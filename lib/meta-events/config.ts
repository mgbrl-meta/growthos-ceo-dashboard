import 'server-only';

export const META_EVENTS_PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    ||
    process.env.BQ_PROJECT_ID
    ||
    ''
  ).trim();

export const META_EVENTS_DATASET =
  String(
    process.env.GROWTHOS_META_EVENTS_DATASET
    ||
    'growthos_meta_events'
  ).trim();

export const META_EVENTS_LOCATION =
  String(
    process.env.GROWTHOS_META_EVENTS_LOCATION
    ||
    process.env.GCP_BQ_LOCATION
    ||
    'asia-south1'
  ).trim();

export const META_EVENTS_TOPIC =
  String(
    process.env.GROWTHOS_META_EVENTS_TOPIC
    ||
    'growthos-meta-events'
  ).trim();

export const META_EVENTS_DEFAULTS = {
  maxAttempts: 5,
  retryDelaySeconds: 60,
  batchSize: 100,
  defaultActionSource: 'website',
} as const;

export function requireMetaEventsProjectId() {
  if (!META_EVENTS_PROJECT_ID) {
    throw new Error(
      'META_EVENTS_PROJECT_ID_MISSING'
    );
  }

  return META_EVENTS_PROJECT_ID;
}
