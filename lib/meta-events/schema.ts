import 'server-only';
import { bigquery, } from '@/lib/bigquery';
import { META_EVENTS_DATASET, META_EVENTS_LOCATION, requireMetaEventsProjectId, } from './config';
import { META_EVENTS_CATALOGUE_SEED_VERSION, META_EVENTS_CATALOGUE_V1, } from './catalogue';
// ============================================================
// META EVENTS WAREHOUSE VERSION
// ============================================================
//
// This is NOT the canonical eventVersion.
//
// eventVersion:
//   version of an individual canonical business event.
//
// META_EVENTS_WAREHOUSE_SCHEMA_VERSION:
//   version of Meta Events warehouse/bootstrap architecture.
//
// META_EVENTS_CATALOGUE_SEED_VERSION:
//   version of the platform catalogue definitions/seeds.
//
// RULE:
//
// Any change to:
// - tables
// - columns
// - views
// - migrations
// - catalogue definitions
// - catalogue schemas
// - bootstrap defaults
//
// must increment the appropriate version.
//
// This makes upgrades automatic and reproducible.
// ============================================================
const META_EVENTS_WAREHOUSE_SCHEMA_VERSION = 3;
let schemaReadyKey: string | null = null;
let schemaPromise: Promise<void> | null = null;
let schemaPromiseKey: string | null = null;
function table(name: string) {
    const projectId = requireMetaEventsProjectId();
    return `\`${projectId}.${META_EVENTS_DATASET}.${name}\``;
}
function schemaTargetKey() {
    const projectId = requireMetaEventsProjectId();
    return [
        projectId,
        META_EVENTS_DATASET,
        META_EVENTS_LOCATION,
        `schema-v${META_EVENTS_WAREHOUSE_SCHEMA_VERSION}`,
        `catalogue-v${META_EVENTS_CATALOGUE_SEED_VERSION}`,
    ].join(':');
}
// ============================================================
// PLATFORM EVENT CATALOGUE
//
// Definitions live in ./catalogue.ts so producer code and the
// warehouse seed share one canonical manifest.
// ============================================================
function catalogueSeedPayload() {
    return META_EVENTS_CATALOGUE_V1.map(definition => ({
        catalogueId: `mecat_v${definition.eventVersion}_${definition.eventKey}`,
        eventKey: definition.eventKey,
        eventVersion: definition.eventVersion,
        source: definition.source,
        label: definition.label,
        description: definition.description,
        producerType: definition.producerType,
        lifecycleStatus: definition.lifecycleStatus,
        routingAllowed: definition.routingAllowed,
        schema: definition.schema,
        introducedContractVersion: 1,
    }));
}
async function seedMetaEventsCatalogue() {
    await bigquery.query({
        location: META_EVENTS_LOCATION,
        query: `

      MERGE

        ${table('event_catalogue')}

        AS target



      USING (

        SELECT

          JSON_VALUE(item, '$.catalogueId')

            AS catalogue_id,



          JSON_VALUE(item, '$.eventKey')

            AS event_key,



          CAST(

            JSON_VALUE(item, '$.eventVersion')

            AS INT64

          )

            AS event_version,



          JSON_VALUE(item, '$.source')

            AS source,



          JSON_VALUE(item, '$.label')

            AS label,



          JSON_VALUE(item, '$.description')

            AS description,



          JSON_VALUE(item, '$.producerType')

            AS producer_type,



          JSON_VALUE(item, '$.lifecycleStatus')

            AS lifecycle_status,



          CAST(

            JSON_VALUE(item, '$.routingAllowed')

            AS BOOL

          )

            AS routing_allowed,



          JSON_QUERY(item, '$.schema')

            AS schema_json,



          CAST(

            JSON_VALUE(

              item,

              '$.introducedContractVersion'

            )

            AS INT64

          )

            AS introduced_contract_version



        FROM

          UNNEST(

            JSON_QUERY_ARRAY(

              PARSE_JSON(

                @catalogue_json

              )

            )

          )

          AS item

      )

      AS source_row



      ON

        target.catalogue_id=

          source_row.catalogue_id



      WHEN MATCHED THEN

        UPDATE SET

          event_key=

            source_row.event_key,



          event_version=

            source_row.event_version,



          source=

            source_row.source,



          label=

            source_row.label,



          description=

            source_row.description,



          producer_type=

            source_row.producer_type,



          lifecycle_status=

            source_row.lifecycle_status,



          routing_allowed=

            source_row.routing_allowed,



          schema_json=

            source_row.schema_json,



          introduced_contract_version=

            source_row.introduced_contract_version,



          updated_at=

            CURRENT_TIMESTAMP()



      WHEN NOT MATCHED THEN

        INSERT (

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



          introduced_contract_version,



          created_at,

          updated_at

        )



        VALUES (

          source_row.catalogue_id,



          source_row.event_key,

          source_row.event_version,



          source_row.source,



          source_row.label,

          source_row.description,



          source_row.producer_type,



          source_row.lifecycle_status,



          source_row.routing_allowed,



          source_row.schema_json,



          source_row.introduced_contract_version,



          CURRENT_TIMESTAMP(),

          CURRENT_TIMESTAMP()

        )

    `,
        params: {
            catalogue_json: JSON.stringify(catalogueSeedPayload()),
        },
    });
}
export async function ensureMetaEventsSchema() {
    const targetKey = schemaTargetKey();
    // ==========================================================
    // PROCESS-LOCAL FAST PATH
    // ==========================================================
    if (schemaReadyKey ===
        targetKey) {
        return;
    }
    // ==========================================================
    // WAIT FOR AN IN-FLIGHT BOOTSTRAP
    // ==========================================================
    if (schemaPromise) {
        await schemaPromise;
        if (schemaReadyKey ===
            targetKey) {
            return;
        }
    }
    schemaPromiseKey =
        targetKey;
    schemaPromise =
        (async () => {
            const projectId = requireMetaEventsProjectId();
            // ========================================================
            // DATASET
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE SCHEMA IF NOT EXISTS
            \`${projectId}.${META_EVENTS_DATASET}\`
          OPTIONS(
            location='${META_EVENTS_LOCATION}'
          )
        `,
            });
            // ========================================================
            // SCHEMA STATE
            // ========================================================
            //
            // Persistent platform-level version ledger.
            // No workspace_id / brand_id here.
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE TABLE IF NOT EXISTS
            ${table('schema_state')}
          (
            module_id STRING NOT NULL,

            schema_version INT64 NOT NULL,
            catalogue_seed_version INT64 NOT NULL,
            catalogue_definition_count INT64 NOT NULL,

            project_id STRING NOT NULL,
            dataset_id STRING NOT NULL,
            location STRING NOT NULL,

            status STRING NOT NULL,
            last_bootstrapped_at TIMESTAMP NOT NULL,

            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
          )
          CLUSTER BY
            module_id,
            status
        `,
            });
            // ========================================================
            // READ INSTALLED WAREHOUSE VERSION
            // ========================================================
            const [schemaStateRows,] = await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
            SELECT
              schema_version,
              catalogue_seed_version

            FROM
              ${table('schema_state')}

            WHERE
              module_id='meta_events'

            LIMIT 1
          `,
            });
            const installedSchemaVersion = Number(schemaStateRows?.[0]?.schema_version
                ??
                    0);
            const installedCatalogueSeedVersion = Number(schemaStateRows?.[0]?.catalogue_seed_version
                ??
                    0);
            // ========================================================
            // DOWNGRADE GUARD
            // ========================================================
            if (installedSchemaVersion >
                META_EVENTS_WAREHOUSE_SCHEMA_VERSION) {
                throw new Error([
                    'META_EVENTS_SCHEMA_NEWER_THAN_CODE',
                    `warehouse=${installedSchemaVersion}`,
                    `code=${META_EVENTS_WAREHOUSE_SCHEMA_VERSION}`,
                ].join(':'));
            }
            if (installedCatalogueSeedVersion >
                META_EVENTS_CATALOGUE_SEED_VERSION) {
                throw new Error([
                    'META_EVENTS_CATALOGUE_NEWER_THAN_CODE',
                    `warehouse=${installedCatalogueSeedVersion}`,
                    `code=${META_EVENTS_CATALOGUE_SEED_VERSION}`,
                ].join(':'));
            }
            // ========================================================
            // WAREHOUSE ALREADY CURRENT
            // ========================================================
            //
            // Avoid re-running DDL, catalogue MERGEs and view rewrites
            // on every fresh application process.
            // ========================================================
            if (installedSchemaVersion ===
                META_EVENTS_WAREHOUSE_SCHEMA_VERSION
                &&
                    installedCatalogueSeedVersion ===
                        META_EVENTS_CATALOGUE_SEED_VERSION) {
                schemaReadyKey =
                    targetKey;
                return;
            }
            // ========================================================
            // DESTINATIONS
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE TABLE IF NOT EXISTS
            ${table('event_destinations')}
          (
            destination_id STRING NOT NULL,

            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,

            name STRING NOT NULL,
            dataset_id STRING NOT NULL,

            credential_secret_name STRING,

            status STRING NOT NULL,
            is_default BOOL NOT NULL,

            test_event_code STRING,

            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
          CLUSTER BY
            workspace_id,
            brand_id,
            status,
            is_default
        `,
            });
            // ========================================================
            // RULES
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE TABLE IF NOT EXISTS
            ${table('event_rules')}
          (
            rule_id STRING NOT NULL,

            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,

            name STRING NOT NULL,

            source STRING NOT NULL,
            source_event STRING NOT NULL,

            meta_event_name STRING NOT NULL,

            destination_id STRING,
            action_source STRING NOT NULL,

            condition_json JSON,

            enabled BOOL NOT NULL,
            seeded BOOL NOT NULL,
            priority INT64 NOT NULL,

            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
          CLUSTER BY
            workspace_id,
            brand_id,
            source,
            enabled
        `,
            });
            // ========================================================
            // OUTBOX
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE TABLE IF NOT EXISTS
            ${table('event_outbox')}
          (
            outbox_id STRING NOT NULL,

            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,

            source STRING NOT NULL,
            source_event STRING NOT NULL,
            source_event_id STRING NOT NULL,
            source_entity_id STRING,

            rule_id STRING NOT NULL,
            destination_id STRING NOT NULL,

            meta_event_name STRING NOT NULL,
            event_id STRING NOT NULL,

            occurred_at TIMESTAMP NOT NULL,
            action_source STRING NOT NULL,

            user_data JSON,
            custom_data JSON,

            status STRING NOT NULL,
            attempts INT64 NOT NULL,

            next_attempt_at TIMESTAMP,
            last_error STRING,
            last_http_status INT64,

            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            sent_at TIMESTAMP
          )
          PARTITION BY DATE(created_at)
          CLUSTER BY
            workspace_id,
            brand_id,
            status,
            source
        `,
            });
            // ========================================================
            // EVENT INBOX
            // ========================================================
            //
            // V3 processing fields remain nullable at the warehouse
            // layer during the rolling migration. The Phase 3A worker
            // will populate them explicitly.
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE TABLE IF NOT EXISTS
            ${table('event_inbox')}
          (
            inbox_id STRING NOT NULL,

            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,

            source STRING NOT NULL,
            source_event STRING NOT NULL,
            source_event_id STRING NOT NULL,
            source_entity_id STRING,

            event_version INT64 NOT NULL,
            occurred_at TIMESTAMP NOT NULL,

            first_received_at TIMESTAMP NOT NULL,
            last_received_at TIMESTAMP NOT NULL,

            identity JSON,
            context JSON,
            attribution JSON,
            commerce JSON,
            data JSON,
            metadata JSON,

            validation_status STRING NOT NULL,
            routing_status STRING NOT NULL,

            duplicate_count INT64 NOT NULL,
            processing_error STRING,

            processing_status STRING,
            processing_claim_id STRING,
            processing_started_at TIMESTAMP,
            processing_completed_at TIMESTAMP,
            processing_attempts INT64,

            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
          )
          PARTITION BY DATE(created_at)
          CLUSTER BY
            workspace_id,
            brand_id,
            source,
            routing_status
        `,
            });
            // ========================================================
            // PLATFORM EVENT CATALOGUE
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE TABLE IF NOT EXISTS
            ${table('event_catalogue')}
          (
            catalogue_id STRING NOT NULL,

            event_key STRING NOT NULL,
            event_version INT64 NOT NULL,

            source STRING NOT NULL,

            label STRING NOT NULL,
            description STRING NOT NULL,

            producer_type STRING NOT NULL,
            lifecycle_status STRING NOT NULL,
            routing_allowed BOOL NOT NULL,

            schema_json JSON NOT NULL,
            introduced_contract_version INT64 NOT NULL,

            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
          )
          CLUSTER BY
            source,
            lifecycle_status,
            event_key
        `,
            });
            // ========================================================
            // DELIVERY ATTEMPTS
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE TABLE IF NOT EXISTS
            ${table('event_delivery_attempts')}
          (
            attempt_id STRING NOT NULL,
            outbox_id STRING NOT NULL,

            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,

            destination_id STRING NOT NULL,
            attempt_number INT64 NOT NULL,

            request_payload JSON,
            response_payload JSON,

            http_status INT64,
            success BOOL NOT NULL,
            error STRING,

            created_at TIMESTAMP
          )
          PARTITION BY DATE(created_at)
          CLUSTER BY
            workspace_id,
            brand_id,
            success,
            destination_id
        `,
            });
            // ========================================================
            // SOURCE REGISTRY
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE TABLE IF NOT EXISTS
            ${table('event_source_registry')}
          (
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,

            source STRING NOT NULL,
            label STRING NOT NULL,
            enabled BOOL NOT NULL,

            event_count INT64 NOT NULL,
            last_event_at TIMESTAMP,
            last_source_event_id STRING,

            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
          CLUSTER BY
            workspace_id,
            brand_id,
            source
        `,
            });
            // ========================================================
            // SETTINGS
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE TABLE IF NOT EXISTS
            ${table('event_settings')}
          (
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,

            max_attempts INT64 NOT NULL,
            retry_delay_seconds INT64 NOT NULL,
            batch_size INT64 NOT NULL,
            default_action_source STRING NOT NULL,

            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
          CLUSTER BY
            workspace_id,
            brand_id
        `,
            });
            // ========================================================
            // V1 -> V2 MIGRATION
            // ========================================================
            if (installedSchemaVersion <
                2) {
                await bigquery.query({
                    location: META_EVENTS_LOCATION,
                    query: `
            ALTER TABLE ${table('event_rules')}
            ADD COLUMN IF NOT EXISTS seeded BOOL;

            UPDATE ${table('event_rules')}
            SET
              seeded=FALSE
            WHERE
              seeded IS NULL;

            ALTER TABLE ${table('event_source_registry')}
            ADD COLUMN IF NOT EXISTS last_source_event_id STRING;
          `,
                });
            }
            // ========================================================
            // V2 -> V3 MIGRATION
            // ========================================================
            //
            // Add durable processing ownership state using ONE metadata
            // update against event_inbox.
            // ========================================================
            if (installedSchemaVersion <
                3) {
                await bigquery.query({
                    location: META_EVENTS_LOCATION,
                    query: `
            ALTER TABLE ${table('event_inbox')}
              ADD COLUMN IF NOT EXISTS processing_status STRING,
              ADD COLUMN IF NOT EXISTS processing_claim_id STRING,
              ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP,
              ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP,
              ADD COLUMN IF NOT EXISTS processing_attempts INT64
          `,
                });
                await bigquery.query({
                    location: META_EVENTS_LOCATION,
                    query: `
            UPDATE
              ${table('event_inbox')}

            SET
              processing_status=
                CASE
                  WHEN processing_status IS NOT NULL
                    THEN processing_status

                  WHEN routing_status IN (
                    'REJECTED',
                    'NOT_ROUTABLE',
                    'NO_MATCHING_RULES',
                    'ROUTED'
                  )
                    THEN 'COMPLETED'

                  ELSE 'PENDING'
                END,

              processing_attempts=
                COALESCE(
                  processing_attempts,
                  0
                ),

              processing_completed_at=
                CASE
                  WHEN processing_completed_at IS NOT NULL
                    THEN processing_completed_at

                  WHEN routing_status IN (
                    'REJECTED',
                    'NOT_ROUTABLE',
                    'NO_MATCHING_RULES',
                    'ROUTED'
                  )
                    THEN updated_at

                  ELSE NULL
                END,

              updated_at=
                CURRENT_TIMESTAMP()

            WHERE
              processing_status IS NULL
              OR processing_attempts IS NULL
          `,
                });
            }
            // ========================================================
            // PLATFORM CATALOGUE SEED / UPGRADE
            // ========================================================
            if (installedCatalogueSeedVersion <
                META_EVENTS_CATALOGUE_SEED_VERSION) {
                await seedMetaEventsCatalogue();
            }
            // ========================================================
            // DAILY DELIVERY METRICS
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          CREATE OR REPLACE VIEW
            ${table('event_metrics_daily')}
          AS
          SELECT
            workspace_id,
            brand_id,

            DATE(created_at)
              AS event_date,

            source,
            meta_event_name,

            COUNT(*)
              AS total_events,

            COUNTIF(
              status='SUCCESS'
            )
              AS success_events,

            COUNTIF(
              status='RETRY'
            )
              AS retry_events,

            COUNTIF(
              status='FAILED'
            )
              AS failed_events,

            SUM(attempts)
              AS total_attempts

          FROM
            ${table('event_outbox')}

          GROUP BY
            workspace_id,
            brand_id,
            event_date,
            source,
            meta_event_name
        `,
            });
            // ========================================================
            // RECORD SUCCESSFUL WAREHOUSE VERSION
            // ========================================================
            //
            // Only mark CURRENT after all migrations, catalogue changes
            // and view reconciliation complete successfully.
            // ========================================================
            await bigquery.query({
                location: META_EVENTS_LOCATION,
                query: `
          MERGE
            ${table('schema_state')}
            AS target

          USING (
            SELECT
              'meta_events' AS module_id
          )
          AS source_row

          ON
            target.module_id=
              source_row.module_id

          WHEN MATCHED THEN
            UPDATE SET
              schema_version=
                @schema_version,

              catalogue_seed_version=
                @catalogue_seed_version,

              catalogue_definition_count=
                @catalogue_definition_count,

              project_id=
                @project_id,

              dataset_id=
                @dataset_id,

              location=
                @location,

              status=
                'CURRENT',

              last_bootstrapped_at=
                CURRENT_TIMESTAMP(),

              updated_at=
                CURRENT_TIMESTAMP()

          WHEN NOT MATCHED THEN
            INSERT (
              module_id,
              schema_version,
              catalogue_seed_version,
              catalogue_definition_count,
              project_id,
              dataset_id,
              location,
              status,
              last_bootstrapped_at,
              created_at,
              updated_at
            )

            VALUES (
              'meta_events',
              @schema_version,
              @catalogue_seed_version,
              @catalogue_definition_count,
              @project_id,
              @dataset_id,
              @location,
              'CURRENT',
              CURRENT_TIMESTAMP(),
              CURRENT_TIMESTAMP(),
              CURRENT_TIMESTAMP()
            )
        `,
                params: {
                    schema_version: META_EVENTS_WAREHOUSE_SCHEMA_VERSION,
                    catalogue_seed_version: META_EVENTS_CATALOGUE_SEED_VERSION,
                    catalogue_definition_count: META_EVENTS_CATALOGUE_V1.length,
                    project_id: projectId,
                    dataset_id: META_EVENTS_DATASET,
                    location: META_EVENTS_LOCATION,
                },
                types: {
                    schema_version: 'INT64',
                    catalogue_seed_version: 'INT64',
                    catalogue_definition_count: 'INT64',
                },
            });
            // ========================================================
            // MARK THIS PROCESS/TARGET READY
            // ========================================================
            schemaReadyKey =
                targetKey;
        })()
            .finally(() => {
            if (schemaPromiseKey ===
                targetKey) {
                schemaPromise =
                    null;
                schemaPromiseKey =
                    null;
            }
        });
    return schemaPromise;
}
export function metaEventsTable(name: string) {
    return table(name);
}
