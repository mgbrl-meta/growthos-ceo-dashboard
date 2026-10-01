import 'server-only';

export type OperationalStore = 'postgres' | 'bigquery';

export function getCallCommerceStore(): OperationalStore {
  return String(process.env.GROWTHOS_CALL_COMMERCE_STORE || 'postgres')
    .trim()
    .toLowerCase() === 'postgres'
    ? 'postgres'
    : 'bigquery';
}

export function isCallCommercePostgres() {
  return getCallCommerceStore() === 'postgres';
}
