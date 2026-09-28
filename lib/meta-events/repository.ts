import 'server-only';

import crypto from 'crypto';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  getIntegrationConnection,
} from '@/lib/integrations/store';

import {
  deleteIntegrationSecret,
  storeIntegrationSecret,
} from '@/lib/integrations/secrets';

import {
  META_EVENTS_DEFAULTS,
  META_EVENTS_LOCATION,
} from './config';

import {
  ensureMetaEventsSchema,
  metaEventsTable,
} from './schema';

import type {
  MetaEventsRuleInput,
  MetaEventsSettings,
} from './types';

function id(
  prefix: string
) {
  return `${prefix}_${crypto
    .randomUUID()
    .replace(/-/g, '')}`;
}

function deterministic(
  prefix: string,
  parts: string[]
) {
  return `${prefix}_${crypto
    .createHash('sha256')
    .update(parts.join(':'))
    .digest('hex')
    .slice(0, 28)}`;
}

function clean(
  value: unknown
) {
  return String(
    value
    ??
    ''
  ).trim();
}

async function seedSource(
  workspaceId: string,
  brandId: string,
  source: string,
  label: string
) {
  await bigquery.query({
    location:
      META_EVENTS_LOCATION,
    query: `
      MERGE ${metaEventsTable('event_source_registry')} AS target
      USING (
        SELECT
          @workspace_id AS workspace_id,
          @brand_id AS brand_id,
          @source AS source,
          @label AS label
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
          source_row.label,
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

async function seedRule(
  input: {
    workspaceId: string;
    brandId: string;
    source: string;
    sourceEvent: string;
    name: string;
    metaEventName: string;
    actionSource: string;
    priority: number;
  }
) {
  const ruleId =
    deterministic(
      'merule',
      [
        input.workspaceId,
        input.brandId,
        input.source,
        input.sourceEvent,
        input.metaEventName,
      ]
    );

  await bigquery.query({
    location:
      META_EVENTS_LOCATION,
    query: `
      MERGE ${metaEventsTable('event_rules')} AS target
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
        input.workspaceId,
      brand_id:
        input.brandId,
      name:
        input.name,
      source:
        input.source,
      source_event:
        input.sourceEvent,
      meta_event_name:
        input.metaEventName,
      action_source:
        input.actionSource,
      priority:
        input.priority,
    },
    types: {
      priority:
        'INT64',
    },
  });
}

