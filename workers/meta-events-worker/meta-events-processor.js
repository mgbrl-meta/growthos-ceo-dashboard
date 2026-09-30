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
    ||
    process.env.GOOGLE_CLOUD_PROJECT
    ||
    ''
  ).trim();

const DATASET_ID =
  String(
    process.env.GROWTHOS_META_EVENTS_DATASET
    ||
    'growthos_meta_events'
  ).trim();

const CONTROL_DATASET =
  String(
    process.env.GROWTHOS_CONTROL_DATASET
    ||
    'growthos_control'
  ).trim();

const LOCATION =
  String(
    process.env.GROWTHOS_META_EVENTS_LOCATION
    ||
    process.env.GCP_BQ_LOCATION
    ||
    'asia-south1'
  ).trim();

const GRAPH_VERSION =
  String(
    process.env.META_GRAPH_API_VERSION
    ||
    'v24.0'
  ).trim();

if (!PROJECT_ID) {
  throw new Error(
    'META_EVENTS_WORKER_PROJECT_MISSING'
  );
}

const bigquery =
  new BigQuery({
    projectId:
      PROJECT_ID,
  });

const secretManager =
  new SecretManagerServiceClient({
    projectId:
      PROJECT_ID,
  });

function table(
  name
) {
  return `\`${PROJECT_ID}.${DATASET_ID}.${name}\``;
}

function controlTable(
  name
) {
  return `\`${PROJECT_ID}.${CONTROL_DATASET}.${name}\``;
}

function deterministic(
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

function hash(
  value
) {
  return crypto
    .createHash('sha256')
    .update(
      String(
        value
        ??
        ''
      )
    )
    .digest('hex');
}

function normalizeEmail(
  value
) {
  return String(
    value
    ??
    ''
  )
    .trim()
    .toLowerCase();
}

function normalizePhone(
  value
) {
  return String(
    value
    ??
    ''
  )
    .replace(
      /\D/g,
      ''
    )
    .trim();
}

function readJson(
  value,
  fallback = {}
) {
  if (
    value ===
      null
    ||
    value ===
      undefined
  ) {
    return fallback;
  }

  if (
    typeof value ===
    'string'
  ) {
    try {
      return JSON.parse(
        value
      );
    } catch {
      return fallback;
    }
  }

  return value;
}

async function readSecret(
  secretName
) {
  const normalized =
    String(
      secretName
      ||
      ''
    ).trim();

  if (!normalized) {
    throw new Error(
      'META_EVENTS_SECRET_NAME_MISSING'
    );
  }

  const [
    version,
  ] =
    await secretManager
      .accessSecretVersion({
        name:
          `${normalized}/versions/latest`,
      });

  const raw =
    version?.payload?.data
      ?.toString();

  if (!raw) {
    throw new Error(
      'META_EVENTS_SECRET_EMPTY'
    );
  }

  try {
    return JSON.parse(
      raw
    );
  } catch {
    throw new Error(
      'META_EVENTS_SECRET_INVALID_JSON'
    );
  }
}

async function ensureTenantDefaults(
  workspaceId,
  brandId
) {
  await bigquery.query({
    location:
      LOCATION,
    query: `
      MERGE ${table('event_settings')} AS target
      USING (
        SELECT
          @workspace_id AS workspace_id,
          @brand_id AS brand_id
      ) AS source
      ON
        target.workspace_id=source.workspace_id
        AND target.brand_id=source.brand_id
      WHEN NOT MATCHED THEN
        INSERT (
          workspace_id,
          brand_id,
          max_attempts,
          retry_delay_seconds,
          batch_size,
          default_action_source,
          created_at,
          updated_at
        )
        VALUES (
          source.workspace_id,
          source.brand_id,
          5,
          60,
          100,
          'website',
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `,
    params: {
      workspace_id:
        workspaceId,
      brand_id:
        brandId,
    },
  });

  const sources = [
    [
      'call_commerce',
      'Call Commerce',
    ],
    [
      'shopify',
      'Shopify',
    ],
  ];

  for (
    const [
      source,
      label,
    ]
    of sources
  ) {
    await bigquery.query({
      location:
        LOCATION,
      query: `
        MERGE ${table('event_source_registry')} AS target
        USING (
          SELECT
            @workspace_id AS workspace_id,
            @brand_id AS brand_id,
            @source AS source
        ) AS source_row
        ON
          target.workspace_id=source_row.workspace_id
          AND target.brand_id=source_row.brand_id
          AND target.source=source_row.source
        WHEN NOT MATCHED THEN
          INSERT (
            workspace_id,
            brand_id,
            source,
            label,
            enabled,
            event_count,
            last_event_at,
            last_source_event_id,
            created_at,
            updated_at
          )
          VALUES (
            source_row.workspace_id,
            source_row.brand_id,
            source_row.source,
            @label,
            TRUE,
            0,
            NULL,
            NULL,
            CURRENT_TIMESTAMP(),
            CURRENT_TIMESTAMP()
          )
      `,
      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
        source,
        label,
      },
    });
  }

  const rules = [
    [
      'call_commerce',
      'call_commerce.connected',
      'Connected call lead',
      'ConnectedCallLead',
      'phone_call',
      10,
    ],
    [
      'call_commerce',
      'call_commerce.qualified',
      'Qualified call lead',
      'QualifiedCallLead',
      'phone_call',
      20,
    ],
    [
      'call_commerce',
      'call_commerce.unqualified',
      'Unqualified call lead',
      'UnqualifiedCallLead',
      'phone_call',
      30,
    ],
    [
      'call_commerce',
      'call_commerce.purchased',
      'Purchased call lead',
      'ConvertedCallLead',
      'phone_call',
      40,
    ],
    [
      'shopify',
      'shopify.order_paid_new',
      'New customer purchase',
      'NewCustomerPurchase',
      'website',
      50,
    ],
    [
      'shopify',
      'shopify.order_paid_existing',
      'Existing customer purchase',
      'ExistingCustomerPurchase',
      'website',
      60,
    ],
  ];

  for (
    const [
      source,
      sourceEvent,
      name,
      metaEventName,
      actionSource,
      priority,
    ]
    of rules
  ) {
    const ruleId =
      deterministic(
        'merule',
        [
          workspaceId,
          brandId,
          source,
          sourceEvent,
          metaEventName,
        ]
      );

    await bigquery.query({
      location:
        LOCATION,
      query: `
        MERGE ${table('event_rules')} AS target
        USING (
          SELECT
            @workspace_id AS workspace_id,
            @brand_id AS brand_id,
            @source AS source,
            @source_event AS source_event
        ) AS source_row
        ON
          target.workspace_id=source_row.workspace_id
          AND target.brand_id=source_row.brand_id
          AND target.seeded=TRUE
          AND target.source=source_row.source
          AND target.source_event=source_row.source_event

        WHEN MATCHED THEN
          UPDATE SET
            name=@name,
            meta_event_name=@meta_event_name,
            destination_id=NULL,
            action_source=@action_source,
            condition_json=PARSE_JSON('{}'),
            priority=@priority,
            updated_at=CURRENT_TIMESTAMP()

        WHEN NOT MATCHED THEN
          INSERT (
            rule_id,
            workspace_id,
            brand_id,
            name,
            source,
            source_event,
            meta_event_name,
            destination_id,
            action_source,
            condition_json,
            enabled,
            seeded,
            priority,
            created_at,
            updated_at
          )
          VALUES (
            @rule_id,
            @workspace_id,
            @brand_id,
            @name,
            @source,
            @source_event,
            @meta_event_name,
            NULL,
            @action_source,
            PARSE_JSON('{}'),
            TRUE,
            TRUE,
            @priority,
            CURRENT_TIMESTAMP(),
            CURRENT_TIMESTAMP()
          )
      `,
      params: {
        rule_id:
          ruleId,
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
        name,
        source,
        source_event:
          sourceEvent,
        meta_event_name:
          metaEventName,
        action_source:
          actionSource,
        priority,
      },
      types: {
        priority:
          'INT64',
      },
    });
  }

  // Existing Settings -> Integrations -> Meta Events connector
  // automatically becomes the default module destination.
  const [
    connectionRows,
  ] =
    await bigquery.query({
      location:
        LOCATION,
      query: `
        SELECT
          provider_account_id,
          provider_account_name,
          secret_name,
          status
        FROM ${controlTable('integration_connections')}
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND provider='meta_events'
        ORDER BY
          updated_at DESC
        LIMIT 1
      `,
      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
      },
    });

  const connection =
    connectionRows?.[0]
    ||
    null;

  if (
    connection
    &&
    String(
      connection.status
      ||
      ''
    ).toLowerCase() ===
      'connected'
    &&
    connection.provider_account_id
    &&
    connection.secret_name
  ) {
    const datasetId =
      String(
        connection.provider_account_id
      ).trim();

    const secretName =
      String(
        connection.secret_name
      ).trim();

    // The application and worker must resolve the same
    // integration-owned destination. Reuse the existing row by
    // logical endpoint identity; generate an ID only on first
    // provisioning.
    const [
      existingDestinationRows,
    ] =
      await bigquery.query({
        location:
          LOCATION,
        query: `
          SELECT
            destination_id
          FROM ${table('event_destinations')}
          WHERE
            workspace_id=@workspace_id
            AND brand_id=@brand_id
            AND dataset_id=@dataset_id
            AND credential_secret_name=@secret_name
          ORDER BY
            IF(
              NULLIF(test_event_code,'')
              IS NOT NULL,
              0,
              1
            ),
            IF(is_default,0,1),
            created_at
          LIMIT 1
        `,
        params: {
          workspace_id:
            workspaceId,
          brand_id:
            brandId,
          dataset_id:
            datasetId,
          secret_name:
            secretName,
        },
      });

    const destinationId =
      String(
        existingDestinationRows?.[0]
          ?.destination_id
        ||
        ''
      ).trim()
      ||
      deterministic(
        'medst',
        [
          workspaceId,
          brandId,
          'integration',
          datasetId,
        ]
      );

    await bigquery.query({
      location:
        LOCATION,
      query: `
        UPDATE ${table('event_destinations')}
        SET
          is_default=FALSE,
          updated_at=CURRENT_TIMESTAMP()
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND destination_id!=@destination_id
          AND is_default=TRUE
      `,
      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
        destination_id:
          destinationId,
      },
    });

    await bigquery.query({
      location:
        LOCATION,
      query: `
        MERGE ${table('event_destinations')} AS target
        USING (
          SELECT
            @destination_id AS destination_id
        ) AS source
        ON target.destination_id=source.destination_id
        WHEN MATCHED THEN
          UPDATE SET
            name=@name,
            dataset_id=@dataset_id,
            credential_secret_name=@secret_name,
            status='active',
            is_default=TRUE,
            updated_at=CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN
          INSERT (
            destination_id,
            workspace_id,
            brand_id,
            name,
            dataset_id,
            credential_secret_name,
            status,
            is_default,
            test_event_code,
            created_at,
            updated_at
          )
          VALUES (
            @destination_id,
            @workspace_id,
            @brand_id,
            @name,
            @dataset_id,
            @secret_name,
            'active',
            TRUE,
            NULL,
            CURRENT_TIMESTAMP(),
            CURRENT_TIMESTAMP()
          )
      `,
      params: {
        destination_id:
          destinationId,
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
        name:
          String(
            connection.provider_account_name
            ||
            `Meta Dataset ${datasetId}`
          ),
        dataset_id:
          datasetId,
        secret_name:
          secretName,
      },
    });
  }
}

