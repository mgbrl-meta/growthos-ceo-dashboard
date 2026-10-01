import {
  Connector,
  IpAddressTypes,
} from '@google-cloud/cloud-sql-connector';

import pg from 'pg';

const { Pool } = pg;

const INSTANCE_CONNECTION_NAME = String(
  process.env.GROWTHOS_PG_INSTANCE_CONNECTION_NAME || ''
).trim();

const HOST = String(
  process.env.GROWTHOS_PG_HOST || ''
).trim();

const PORT = Number(
  process.env.GROWTHOS_PG_PORT || 5432
);

const DATABASE = String(
  process.env.GROWTHOS_PG_DATABASE || 'growthos'
).trim();

const USER = String(
  process.env.GROWTHOS_PG_USER || 'growthos_app'
).trim();

const PASSWORD = String(
  process.env.GROWTHOS_PG_PASSWORD || ''
);

const IP_TYPE = String(
  process.env.GROWTHOS_PG_IP_TYPE || 'PUBLIC'
).trim().toUpperCase();

const POOL_MAX = Math.max(
  1,
  Number(process.env.GROWTHOS_PG_POOL_MAX || 10)
);

if (!PASSWORD) {
  throw new Error('GROWTHOS_PG_PASSWORD_MISSING');
}

if (!HOST && !INSTANCE_CONNECTION_NAME) {
  throw new Error('GROWTHOS_PG_CONNECTION_MISSING');
}

let poolPromise = null;
let connector = null;

async function buildPool() {
  const common = {
    user: USER,
    password: PASSWORD,
    database: DATABASE,
    max: POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
    application_name: 'growthos-call-commerce-worker',
  };

  if (HOST) {
    return new Pool({
      ...common,
      host: HOST,
      port: PORT,
      ssl:
        String(process.env.GROWTHOS_PG_SSL || 'true').toLowerCase() === 'false'
          ? undefined
          : { rejectUnauthorized: false },
    });
  }

  connector ||= new Connector();

  const connectorOptions = await connector.getOptions({
    instanceConnectionName: INSTANCE_CONNECTION_NAME,
    ipType:
      IP_TYPE === 'PRIVATE'
        ? IpAddressTypes.PRIVATE
        : IpAddressTypes.PUBLIC,
  });

  return new Pool({
    ...connectorOptions,
    ...common,
  });
}

export async function getPgPool() {
  if (!poolPromise) {
    poolPromise = buildPool();
  }

  return poolPromise;
}

export async function pgQuery(text, values = []) {
  const pool = await getPgPool();
  return pool.query(text, values);
}

export async function pgTransaction(fn) {
  const pool = await getPgPool();
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

export function getPostgresConfig() {
  return {
    instanceConnectionName: INSTANCE_CONNECTION_NAME || null,
    host: HOST || null,
    database: DATABASE,
    user: USER,
    ipType: IP_TYPE,
    poolMax: POOL_MAX,
  };
}
