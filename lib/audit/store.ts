import 'server-only';

import crypto from 'crypto';

import {
  bigquery,
} from '@/lib/bigquery';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  ||
  process.env.BQ_PROJECT_ID
  ||
  '';


const DATASET_ID =
  process.env.GROWTHOS_CONTROL_DATASET
  ||
  'growthos_control';


const LOCATION =
  process.env.GCP_BQ_LOCATION
  ||
  'asia-south1';


const MAX_JSON_LENGTH =
  24000;


const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|cookie|credential|private[_-]?key|api[_-]?key)/i;


function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Growth OS audit store requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// TYPES
// ============================================================

export type GrowthOSAuditCategory =
  | 'user_access'
  | 'security'
  | 'billing'
  | 'workspace'
  | 'integration'
  | 'system';


export type GrowthOSAuditEventInput = {

  workspaceId:
    string;

  brandId:
    string;

  category:
    GrowthOSAuditCategory;

  action:
    string;

  actorUserId?:
    string | null;

  actorEmail?:
    string | null;

  actorRole?:
    string | null;

  targetType?:
    string | null;

  targetId?:
    string | null;

  targetLabel?:
    string | null;

  before?:
    unknown;

  after?:
    unknown;

  metadata?:
    unknown;

  request?:
    Request | null;

};


export type GrowthOSAuditEvent = {

  eventId:
    string;

  workspaceId:
    string;

  brandId:
    string;

  category:
    string;

  action:
    string;

  actorUserId:
    string | null;

  actorEmail:
    string | null;

  actorRole:
    string | null;

  targetType:
    string | null;

  targetId:
    string | null;

  targetLabel:
    string | null;

  before:
    unknown;

  after:
    unknown;

  metadata:
    unknown;

  ipAddress:
    string | null;

  userAgent:
    string | null;

  createdAt:
    string | null;

};


export type GrowthOSAuditListInput = {

  workspaceId:
    string;

  brandId:
    string;

  startDate?:
    string | null;

  endDate?:
    string | null;

  actorUserId?:
    string | null;

  category?:
    string | null;

  action?:
    string | null;

  page?:
    number;

  pageSize?:
    number;

};


// ============================================================
// SCHEMA BOOTSTRAP
// ============================================================

let auditStoreReady =
  false;


let auditStorePromise:
  Promise<void> | null =
    null;


export async function ensureGrowthOSAuditStore() {

  if (auditStoreReady) {

    return;

  }


  if (auditStorePromise) {

    return auditStorePromise;

  }


  auditStorePromise =
    (async () => {

      const projectId =
        requireProjectId();


      await bigquery.query({

        location:
          LOCATION,

        query: `

          CREATE TABLE IF NOT EXISTS
            \`${projectId}.${DATASET_ID}.audit_events\`
          (

            event_id STRING NOT NULL,
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,
            category STRING NOT NULL,
            action STRING NOT NULL,
            actor_user_id STRING,
            actor_email STRING,
            actor_role STRING,
            target_type STRING,
            target_id STRING,
            target_label STRING,
            before_json JSON,
            after_json JSON,
            metadata JSON,
            ip_address STRING,
            user_agent STRING,
            created_at TIMESTAMP NOT NULL

          )

          PARTITION BY
            DATE(created_at)

          CLUSTER BY
            workspace_id,
            brand_id,
            category,
            action

        `,

      });


      auditStoreReady =
        true;

    })();


  try {

    await auditStorePromise;

  } catch (
    error
  ) {

    auditStoreReady =
      false;

    auditStorePromise =
      null;

    throw error;

  }

}


// ============================================================
// REQUEST METADATA
// ============================================================

function requestMetadata(
  request?:
    Request | null
) {

  if (!request) {

    return {
      ipAddress:
        null,
      userAgent:
        null,
    };

  }


  const forwardedFor =
    request.headers.get(
      'x-forwarded-for'
    );


  const ipAddress =
    forwardedFor
      ?.split(',')[0]
      ?.trim()
    ||
    request.headers.get(
      'x-real-ip'
    )
    ||
    null;


  const userAgent =
    request.headers.get(
      'user-agent'
    )
    ||
    null;


  return {
    ipAddress,
    userAgent,
  };

}


