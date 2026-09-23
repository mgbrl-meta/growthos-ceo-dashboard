import {
  BigQuery,
} from '@google-cloud/bigquery';

import {
  writeShopifyOrders,
} from './shopify-writer.js';

import {
  writeShopifyCustomers,
} from './shopify-customer-writer.js';

import {
  writeShopifyProducts,
} from './shopify-product-writer.js';


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
    process.env.GROWTHOS_DATA_DATASET
    ||
    'growthos_data'
  ).trim();

const CONTROL_DATASET =
  String(
    process.env.GROWTHOS_CONTROL_DATASET
    ||
    'growthos_control'
  ).trim();

const LOCATION =
  String(
    process.env.GROWTHOS_DATA_LOCATION
    ||
    'asia-south1'
  ).trim();

const PENDING_TABLE =
  String(
    process.env.GROWTHOS_SHOPIFY_PENDING_TABLE
    ||
    'shopify_warehouse_pending'
  ).trim();

const POLICY_TABLE =
  String(
    process.env.GROWTHOS_WAREHOUSE_POLICY_TABLE
    ||
    'warehouse_refresh_policies'
  ).trim();

const MAX_BRANDS_PER_RUN =
  Math.max(
    1,
    Math.min(
      Number(
        process.env
          .GROWTHOS_WAREHOUSE_MAX_BRANDS_PER_RUN
        ||
        25
      ),
      100
    )
  );

const MAX_RECORDS_PER_ENTITY =
  Math.max(
    1000,
    Math.min(
      Number(
        process.env
          .GROWTHOS_WAREHOUSE_MAX_RECORDS_PER_ENTITY
        ||
        100000
      ),
      500000
    )
  );

const CANONICAL_WRITE_CHUNK_SIZE =
  Math.max(
    50,
    Math.min(
      Number(
        process.env
          .GROWTHOS_WAREHOUSE_CANONICAL_CHUNK_SIZE
        ||
        250
      ),
      1000
    )
  );


if (!PROJECT_ID) {

  throw new Error(
    'WAREHOUSE_REFRESH_PROJECT_MISSING'
  );

}


const bigquery =
  new BigQuery({
    projectId:
      PROJECT_ID,
  });


function timestampValue(
  value
) {

  if (
    value ===
    null
    ||
    value ===
    undefined
  ) {

    return null;

  }


  if (
    typeof value ===
      'string'
  ) {

    return value;

  }


  if (
    value?.value
  ) {

    return String(
      value.value
    );

  }


  return String(
    value
  );

}


async function ensureMissingPolicies() {

  await bigquery.query({

    query: `

      MERGE
        \`${PROJECT_ID}.${CONTROL_DATASET}.${POLICY_TABLE}\`
        AS target

      USING
      (
        SELECT
          workspace_id,
          brand_id

        FROM
          \`${PROJECT_ID}.${CONTROL_DATASET}.brands\`

        WHERE
          LOWER(
            IFNULL(
              status,
              'active'
            )
          ) =
            'active'
      )
        AS source

      ON
        target.workspace_id =
          source.workspace_id

        AND target.brand_id =
          source.brand_id

      WHEN NOT MATCHED THEN

        INSERT
        (
          workspace_id,
          brand_id,
          refresh_interval_minutes,
          enabled,
          last_refresh_at,
          next_refresh_at,
          last_status,
          last_error,
          updated_at,
          updated_by,
          last_pending_cutoff
        )

        VALUES
        (
          source.workspace_id,
          source.brand_id,
          60,
          TRUE,
          NULL,
          CURRENT_TIMESTAMP(),
          'configured',
          NULL,
          CURRENT_TIMESTAMP(),
          'warehouse_refresh_supervisor',
          NULL
        )

    `,

    location:
      LOCATION,

  });

}


