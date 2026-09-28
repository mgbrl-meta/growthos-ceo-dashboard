import 'server-only';

import crypto from 'crypto';

import {
  publishJsonMessage,
} from '@/lib/queue/pubsub';

import {
  META_EVENTS_TOPIC,
} from './config';

import type {
  MetaEventsSourceJob,
} from './types';

type MetaEventsPublishInput =
  Omit<
    MetaEventsSourceJob,
    'version' | 'jobType' | 'eventVersion'
  >
  & {
    eventVersion?: number;
  };

export function buildMetaSourceEventId(
  prefix: string,
  parts: Array<
    string | number | null | undefined
  >
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

export async function emitMetaSourceEvent(
  input: MetaEventsPublishInput
) {
  const eventVersion =
    Number(
      input.eventVersion
      ??
      1
    );

  if (
    !Number.isInteger(
      eventVersion
    )
    ||
    eventVersion < 1
  ) {
    throw new Error(
      'META_EVENTS_EVENT_VERSION_INVALID'
    );
  }

  const job: MetaEventsSourceJob = {
    version:
      1,

    jobType:
      'source_event',

    ...input,

    eventVersion,
  };

  return publishJsonMessage({
    topic:
      META_EVENTS_TOPIC,

    payload:
      job,

    attributes: {
      job_type:
        'source_event',

      event_version:
        String(
          eventVersion
        ),

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      source:
        input.source,

      source_event:
        input.sourceEvent,

      source_event_id:
        input.sourceEventId,
    },
  });
}