export async function syncDefaultMetaEventsDestinationFromConnection(
  workspaceId: string,
  brandId: string
) {
  const connection =
    await getIntegrationConnection(
      workspaceId,
      brandId,
      'meta_events'
    );

  if (
    !connection
    ||
    String(
      connection.status
      ||
      ''
    ).toLowerCase() !==
      'connected'
    ||
    !clean(
      connection.provider_account_id
    )
    ||
    !clean(
      connection.secret_name
    )
  ) {
    return null;
  }

  const datasetId =
    clean(
      connection.provider_account_id
    );

  const destinationId =
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
      META_EVENTS_LOCATION,
    query: `
      UPDATE ${metaEventsTable('event_destinations')}
      SET
        is_default=FALSE,
        updated_at=CURRENT_TIMESTAMP()
      WHERE
        workspace_id=@workspace_id
        AND brand_id=@brand_id
        AND destination_id!=@destination_id
        AND is_default=TRUE;

      MERGE ${metaEventsTable('event_destinations')} AS target
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
        clean(
          connection.provider_account_name
        )
        ||
        `Meta Dataset ${datasetId}`,
      dataset_id:
        datasetId,
      secret_name:
        clean(
          connection.secret_name
        ),
    },
  });

  return destinationId;
}

export async function ensureMetaEventsTenant(
  workspaceId: string,
  brandId: string
) {
  await ensureMetaEventsSchema();

  await bigquery.query({
    location:
      META_EVENTS_LOCATION,
    query: `
      MERGE ${metaEventsTable('event_settings')} AS target
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
          @max_attempts,
          @retry_delay_seconds,
          @batch_size,
          @default_action_source,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `,
    params: {
      workspace_id:
        workspaceId,
      brand_id:
        brandId,
      max_attempts:
        META_EVENTS_DEFAULTS.maxAttempts,
      retry_delay_seconds:
        META_EVENTS_DEFAULTS.retryDelaySeconds,
      batch_size:
        META_EVENTS_DEFAULTS.batchSize,
      default_action_source:
        META_EVENTS_DEFAULTS.defaultActionSource,
    },
    types: {
      max_attempts:
        'INT64',
      retry_delay_seconds:
        'INT64',
      batch_size:
        'INT64',
    },
  });

  await seedSource(
    workspaceId,
    brandId,
    'call_commerce',
    'Call Commerce'
  );

  await seedSource(
    workspaceId,
    brandId,
    'shopify',
    'Shopify'
  );

  const defaultRules = [
    {
      source:
        'call_commerce',
      sourceEvent:
        'call_commerce.connected',
      name:
        'Connected call lead',
      metaEventName:
        'ConnectedCallLead',
      actionSource:
        'phone_call',
      priority:
        10,
    },
    {
      source:
        'call_commerce',
      sourceEvent:
        'call_commerce.qualified',
      name:
        'Qualified call lead',
      metaEventName:
        'QualifiedCallLead',
      actionSource:
        'phone_call',
      priority:
        20,
    },
    {
      source:
        'call_commerce',
      sourceEvent:
        'call_commerce.unqualified',
      name:
        'Unqualified call lead',
      metaEventName:
        'UnqualifiedCallLead',
      actionSource:
        'phone_call',
      priority:
        30,
    },
    {
      source:
        'call_commerce',
      sourceEvent:
        'call_commerce.purchased',
      name:
        'Purchased call lead',
      metaEventName:
        'ConvertedCallLead',
      actionSource:
        'phone_call',
      priority:
        40,
    },
    {
      source:
        'shopify',
      sourceEvent:
        'shopify.order_paid_new',
      name:
        'New customer purchase',
      metaEventName:
        'NewCustomerPurchase',
      actionSource:
        'website',
      priority:
        50,
    },
    {
      source:
        'shopify',
      sourceEvent:
        'shopify.order_paid_existing',
      name:
        'Existing customer purchase',
      metaEventName:
        'ExistingCustomerPurchase',
      actionSource:
        'website',
      priority:
        60,
    },
  ];

  for (
    const rule
    of defaultRules
  ) {
    await seedRule({
      workspaceId,
      brandId,
      ...rule,
    });
  }

  await syncDefaultMetaEventsDestinationFromConnection(
    workspaceId,
    brandId
  );
}

export async function getMetaEventsOverview(
  workspaceId: string,
  brandId: string
) {
  const [
    [metricRows],
    [sourceRows],
    [destinationRows],
    [ruleRows],
  ] =
    await Promise.all([
      bigquery.query({
        location:
          META_EVENTS_LOCATION,
        query: `
          SELECT
            COUNT(*) AS total,
            COUNTIF(status='SUCCESS') AS success,
            COUNTIF(status='PENDING') AS pending,
            COUNTIF(status='RETRY') AS retry,
            COUNTIF(status='FAILED') AS failed,
            COUNTIF(created_at>=TIMESTAMP_SUB(CURRENT_TIMESTAMP(),INTERVAL 24 HOUR)) AS last_24h,
            MAX(created_at) AS last_event_at,
            MAX(sent_at) AS last_sent_at
          FROM ${metaEventsTable('event_outbox')}
          WHERE
            workspace_id=@workspace_id
            AND brand_id=@brand_id
        `,
        params: {
          workspace_id:
            workspaceId,
          brand_id:
            brandId,
        },
      }),
      bigquery.query({
        location:
          META_EVENTS_LOCATION,
        query: `
          SELECT
            source,
            label,
            enabled,
            event_count,
            last_event_at
          FROM ${metaEventsTable('event_source_registry')}
          WHERE
            workspace_id=@workspace_id
            AND brand_id=@brand_id
          ORDER BY label
        `,
        params: {
          workspace_id:
            workspaceId,
          brand_id:
            brandId,
        },
      }),
      bigquery.query({
        location:
          META_EVENTS_LOCATION,
        query: `
          SELECT
            COUNT(*) AS total,
            COUNTIF(status='active') AS active,
            COUNTIF(is_default=TRUE AND status='active') AS default_active
          FROM ${metaEventsTable('event_destinations')}
          WHERE
            workspace_id=@workspace_id
            AND brand_id=@brand_id
        `,
        params: {
          workspace_id:
            workspaceId,
          brand_id:
            brandId,
        },
      }),
      bigquery.query({
        location:
          META_EVENTS_LOCATION,
        query: `
          SELECT
            COUNT(*) AS total,
            COUNTIF(enabled=TRUE) AS enabled
          FROM ${metaEventsTable('event_rules')}
          WHERE
            workspace_id=@workspace_id
            AND brand_id=@brand_id
        `,
        params: {
          workspace_id:
            workspaceId,
          brand_id:
            brandId,
        },
      }),
    ]);

  const metrics =
    (metricRows as any[])?.[0]
    ||
    {};

  const destinationMetrics =
    (destinationRows as any[])?.[0]
    ||
    {};

  const ruleMetrics =
    (ruleRows as any[])?.[0]
    ||
    {};

  return {
    metrics,
    sources:
      sourceRows,
    destinations:
      destinationMetrics,
    rules:
      ruleMetrics,
  };
}

export async function listMetaEventRules(
  workspaceId: string,
  brandId: string
) {
  const [rows] =
    await bigquery.query({
      location:
        META_EVENTS_LOCATION,
      query: `
        SELECT
          r.*,
          d.name AS destination_name,
          d.dataset_id AS destination_dataset_id
        FROM ${metaEventsTable('event_rules')} r
        LEFT JOIN ${metaEventsTable('event_destinations')} d
          ON
            d.workspace_id=r.workspace_id
            AND d.brand_id=r.brand_id
            AND d.destination_id=r.destination_id
        WHERE
          r.workspace_id=@workspace_id
          AND r.brand_id=@brand_id
        ORDER BY
          r.priority,
          r.created_at
      `,
      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
      },
    });

  return rows as any[];
}

export async function upsertMetaEventRule(
  workspaceId: string,
  brandId: string,
  input: MetaEventsRuleInput
) {
  // Runtime rule mutations must not run the full tenant bootstrap.
  // The bootstrap seeds event_rules and can collide with this mutation.
  await ensureMetaEventsSchema();

  const name =
    clean(
      input.name
    );

  const source =
    clean(
      input.source
    );

  const sourceEvent =
    clean(
      input.sourceEvent
    );

  const metaEventName =
    clean(
      input.metaEventName
    );

  if (
    !name
    ||
    !source
    ||
    !sourceEvent
    ||
    !metaEventName
  ) {
    throw new Error(
      'META_EVENT_RULE_FIELDS_REQUIRED'
    );
  }

  const destinationId =
    clean(
      input.destinationId
    );

  const actionSource =
    clean(
      input.actionSource
    )
    ||
    'website';

  const conditionJson =
    JSON.stringify(
      input.condition
      ??
      {}
    );

  // If this is an edit, preserve the supplied rule id.
  // If this is a create, derive a deterministic id from the logical
  // routing definition so an accidental duplicate submission is idempotent.
  const ruleId =
    clean(
      input.ruleId
    )
    ||
    deterministic(
      'merule',
      [
        workspaceId,
        brandId,
        'custom',
        source,
        sourceEvent,
        metaEventName,
        destinationId
        ||
        'default',
        actionSource,
        conditionJson,
      ]
    );

  await bigquery.query({
    location:
      META_EVENTS_LOCATION,
    query: `
      MERGE ${metaEventsTable('event_rules')} AS target
      USING (
        SELECT
          @rule_id AS rule_id
      ) AS source_row
      ON
        target.rule_id=source_row.rule_id
        AND target.workspace_id=@workspace_id
        AND target.brand_id=@brand_id

      WHEN MATCHED THEN
        UPDATE SET
          name=@name,
          source=@source,
          source_event=@source_event,
          meta_event_name=@meta_event_name,
          destination_id=@destination_id,
          action_source=@action_source,
          condition_json=PARSE_JSON(@condition_json),
          enabled=@enabled,
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
          @destination_id,
          @action_source,
          PARSE_JSON(@condition_json),
          @enabled,
          FALSE,
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
      destination_id:
        destinationId
        ||
        null,
      action_source:
        actionSource,
      condition_json:
        conditionJson,
      enabled:
        input.enabled
        !==
        false,
      priority:
        Number.isFinite(
          Number(
            input.priority
          )
        )
          ?
            Number(
              input.priority
            )
          :
            100,
    },
    types: {
      destination_id:
        'STRING',
      priority:
        'INT64',
    },
  });

  return ruleId;
}

