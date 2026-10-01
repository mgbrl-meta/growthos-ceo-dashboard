import 'server-only';

const inferredProjectId = String(
  process.env.GCP_PROJECT_ID || process.env.BQ_PROJECT_ID || ''
).trim();
const inferredRegion = String(process.env.GROWTHOS_PG_REGION || 'asia-south1').trim();
const inferredInstanceName = String(
  process.env.GROWTHOS_PG_INSTANCE_NAME || 'growthos-operational'
).trim();
const inferredConnectionName = inferredProjectId
  ? `${inferredProjectId}:${inferredRegion}:${inferredInstanceName}`
  : '';

export const OPERATIONAL_POSTGRES = {
  instanceConnectionName: String(
    process.env.GROWTHOS_PG_INSTANCE_CONNECTION_NAME || inferredConnectionName
  ).trim(),
  host: String(process.env.GROWTHOS_PG_HOST || '').trim(),
  port: Number(process.env.GROWTHOS_PG_PORT || 5432),
  database: String(process.env.GROWTHOS_PG_DATABASE || 'growthos').trim(),
  user: String(process.env.GROWTHOS_PG_USER || 'growthos_app').trim(),
  password: String(process.env.GROWTHOS_PG_PASSWORD || ''),
  passwordSecret: String(process.env.GROWTHOS_PG_PASSWORD_SECRET || 'growthos-postgres-password').trim(),
  ipType: String(process.env.GROWTHOS_PG_IP_TYPE || 'PUBLIC').trim().toUpperCase(),
  maxConnections: Math.max(1, Number(process.env.GROWTHOS_PG_POOL_MAX || 3)),
  idleTimeoutMs: Math.max(1_000, Number(process.env.GROWTHOS_PG_IDLE_TIMEOUT_MS || 30_000)),
  connectionTimeoutMs: Math.max(1_000, Number(process.env.GROWTHOS_PG_CONNECTION_TIMEOUT_MS || 15_000)),
  statementTimeoutMs: Math.max(1_000, Number(process.env.GROWTHOS_PG_STATEMENT_TIMEOUT_MS || 30_000)),
};

export function isOperationalPostgresConfigured() {
  return Boolean(
    OPERATIONAL_POSTGRES.host ||
    OPERATIONAL_POSTGRES.instanceConnectionName
  );
}
