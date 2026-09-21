import crypto from 'crypto';

import {
  BigQuery,
} from '@google-cloud/bigquery';

import {
  SecretManagerServiceClient,
} from '@google-cloud/secret-manager';


const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || ''
  ).trim();


const DATASET_ID =
  String(
    process.env.GROWTHOS_CALL_COMMERCE_DATASET
    || 'growthos_call_commerce'
  ).trim();


const CONTROL_DATASET =
  String(
    process.env.GROWTHOS_CONTROL_DATASET
    || 'growthos_control'
  ).trim();


const LOCATION =
  String(
    process.env.GROWTHOS_CALL_COMMERCE_LOCATION
    || process.env.GCP_BQ_LOCATION
    || 'asia-south1'
  ).trim();


const META_MAX_ATTEMPTS =
  Number(
    process.env.CALL_COMMERCE_META_MAX_ATTEMPTS
    || 3
  );


const META_RETRY_DELAY_MINUTES =
  Number(
    process.env.CALL_COMMERCE_META_RETRY_DELAY_MINUTES
    || 60
  );


if (!PROJECT_ID) {
  throw new Error('CALL_COMMERCE_META_PROJECT_MISSING');
}


const bigquery =
  new BigQuery({
    projectId: PROJECT_ID,
  });


const secretManager =
  new SecretManagerServiceClient({
    projectId: PROJECT_ID,
  });


const table =
  name =>
    `\`${PROJECT_ID}.${DATASET_ID}.${name}\``;


const controlTable =
  name =>
    `\`${PROJECT_ID}.${CONTROL_DATASET}.${name}\``;


function sha(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || '').trim().toLowerCase())
    .digest('hex');
}


function readJson(value, fallback) {
  if (value === null || value === undefined) return fallback;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value;
}

function nullableString(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}