export async function setMetaEventRuleEnabled(
  workspaceId: string,
  brandId: string,
  ruleId: string,
  enabled: boolean
) {
  // Schema assurance only. Do not reseed event_rules on a toggle.
  await ensureMetaEventsSchema();

  const cleanRuleId =
    clean(
      ruleId
    );

  if (
    !cleanRuleId
  ) {
    throw new Error(
      'META_EVENT_RULE_ID_REQUIRED'
    );
  }

  await bigquery.query({
    location:
      META_EVENTS_LOCATION,
    query: `
      UPDATE ${metaEventsTable('event_rules')}
      SET
        enabled=@enabled,
        updated_at=CURRENT_TIMESTAMP()
      WHERE
        workspace_id=@workspace_id
        AND brand_id=@brand_id
        AND rule_id=@rule_id
    `,
    params: {
      enabled,
      workspace_id:
        workspaceId,
      brand_id:
        brandId,
      rule_id:
        cleanRuleId,
    },
  });
}

export async function deleteMetaEventRule(
  workspaceId: string,
  brandId: string,
  ruleId: string
) {
  // Schema assurance only. Do not reseed event_rules before deleting.
  await ensureMetaEventsSchema();

  const cleanRuleId =
    clean(
      ruleId
    );

  if (
    !cleanRuleId
  ) {
    throw new Error(
      'META_EVENT_RULE_ID_REQUIRED'
    );
  }

  await bigquery.query({
    location:
      META_EVENTS_LOCATION,
    query: `
      DELETE FROM ${metaEventsTable('event_rules')}
      WHERE
        workspace_id=@workspace_id
        AND brand_id=@brand_id
        AND rule_id=@rule_id
        AND seeded=FALSE
    `,
    params: {
      workspace_id:
        workspaceId,
      brand_id:
        brandId,
      rule_id:
        cleanRuleId,
    },
  });
}

