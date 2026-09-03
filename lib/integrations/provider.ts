// ============================================================
// GROWTH OS INTEGRATION PROVIDER CONTRACT
//
// Every external data source must implement this contract.
//
// Examples:
// - Meta Ads
// - Google Ads
// - Shopify
// - Amazon
// - Klaviyo
//
// Authentication method can change later without changing
// the rest of Growth OS.
// ============================================================


export type ProviderConnectionMode =
  | 'legacy'
  | 'oauth'
  | 'api_key'
  | 'service_account'
  | 'native';


export type ProviderHealthStatus =
  | 'healthy'
  | 'warning'
  | 'failed'
  | 'not_connected';


export type SyncType =
  | 'backfill'
  | 'incremental'
  | 'recovery'
  | 'manual';


export type SyncStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'partial';


export type ProviderAccount = {

  providerAccountId: string;

  providerAccountName: string;

  accountType?: string | null;

  currency?: string | null;

  timezone?: string | null;

  metadata?: Record<string, any>;

};


export type ProviderHealth = {

  provider: string;

  status: ProviderHealthStatus;

  message?: string | null;

  latestSourceTimestamp?: string | null;

  lastSuccessfulSync?: string | null;

  lagSeconds?: number | null;

  details?: Record<string, any>;

};


export type SyncContext = {

  workspaceId: string;

  brandId: string;

  connectionId: string;

  providerAccountId?: string | null;

  entity: string;

  syncType: SyncType;

  startDate?: string | null;

  endDate?: string | null;

  cursor?: string | null;

};


export type SyncResult = {

  status: SyncStatus;

  recordsFetched: number;

  recordsLoaded: number;

  recordsRejected: number;

  cursorBefore?: string | null;

  cursorAfter?: string | null;

  latestSourceTimestamp?: string | null;

  metadata?: Record<string, any>;

};


export interface IntegrationProvider {

  // ==========================================================
  // IDENTITY
  // ==========================================================

  id: string;

  name: string;

  connectionModes:
    ProviderConnectionMode[];


  // ==========================================================
  // ENTITIES
  //
  // Example:
  //
  // Meta:
  // campaigns, adsets, ads, creatives
  //
  // Shopify:
  // orders, customers, products
  // ==========================================================

  entities: string[];


  // ==========================================================
  // CONNECTION
  // ==========================================================

  testConnection(
    workspaceId: string,
    brandId: string,
    connectionId: string
  ): Promise<ProviderHealth>;


  // ==========================================================
  // ACCOUNT DISCOVERY
  // ==========================================================

  discoverAccounts(
    workspaceId: string,
    brandId: string,
    connectionId: string
  ): Promise<ProviderAccount[]>;


  // ==========================================================
  // DATA SYNCHRONIZATION
  // ==========================================================

  sync(
    context: SyncContext
  ): Promise<SyncResult>;


  // ==========================================================
  // INITIAL HISTORY
  // ==========================================================

  backfill(
    context: SyncContext
  ): Promise<SyncResult>;

}