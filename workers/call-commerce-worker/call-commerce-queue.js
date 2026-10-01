import crypto from 'crypto';

import {
  PubSub,
} from '@google-cloud/pubsub';


const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || ''
  ).trim();


const TOPIC =
  String(
    process.env.GROWTHOS_CALL_COMMERCE_TOPIC
    || 'growthos-call-commerce-events'
  ).trim();


if (!PROJECT_ID) {
  throw new Error('CALL_COMMERCE_QUEUE_PROJECT_MISSING');
}


const pubsub =
  new PubSub({
    projectId: PROJECT_ID,
  });


async function enqueueFlushJob(jobType, workspaceId, brandId) {
  const prefix = jobType === 'analytics_flush' ? 'cca' : 'ccm';
  const jobId = `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;

  const payload = {
    version: 1,
    jobType,
    jobId,
    requestedAt: new Date().toISOString(),
    workspaceId,
    brandId,
  };

  const messageId = await pubsub
    .topic(TOPIC)
    .publishMessage({
      data: Buffer.from(JSON.stringify(payload), 'utf8'),
      attributes: {
        job_type: jobType,
        workspace_id: String(workspaceId),
        brand_id: String(brandId),
        job_id: jobId,
      },
    });

  return { jobId, messageId };
}

export function enqueueMetaFlush(workspaceId, brandId) {
  return enqueueFlushJob('meta_flush', workspaceId, brandId);
}

export function enqueueAnalyticsFlush(workspaceId, brandId) {
  return enqueueFlushJob('analytics_flush', workspaceId, brandId);
}
