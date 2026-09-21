import express from 'express';

import {
  normalizeCallingPayload,
  readJson,
} from './call-commerce-mapping.js';

import {
  beginRawEventDelivery,
  finalizeRawEventDelivery,
  getCallCommerceConfig,
  ingestCanonicalEvent,
  markCallingConnectionProcessingResult,
  resolveCallingContext,
} from './call-commerce-repository.js';

import {
  processMetaQueue,
} from './call-commerce-meta-worker.js';

import {
  enqueueMetaFlush,
} from './call-commerce-queue.js';


// ============================================================
// APP
// ============================================================

const app = express();


app.use(
  express.json({
    limit: '10mb',
  })
);


const PORT =
  Number(
    process.env.PORT
    || 8080
  );


// ============================================================
// HEALTH
// ============================================================

app.get(
  '/health',
  (_req, res) => {
    return res
      .status(200)
      .json({
        ok: true,
        service: 'growthos-call-commerce-worker',
        config: getCallCommerceConfig(),
      });
  }
);


// ============================================================
// REQUIRED STRING
// ============================================================

function requireString(value, errorCode) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    throw new Error(errorCode);
  }

  return normalized;
}


// ============================================================
// PUB/SUB DECODE
// ============================================================

function decodePubSubData(encodedData) {
  const encoded =
    requireString(
      encodedData,
      'PUBSUB_DATA_MISSING'
    );

  try {
    return JSON.parse(
      Buffer
        .from(encoded, 'base64')
        .toString('utf8')
    );
  } catch {
    throw new Error('PUBSUB_DATA_INVALID');
  }
}


// ============================================================
// VALIDATE JOB
// ============================================================

function validateCallCommerceMessage(payload) {
  if (
    !payload
    || typeof payload !== 'object'
    || Array.isArray(payload)
  ) {
    throw new Error('CALL_COMMERCE_JOB_INVALID');
  }

  if (Number(payload.version) !== 1) {
    throw new Error('CALL_COMMERCE_JOB_VERSION_UNSUPPORTED');
  }

  const jobType =
    requireString(
      payload.jobType,
      'CALL_COMMERCE_JOB_TYPE_MISSING'
    );

  if (!['call_event', 'meta_flush'].includes(jobType)) {
    throw new Error('CALL_COMMERCE_JOB_TYPE_UNSUPPORTED');
  }

  const workspaceId =
    requireString(
      payload.workspaceId,
      'CALL_COMMERCE_JOB_WORKSPACE_MISSING'
    );

  const brandId =
    requireString(
      payload.brandId,
      'CALL_COMMERCE_JOB_BRAND_MISSING'
    );

  if (jobType === 'meta_flush') {
    return {
      version: 1,
      jobType,
      jobId:
        requireString(
          payload.jobId,
          'CALL_COMMERCE_META_JOB_ID_MISSING'
        ),
      requestedAt: payload.requestedAt ?? null,
      workspaceId,
      brandId,
    };
  }

  const acceptedAtCandidate =
    String(payload.acceptedAt || '').trim();

  const acceptedAt =
    Number.isFinite(Date.parse(acceptedAtCandidate))
      ? new Date(acceptedAtCandidate).toISOString()
      : null;

  return {
    version: 1,
    jobType,
    deliveryId:
      requireString(
        payload.deliveryId,
        'CALL_COMMERCE_DELIVERY_ID_MISSING'
      ),
    acceptedAt,
    connectionId:
      requireString(
        payload.connectionId,
        'CALL_COMMERCE_CONNECTION_ID_MISSING'
      ),
    workspaceId,
    brandId,
    providerKey:
      requireString(
        payload.providerKey,
        'CALL_COMMERCE_PROVIDER_KEY_MISSING'
      ),
    mappingVersionId:
      requireString(
        payload.mappingVersionId,
        'CALL_COMMERCE_MAPPING_VERSION_MISSING'
      ),
    payload:
      payload.payload
      ?? {},
  };
}


// ============================================================
// CALL EVENT
// ============================================================