async function getDuePolicies() {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT

          policy.workspace_id,
          policy.brand_id,
          policy.refresh_interval_minutes,
          policy.last_refresh_at,
          policy.next_refresh_at,
          policy.last_pending_cutoff,

          brand.brand_name,
          brand.status AS brand_status

        FROM
          \`${PROJECT_ID}.${CONTROL_DATASET}.${POLICY_TABLE}\`
          AS policy

        INNER JOIN
          \`${PROJECT_ID}.${CONTROL_DATASET}.brands\`
          AS brand

        ON
          brand.workspace_id =
            policy.workspace_id

          AND brand.brand_id =
            policy.brand_id

        WHERE
          policy.enabled = TRUE

          AND LOWER(
            IFNULL(
              brand.status,
              'active'
            )
          ) =
            'active'

          AND
          (
            policy.next_refresh_at
              IS NULL

            OR policy.next_refresh_at <=
              CURRENT_TIMESTAMP()
          )

          AND EXISTS
          (

            SELECT
              1

            FROM
              \`${PROJECT_ID}.${DATASET_ID}.${PENDING_TABLE}\`
              AS pending

            WHERE
              pending.queued_at >=
                TIMESTAMP_SUB(
                  CURRENT_TIMESTAMP(),
                  INTERVAL 14 DAY
                )

              AND pending.workspace_id =
                policy.workspace_id

              AND pending.brand_id =
                policy.brand_id

              AND pending.queued_at >
                COALESCE(
                  policy.last_pending_cutoff,
                  TIMESTAMP('1970-01-01')
                )

              AND pending.queued_at <=
                CURRENT_TIMESTAMP()

            LIMIT 1

          )

        ORDER BY
          COALESCE(
            policy.next_refresh_at,
            TIMESTAMP('1970-01-01')
          ) ASC

        LIMIT
          @max_brands

      `,

      location:
        LOCATION,

      params: {
        max_brands:
          MAX_BRANDS_PER_RUN,
      },

      types: {
        max_brands:
          'INT64',
      },

    });


  return rows;

}


async function loadEntityRecords(
  input
) {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        WITH candidates AS
        (

          SELECT

            integration_account_id,
            record_id,
            payload,
            source_updated_at,
            queued_at,
            pending_id,

            ROW_NUMBER()
            OVER
            (
              PARTITION BY
                integration_account_id,
                record_id

              ORDER BY
                source_updated_at DESC,
                queued_at DESC,
                pending_id DESC
            )
              AS row_number

          FROM
            \`${PROJECT_ID}.${DATASET_ID}.${PENDING_TABLE}\`

          WHERE
            queued_at >=
              TIMESTAMP_SUB(
                CURRENT_TIMESTAMP(),
                INTERVAL 14 DAY
              )

            AND workspace_id =
              @workspace_id

            AND brand_id =
              @brand_id

            AND entity =
              @entity

            AND queued_at >
              TIMESTAMP(
                @after_cutoff
              )

            AND queued_at <=
              TIMESTAMP(
                @cutoff
              )

        )

        SELECT

          integration_account_id,
          record_id,
          payload

        FROM
          candidates

        WHERE
          row_number =
            1

        ORDER BY
          integration_account_id,
          record_id

        LIMIT
          @max_records_plus_one

      `,

      location:
        LOCATION,

      params: {

        workspace_id:
          input.workspaceId,

        brand_id:
          input.brandId,

        entity:
          input.entity,

        after_cutoff:
          input.afterCutoff,

        cutoff:
          input.cutoff,

        max_records_plus_one:
          MAX_RECORDS_PER_ENTITY
          +
          1,

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        entity:
          'STRING',

        after_cutoff:
          'STRING',

        cutoff:
          'STRING',

        max_records_plus_one:
          'INT64',

      },

    });


  if (
    rows.length >
      MAX_RECORDS_PER_ENTITY
  ) {

    throw new Error(
      `WAREHOUSE_PENDING_${input.entity.toUpperCase()}_LIMIT_EXCEEDED`
    );

  }


  const grouped =
    new Map();


  for (
    const row
    of rows
  ) {

    const integrationAccountId =
      String(
        row.integration_account_id
        ??
        ''
      ).trim();


    if (!integrationAccountId) {

      continue;

    }


    let record;

    try {

      record =
        JSON.parse(
          String(
            row.payload
            ??
            '{}'
          )
        );

    } catch {

      throw new Error(
        `WAREHOUSE_PENDING_PAYLOAD_INVALID_${input.entity}`
      );

    }


    if (
      !grouped.has(
        integrationAccountId
      )
    ) {

      grouped.set(
        integrationAccountId,
        []
      );

    }


    grouped
      .get(
        integrationAccountId
      )
      .push(
        record
      );

  }


  return grouped;

}