export async function listMetaEventLog(
  workspaceId: string,
  brandId: string,
  input?: {
    limit?: number;
    source?: string | null;
    status?: string | null;
  }
) {
  const limit =
    Math.max(
      1,
      Math.min(
        Number(
          input?.limit
          ||
          200
        ),
        500
      )
    );

  const [rows] =
    await bigquery.query({
      location:
        META_EVENTS_LOCATION,
      query: `
        SELECT
          *
        FROM ${metaEventsTable('event_outbox')}
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND (
            @source=''
            OR source=@source
          )
          AND (
            @status=''
            OR status=@status
          )
        ORDER BY
          created_at DESC
        LIMIT @limit
      `,
      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
        source:
          clean(
            input?.source
          ),
        status:
          clean(
            input?.status
          ).toUpperCase(),
        limit,
      },
      types: {
        limit:
          'INT64',
      },
    });

  return rows as any[];
}

export async function listMetaEventSources(
  workspaceId: string,
  brandId: string
) {
  const [rows] =
    await bigquery.query({
      location:
        META_EVENTS_LOCATION,
      query: `
        SELECT
          *
        FROM ${metaEventsTable('event_source_registry')}
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
        ORDER BY
          label
      `,
      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
      },
    });

  return rows as any[];
}

export async function listMetaEventDestinations(
  workspaceId: string,
  brandId: string
) {
  const [rows] =
    await bigquery.query({
      location:
        META_EVENTS_LOCATION,
      query: `
        SELECT
          destination_id,
          workspace_id,
          brand_id,
          name,
          dataset_id,
          status,
          is_default,
          test_event_code,
          credential_secret_name IS NOT NULL AS has_credential,
          created_at,
          updated_at
        FROM ${metaEventsTable('event_destinations')}
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
        ORDER BY
          is_default DESC,
          created_at
      `,
      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
      },
    });

  return rows as any[];
}

