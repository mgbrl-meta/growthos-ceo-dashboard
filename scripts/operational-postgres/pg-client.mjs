import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import pg from 'pg';

const { Pool } = pg;

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function loadGrowthOsEnv(repoRoot = process.cwd()) {
  loadEnvFile(path.join(repoRoot, '.env.local'));
  loadEnvFile(path.join(repoRoot, '.env'));
}

export function ensureAdcCredentialFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const clientEmail = String(process.env.GCP_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.GCP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const projectId = String(process.env.GCP_PROJECT_ID || process.env.BQ_PROJECT_ID || '').trim();
  if (!clientEmail || !privateKey || !projectId) return;

  const credentialPath = path.join(os.tmpdir(), 'growthos-gcp-service-account.json');
  if (!fs.existsSync(credentialPath)) {
    fs.writeFileSync(
      credentialPath,
      JSON.stringify({
        type: 'service_account',
        project_id: projectId,
        private_key_id: 'runtime',
        private_key: privateKey,
        client_email: clientEmail,
        client_id: '',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: '',
        universe_domain: 'googleapis.com',
      }),
      { mode: 0o600 }
    );
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialPath;
}

async function resolvePassword() {
  const direct = String(process.env.GROWTHOS_PG_PASSWORD || '');
  if (direct) return direct;

  ensureAdcCredentialFile();
  const projectId = String(process.env.GCP_PROJECT_ID || process.env.BQ_PROJECT_ID || '').trim();
  const secretId = String(process.env.GROWTHOS_PG_PASSWORD_SECRET || 'growthos-postgres-password').trim();
  if (!projectId || !secretId) throw new Error('GROWTHOS_PG_PASSWORD_OR_SECRET_REQUIRED');

  const client = new SecretManagerServiceClient({ projectId });
  const name = secretId.startsWith('projects/')
    ? `${secretId}/versions/latest`
    : `projects/${projectId}/secrets/${secretId}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  const value = version?.payload?.data?.toString() || '';
  if (!value) throw new Error('GROWTHOS_PG_PASSWORD_SECRET_EMPTY');
  return value;
}

export async function createGrowthOsPgPool() {
  ensureAdcCredentialFile();

  const host = String(process.env.GROWTHOS_PG_HOST || '').trim();
  const instanceConnectionName = String(process.env.GROWTHOS_PG_INSTANCE_CONNECTION_NAME || '').trim();
  const user = String(process.env.GROWTHOS_PG_USER || 'growthos_app').trim();
  const database = String(process.env.GROWTHOS_PG_DATABASE || 'growthos').trim();
  const password = await resolvePassword();
  const max = Math.max(1, Number(process.env.GROWTHOS_PG_POOL_MAX || 5));

  const common = {
    user,
    password,
    database,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
    application_name: 'growthos-postgres-tools',
  };

  if (host) {
    return {
      pool: new Pool({
        ...common,
        host,
        port: Number(process.env.GROWTHOS_PG_PORT || 5432),
        ssl: String(process.env.GROWTHOS_PG_SSL || 'true').toLowerCase() === 'false'
          ? undefined
          : { rejectUnauthorized: false },
      }),
      close: async () => {
        await pool.end();
      },
    };
  }

  if (!instanceConnectionName) throw new Error('GROWTHOS_PG_INSTANCE_CONNECTION_NAME_MISSING');
  const connector = new Connector();
  const options = await connector.getOptions({
    instanceConnectionName,
    ipType: String(process.env.GROWTHOS_PG_IP_TYPE || 'PUBLIC').toUpperCase() === 'PRIVATE'
      ? IpAddressTypes.PRIVATE
      : IpAddressTypes.PUBLIC,
  });
  const pool = new Pool({ ...options, ...common });
  return {
    pool,
    close: async () => {
      await pool.end();
      connector.close();
    },
  };
}