async function writeCanonicalChunk(
  input
) {

  if (
    input.entity ===
      'orders'
  ) {

    return writeShopifyOrders({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      integrationAccountId:
        input.integrationAccountId,

      orders:
        input.records,

      bypassWarehouseDeferral:
        true,

    });

  }


  if (
    input.entity ===
      'customers'
  ) {

    return writeShopifyCustomers({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      integrationAccountId:
        input.integrationAccountId,

      customers:
        input.records,

      bypassWarehouseDeferral:
        true,

    });

  }


  if (
    input.entity ===
      'products'
  ) {

    return writeShopifyProducts({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      integrationAccountId:
        input.integrationAccountId,

      products:
        input.records,

      bypassWarehouseDeferral:
        true,

    });

  }


  throw new Error(
    'WAREHOUSE_REFRESH_ENTITY_UNSUPPORTED'
  );

}


async function flushEntity(
  input
) {

  const grouped =
    await loadEntityRecords(
      input
    );


  let received =
    0;

  let changed =
    0;

  let skipped =
    0;

  let loaded =
    0;

  let canonicalWrites =
    0;


  for (
    const [
      integrationAccountId,
      records,
    ]
    of grouped.entries()
  ) {

    for (
      let offset = 0;
      offset < records.length;
      offset +=
        CANONICAL_WRITE_CHUNK_SIZE
    ) {

      const chunk =
        records.slice(
          offset,
          offset
          +
          CANONICAL_WRITE_CHUNK_SIZE
        );


      const result =
        await writeCanonicalChunk({

          workspaceId:
            input.workspaceId,

          brandId:
            input.brandId,

          integrationAccountId,

          entity:
            input.entity,

          records:
            chunk,

        });


      canonicalWrites +=
        1;

      received +=
        Number(
          result?.received
          ??
          0
        );

      changed +=
        Number(
          result?.changed
          ??
          0
        );

      skipped +=
        Number(
          result?.skipped
          ??
          0
        );

      loaded +=
        Number(
          result?.loaded
          ??
          0
        );

    }

  }


  return {
    received,
    changed,
    skipped,
    loaded,
    canonicalWrites,
  };

}


async function markPolicySuccess(
  input
) {

  await bigquery.query({

    query: `

      UPDATE
        \`${PROJECT_ID}.${CONTROL_DATASET}.${POLICY_TABLE}\`

      SET

        last_refresh_at =
          CURRENT_TIMESTAMP(),

        last_pending_cutoff =
          TIMESTAMP(
            @cutoff
          ),

        next_refresh_at =
          TIMESTAMP_ADD(
            CURRENT_TIMESTAMP(),
            INTERVAL refresh_interval_minutes MINUTE
          ),

        last_status =
          'success',

        last_error =
          NULL,

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE
        workspace_id =
          @workspace_id

        AND brand_id =
          @brand_id

    `,

    location:
      LOCATION,

    params: {

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      cutoff:
        input.cutoff,

    },

    types: {

      workspace_id:
        'STRING',

      brand_id:
        'STRING',

      cutoff:
        'STRING',

    },

  });

}


async function markPolicyFailure(
  input
) {

  await bigquery.query({

    query: `

      UPDATE
        \`${PROJECT_ID}.${CONTROL_DATASET}.${POLICY_TABLE}\`

      SET

        next_refresh_at =
          TIMESTAMP_ADD(
            CURRENT_TIMESTAMP(),
            INTERVAL 10 MINUTE
          ),

        last_status =
          'failed',

        last_error =
          SUBSTR(
            @error,
            1,
            1000
          ),

        updated_at =
          CURRENT_TIMESTAMP()

      WHERE
        workspace_id =
          @workspace_id

        AND brand_id =
          @brand_id

    `,

    location:
      LOCATION,

    params: {

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      error:
        input.error,

    },

  });

}


