import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { OPERATIONAL_POSTGRES, isOperationalPostgresConfigured } from './config';

let poolPromise: Promise<Pool> | null = null;
let connector: Connector | null = null;
let passwordPromise: Promise<string> | null = null;

function ensureAdcCredentialFile() {
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

async function readPasswordFromSecretManager() {
  if (OPERATIONAL_POSTGRES.password) return OPERATIONAL_POSTGRES.password;
  if (!OPERATIONAL_POSTGRES.passwordSecret) {
    throw new Error('GROWTHOS_PG_PASSWORD_OR_SECRET_REQUIRED');
  }

  ensureAdcCredentialFile();

  const projectId = String(process.env.GCP_PROJECT_ID || process.env.BQ_PROJECT_ID || '').trim();
  if (!projectId) throw new Error('GROWTHOS_PG_SECRET_PROJECT_MISSING');

  const client = new SecretManagerServiceClient({ projectId });
  const secretName = OPERATIONAL_POSTGRES.passwordSecret.startsWith('projects/')
    ? OPERATIONAL_POSTGRES.passwordSecret
    : `projects/${projectId}/secrets/${OPERATIONAL_POSTGRES.passwordSecret}`;

  const [version] = await client.accessSecretVersion({
    name: `${secretName}/versions/latest`,
  });

  const value = version?.payload?.data?.toString() || '';
  if (!value) throw new Error('GROWTHOS_PG_PASSWORD_SECRET_EMPTY');
  return value;
}

async function getPassword() {
  if (!passwordPromise) passwordPromise = readPasswordFromSecretManager();
  return passwordPromise;
}

async function buildPool() {
  if (!isOperationalPostgresConfigured()) {
    throw new Error('GROWTHOS_OPERATIONAL_POSTGRES_NOT_CONFIGURED');
  }

  const password = await getPassword();

  const common = {
    user: OPERATIONAL_POSTGRES.user,
    password,
    database: OPERATIONAL_POSTGRES.database,
    max: OPERATIONAL_POSTGRES.maxConnections,
    idleTimeoutMillis: OPERATIONAL_POSTGRES.idleTimeoutMs,
    connectionTimeoutMillis: OPERATIONAL_POSTGRES.connectionTimeoutMs,
    statement_timeout: OPERATIONAL_POSTGRES.statementTimeoutMs,
    application_name: 'growthos-dashboard',
  };

  if (OPERATIONAL_POSTGRES.host) {
    return new Pool({
      ...common,
      host: OPERATIONAL_POSTGRES.host,
      port: OPERATIONAL_POSTGRES.port,
      ssl:
        String(process.env.GROWTHOS_PG_SSL || 'true').toLowerCase() === 'false'
          ? undefined
          : { rejectUnauthorized: false },
    });
  }

  ensureAdcCredentialFile();
  connector ||= new Connector();

  const connectorOptions = await connector.getOptions({
    instanceConnectionName: OPERATIONAL_POSTGRES.instanceConnectionName,
    ipType:
      OPERATIONAL_POSTGRES.ipType === 'PRIVATE'
        ? IpAddressTypes.PRIVATE
        : IpAddressTypes.PUBLIC,
  });

  return new Pool({
    ...connectorOptions,
    ...common,
  });
}

export async function getOperationalPostgresPool() {
  if (!poolPromise) poolPromise = buildPool();
  return poolPromise;
}

export async function pgQuery<T extends QueryResultRow = any>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  const pool = await getOperationalPostgresPool();
  return pool.query<T>(text, values as any[]);
}

export async function withPgTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = await getOperationalPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

export async function operationalPostgresHealth() {
  const startedAt = Date.now();
  const result = await pgQuery<{ now: string; database_name: string; user_name: string }>(
    `SELECT NOW()::text AS now, current_database() AS database_name, current_user AS user_name`
  );

  return {
    ok: true,
    latencyMs: Date.now() - startedAt,
    ...result.rows[0],
  };
}
