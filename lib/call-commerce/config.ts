export const CALL_COMMERCE_DATASET =
  process.env.GROWTHOS_CALL_COMMERCE_DATASET || 'growthos_call_commerce';

export const CALL_COMMERCE_LOCATION =
  process.env.GCP_BQ_LOCATION || 'asia-south1';

export const CALL_COMMERCE_MODULE_ID = 'call-commerce';

export const CALL_COMMERCE_SUBMODULES = {
  summary: 'summary',
  calls: 'calls',
  metaEvents: 'meta-events',
  archive: 'archive',
  reports: 'reports',
  systemStatus: 'system-status',
  settings: 'settings',
} as const;

export const CALL_COMMERCE_DEFAULTS = {
  contactMinDurationSeconds: 20,
  generalArchiveDays: 30,
  terminalArchiveDays: 3,
  reopenGraceMinutes: 30,
  metaMaxAttempts: 3,
  metaRetryDelayMinutes: 60,
} as const;
