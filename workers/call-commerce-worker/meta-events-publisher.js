import crypto from 'crypto';

import {
  PubSub,
} from '@google-cloud/pubsub';

const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    ||
    process.env.GOOGLE_CLOUD_PROJECT
    ||
    ''
  ).trim();

const TOPIC =
  String(
    process.env.GROWTHOS_META_EVENTS_TOPIC
    ||
    'growthos-meta-events'
  ).trim();

if (!PROJECT_ID) {
  throw new Error(
    'META_EVENTS_PUBLISHER_PROJECT_MISSING'
  );
}

const pubsub =
  new PubSub({
    projectId:
      PROJECT_ID,
  });

export function buildMetaSourceEventId(
  prefix,
  parts
) {
  return `${prefix}_${crypto
    .createHash('sha256')
    .update(
      parts
        .map(
          value =>
            String(
              value
              ??
              ''
            )
        )
        .join(':')
    )
    .digest('hex')
    .slice(0, 32)}`;
}

export async function publishMetaSourceEvent(
  input
) {
  const job = {
    version:
      1,
    jobType:
      'source_event',
    ...input,
  };

  const messageId =
    await pubsub
      .topic(
        TOPIC
      )
      .publishMessage({
        data:
          Buffer.from(
            JSON.stringify(
              job
            ),
            'utf8'
          ),
        attributes: {
          job_type:
            'source_event',
          workspace_id:
            String(
              input.workspaceId
            ),
          brand_id:
            String(
              input.brandId
            ),
          source:
            String(
              input.source
            ),
          source_event:
            String(
              input.sourceEvent
            ),
          source_event_id:
            String(
              input.sourceEventId
            ),
        },
      });

  return {
    messageId,
  };
}