// ============================================================
// CANONICAL SOURCE EVENT NORMALIZATION
// ============================================================
//
// Transport version and canonical event version are separate.
//
// Older already-published V1 jobs may not contain eventVersion,
// context, attribution, commerce or metadata.
//
// We normalize those jobs here so the migration remains fully
// backward-compatible.
// ============================================================

function normalizeCanonicalSourceJob(
  input
) {
  const job =
    input
    &&
    typeof input ===
      'object'
      ?
        input
      :
        {};

  return {
    ...job,

    version:
      Number(
        job.version
        ??
        1
      ),

    jobType:
      String(
        job.jobType
        ??
        'source_event'
      ).trim(),

    eventVersion:
      Number(
        job.eventVersion
        ??
        1
      ),

    workspaceId:
      String(
        job.workspaceId
        ??
        ''
      ).trim(),

    brandId:
      String(
        job.brandId
        ??
        ''
      ).trim(),

    source:
      String(
        job.source
        ??
        ''
      ).trim(),

    sourceEvent:
      String(
        job.sourceEvent
        ??
        ''
      ).trim(),

    sourceEventId:
      String(
        job.sourceEventId
        ??
        ''
      ).trim(),

    sourceEntityId:
      job.sourceEntityId
      ??
      null,

    occurredAt:
      String(
        job.occurredAt
        ??
        ''
      ).trim(),

    identity:
      job.identity
      ??
      null,

    context:
      job.context
      ??
      null,

    attribution:
      job.attribution
      ??
      null,

    commerce:
      job.commerce
      ??
      null,

    data:
      job.data
      ??
      null,

    metadata:
      job.metadata
      ??
      null,
  };
}


// ============================================================
// CANONICAL SOURCE EVENT VALIDATION
// ============================================================
//
// This is structural V1 validation.
//
// Event-specific catalogue/schema validation will be added in
// Phase 2.
//
// Producers therefore only need to satisfy the universal
// canonical-event envelope here.
// ============================================================

function validateCanonicalSourceJob(
  job
) {
  if (
    job.version !==
      1
  ) {
    throw new Error(
      'META_EVENTS_TRANSPORT_VERSION_UNSUPPORTED'
    );
  }

  if (
    job.jobType !==
      'source_event'
  ) {
    throw new Error(
      'META_EVENTS_JOB_TYPE_INVALID'
    );
  }

  if (
    job.eventVersion !==
      1
  ) {
    throw new Error(
      'META_EVENTS_EVENT_VERSION_UNSUPPORTED'
    );
  }

  if (
    !job.workspaceId
  ) {
    throw new Error(
      'META_EVENTS_WORKSPACE_ID_REQUIRED'
    );
  }

  if (
    !job.brandId
  ) {
    throw new Error(
      'META_EVENTS_BRAND_ID_REQUIRED'
    );
  }

  if (
    !job.source
  ) {
    throw new Error(
      'META_EVENTS_SOURCE_REQUIRED'
    );
  }

  if (
    !job.sourceEvent
  ) {
    throw new Error(
      'META_EVENTS_SOURCE_EVENT_REQUIRED'
    );
  }

  if (
    !job.sourceEventId
  ) {
    throw new Error(
      'META_EVENTS_SOURCE_EVENT_ID_REQUIRED'
    );
  }

  if (
    !job.occurredAt
  ) {
    throw new Error(
      'META_EVENTS_OCCURRED_AT_REQUIRED'
    );
  }

  const occurredAt =
    new Date(
      job.occurredAt
    );

  if (
    Number.isNaN(
      occurredAt.getTime()
    )
  ) {
    throw new Error(
      'META_EVENTS_OCCURRED_AT_INVALID'
    );
  }
}


// ============================================================
// SAFE JSON PARAM
// ============================================================

function jsonParam(
  value
) {
  if (
    value === null
    ||
    value === undefined
  ) {
    return '';
  }

  return JSON.stringify(
    value
  );
}


// ============================================================
// EVENT INBOX
// ============================================================
//
// Logical idempotency key:
//
// workspace
// + brand
// + source
// + sourceEventId
//
// The first canonical payload is preserved.
//
// Subsequent deliveries only update:
//
// last_received_at
// duplicate_count
// updated_at
//
// A duplicate cannot silently rewrite the original canonical
// business event.
// ============================================================