export async function createMetaEventDestination(
  workspaceId: string,
  brandId: string,
  input: {
    name?: string | null;
    datasetId: string;
    accessToken: string;
    isDefault?: boolean;
    testEventCode?: string | null;
  }
) {
  await ensureMetaEventsTenant(
    workspaceId,
    brandId
  );

  const datasetId =
    clean(
      input.datasetId
    );

  const accessToken =
    clean(
      input.accessToken
    );

  if (
    !datasetId
    ||
    !accessToken
  ) {
    throw new Error(
      'META_EVENT_DESTINATION_FIELDS_REQUIRED'
    );
  }

  const destinationId =
    id(
      'medst'
    );

  const secretName =
    await storeIntegrationSecret({
      workspaceId,
      brandId,
      provider:
        `meta_events_destination_${destinationId}`,
      value: {
        schema_version:
          1,
        credential_type:
          'meta_capi_access_token',
        access_token:
          accessToken,
        dataset_id:
          datasetId,
        updated_at:
          new Date()
            .toISOString(),
      },
    });

  const requestedDefault =
    input.isDefault
    !==
    false;

  if (
    requestedDefault
  ) {
    await bigquery.query({
      location:
        META_EVENTS_LOCATION,
      query: `
        UPDATE ${metaEventsTable('event_destinations')}
        SET
          is_default=FALSE,
          updated_at=CURRENT_TIMESTAMP()
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
      `,
      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
      },
    });
  }

  await bigquery.query({
    location:
      META_EVENTS_LOCATION,
    query: `
      INSERT INTO ${metaEventsTable('event_destinations')} (
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
        @is_default,
        @test_event_code,
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
        clean(
          input.name
        )
        ||
        `Meta Dataset ${datasetId}`,
      dataset_id:
        datasetId,
      secret_name:
        secretName,
      is_default:
        requestedDefault,
      test_event_code:
        clean(
          input.testEventCode
        )
        ||
        null,
    },
  });

  return destinationId;
}

export async function setMetaEventDestinationStatus(
  workspaceId: string,
  brandId: string,
  destinationId: string,
  input: {
    enabled?: boolean;
    isDefault?: boolean;
    name?: string | null;
    testEventCode?: string | null;
  }
) {
  await ensureMetaEventsTenant(
    workspaceId,
    brandId
  );

  if (
    input.isDefault ===
    true
  ) {
    await bigquery.query({
      location:
        META_EVENTS_LOCATION,
      query: `
        UPDATE ${metaEventsTable('event_destinations')}
        SET
          is_default=FALSE,
          updated_at=CURRENT_TIMESTAMP()
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
      `,
      params: {
        workspace_id:
          workspaceId,
        brand_id:
          brandId,
      },
    });
  }

  await bigquery.query({
    location:
      META_EVENTS_LOCATION,
    query: `
      UPDATE ${metaEventsTable('event_destinations')}
      SET
        status=
          IF(
            @has_enabled,
            IF(@enabled,'active','disabled'),
            status
          ),
        is_default=
          IF(
            @has_default,
            @is_default,
            is_default
          ),
        name=
          IF(
            @has_name,
            @name,
            name
          ),
        test_event_code=
          IF(
            @has_test_code,
            NULLIF(@test_event_code,''),
            test_event_code
          ),
        updated_at=CURRENT_TIMESTAMP()
      WHERE
        workspace_id=@workspace_id
        AND brand_id=@brand_id
        AND destination_id=@destination_id
    `,
    params: {
      workspace_id:
        workspaceId,
      brand_id:
        brandId,
      destination_id:
        destinationId,
      has_enabled:
        typeof input.enabled ===
        'boolean',
      enabled:
        input.enabled
        ??
        false,
      has_default:
        typeof input.isDefault ===
        'boolean',
      is_default:
        input.isDefault
        ??
        false,
      has_name:
        input.name
        !==
        undefined,
      name:
        clean(
          input.name
        ),
      has_test_code:
        input.testEventCode
        !==
        undefined,
      test_event_code:
        clean(
          input.testEventCode
        ),
    },
  });
}

export async function deleteMetaEventDestination(
  workspaceId: string,
  brandId: string,
  destinationId: string
) {
  await ensureMetaEventsTenant(
    workspaceId,
    brandId
  );

  const [rows] =
    await bigquery.query({
      location:
        META_EVENTS_LOCATION,
      query: `
        SELECT
          credential_secret_name
        FROM ${metaEventsTable('event_destinations')}
        WHERE
          workspace_id=@workspace_id
          AND brand_id=@brand_id
          AND destination_id=@destination_id
        LIMIT 1
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

  const secretName =
    clean(
      (rows as any[])?.[0]
        ?.credential_secret_name
    );

  await bigquery.query({
    location:
      META_EVENTS_LOCATION,
    query: `
      DELETE FROM ${metaEventsTable('event_destinations')}
      WHERE
        workspace_id=@workspace_id
        AND brand_id=@brand_id
        AND destination_id=@destination_id
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

  if (
    secretName
  ) {
    await deleteIntegrationSecret(
      secretName
    );
  }
}

export async function getMetaEventsSettings(
  workspaceId: string,
  brandId: string
): Promise<MetaEventsSettings> {
  const [rows] =
    await bigquery.query({
      location:
        META_EVENTS_LOCATION,
      query: `
        SELECT
          max_attempts,
          retry_delay_seconds,
          batch_size,
          default_action_source
        FROM ${metaEventsTable('event_settings')}
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

  const row =
    (rows as any[])?.[0]
    ||
    {};

  return {
    maxAttempts:
      Number(
        row.max_attempts
        ??
        META_EVENTS_DEFAULTS.maxAttempts
      ),
    retryDelaySeconds:
      Number(
        row.retry_delay_seconds
        ??
        META_EVENTS_DEFAULTS.retryDelaySeconds
      ),
    batchSize:
      Number(
        row.batch_size
        ??
        META_EVENTS_DEFAULTS.batchSize
      ),
    defaultActionSource:
      clean(
        row.default_action_source
      )
      ||
      META_EVENTS_DEFAULTS.defaultActionSource,
  };
}

export async function updateMetaEventsSettings(
  workspaceId: string,
  brandId: string,
  input: Partial<
    MetaEventsSettings
  >
) {
  await ensureMetaEventsTenant(
    workspaceId,
    brandId
  );

  const current =
    await getMetaEventsSettings(
      workspaceId,
      brandId
    );

  const next = {
    maxAttempts:
      Math.max(
        1,
        Math.min(
          20,
          Number(
            input.maxAttempts
            ??
            current.maxAttempts
          )
        )
      ),
    retryDelaySeconds:
      Math.max(
        10,
        Math.min(
          3600,
          Number(
            input.retryDelaySeconds
            ??
            current.retryDelaySeconds
          )
        )
      ),
    batchSize:
      Math.max(
        1,
        Math.min(
          500,
          Number(
            input.batchSize
            ??
            current.batchSize
          )
        )
      ),
    defaultActionSource:
      clean(
        input.defaultActionSource
      )
      ||
      current.defaultActionSource,
  };

  await bigquery.query({
    location:
      META_EVENTS_LOCATION,
    query: `
      UPDATE ${metaEventsTable('event_settings')}
      SET
        max_attempts=@max_attempts,
        retry_delay_seconds=@retry_delay_seconds,
        batch_size=@batch_size,
        default_action_source=@default_action_source,
        updated_at=CURRENT_TIMESTAMP()
      WHERE
        workspace_id=@workspace_id
        AND brand_id=@brand_id
    `,
    params: {
      workspace_id:
        workspaceId,
      brand_id:
        brandId,
      max_attempts:
        next.maxAttempts,
      retry_delay_seconds:
        next.retryDelaySeconds,
      batch_size:
        next.batchSize,
      default_action_source:
        next.defaultActionSource,
    },
    types: {
      max_attempts:
        'INT64',
      retry_delay_seconds:
        'INT64',
      batch_size:
        'INT64',
    },
  });

  return next;
}

export async function getMetaEventsDiagnostics(
  workspaceId: string,
  brandId: string
) {
  const connection =
    await getIntegrationConnection(
      workspaceId,
      brandId,
      'meta_events'
    );

  const [
    [statusRows],
    [errorRows],
  ] =
    await Promise.all([
      bigquery.query({
        location:
          META_EVENTS_LOCATION,
        query: `
          SELECT
            COUNTIF(status='PENDING') AS pending,
            COUNTIF(status='RETRY') AS retry,
            COUNTIF(status='FAILED') AS failed,
            COUNTIF(status='SUCCESS') AS success,
            MAX(created_at) AS latest_created_at,
            MAX(sent_at) AS latest_sent_at
          FROM ${metaEventsTable('event_outbox')}
          WHERE
            workspace_id=@workspace_id
            AND brand_id=@brand_id
        `,
        params: {
          workspace_id:
            workspaceId,
          brand_id:
            brandId,
        },
      }),
      bigquery.query({
        location:
          META_EVENTS_LOCATION,
        query: `
          SELECT
            outbox_id,
            source,
            source_event,
            meta_event_name,
            status,
            attempts,
            last_http_status,
            last_error,
            updated_at
          FROM ${metaEventsTable('event_outbox')}
          WHERE
            workspace_id=@workspace_id
            AND brand_id=@brand_id
            AND (
              status='FAILED'
              OR status='RETRY'
            )
          ORDER BY
            updated_at DESC
          LIMIT 50
        `,
        params: {
          workspace_id:
            workspaceId,
          brand_id:
            brandId,
        },
      }),
    ]);

  return {
    connection: {
      connected:
        String(
          connection?.status
          ||
          ''
        ).toLowerCase() ===
        'connected',
      status:
        connection?.status
        ??
        'not_connected',
      datasetId:
        connection?.provider_account_id
        ??
        null,
      hasCredential:
        Boolean(
          connection?.secret_name
        ),
    },
    status:
      (statusRows as any[])?.[0]
      ||
      {},
    errors:
      errorRows,
  };
}
