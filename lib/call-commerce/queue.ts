import 'server-only';

import crypto from 'crypto';
import { publishJsonMessage } from '@/lib/queue/pubsub';

export const CALL_COMMERCE_TOPIC = String(
  process.env.GROWTHOS_CALL_COMMERCE_TOPIC || 'growthos-call-commerce-events'
).trim();

export type CallCommerceCallEventJob = {
  version: 1;
  jobType: 'call_event';
  deliveryId: string;
  acceptedAt: string;
  connectionId: string;
  workspaceId: string;
  brandId: string;
  providerKey: string;
  mappingVersionId: string;
  payload: unknown;
};

export type CallCommerceMetaFlushJob = {
  version: 1;
  jobType: 'meta_flush';
  jobId: string;
  requestedAt: string;
  workspaceId: string;
  brandId: string;
};

export type CallCommerceJob = CallCommerceCallEventJob | CallCommerceMetaFlushJob;

export function newCallDeliveryId() {
  return `cce_${crypto.randomUUID().replace(/-/g, '')}`;
}

export async function enqueueCallCommerceJob(job: CallCommerceJob) {
  return publishJsonMessage({
    topic: CALL_COMMERCE_TOPIC,
    payload: job,
    attributes: {
      job_type: job.jobType,
      workspace_id: job.workspaceId,
      brand_id: job.brandId,
      ...(job.jobType === 'call_event'
        ? { connection_id: job.connectionId, delivery_id: job.deliveryId }
        : { job_id: job.jobId }),
    },
  });
}

export async function enqueueCallingEvent(input: Omit<CallCommerceCallEventJob, 'version' | 'jobType'>) {
  return enqueueCallCommerceJob({
    version: 1,
    jobType: 'call_event',
    ...input,
  });
}

export async function enqueueMetaFlush(workspaceId: string, brandId: string) {
  return enqueueCallCommerceJob({
    version: 1,
    jobType: 'meta_flush',
    jobId: `ccm_${crypto.randomUUID().replace(/-/g, '')}`,
    requestedAt: new Date().toISOString(),
    workspaceId,
    brandId,
  });
}