async function upsertEventInbox(
  job
) {
  const inboxId =
    deterministic(
      'mein',
      [
        job.workspaceId,
        job.brandId,
        job.source,
        job.sourceEventId,
      ]
    );


  await bigquery.query({
    location:
      LOCATION,

    query: `
      MERGE
        ${table('event_inbox')}
        AS target

      USING (
        SELECT
          @inbox_id AS inbox_id
      )
      AS source_row

      ON
        target.inbox_id=
          source_row.inbox_id


      WHEN MATCHED THEN
        UPDATE SET
          last_received_at=
            CURRENT_TIMESTAMP(),

          duplicate_count=
            COALESCE(
              duplicate_count,
              0
            ) + 1,

          updated_at=
            CURRENT_TIMESTAMP()


      WHEN NOT MATCHED THEN
        INSERT (
          inbox_id,

          workspace_id,
          brand_id,

          source,
          source_event,
          source_event_id,

          source_entity_id,

          event_version,

          occurred_at,

          first_received_at,
          last_received_at,

          identity,
          context,
          attribution,
          commerce,
          data,
          metadata,

          validation_status,
          routing_status,

          duplicate_count,

          processing_error,

          processing_status,
          processing_claim_id,

          processing_started_at,
          processing_completed_at,

          processing_attempts,

          created_at,
          updated_at
        )

        VALUES (
          @inbox_id,

          @workspace_id,
          @brand_id,

          @source,
          @source_event,
          @source_event_id,

          @source_entity_id,

          @event_version,

          @occurred_at,

          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP(),

          IF(
            @identity_json='',
            NULL,
            PARSE_JSON(
              @identity_json
            )
          ),

          IF(
            @context_json='',
            NULL,
            PARSE_JSON(
              @context_json
            )
          ),

          IF(
            @attribution_json='',
            NULL,
            PARSE_JSON(
              @attribution_json
            )
          ),

          IF(
            @commerce_json='',
            NULL,
            PARSE_JSON(
              @commerce_json
            )
          ),

          IF(
            @data_json='',
            NULL,
            PARSE_JSON(
              @data_json
            )
          ),

          IF(
            @metadata_json='',
            NULL,
            PARSE_JSON(
              @metadata_json
            )
          ),

          'PENDING',
          'PENDING',

          0,

          NULL,

          'PENDING',
          NULL,

          NULL,
          NULL,

          0,

          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `,

    params: {
      inbox_id:
        inboxId,

      workspace_id:
        job.workspaceId,

      brand_id:
        job.brandId,

      source:
        job.source,

      source_event:
        job.sourceEvent,

      source_event_id:
        job.sourceEventId,

      source_entity_id:
        job.sourceEntityId
        ??
        null,

      event_version:
        job.eventVersion,

      occurred_at:
        new Date(
          job.occurredAt
        ),

      identity_json:
        jsonParam(
          job.identity
        ),

      context_json:
        jsonParam(
          job.context
        ),

      attribution_json:
        jsonParam(
          job.attribution
        ),

      commerce_json:
        jsonParam(
          job.commerce
        ),

      data_json:
        jsonParam(
          job.data
        ),

      metadata_json:
        jsonParam(
          job.metadata
        ),
    },

    types: {
      source_entity_id:
        'STRING',

      event_version:
        'INT64',

      occurred_at:
        'TIMESTAMP',
    },
  });


  const [
    rows,
  ] =
    await bigquery.query({
      location:
        LOCATION,

      query: `
        SELECT
          *

        FROM
          ${table('event_inbox')}

        WHERE
          inbox_id=
            @inbox_id

        LIMIT 1
      `,

      params: {
        inbox_id:
          inboxId,
      },
    });


  return (
    rows?.[0]
    ??
    null
  );
}

// ============================================================
// INBOX PROCESSING OWNERSHIP
// ============================================================
//
// Phase 3A:
//
// Pub/Sub can deliver the same logical event multiple times.
//
// The inbox remains the durable idempotency record, while
// processing_claim_id acts as the fencing token that gives
// exactly one worker ownership of routing at a time.
//
// Normal states:
//
// PENDING
//   -> PROCESSING
//   -> COMPLETED
//
// Transient failure:
//
// PROCESSING
//   -> RETRY
//   -> PROCESSING
//
// A PROCESSING claim older than 15 minutes is considered stale
// and may be reclaimed by a later Pub/Sub delivery.
// ============================================================

function newInboxProcessingClaimId() {
  return `meclaim_${crypto
    .randomUUID()
    .replace(
      /-/g,
      ''
    )}`;
}


// ============================================================
// ERROR TEXT
// ============================================================

function processingErrorText(
  error
) {
  const text =
    String(
      error?.message
      ??
      error
      ??
      'META_EVENTS_PROCESSING_FAILURE'
    )
      .trim();


  return (
    text
      .slice(
        0,
        4000
      )
    ||
    'META_EVENTS_PROCESSING_FAILURE'
  );
}


// ============================================================
// CLAIM PROCESSING
// ============================================================

async function claimInboxProcessing(
  inboxId
) {
  const claimId =
    newInboxProcessingClaimId();


  // ----------------------------------------------------------
  // COMPARE-AND-SET CLAIM
  // ----------------------------------------------------------
  //
  // Eligible:
  //
  // - PENDING
  // - RETRY
  // - old rows where processing_status is NULL
  // - stale PROCESSING claims
  //
  // Not eligible:
  //
  // - active PROCESSING
  // - COMPLETED
  // ----------------------------------------------------------

  await bigquery.query({
    location:
      LOCATION,

    query: `
      UPDATE
        ${table('event_inbox')}

      SET
        processing_status=
          'PROCESSING',

        processing_claim_id=
          @processing_claim_id,

        processing_started_at=
          CURRENT_TIMESTAMP(),

        processing_completed_at=
          NULL,

        processing_attempts=
          COALESCE(
            processing_attempts,
            0
          ) + 1,

        processing_error=
          NULL,

        updated_at=
          CURRENT_TIMESTAMP()

      WHERE
        inbox_id=
          @inbox_id

        AND (
          processing_status IS NULL

          OR processing_status IN (
            'PENDING',
            'RETRY'
          )

          OR (
            processing_status=
              'PROCESSING'

            AND (
              processing_started_at IS NULL

              OR processing_started_at <
                TIMESTAMP_SUB(
                  CURRENT_TIMESTAMP(),
                  INTERVAL 15 MINUTE
                )
            )
          )
        )
    `,

    params: {
      inbox_id:
        inboxId,

      processing_claim_id:
        claimId,
    },
  });


  // ----------------------------------------------------------
  // READ FINAL CLAIM STATE
  // ----------------------------------------------------------

  const [
    rows,
  ] =
    await bigquery.query({
      location:
        LOCATION,

      query: `
        SELECT
          inbox_id,

          processing_status,
          processing_claim_id,

          processing_started_at,
          processing_completed_at,

          processing_attempts,

          duplicate_count

        FROM
          ${table('event_inbox')}

        WHERE
          inbox_id=
            @inbox_id

        LIMIT 1
      `,

      params: {
        inbox_id:
          inboxId,
      },
    });


  const row =
    rows?.[0]
    ??
    null;


  if (
    !row
  ) {
    throw new Error(
      'META_EVENTS_PROCESSING_CLAIM_ROW_MISSING'
    );
  }


  const currentStatus =
    String(
      row.processing_status
      ??
      ''
    )
      .trim()
      .toUpperCase();


  const currentClaimId =
    String(
      row.processing_claim_id
      ??
      ''
    )
      .trim();


  // ----------------------------------------------------------
  // THIS WORKER OWNS IT
  // ----------------------------------------------------------

  if (
    currentStatus ===
      'PROCESSING'
    &&
    currentClaimId ===
      claimId
  ) {
    return {
      claimed:
        true,

      reason:
        'CLAIMED',

      claimId,

      row,
    };
  }


  // ----------------------------------------------------------
  // ALREADY FINISHED
  // ----------------------------------------------------------

  if (
    currentStatus ===
      'COMPLETED'
  ) {
    return {
      claimed:
        false,

      reason:
        'ALREADY_PROCESSED',

      claimId:
        null,

      row,
    };
  }


  // ----------------------------------------------------------
  // ANOTHER WORKER CURRENTLY OWNS IT
  // ----------------------------------------------------------

  if (
    currentStatus ===
      'PROCESSING'
  ) {
    return {
      claimed:
        false,

      reason:
        'ALREADY_IN_PROGRESS',

      claimId:
        null,

      row,
    };
  }


  return {
    claimed:
      false,

    reason:
      'CLAIM_NOT_ACQUIRED',

    claimId:
      null,

    row,
  };
}