// ============================================================
// SAFE JSON
// ============================================================

function sanitizeAuditValue(
  value:
    unknown,
  depth =
    0
): unknown {

  if (
    value ===
      null
    ||
    value ===
      undefined
  ) {

    return null;

  }


  if (depth > 6) {

    return '[max-depth]';

  }


  if (
    typeof value ===
      'string'
  ) {

    return value.length > 2000
      ? `${value.slice(0, 2000)}…`
      : value;

  }


  if (
    typeof value ===
      'number'
    ||
    typeof value ===
      'boolean'
  ) {

    return value;

  }


  if (Array.isArray(value)) {

    return value
      .slice(0, 200)
      .map(
        item =>
          sanitizeAuditValue(
            item,
            depth + 1
          )
      );

  }


  if (
    typeof value ===
      'object'
  ) {

    const output:
      Record<string, unknown> =
        {};


    for (
      const [
        key,
        item,
      ]
      of Object.entries(
        value as Record<string, unknown>
      ).slice(0, 200)
    ) {

      if (
        SENSITIVE_KEY_PATTERN.test(
          key
        )
      ) {

        output[key] =
          '[redacted]';

        continue;

      }


      output[key] =
        sanitizeAuditValue(
          item,
          depth + 1
        );

    }


    return output;

  }


  return String(
    value
  );

}


function serializeAuditJson(
  value:
    unknown
) {

  if (
    value ===
      undefined
    ||
    value ===
      null
  ) {

    return null;

  }


  const serialized =
    JSON.stringify(
      sanitizeAuditValue(
        value
      )
    );


  if (
    serialized.length <=
      MAX_JSON_LENGTH
  ) {

    return serialized;

  }


  return JSON.stringify({
    truncated:
      true,
    preview:
      serialized.slice(
        0,
        MAX_JSON_LENGTH - 100
      ),
  });

}


function parseJsonString(
  value:
    unknown
) {

  if (
    typeof value !==
      'string'
    ||
    !value
  ) {

    return null;

  }


  try {

    return JSON.parse(
      value
    );

  } catch {

    return value;

  }

}


// ============================================================
// WRITE EVENT
// ============================================================

export async function writeGrowthOSAuditEvent(
  input:
    GrowthOSAuditEventInput
) {

  await ensureGrowthOSAuditStore();


  const projectId =
    requireProjectId();


  const workspaceId =
    String(
      input.workspaceId
      ||
      ''
    ).trim();


  const brandId =
    String(
      input.brandId
      ||
      ''
    ).trim();


  const category =
    String(
      input.category
      ||
      ''
    ).trim();


  const action =
    String(
      input.action
      ||
      ''
    ).trim();


  if (
    !workspaceId
    ||
    !brandId
    ||
    !category
    ||
    !action
  ) {

    throw new Error(
      'Audit event requires workspaceId, brandId, category and action'
    );

  }


  const eventId =
    `audit_${crypto.randomUUID()}`;


  const {
    ipAddress,
    userAgent,
  } =
    requestMetadata(
      input.request
    );


  await bigquery.query({

    location:
      LOCATION,

    query: `

      INSERT INTO
        \`${projectId}.${DATASET_ID}.audit_events\`
      (

        event_id,
        workspace_id,
        brand_id,
        category,
        action,
        actor_user_id,
        actor_email,
        actor_role,
        target_type,
        target_id,
        target_label,
        before_json,
        after_json,
        metadata,
        ip_address,
        user_agent,
        created_at

      )

      VALUES
      (

        @event_id,
        @workspace_id,
        @brand_id,
        @category,
        @action,
        @actor_user_id,
        @actor_email,
        @actor_role,
        @target_type,
        @target_id,
        @target_label,
        CASE
          WHEN @before_json IS NULL THEN NULL
          ELSE PARSE_JSON(@before_json)
        END,
        CASE
          WHEN @after_json IS NULL THEN NULL
          ELSE PARSE_JSON(@after_json)
        END,
        CASE
          WHEN @metadata IS NULL THEN NULL
          ELSE PARSE_JSON(@metadata)
        END,
        @ip_address,
        @user_agent,
        CURRENT_TIMESTAMP()

      )

    `,

    params: {

      event_id:
        eventId,

      workspace_id:
        workspaceId,

      brand_id:
        brandId,

      category,

      action,

      actor_user_id:
        input.actorUserId
        ??
        null,

      actor_email:
        input.actorEmail
        ??
        null,

      actor_role:
        input.actorRole
        ??
        null,

      target_type:
        input.targetType
        ??
        null,

      target_id:
        input.targetId
        ??
        null,

      target_label:
        input.targetLabel
        ??
        null,

      before_json:
        serializeAuditJson(
          input.before
        ),

      after_json:
        serializeAuditJson(
          input.after
        ),

      metadata:
        serializeAuditJson(
          input.metadata
        ),

      ip_address:
        ipAddress,

      user_agent:
        userAgent,

    },

    types: {

      event_id:
        'STRING',

      workspace_id:
        'STRING',

      brand_id:
        'STRING',

      category:
        'STRING',

      action:
        'STRING',

      actor_user_id:
        'STRING',

      actor_email:
        'STRING',

      actor_role:
        'STRING',

      target_type:
        'STRING',

      target_id:
        'STRING',

      target_label:
        'STRING',

      before_json:
        'STRING',

      after_json:
        'STRING',

      metadata:
        'STRING',

      ip_address:
        'STRING',

      user_agent:
        'STRING',

    },

  });


  return {
    eventId,
  };

}