async function processCallEvent(job, message) {
  const publishTimeCandidate =
    String(
      message?.publishTime
      || message?.publish_time
      || ''
    ).trim();

  const acceptedAt =
    job.acceptedAt
    || (
      Number.isFinite(Date.parse(publishTimeCandidate))
        ? new Date(publishTimeCandidate).toISOString()
        : new Date().toISOString()
    );

  const messageId =
    String(
      message?.messageId
      || message?.message_id
      || ''
    ).trim()
    || null;

  // Persisted connection + mapping are authoritative for tenant
  // identity and active configuration.
  const context =
    await resolveCallingContext(job);

  let rawEventId = null;

  try {
    rawEventId =
      await beginRawEventDelivery({
        deliveryId: job.deliveryId,
        pubsubMessageId: messageId,
        acceptedAt,
        workspaceId: context.workspace_id,
        brandId: context.brand_id,
        connectionId: context.connection_id,
        providerKey: context.provider_key,
        mappingVersionId: context.active_mapping_version_id,
        payload: job.payload,
      });

    let event;

    try {
      event =
        normalizeCallingPayload({
          workspaceId: context.workspace_id,
          brandId: context.brand_id,
          connectionId: context.connection_id,
          providerKey: context.provider_key,
          payload: job.payload,
          fieldMappings:
            readJson(
              context.field_mappings,
              []
            ),
          valueMappings:
            readJson(
              context.value_mappings,
              []
            ),
        });
    } catch (error) {
      const messageText =
        error?.message
        || 'NORMALIZATION_FAILED';

      await finalizeRawEventDelivery({
        rawEventId,
        status: 'failed',
        error: messageText,
      });

      await markCallingConnectionProcessingResult({
        connectionId: context.connection_id,
        acceptedAt,
        success: false,
        error: messageText,
      });

      console.error(
        'CALL_COMMERCE_NORMALIZATION_FAILED',
        {
          deliveryId: job.deliveryId,
          pubsubMessageId: messageId,
          connectionId: context.connection_id,
          workspaceId: context.workspace_id,
          brandId: context.brand_id,
          error: messageText,
        }
      );

      // Permanent mapping/input failure. Raw provider truth is
      // preserved; ACK so Pub/Sub does not retry forever.
      return {
        acknowledged: true,
        rawEventId,
        status: 'failed',
      };
    }

    await finalizeRawEventDelivery({
      rawEventId,
      event,
      status:
        event.eventType === 'RINGING'
          ? 'raw_only'
          : 'processing',
      error: null,
    });

    if (event.eventType === 'RINGING') {
      await markCallingConnectionProcessingResult({
        connectionId: context.connection_id,
        acceptedAt,
        success: true,
      });

      return {
        acknowledged: true,
        rawOnly: true,
        rawEventId,
      };
    }

    const data =
      await ingestCanonicalEvent(
        event,
        'calling-cloud-run'
      );

    await finalizeRawEventDelivery({
      rawEventId,
      event,
      status: 'processed',
      error: null,
    });

    await markCallingConnectionProcessingResult({
      connectionId: context.connection_id,
      acceptedAt,
      success: true,
    });

    // Meta is intentionally a second queue hop. Meta outages
    // must never hold up call ingestion.
    try {
      await enqueueMetaFlush(
        context.workspace_id,
        context.brand_id
      );
    } catch (error) {
      console.error(
        'CALL_COMMERCE_META_ENQUEUE_FAILED',
        {
          workspaceId: context.workspace_id,
          brandId: context.brand_id,
          error:
            error?.message
            || 'META_ENQUEUE_FAILED',
        }
      );
    }

    return {
      acknowledged: true,
      rawEventId,
      data,
    };
  } catch (error) {
    const messageText =
      error?.message
      || 'CALL_COMMERCE_CALL_JOB_FAILED';

    if (rawEventId) {
      try {
        await finalizeRawEventDelivery({
          rawEventId,
          status: 'retry',
          error: messageText,
        });
      } catch (finalizeError) {
        console.error(
          'CALL_COMMERCE_RAW_FINALIZE_FAILED',
          {
            rawEventId,
            error:
              finalizeError?.message
              || 'RAW_FINALIZE_FAILED',
          }
        );
      }
    }

    try {
      await markCallingConnectionProcessingResult({
        connectionId: job.connectionId,
        acceptedAt,
        success: false,
        error: messageText,
      });
    } catch (healthError) {
      console.error(
        'CALL_COMMERCE_CONNECTION_HEALTH_FAILED',
        {
          connectionId: job.connectionId,
          error:
            healthError?.message
            || 'CONNECTION_HEALTH_FAILED',
        }
      );
    }

    throw error;
  }
}


// ============================================================
// PUB/SUB CALL COMMERCE WORKER
//
// Cloud Run IAM authenticates Pub/Sub before Express receives
// the request. The application therefore follows the same
// trusted push model as growthos-shopify-sync-worker.
// ============================================================

app.post(
  '/pubsub/call-commerce',
  async (req, res) => {
    const startedAt = Date.now();

    try {
      const message = req.body?.message;

      if (!message) {
        throw new Error('PUBSUB_MESSAGE_MISSING');
      }

      const payload =
        decodePubSubData(
          message.data
        );

      const job =
        validateCallCommerceMessage(
          payload
        );

      if (job.jobType === 'meta_flush') {
        const result =
          await processMetaQueue(
            job.workspaceId,
            job.brandId
          );

        console.log(
          'CALL_COMMERCE_META_FLUSH_COMPLETED',
          {
            pubsubMessageId:
              message.messageId
              ?? null,
            jobId: job.jobId,
            workspaceId: job.workspaceId,
            brandId: job.brandId,
            result,
            durationMs:
              Date.now()
              - startedAt,
          }
        );

        return res
          .status(204)
          .end();
      }

      const result =
        await processCallEvent(
          job,
          message
        );

      console.log(
        'CALL_COMMERCE_EVENT_COMPLETED',
        {
          pubsubMessageId:
            message.messageId
            ?? null,
          deliveryId: job.deliveryId,
          connectionId: job.connectionId,
          workspaceId: job.workspaceId,
          brandId: job.brandId,
          rawEventId:
            result.rawEventId
            ?? null,
          rawOnly:
            Boolean(result.rawOnly),
          durationMs:
            Date.now()
            - startedAt,
        }
      );

      return res
        .status(204)
        .end();
    } catch (error) {
      const messageText =
        String(
          error?.message
          || 'Unknown Call Commerce worker failure'
        );

      console.error(
        'CALL_COMMERCE_WORKER_MESSAGE_FAILED',
        {
          message: messageText,
          durationMs:
            Date.now()
            - startedAt,
        }
      );

      // Non-2xx intentionally asks Pub/Sub to retry transient
      // processing failures.
      return res
        .status(500)
        .json({
          ok: false,
          error: 'CALL_COMMERCE_WORKER_EXECUTION_FAILED',
          message: messageText,
        });
    }
  }
);


// ============================================================
// START
// ============================================================

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      'CALL_COMMERCE_WORKER_READY',
      {
        port: PORT,
        config: getCallCommerceConfig(),
      }
    );
  }
);