// ============================================================
// COMPLETE PROCESSING
// ============================================================
//
// claimId is part of the WHERE clause.
//
// That is the fencing guarantee: an old/stale worker cannot
// mark a row complete after another worker has reclaimed it.
// ============================================================

async function completeInboxProcessing(
  inboxId,
  claimId
) {
  await bigquery.query({
    location:
      LOCATION,

    query: `
      UPDATE
        ${table('event_inbox')}

      SET
        processing_status=
          'COMPLETED',

        processing_completed_at=
          CURRENT_TIMESTAMP(),

        updated_at=
          CURRENT_TIMESTAMP()

      WHERE
        inbox_id=
          @inbox_id

        AND processing_status=
          'PROCESSING'

        AND processing_claim_id=
          @processing_claim_id
    `,

    params: {
      inbox_id:
        inboxId,

      processing_claim_id:
        claimId,
    },
  });
}


// ============================================================
// RELEASE PROCESSING FOR RETRY
// ============================================================
//
// Unexpected infrastructure / delivery errors must not leave
// the logical event permanently locked.
//
// Pub/Sub receives the thrown error and redelivers later.
// ============================================================

async function releaseInboxProcessingForRetry(
  inboxId,
  claimId,
  error
) {
  const errorText =
    processingErrorText(
      error
    );


  await bigquery.query({
    location:
      LOCATION,

    query: `
      UPDATE
        ${table('event_inbox')}

      SET
        processing_status=
          'RETRY',

        processing_claim_id=
          NULL,

        processing_started_at=
          NULL,

        processing_completed_at=
          NULL,

        processing_error=
          @processing_error,

        updated_at=
          CURRENT_TIMESTAMP()

      WHERE
        inbox_id=
          @inbox_id

        AND processing_status=
          'PROCESSING'

        AND processing_claim_id=
          @processing_claim_id
    `,

    params: {
      inbox_id:
        inboxId,

      processing_claim_id:
        claimId,

      processing_error:
        errorText,
    },

    types: {
      processing_error:
        'STRING',
    },
  });
}

// ============================================================
// INBOX ROUTING STATUS
// ============================================================

async function markInboxRoutingStatus(
  inboxId,
  routingStatus,
  processingError = null
) {
  await bigquery.query({
    location:
      LOCATION,

    query: `
      UPDATE ${table('event_inbox')}
      SET
        routing_status=
          @routing_status,

        processing_error=
          @processing_error,

        updated_at=
          CURRENT_TIMESTAMP()

      WHERE
        inbox_id=
          @inbox_id
    `,

    params: {
      inbox_id:
        inboxId,

      routing_status:
        routingStatus,

      processing_error:
        processingError,
    },

    types: {
  processing_error:
    'STRING',
},
  });
}

// ============================================================
// PLATFORM EVENT CATALOGUE
// ============================================================
//
// Canonical event definitions are platform-wide.
//
// event_catalogue intentionally contains no workspace_id /
// brand_id because an event must mean the same thing for every
// Growth OS tenant.
//
// Tenant-specific routing remains in event_rules.
// ============================================================

async function readEventCatalogueDefinition(
  job
) {
  const [
    rows,
  ] =
    await bigquery.query({
      location:
        LOCATION,

      query: `
        SELECT
          catalogue_id,

          event_key,
          event_version,

          source,

          label,
          description,

          producer_type,

          lifecycle_status,

          routing_allowed,

          schema_json,

          introduced_contract_version

        FROM
          ${table('event_catalogue')}

        WHERE
          event_key=
            @event_key

          AND event_version=
            @event_version

        ORDER BY
          updated_at DESC

        LIMIT 2
      `,

      params: {
        event_key:
          job.sourceEvent,

        event_version:
          job.eventVersion,
      },

      types: {
        event_version:
          'INT64',
      },
    });


  if (
    !rows
    ||
    rows.length ===
      0
  ) {
    return {
      ok:
        false,

      error:
        'META_EVENTS_CATALOGUE_EVENT_NOT_REGISTERED',

      definition:
        null,
    };
  }


  // BigQuery does not enforce relational uniqueness.
  //
  // Our deterministic catalogue_id + bootstrap MERGE should
  // guarantee one definition, but fail closed if warehouse
  // corruption/manual mutation ever produces duplicates.
  if (
    rows.length >
      1
  ) {
    return {
      ok:
        false,

      error:
        'META_EVENTS_CATALOGUE_DUPLICATE_DEFINITION',

      definition:
        null,
    };
  }


  return {
    ok:
      true,

    error:
      null,

    definition:
      rows[0],
  };
}


// ============================================================
// JSON VALUE NORMALIZATION
// ============================================================

function normalizeCatalogueJson(
  value
) {
  if (
    value ===
      null
    ||
    value ===
      undefined
  ) {
    return {};
  }


  if (
    typeof value ===
      'object'
  ) {
    return value;
  }


  try {
    const parsed =
      JSON.parse(
        String(
          value
        )
      );

    return (
      parsed
      &&
      typeof parsed ===
        'object'
    )
      ?
        parsed
      :
        {};
  } catch {
    return {};
  }
}


// ============================================================
// NESTED VALUE
// ============================================================

function readNestedValue(
  object,
  path
) {
  const normalizedPath =
    String(
      path
      ??
      ''
    )
      .trim();


  if (
    !normalizedPath
  ) {
    return undefined;
  }


  const parts =
    normalizedPath
      .split(
        '.'
      )
      .map(
        part =>
          part.trim()
      )
      .filter(
        Boolean
      );


  let current =
    object;


  for (
    const part
    of parts
  ) {
    if (
      current ===
        null
      ||
      current ===
        undefined
      ||
      typeof current !==
        'object'
    ) {
      return undefined;
    }


    current =
      current[
        part
      ];
  }


  return current;
}


// ============================================================
// VALUE PRESENCE
// ============================================================

function hasMeaningfulValue(
  value
) {
  if (
    value ===
      null
    ||
    value ===
      undefined
  ) {
    return false;
  }


  if (
    typeof value ===
      'string'
  ) {
    return (
      value.trim().length >
      0
    );
  }


  if (
    Array.isArray(
      value
    )
  ) {
    return (
      value.length >
      0
    );
  }


  return true;
}


// ============================================================
// CATALOGUE VALIDATION
// ============================================================
//
// Phase 2B validates:
//
// - registered event
// - event version
// - declared source
// - catalogue lifecycle
// - required data paths
// - identity any-of requirement
//
// The schema format is deliberately small and safe.
//
// Future catalogue versions may expand this validator without
// allowing arbitrary JavaScript / SQL inside event definitions.
// ============================================================