// ============================================================
// BEST-EFFORT WRITE
//
// Business/security action has already succeeded when this is
// called. Audit storage failure must not create a partially
// applied user-facing transaction.
// ============================================================

export async function writeGrowthOSAuditEventSafe(
  input:
    GrowthOSAuditEventInput
) {

  try {

    return await writeGrowthOSAuditEvent(
      input
    );

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_AUDIT_WRITE_FAILED',
      {
        category:
          input.category,
        action:
          input.action,
        workspaceId:
          input.workspaceId,
        brandId:
          input.brandId,
        message:
          error instanceof Error
            ? error.message
            : String(error),
      }
    );


    return null;

  }

}


// ============================================================
// LIST EVENTS
// ============================================================

export async function listGrowthOSAuditEvents(
  input:
    GrowthOSAuditListInput
) {

  await ensureGrowthOSAuditStore();


  const projectId =
    requireProjectId();


  const pageSize =
    Math.min(
      Math.max(
        Number(
          input.pageSize
          ||
          50
        ),
        10
      ),
      200
    );


  const page =
    Math.max(
      Number(
        input.page
        ||
        1
      ),
      1
    );


  const offset =
    (page - 1) *
    pageSize;


  const startDate =
    String(
      input.startDate
      ||
      ''
    ).trim();


  const endDate =
    String(
      input.endDate
      ||
      ''
    ).trim();


  const actorUserId =
    String(
      input.actorUserId
      ||
      ''
    ).trim();


  const category =
    String(
      input.category
      ||
      ''
    ).trim();


  const action =
    String(
      input.action
      ||
      ''
    ).trim();


  const baseWhere = `

    workspace_id = @workspace_id

    AND brand_id = @brand_id

    AND (
      @start_date = ''
      OR DATE(created_at) >= DATE(@start_date)
    )

    AND (
      @end_date = ''
      OR DATE(created_at) <= DATE(@end_date)
    )

    AND (
      @actor_user_id = ''
      OR actor_user_id = @actor_user_id
    )

    AND (
      @category = ''
      OR category = @category
    )

    AND (
      @action = ''
      OR action = @action
    )

  `;


  const params = {

    workspace_id:
      input.workspaceId,

    brand_id:
      input.brandId,

    start_date:
      startDate,

    end_date:
      endDate,

    actor_user_id:
      actorUserId,

    category,

    action,

  };


  const types = {

    workspace_id:
      'STRING',

    brand_id:
      'STRING',

    start_date:
      'STRING',

    end_date:
      'STRING',

    actor_user_id:
      'STRING',

    category:
      'STRING',

    action:
      'STRING',

  };


  const [
    [
      rows,
    ],
    [
      countRows,
    ],
    [
      actorRows,
    ],
    [
      optionRows,
    ],
  ] =
    await Promise.all([

      bigquery.query({

        location:
          LOCATION,

        query: `

          SELECT

            event_id,
            workspace_id,
            brand_id,
            category,
            action,
            actor_user_id,
            actor_email,
            actor_role,
            target_type,
            target_id,
            target_label,
            TO_JSON_STRING(before_json) AS before_json,
            TO_JSON_STRING(after_json) AS after_json,
            TO_JSON_STRING(metadata) AS metadata,
            ip_address,
            user_agent,
            FORMAT_TIMESTAMP(
              '%Y-%m-%dT%H:%M:%SZ',
              created_at
            ) AS created_at

          FROM
            \`${projectId}.${DATASET_ID}.audit_events\`

          WHERE
            ${baseWhere}

          ORDER BY
            created_at DESC,
            event_id DESC

          LIMIT
            ${pageSize}

          OFFSET
            ${offset}

        `,

        params,
        types,

      }),


      bigquery.query({

        location:
          LOCATION,

        query: `

          SELECT
            COUNT(*) AS total

          FROM
            \`${projectId}.${DATASET_ID}.audit_events\`

          WHERE
            ${baseWhere}

        `,

        params,
        types,

      }),


      bigquery.query({

        location:
          LOCATION,

        query: `

          SELECT
            actor_user_id,
            ANY_VALUE(actor_email HAVING MAX created_at) AS actor_email

          FROM
            \`${projectId}.${DATASET_ID}.audit_events\`

          WHERE
            workspace_id = @workspace_id
            AND brand_id = @brand_id
            AND actor_user_id IS NOT NULL

          GROUP BY
            actor_user_id

          ORDER BY
            actor_email

          LIMIT
            200

        `,

        params: {
          workspace_id:
            input.workspaceId,
          brand_id:
            input.brandId,
        },

        types: {
          workspace_id:
            'STRING',
          brand_id:
            'STRING',
        },

      }),


      bigquery.query({

        location:
          LOCATION,

        query: `

          SELECT

            ARRAY_AGG(
              DISTINCT category
              IGNORE NULLS
              ORDER BY category
            ) AS categories,

            ARRAY_AGG(
              DISTINCT action
              IGNORE NULLS
              ORDER BY action
            ) AS actions

          FROM
            \`${projectId}.${DATASET_ID}.audit_events\`

          WHERE
            workspace_id = @workspace_id
            AND brand_id = @brand_id

        `,

        params: {
          workspace_id:
            input.workspaceId,
          brand_id:
            input.brandId,
        },

        types: {
          workspace_id:
            'STRING',
          brand_id:
            'STRING',
        },

      }),

    ]);


  const events:
    GrowthOSAuditEvent[] =
      (rows || []).map(
        (row: any) => ({

          eventId:
            String(
              row.event_id
            ),

          workspaceId:
            String(
              row.workspace_id
            ),

          brandId:
            String(
              row.brand_id
            ),

          category:
            String(
              row.category
            ),

          action:
            String(
              row.action
            ),

          actorUserId:
            row.actor_user_id
            ??
            null,

          actorEmail:
            row.actor_email
            ??
            null,

          actorRole:
            row.actor_role
            ??
            null,

          targetType:
            row.target_type
            ??
            null,

          targetId:
            row.target_id
            ??
            null,

          targetLabel:
            row.target_label
            ??
            null,

          before:
            parseJsonString(
              row.before_json
            ),

          after:
            parseJsonString(
              row.after_json
            ),

          metadata:
            parseJsonString(
              row.metadata
            ),

          ipAddress:
            row.ip_address
            ??
            null,

          userAgent:
            row.user_agent
            ??
            null,

          createdAt:
            row.created_at
            ??
            null,

        })
      );


  const total =
    Number(
      (countRows as any[])?.[0]
        ?.total
      ||
      0
    );


  return {

    events,

    pagination: {

      page,

      pageSize,

      total,

      totalPages:
        Math.max(
          Math.ceil(
            total /
            pageSize
          ),
          1
        ),

    },

    filters: {

      actors:
        (actorRows as any[] || []).map(
          row => ({
            userId:
              String(
                row.actor_user_id
              ),
            email:
              row.actor_email
              ??
              null,
          })
        ),

      categories:
        (optionRows as any[])?.[0]
          ?.categories
        ||
        [],

      actions:
        (optionRows as any[])?.[0]
          ?.actions
        ||
        [],

    },

  };

}
