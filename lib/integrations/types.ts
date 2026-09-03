export type IntegrationProviderId =
  | 'shopify'
  | 'meta_ads'
  | 'google_ads'
  | 'bigquery';


export type IntegrationCategory =
  | 'commerce'
  | 'advertising'
  | 'warehouse';


export type IntegrationAuthType =
  | 'oauth'
  | 'shopify_oauth'
  | 'service_account'
  | 'internal';


export type IntegrationStatus =
  | 'connected'
  | 'not_connected'
  | 'syncing'
  | 'needs_attention'
  | 'authentication_expired'
  | 'failed';


export type IntegrationProvider = {

  id:
    IntegrationProviderId;

  name:
    string;

  shortName:
    string;

  description:
    string;

  category:
    IntegrationCategory;

  authType:
    IntegrationAuthType;

  capabilities:
    string[];

  status:
    IntegrationStatus;

  accountName?:
    string | null;

  accountId?:
    string | null;

  lastSyncAt?:
    string | null;

  nextSyncAt?:
    string | null;

  error?:
    string | null;

  connectionManaged:
    boolean;

};