function validateAgainstCatalogue(
  job,
  definition
) {
  if (
    !definition
  ) {
    return {
      valid:
        false,

      routingAllowed:
        false,

      error:
        'META_EVENTS_CATALOGUE_DEFINITION_MISSING',
    };
  }


  const eventKey =
    String(
      definition.event_key
      ??
      ''
    ).trim();


  if (
    eventKey !==
      job.sourceEvent
  ) {
    return {
      valid:
        false,

      routingAllowed:
        false,

      error:
        'META_EVENTS_CATALOGUE_EVENT_MISMATCH',
    };
  }


  const eventVersion =
    Number(
      definition.event_version
    );


  if (
    eventVersion !==
      job.eventVersion
  ) {
    return {
      valid:
        false,

      routingAllowed:
        false,

      error:
        'META_EVENTS_CATALOGUE_VERSION_MISMATCH',
    };
  }


  const catalogueSource =
    String(
      definition.source
      ??
      ''
    ).trim();


  if (
    catalogueSource !==
      job.source
  ) {
    return {
      valid:
        false,

      routingAllowed:
        false,

      error:
        'META_EVENTS_CATALOGUE_SOURCE_MISMATCH',
    };
  }


  const lifecycleStatus =
    String(
      definition.lifecycle_status
      ??
      ''
    )
      .trim()
      .toLowerCase();


  if (
    lifecycleStatus ===
      'deprecated'
    ||
    lifecycleStatus ===
      'disabled'
  ) {
    return {
      valid:
        false,

      routingAllowed:
        false,

      error:
        'META_EVENTS_CATALOGUE_EVENT_DISABLED',
    };
  }


  const schema =
    normalizeCatalogueJson(
      definition.schema_json
    );


  const requiredDataPaths =
    Array.isArray(
      schema.requiredDataPaths
    )
      ?
        schema.requiredDataPaths
      :
        [];


  for (
    const path
    of requiredDataPaths
  ) {
    const value =
      readNestedValue(
        job.data,
        path
      );


    if (
      !hasMeaningfulValue(
        value
      )
    ) {
      return {
        valid:
          false,

        routingAllowed:
          false,

        error:
          `META_EVENTS_REQUIRED_DATA_MISSING:${String(path)}`,
      };
    }
  }


  const identityAnyOf =
    Array.isArray(
      schema.identityAnyOf
    )
      ?
        schema.identityAnyOf
      :
        [];


  if (
    identityAnyOf.length >
      0
  ) {
    const identitySatisfied =
      identityAnyOf.some(
        path => {
          const value =
            readNestedValue(
              job.identity,
              path
            );

          return hasMeaningfulValue(
            value
          );
        }
      );


    if (
      !identitySatisfied
    ) {
      return {
        valid:
          false,

        routingAllowed:
          false,

        error:
          'META_EVENTS_REQUIRED_IDENTITY_MISSING',
      };
    }
  }


  const routingAllowed =
    definition.routing_allowed ===
      true
    ||
    String(
      definition.routing_allowed
      ??
      ''
    )
      .trim()
      .toLowerCase() ===
        'true';


  return {
    valid:
      true,

    routingAllowed,

    error:
      null,

    lifecycleStatus,
  };
}


// ============================================================
// INBOX VALIDATION RESULT
// ============================================================

async function markInboxValidationResult(
  inboxId,
  validationStatus,
  routingStatus,
  processingError = null
) {
  await bigquery.query({
    location:
      LOCATION,

    query: `
      UPDATE
        ${table('event_inbox')}

      SET
        validation_status=
          @validation_status,

        routing_status=
          @routing_status,

        processing_error=
          @processing_error,

        updated_at=
          CURRENT_TIMESTAMP()

      WHERE
        inbox_id=
          @inbox_id
    `,

    params: {
      inbox_id:
        inboxId,

      validation_status:
        validationStatus,

      routing_status:
        routingStatus,

      processing_error:
        processingError,
    },

    types: {
      processing_error:
        'STRING',
    },
  });
}

async function markSourceEvent(
  job
) {
  await bigquery.query({
    location:
      LOCATION,
    query: `
      UPDATE ${table('event_source_registry')}
      SET
        event_count=
          IF(
            COALESCE(last_source_event_id,'')=@source_event_id,
            event_count,
            event_count+1
          ),
        last_event_at=
          IF(
            COALESCE(last_source_event_id,'')=@source_event_id,
            last_event_at,
            @occurred_at
          ),
        last_source_event_id=@source_event_id,
        updated_at=CURRENT_TIMESTAMP()
      WHERE
        workspace_id=@workspace_id
        AND brand_id=@brand_id
        AND source=@source
    `,
    params: {
      workspace_id:
        job.workspaceId,
      brand_id:
        job.brandId,
      source:
        job.source,
      source_event_id:
        job.sourceEventId,
      occurred_at:
        new Date(
          job.occurredAt
        ),
    },
    types: {
      occurred_at:
        'TIMESTAMP',
    },
  });
}

async function readSettings(
  workspaceId,
  brandId
) {
  const [
    rows,
  ] =
    await bigquery.query({
      location:
        LOCATION,
      query: `
        SELECT
          max_attempts,
          retry_delay_seconds,
          batch_size,
          default_action_source
        FROM ${table('event_settings')}
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
        LIMIT 1
      `,
      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
      },
    });

  return rows?.[0]
    ||
    {
      max_attempts:
        5,
      retry_delay_seconds:
        60,
      batch_size:
        100,
      default_action_source:
        'website',
    };
}

async function readRules(
  job
) {
  const [
    rows,
  ] =
    await bigquery.query({
      location:
        LOCATION,
      query: `
        SELECT
          *
        FROM ${table('event_rules')}
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND enabled=TRUE
          AND source=@source
          AND source_event=@source_event
        QUALIFY
          ROW_NUMBER() OVER (
            PARTITION BY
              source,
              source_event,
              meta_event_name,
              COALESCE(destination_id,''),
              COALESCE(action_source,''),
              COALESCE(TO_JSON_STRING(condition_json),'{}'),
              seeded
            ORDER BY
              updated_at DESC,
              created_at DESC,
              rule_id DESC
          ) = 1

        ORDER BY
          priority,
          created_at
      `,
      params: {
        workspace_id:
          job.workspaceId,
        brand_id:
          job.brandId,
        source:
          job.source,
        source_event:
          job.sourceEvent,
      },
    });

  return rows
    ||
    [];
}

async function readDestinations(
  job,
  rule
) {
  const destinationId =
    String(
      rule?.destination_id
      ||
      ''
    ).trim();

  const [
    rows,
  ] =
    await bigquery.query({
      location:
        LOCATION,
      query: `
        SELECT
          *
        FROM ${table('event_destinations')}
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND status='active'
          AND (
            (
              @destination_id!=''
              AND destination_id=@destination_id
            )
            OR
            (
              @destination_id=''
              AND is_default=TRUE
            )
          )
        ORDER BY
          is_default DESC,
          created_at
      `,
      params: {
        workspace_id:
          job.workspaceId,
        brand_id:
          job.brandId,
        destination_id:
          destinationId,
      },
    });

  return rows
    ||
    [];
}

function buildUserData(
  identity
) {
  const source =
    identity
    &&
    typeof identity ===
      'object'
      ?
        identity
      :
        {};

  const email =
    normalizeEmail(
      source.email
    );

  const phone =
    normalizePhone(
      source.phone
    );

  const externalId =
    String(
      source.externalId
      ||
      ''
    ).trim();

  return {
    ...(email
      ?
        {
          em: [
            hash(
              email
            ),
          ],
        }
      :
        {}),
    ...(phone
      ?
        {
          ph: [
            hash(
              phone
            ),
          ],
        }
      :
        {}),
    ...(externalId
      ?
        {
          external_id: [
            hash(
              externalId
            ),
          ],
        }
      :
        {}),
    ...(source.fbc
      ?
        {
          fbc:
            String(
              source.fbc
            ),
        }
      :
        {}),
    ...(source.fbp
      ?
        {
          fbp:
            String(
              source.fbp
            ),
        }
      :
        {}),
    ...(source.clientIpAddress
      ?
        {
          client_ip_address:
            String(
              source.clientIpAddress
            ),
        }
      :
        {}),
    ...(source.clientUserAgent
      ?
        {
          client_user_agent:
            String(
              source.clientUserAgent
            ),
        }
      :
        {}),
  };
}