async function getMetaEventsConnection(workspaceId, brandId) {
  const [rows] =
    await bigquery.query({
      location: LOCATION,
      query: `
        SELECT
          connection_id,
          workspace_id,
          brand_id,
          provider,
          status,
          provider_account_id,
          secret_name
        FROM ${controlTable('integration_connections')}
        WHERE workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND provider='meta_events'
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      params: {
        workspace_id: workspaceId,
        brand_id: brandId,
      },
    });

  return rows?.[0] || null;
}


async function readSecret(secretName) {
  if (!secretName) {
    throw new Error('META_EVENTS_SECRET_NAME_MISSING');
  }

  const [version] =
    await secretManager.accessSecretVersion({
      name: `${secretName}/versions/latest`,
    });

  const raw = version?.payload?.data?.toString();

  if (!raw) {
    throw new Error('META_EVENTS_SECRET_EMPTY');
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('META_EVENTS_SECRET_INVALID_JSON');
  }
}


export async function processMetaQueue(workspaceId, brandId) {
  const connection =
    await getMetaEventsConnection(
      workspaceId,
      brandId
    );

  if (
    !connection
    || String(connection.status || '').toLowerCase() !== 'connected'
    || !connection.secret_name
    || !connection.provider_account_id
  ) {
    return {
      processed: 0,
      skipped: 'META_EVENTS_NOT_CONNECTED',
    };
  }

  const secret =
    await readSecret(
      connection.secret_name
    );

  const token =
    String(
      secret?.access_token
      || ''
    ).trim();

  if (!token) {
    throw new Error('META_EVENTS_ACCESS_TOKEN_MISSING');
  }

  const [rows] =
    await bigquery.query({
      location: LOCATION,
      query: `
        SELECT *
        FROM ${table('meta_event_queue')}
        WHERE workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND status IN ('PENDING','RETRY')
          AND (
            next_attempt_at IS NULL
            OR next_attempt_at<=CURRENT_TIMESTAMP()
          )
        ORDER BY created_at ASC
        LIMIT 100
      `,
      params: {
        workspace_id: workspaceId,
        brand_id: brandId,
      },
    });

  let processed = 0;

  for (const row of rows || []) {
    const payload = readJson(row.payload, {});
    const phone = String(payload.phone || '').replace(/\D/g, '');
    const email = String(payload.email || '').trim().toLowerCase();
    const eventTime = Math.floor(Date.now() / 1000);

    const body = {
      data: [
        {
          event_name: row.event_name,
          event_time: eventTime,
          event_id: row.event_id,
          action_source: 'phone_call',
          user_data: {
            external_id: [sha(String(row.lead_id))],
            ...(phone ? { ph: [sha(phone)] } : {}),
            ...(email ? { em: [sha(email)] } : {}),
          },
          custom_data: {
            ...payload,
            lead_type: 'call',
            source_module: 'call_commerce',
          },
        },
      ],
    };

    const url =
      `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || 'v24.0'}`
      + `/${encodeURIComponent(connection.provider_account_id)}/events`
      + `?access_token=${encodeURIComponent(token)}`;

    let ok = false;
    let status = 0;
    let responsePayload = null;
    let errorMessage = null;

    try {
      const response =
        await fetch(
          url,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify(body),
          }
        );

      status = response.status;

      const text = await response.text();

      try {
        responsePayload = JSON.parse(text);
      } catch {
        responsePayload = {
          raw: text.slice(0, 2000),
        };
      }

      ok = response.ok && !responsePayload?.error;

      if (!ok) {
        errorMessage =
          responsePayload?.error?.message
          || `Meta HTTP ${status}`;
      }
    } catch (error) {
      errorMessage =
        error?.message
        || 'Meta request failed';
    }

    await bigquery.query({
      location: LOCATION,
      query: `
        INSERT INTO ${table('meta_event_log')} (
          log_id,
          workspace_id,
          brand_id,
          lead_id,
          call_id,
          event_key,
          event_name,
          event_id,
          request_payload,
          response_payload,
          success,
          http_status,
          error,
          sent_at
        ) VALUES (
          @log_id,
          @workspace_id,
          @brand_id,
          @lead_id,
          NULLIF(@call_id,''),
          @event_key,
          @event_name,
          @event_id,
          PARSE_JSON(@request_payload),
          PARSE_JSON(@response_payload),
          @success,
          NULLIF(@http_status,0),
          NULLIF(@error,''),
          CURRENT_TIMESTAMP()
        )
      `,
      params: {
        log_id: `mel_${crypto.randomUUID().replace(/-/g, '')}`,
        workspace_id: workspaceId,
        brand_id: brandId,
        lead_id: row.lead_id,
        call_id: nullableString(row.call_id),
        event_key: row.event_key,
        event_name: row.event_name,
        event_id: row.event_id,
        request_payload: JSON.stringify(body),
        response_payload: JSON.stringify(responsePayload || {}),
        success: ok,
        http_status: status || 0,
        error: nullableString(errorMessage),
      },
    });

    const attempts = Number(row.attempts || 0) + 1;

    const nextStatus =
      ok
        ? 'SUCCESS'
        : attempts >= META_MAX_ATTEMPTS
          ? 'NEEDS_ATTENTION'
          : 'RETRY';

    await bigquery.query({
      location: LOCATION,
      query: `
        UPDATE ${table('meta_event_queue')}
        SET
          status=@status,
          attempts=@attempts,
          last_error=NULLIF(@last_error,''),
          next_attempt_at=IF(
            @status='RETRY',
            TIMESTAMP_ADD(
              CURRENT_TIMESTAMP(),
              INTERVAL ${META_RETRY_DELAY_MINUTES} MINUTE
            ),
            NULL
          ),
          updated_at=CURRENT_TIMESTAMP()
        WHERE queue_id=@queue_id
      `,
      params: {
        status: nextStatus,
        attempts,
        last_error: nullableString(errorMessage),
        queue_id: row.queue_id,
      },
    });

    processed += 1;
  }

  return {
    processed,
  };
}