async function flushBrand(
  policy
) {

  const workspaceId =
    String(
      policy.workspace_id
      ??
      ''
    );

  const brandId =
    String(
      policy.brand_id
      ??
      ''
    );

  const afterCutoff =
    timestampValue(
      policy.last_pending_cutoff
    )
    ||
    '1970-01-01T00:00:00.000Z';

  const cutoff =
    new Date()
      .toISOString();


  const totals = {

    orders: {
      received: 0,
      changed: 0,
      skipped: 0,
      loaded: 0,
      canonicalWrites: 0,
    },

    customers: {
      received: 0,
      changed: 0,
      skipped: 0,
      loaded: 0,
      canonicalWrites: 0,
    },

    products: {
      received: 0,
      changed: 0,
      skipped: 0,
      loaded: 0,
      canonicalWrites: 0,
    },

  };


  for (
    const entity
    of [
      'orders',
      'customers',
      'products',
    ]
  ) {

    totals[entity] =
      await flushEntity({

        workspaceId,
        brandId,
        entity,
        afterCutoff,
        cutoff,

      });

  }


  await markPolicySuccess({

    workspaceId,
    brandId,
    cutoff,

  });


  return {

    workspaceId,
    brandId,

    brandName:
      String(
        policy.brand_name
        ??
        brandId
      ),

    refreshIntervalMinutes:
      Number(
        policy.refresh_interval_minutes
        ??
        60
      ),

    previousLastRefreshAt:
      timestampValue(
        policy.last_refresh_at
      ),

    previousPendingCutoff:
      afterCutoff,

    cutoff,
    totals,

  };

}


// ============================================================
// BRAND-CONTROLLED WAREHOUSE REFRESH V2.1
//
// Pending landing is append-only.
// Progress is tracked using policy.last_pending_cutoff.
//
// Scheduler may invoke this every 5 minutes.
// Only due brands with pending records are consolidated.
// ============================================================

export async function superviseShopifyWarehouseRefresh() {

  const startedAt =
    Date.now();


  await ensureMissingPolicies();


  const policies =
    await getDuePolicies();


  const results =
    [];


  for (
    const policy
    of policies
  ) {

    const workspaceId =
      String(
        policy.workspace_id
        ??
        ''
      );

    const brandId =
      String(
        policy.brand_id
        ??
        ''
      );


    try {

      const result =
        await flushBrand(
          policy
        );


      results.push({
        ok:
          true,
        ...result,
      });


      console.log(
        'SHOPIFY_WAREHOUSE_BRAND_REFRESH_COMPLETED',
        result
      );

    } catch (
      error
    ) {

      const message =
        String(
          error?.message
          ||
          error
          ||
          'Warehouse refresh failed'
        );


      try {

        await markPolicyFailure({

          workspaceId,
          brandId,
          error:
            message,

        });

      } catch (
        policyError
      ) {

        console.error(
          'SHOPIFY_WAREHOUSE_POLICY_FAILURE_MARK_FAILED',
          {
            workspaceId,
            brandId,
            message:
              String(
                policyError?.message
                ||
                policyError
              ),
          }
        );

      }


      results.push({

        ok:
          false,

        workspaceId,
        brandId,

        error:
          message,

      });


      console.error(
        'SHOPIFY_WAREHOUSE_BRAND_REFRESH_FAILED',
        {
          workspaceId,
          brandId,
          message,
        }
      );

    }

  }


  return {

    dueBrands:
      policies.length,

    succeeded:
      results.filter(
        item =>
          item.ok
      ).length,

    failed:
      results.filter(
        item =>
          !item.ok
      ).length,

    durationMs:
      Date.now()
      -
      startedAt,

    results,

  };

}