async function upsertOutbox(
  job,
  rule,
  destination
) {
  const isSeededRule =
    rule.seeded === true;

  const ruleDeliveryKey =
    isSeededRule
      ?
        [
          'seeded',
          String(
            rule.source
            ||
            ''
          ),
          String(
            rule.source_event
            ||
            ''
          ),
          String(
            rule.meta_event_name
            ||
            ''
          ),
          String(
            rule.action_source
            ||
            ''
          ),
        ].join('|')
      :
        [
          'custom',
          String(
            rule.rule_id
            ||
            ''
          ),
        ].join('|');

  // Before deriving a new ID, reuse an existing outbox row for
  // the same logical delivery. This preserves the original Meta
  // event_id when a physical destination_id is migrated.
  const [
    existingRows,
  ] =
    await bigquery.query({
      location:
        LOCATION,
      query: `
        SELECT
          *
        FROM ${table('event_outbox')}
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND source=@source
          AND source_event=@source_event
          AND source_event_id=@source_event_id
          AND meta_event_name=@meta_event_name
          AND action_source=@action_source
          AND (
            (
              @is_seeded=TRUE
            )
            OR
            (
              @is_seeded=FALSE
              AND rule_id=@rule_id
            )
          )
        ORDER BY
          created_at
        LIMIT 1
      `,
      params: {
        workspace_id:
          job.workspaceId,
        brand_id:
          job.brandId,
        source:
          job.source,
        source_event:
          job.sourceEvent,
        source_event_id:
          job.sourceEventId,
        meta_event_name:
          rule.meta_event_name,
        action_source:
          rule.action_source
          ||
          'website',
        is_seeded:
          isSeededRule,
        rule_id:
          String(
            rule.rule_id
            ||
            ''
          ),
      },
    });

  const existing =
    existingRows?.[0]
    ||
    null;

  if (existing) {
    if (
      String(
        existing.status
        ||
        ''
      ).toUpperCase() !==
        'SUCCESS'
      &&
      String(
        existing.destination_id
        ||
        ''
      ) !==
        String(
          destination.destination_id
          ||
          ''
        )
    ) {
      await bigquery.query({
        location:
          LOCATION,
        query: `
          UPDATE ${table('event_outbox')}
          SET
            destination_id=@destination_id,
            updated_at=CURRENT_TIMESTAMP()
          WHERE
            outbox_id=@outbox_id
        `,
        params: {
          destination_id:
            destination.destination_id,
          outbox_id:
            existing.outbox_id,
        },
      });

      return {
        ...existing,
        destination_id:
          destination.destination_id,
      };
    }

    return existing;
  }

  // Dataset ID is the actual Meta delivery endpoint. Do not use
  // the physical Growth OS destination row ID as part of the
  // external event identity.
  const destinationDeliveryKey =
    [
      'meta_dataset',
      String(
        destination.dataset_id
        ||
        ''
      ),
    ].join('|');

  const eventId =
    deterministic(
      'mev',
      [
        job.workspaceId,
        job.brandId,
        job.sourceEventId,
        ruleDeliveryKey,
        destinationDeliveryKey,
        rule.meta_event_name,
      ]
    );

  const outboxId =
    deterministic(
      'meout',
      [
        job.workspaceId,
        job.brandId,
        eventId,
      ]
    );

  const userData =
    buildUserData(
      job.identity
    );

  const customData = {
    ...(
      job.data
      &&
      typeof job.data ===
        'object'
        ?
          job.data
        :
          {}
    ),
    growthos_source:
      job.source,
    growthos_source_event:
      job.sourceEvent,
    growthos_source_event_id:
      job.sourceEventId,
  };

  await bigquery.query({
    location:
      LOCATION,
    query: `
      MERGE ${table('event_outbox')} AS target
      USING (
        SELECT
          @outbox_id AS outbox_id
      ) AS source
      ON target.outbox_id=source.outbox_id
      WHEN NOT MATCHED THEN
        INSERT (
          outbox_id,
          workspace_id,
          brand_id,
          source,
          source_event,
          source_event_id,
          source_entity_id,
          rule_id,
          destination_id,
          meta_event_name,
          event_id,
          occurred_at,
          action_source,
          user_data,
          custom_data,
          status,
          attempts,
          next_attempt_at,
          last_error,
          last_http_status,
          created_at,
          updated_at,
          sent_at
        )
        VALUES (
          @outbox_id,
          @workspace_id,
          @brand_id,
          @source,
          @source_event,
          @source_event_id,
          @source_entity_id,
          @rule_id,
          @destination_id,
          @meta_event_name,
          @event_id,
          @occurred_at,
          @action_source,
          PARSE_JSON(@user_data_json),
          PARSE_JSON(@custom_data_json),
          'PENDING',
          0,
          CURRENT_TIMESTAMP(),
          NULL,
          NULL,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP(),
          NULL
        )
    `,
    params: {
      outbox_id:
        outboxId,
      workspace_id:
        job.workspaceId,
      brand_id:
        job.brandId,
      source:
        job.source,
      source_event:
        job.sourceEvent,
      source_event_id:
        job.sourceEventId,
      source_entity_id:
        job.sourceEntityId
        ||
        null,
      rule_id:
        rule.rule_id,
      destination_id:
        destination.destination_id,
      meta_event_name:
        rule.meta_event_name,
      event_id:
        eventId,
      occurred_at:
        new Date(
          job.occurredAt
        ),
      action_source:
        rule.action_source
        ||
        'website',
      user_data_json:
        JSON.stringify(
          userData
        ),
      custom_data_json:
        JSON.stringify(
          customData
        ),
    },
    types: {
      source_entity_id:
        'STRING',
      occurred_at:
        'TIMESTAMP',
    },
  });

  const [
    rows,
  ] =
    await bigquery.query({
      location:
        LOCATION,
      query: `
        SELECT
          *
        FROM ${table('event_outbox')}
        WHERE
          outbox_id=@outbox_id
        LIMIT 1
      `,
      params: {
        outbox_id:
          outboxId,
      },
    });

  return rows?.[0]
    ||
    null;
}

async function deliverOutbox(
  row,
  destination,
  settings
) {
  if (
    !row
    ||
    String(
      row.status
      ||
      ''
    ).toUpperCase() ===
      'SUCCESS'
  ) {
    return {
      ok:
        true,
      skipped:
        'ALREADY_SUCCESS',
    };
  }

  const nextAttemptAt =
    row.next_attempt_at
      ?
        new Date(
          row.next_attempt_at
        ).getTime()
      :
        0;

  if (
    String(
      row.status
      ||
      ''
    ).toUpperCase() ===
      'RETRY'
    &&
    Number.isFinite(
      nextAttemptAt
    )
    &&
    nextAttemptAt >
      Date.now()
  ) {
    return {
      ok:
        false,
      transient:
        true,
      deferred:
        true,
      status:
        'RETRY',
      attemptNumber:
        Number(
          row.attempts
          ||
          0
        ),
      error:
        'META_EVENTS_RETRY_NOT_DUE',
      httpStatus:
        Number(
          row.last_http_status
          ||
          0
        ),
    };
  }

  const secret =
    await readSecret(
      destination
        .credential_secret_name
    );

  const accessToken =
    String(
      secret?.access_token
      ||
      ''
    ).trim();

  if (!accessToken) {
    throw new Error(
      'META_EVENTS_ACCESS_TOKEN_MISSING'
    );
  }

  const eventTime =
    Math.floor(
      new Date(
        row.occurred_at
        ||
        row.created_at
        ||
        Date.now()
      ).getTime()
      /
      1000
    );

  const event = {
    event_name:
      row.meta_event_name,
    event_time:
      Number.isFinite(
        eventTime
      )
        ?
          eventTime
        :
          Math.floor(
            Date.now()
            /
            1000
          ),
    event_id:
      row.event_id,
    action_source:
      row.action_source
      ||
      settings.default_action_source
      ||
      'website',
    user_data:
      readJson(
        row.user_data,
        {}
      ),
    custom_data:
      readJson(
        row.custom_data,
        {}
      ),
  };

  const body = {
    data: [
      event,
    ],
    ...(
      destination.test_event_code
      ?
        {
          test_event_code:
            destination.test_event_code,
        }
      :
        {}
    ),
  };

  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}`
    +
    `/${encodeURIComponent(destination.dataset_id)}/events`
    +
    `?access_token=${encodeURIComponent(accessToken)}`;

  const attemptNumber =
    Number(
      row.attempts
      ||
      0
    )
    +
    1;

  let httpStatus =
    0;

  let responsePayload =
    null;

  let success =
    false;

  let errorMessage =
    null;

  try {
    const response =
      await fetch(
        url,
        {
          method:
            'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body:
            JSON.stringify(
              body
            ),
        }
      );

    httpStatus =
      response.status;

    const raw =
      await response.text();

    try {
      responsePayload =
        JSON.parse(
          raw
        );
    } catch {
      responsePayload = {
        raw:
          raw.slice(
            0,
            4000
          ),
      };
    }

    success =
      response.ok
      &&
      !responsePayload?.error;

    if (!success) {
      errorMessage =
        responsePayload
          ?.error
          ?.message
        ||
        `Meta HTTP ${httpStatus}`;
    }
  } catch (
    error
  ) {
    errorMessage =
      error?.message
      ||
      'Meta request failed';
  }

  await bigquery.query({
    location:
      LOCATION,
    query: `
      INSERT INTO ${table('event_delivery_attempts')} (
        attempt_id,
        outbox_id,
        workspace_id,
        brand_id,
        destination_id,
        attempt_number,
        request_payload,
        response_payload,
        http_status,
        success,
        error,
        created_at
      )
      VALUES (
        @attempt_id,
        @outbox_id,
        @workspace_id,
        @brand_id,
        @destination_id,
        @attempt_number,
        PARSE_JSON(@request_payload),
        PARSE_JSON(@response_payload),
        @http_status,
        @success,
        @error,
        CURRENT_TIMESTAMP()
      )
    `,
    params: {
      attempt_id:
        deterministic(
          'meatt',
          [
            row.outbox_id,
            attemptNumber,
            Date.now(),
          ]
        ),
      outbox_id:
        row.outbox_id,
      workspace_id:
        row.workspace_id,
      brand_id:
        row.brand_id,
      destination_id:
        destination.destination_id,
      attempt_number:
        attemptNumber,
      request_payload:
        JSON.stringify(
          {
            ...body,
            data: body.data.map(
              item => ({
                ...item,
                user_data:
                  item.user_data,
              })
            ),
          }
        ),
      response_payload:
        JSON.stringify(
          responsePayload
          ||
          {}
        ),
      http_status:
        httpStatus
        ||
        null,
      success,
      error:
        errorMessage,
    },
    types: {
      attempt_number:
        'INT64',
      http_status:
        'INT64',
      error:
        'STRING',
    },
  });

  const maxAttempts =
    Math.max(
      1,
      Number(
        settings.max_attempts
        ||
        5
      )
    );

  const retryDelay =
    Math.max(
      10,
      Number(
        settings.retry_delay_seconds
        ||
        60
      )
    );

  const transient =
    httpStatus ===
      0
    ||
    httpStatus ===
      408
    ||
    httpStatus ===
      429
    ||
    httpStatus >=
      500;

  const nextStatus =
    success
      ?
        'SUCCESS'
      :
    transient
    &&
    attemptNumber <
      maxAttempts
      ?
        'RETRY'
      :
        'FAILED';

  await bigquery.query({
    location:
      LOCATION,
    query: `
      UPDATE ${table('event_outbox')}
      SET
        status=@status,
        attempts=@attempts,
        next_attempt_at=
          IF(
            @status='RETRY',
            TIMESTAMP_ADD(
              CURRENT_TIMESTAMP(),
              INTERVAL @retry_delay SECOND
            ),
            NULL
          ),
        last_error=@error,
        last_http_status=@http_status,
        updated_at=CURRENT_TIMESTAMP(),
        sent_at=
          IF(
            @status='SUCCESS',
            CURRENT_TIMESTAMP(),
            sent_at
          )
      WHERE
        outbox_id=@outbox_id
    `,
    params: {
      status:
        nextStatus,
      attempts:
        attemptNumber,
      retry_delay:
        retryDelay,
      error:
        errorMessage,
      http_status:
        httpStatus
        ||
        null,
      outbox_id:
        row.outbox_id,
    },
    types: {
      attempts:
        'INT64',
      retry_delay:
        'INT64',
      http_status:
        'INT64',
      error:
        'STRING',
    },
  });

  return {
    ok:
      success,
    transient:
      !success
      &&
      transient
      &&
      attemptNumber <
        maxAttempts,
    status:
      nextStatus,
    attemptNumber,
    error:
      errorMessage,
    httpStatus,
  };
}



// ============================================================
// TEMPORARY META EVENTS SOURCE ALLOWLIST
//
// Current Growth OS operating mode:
//   Call Commerce -> Meta remains ACTIVE.
//   All other Meta Events sources are PAUSED.
//
// This gate runs BEFORE event_inbox, rules, outbox and Meta
// delivery, so paused sources do not create runtime BigQuery
// DML or Meta events.
//
// Multi-brand behavior is unchanged. The allowlist is source-
// based, not workspace/brand based.
//
// Re-enable sources later by changing:
//   GROWTHOS_META_EVENTS_ALLOWED_SOURCES
// Example:
//   call_commerce,commerce,customer,web,lead_commerce,retention
// ============================================================

const META_EVENTS_ALLOWED_SOURCES =
  new Set(
    String(
      process.env.GROWTHOS_META_EVENTS_ALLOWED_SOURCES
      ||
      'call_commerce'
    )
      .split(',')
      .map(
        value =>
          value.trim()
      )
      .filter(
        Boolean
      )
  );

function isMetaEventsSourceAllowed(
  source
) {
  return META_EVENTS_ALLOWED_SOURCES.has(
    String(
      source
      ||
      ''
    ).trim()
  );
}


export async function processMetaSourceEvent(
  inputJob
) {
  const job =
    normalizeCanonicalSourceJob(
      inputJob
    );


  // ==========================================================
  // UNIVERSAL ENVELOPE VALIDATION
  // ==========================================================

  validateCanonicalSourceJob(
    job
  );


  // ==========================================================
  // SOURCE PAUSE GATE
  //
  // IMPORTANT:
  // This intentionally runs before DURABLE INBOX FIRST.
  // Paused sources are acknowledged without touching BigQuery
  // event_inbox/outbox or Meta delivery.
  // ==========================================================

  if (
    !isMetaEventsSourceAllowed(
      job.source
    )
  ) {
    console.log(
      'META_EVENTS_SOURCE_PAUSED',
      {
        sourceEventId:
          job.sourceEventId,

        workspaceId:
          job.workspaceId,

        brandId:
          job.brandId,

        source:
          job.source,

        sourceEvent:
          job.sourceEvent,

        allowedSources:
          [
            ...META_EVENTS_ALLOWED_SOURCES,
          ],
      }
    );

    return {
      processed:
        0,

      skipped:
        'SOURCE_PAUSED',

      source:
        job.source,

      sourceEvent:
        job.sourceEvent,
    };
  }




  // ==========================================================
  // DURABLE INBOX FIRST
  // ==========================================================

  const inboxRow =
    await upsertEventInbox(
      job
    );


  if (
    !inboxRow
    ||
    !inboxRow.inbox_id
  ) {
    throw new Error(
      'META_EVENTS_INBOX_WRITE_FAILED'
    );
  }


  // ==========================================================
  // SINGLE PROCESSING OWNER
  // ==========================================================

  const processingClaim =
    await claimInboxProcessing(
      inboxRow.inbox_id
    );


  // ----------------------------------------------------------
  // ALREADY COMPLETED
  // ----------------------------------------------------------
  //
  // This is a harmless Pub/Sub duplicate.
  //
  // Acknowledge it normally.
  // ----------------------------------------------------------

  if (
    !processingClaim.claimed
    &&
    processingClaim.reason ===
      'ALREADY_PROCESSED'
  ) {
    return {
      processed:
        0,

      skipped:
        'ALREADY_PROCESSED',

      inboxId:
        inboxRow.inbox_id,

      processingStatus:
        'COMPLETED',

      processingAttempts:
        Number(
          processingClaim.row
            ?.processing_attempts
          ??
          0
        ),

      duplicateCount:
        Number(
          processingClaim.row
            ?.duplicate_count
          ??
          inboxRow.duplicate_count
          ??
          0
        ),
    };
  }


  // ----------------------------------------------------------
  // ANOTHER WORKER OWNS IT
  // ----------------------------------------------------------
  //
  // IMPORTANT:
  //
  // Do NOT acknowledge this as success.
  //
  // If the owner crashes, Pub/Sub must continue redelivering
  // until the claim either completes or becomes stale.
  // ----------------------------------------------------------

  if (
    !processingClaim.claimed
    &&
    processingClaim.reason ===
      'ALREADY_IN_PROGRESS'
  ) {
    const error =
      new Error(
        'META_EVENTS_PROCESSING_ALREADY_IN_PROGRESS'
      );

    error.code =
      'META_EVENTS_PROCESSING_ALREADY_IN_PROGRESS';

    throw error;
  }


  // ----------------------------------------------------------
  // CLAIM COULD NOT BE ACQUIRED
  // ----------------------------------------------------------

  if (
    !processingClaim.claimed
    ||
    !processingClaim.claimId
  ) {
    const error =
      new Error(
        'META_EVENTS_PROCESSING_CLAIM_NOT_ACQUIRED'
      );

    error.code =
      'META_EVENTS_PROCESSING_CLAIM_NOT_ACQUIRED';

    throw error;
  }


  const claimId =
    processingClaim.claimId;


  // ==========================================================
  // OWNER-ONLY PROCESSING
  // ==========================================================

  try {
    // ========================================================
    // PLATFORM EVENT CATALOGUE LOOKUP
    // ========================================================

    const catalogueResult =
      await readEventCatalogueDefinition(
        job
      );


    if (
      !catalogueResult.ok
    ) {
      await markInboxValidationResult(
        inboxRow.inbox_id,
        'INVALID',
        'REJECTED',
        catalogueResult.error
      );


      await completeInboxProcessing(
        inboxRow.inbox_id,
        claimId
      );


      return {
        processed:
          0,

        skipped:
          'INVALID_EVENT',

        validationStatus:
          'INVALID',

        validationError:
          catalogueResult.error,

        inboxId:
          inboxRow.inbox_id,

        processingStatus:
          'COMPLETED',

        duplicateCount:
          Number(
            inboxRow.duplicate_count
            ??
            0
          ),
      };
    }


    // ========================================================
    // EVENT-SPECIFIC CONTRACT VALIDATION
    // ========================================================

    const validation =
      validateAgainstCatalogue(
        job,
        catalogueResult.definition
      );


    if (
      !validation.valid
    ) {
      await markInboxValidationResult(
        inboxRow.inbox_id,
        'INVALID',
        'REJECTED',
        validation.error
      );


      await completeInboxProcessing(
        inboxRow.inbox_id,
        claimId
      );


      return {
        processed:
          0,

        skipped:
          'INVALID_EVENT',

        validationStatus:
          'INVALID',

        validationError:
          validation.error,

        inboxId:
          inboxRow.inbox_id,

        processingStatus:
          'COMPLETED',

        duplicateCount:
          Number(
            inboxRow.duplicate_count
            ??
            0
          ),
      };
    }


    // ========================================================
    // VALID BUT NOT ROUTABLE
    // ========================================================

    if (
      !validation.routingAllowed
    ) {
      await markInboxValidationResult(
        inboxRow.inbox_id,
        'VALID',
        'NOT_ROUTABLE',
        null
      );


      await completeInboxProcessing(
        inboxRow.inbox_id,
        claimId
      );


      return {
        processed:
          0,

        skipped:
          'CATALOGUE_ROUTING_NOT_ALLOWED',

        validationStatus:
          'VALID',

        routingStatus:
          'NOT_ROUTABLE',

        processingStatus:
          'COMPLETED',

        inboxId:
          inboxRow.inbox_id,

        duplicateCount:
          Number(
            inboxRow.duplicate_count
            ??
            0
          ),
      };
    }


    // ========================================================
    // VALID + ROUTABLE
    // ========================================================

    await markInboxValidationResult(
      inboxRow.inbox_id,
      'VALID',
      'PENDING',
      null
    );


    // Only validated and owned events can touch source/rules.
    await markSourceEvent(
      job
    );


    const settings =
      await readSettings(
        job.workspaceId,
        job.brandId
      );


    const rules =
      await readRules(
        job
      );


    // ========================================================
    // NO MATCHING RULE
    // ========================================================

    if (
      rules.length ===
        0
    ) {
      await markInboxRoutingStatus(
        inboxRow.inbox_id,
        'NO_MATCHING_RULES'
      );


      await completeInboxProcessing(
        inboxRow.inbox_id,
        claimId
      );


      return {
        processed:
          0,

        skipped:
          'NO_MATCHING_RULES',

        inboxId:
          inboxRow.inbox_id,

        processingStatus:
          'COMPLETED',

        duplicateCount:
          Number(
            inboxRow.duplicate_count
            ??
            0
          ),
      };
    }


    // ========================================================
    // ROUTED
    // ========================================================

    await markInboxRoutingStatus(
      inboxRow.inbox_id,
      'ROUTED'
    );


    let processed =
      0;

    let succeeded =
      0;

    let failed =
      0;


    const transientErrors =
      [];


    for (
      const rule
      of rules
    ) {
      const destinations =
        await readDestinations(
          job,
          rule
        );


      if (
        destinations.length ===
          0
      ) {
        continue;
      }


      for (
        const destination
        of destinations
      ) {
        const outbox =
          await upsertOutbox(
            job,
            rule,
            destination
          );


        const result =
          await deliverOutbox(
            outbox,
            destination,
            settings
          );


        processed +=
          1;


        if (
          result.ok
        ) {
          succeeded +=
            1;
        } else {
          failed +=
            1;


          if (
            result.transient
          ) {
            transientErrors.push(
              result.error
              ||
              'META_TRANSIENT_FAILURE'
            );
          }
        }
      }
    }


    // ========================================================
    // TRANSIENT DELIVERY FAILURE
    // ========================================================
    //
    // Do not complete the inbox.
    //
    // Release ownership and throw so Pub/Sub retries.
    // ========================================================

    if (
      transientErrors.length >
        0
    ) {
      const error =
        new Error(
          transientErrors[0]
        );


      error.code =
        'META_EVENTS_TRANSIENT_DELIVERY_FAILURE';


      throw error;
    }


    // ========================================================
    // PROCESSING COMPLETE
    // ========================================================

    await completeInboxProcessing(
      inboxRow.inbox_id,
      claimId
    );


    return {
      processed,
      succeeded,
      failed,

      inboxId:
        inboxRow.inbox_id,

      processingStatus:
        'COMPLETED',

      duplicateCount:
        Number(
          inboxRow.duplicate_count
          ??
          0
        ),
    };


  } catch (
    error
  ) {
    // ========================================================
    // RELEASE CLAIM
    // ========================================================
    //
    // We attempt to release only the claim owned by this
    // specific worker.
    //
    // If this update itself fails, the claim remains PROCESSING.
    // Pub/Sub still gets the thrown error, and the stale-claim
    // recovery path can reclaim it after 15 minutes.
    // ========================================================

    try {
      await releaseInboxProcessingForRetry(
        inboxRow.inbox_id,
        claimId,
        error
      );
    } catch (
      releaseError
    ) {
      console.error(
        'META_EVENTS_PROCESSING_RELEASE_FAILED',
        {
          inboxId:
            inboxRow.inbox_id,

          claimId,

          error:
            processingErrorText(
              releaseError
            ),
        }
      );
    }


    throw error;
  }
}

export function getMetaEventsWorkerConfig() {
  return {
    projectId:
      PROJECT_ID,
    datasetId:
      DATASET_ID,
    controlDataset:
      CONTROL_DATASET,
    location:
      LOCATION,
    graphVersion:
      GRAPH_VERSION,
  };
}

