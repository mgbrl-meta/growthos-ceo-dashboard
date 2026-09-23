import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    ||
    process.env.BQ_PROJECT_ID
    ||
    'shopify-colab'
  ).trim();

const CONTROL_DATASET =
  String(
    process.env.GROWTHOS_CONTROL_DATASET
    ||
    'growthos_control'
  ).trim();

const CONTROL_LOCATION =
  String(
    process.env.GCP_BQ_LOCATION
    ||
    'asia-south1'
  ).trim();

const BILLING_DATASET =
  String(
    process.env.GROWTHOS_BILLING_DATASET
    ||
    'growthos_billing'
  ).trim();

const BILLING_LOCATION =
  String(
    process.env.GROWTHOS_BILLING_LOCATION
    ||
    'US'
  ).trim();

const REPORT_TIMEZONE =
  String(
    process.env.GROWTHOS_BILLING_TIMEZONE
    ||
    'Asia/Kolkata'
  ).trim();

const MAX_RANGE_DAYS =
  180;

const ALLOCATION_TABLE =
  'cloud_cost_allocation_rules';


type AllocationRule = {
  ruleId: string;
  priority: number;
  enabled: boolean;
  matchField: string;
  matchRegex: string;
  moduleId: string | null;
  workspaceId: string | null;
  brandId: string | null;
  allocationScope: string | null;
  lifecycle: string | null;
  note: string | null;
};


function isoDate(
  value:
    Date
) {

  return value
    .toISOString()
    .slice(
      0,
      10
    );

}


function addDays(
  date:
    Date,
  days:
    number
) {

  const next =
    new Date(
      date.getTime()
    );

  next.setUTCDate(
    next.getUTCDate()
    +
    days
  );

  return next;

}


function parseDateOnly(
  value:
    string |
    null
) {

  if (
    !value
    ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {

    return null;

  }


  const date =
    new Date(
      `${value}T00:00:00.000Z`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  return date;

}


function resolveRange(
  request:
    NextRequest
) {

  const {
    searchParams,
  } =
    request.nextUrl;


  const requestedDays =
    Number(
      searchParams.get(
        'days'
      )
      ||
      30
    );


  const days =
    Math.max(
      1,
      Math.min(
        Number.isFinite(
          requestedDays
        )
          ?
            Math.floor(
              requestedDays
            )
          :
            30,
        MAX_RANGE_DAYS
      )
    );


  const requestedEnd =
    parseDateOnly(
      searchParams.get(
        'end'
      )
    );


  const today =
    new Date();


  const end =
    requestedEnd
    ||
    new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate()
      )
    );


  const requestedStart =
    parseDateOnly(
      searchParams.get(
        'start'
      )
    );


  let start =
    requestedStart
    ||
    addDays(
      end,
      -(days - 1)
    );


  const absoluteMinimum =
    addDays(
      end,
      -(MAX_RANGE_DAYS - 1)
    );


  if (
    start <
      absoluteMinimum
  ) {

    start =
      absoluteMinimum;

  }


  if (
    start >
      end
  ) {

    start =
      end;

  }


  const actualDays =
    Math.floor(
      (
        end.getTime()
        -
        start.getTime()
      )
      /
      86400000
    )
    +
    1;


  const previousEnd =
    addDays(
      start,
      -1
    );


  const previousStart =
    addDays(
      previousEnd,
      -(actualDays - 1)
    );


  const baselineStart =
    addDays(
      start,
      -35
    );


  return {

    start:
      isoDate(
        start
      ),

    end:
      isoDate(
        end
      ),

    previousStart:
      isoDate(
        previousStart
      ),

    previousEnd:
      isoDate(
        previousEnd
      ),

    baselineStart:
      isoDate(
        baselineStart
      ),

    actualDays,

  };

}


async function requirePlatformAdmin(
  request:
    NextRequest
) {

  const identity =
    await authenticateRequest(
      request
    );


  if (!identity) {

    throw new Error(
      'UNAUTHENTICATED'
    );

  }


  const userId =
    String(
      identity.userId
      ||
      ''
    ).trim();


  if (!userId) {

    throw new Error(
      'UNAUTHENTICATED'
    );

  }


  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT
          COUNT(*) AS active_admins

        FROM
          \`${PROJECT_ID}.${CONTROL_DATASET}.platform_admins\`

        WHERE
          user_id =
            @user_id

          AND LOWER(
            status
          ) =
            'active'

      `,

      location:
        CONTROL_LOCATION,

      params: {
        user_id:
          userId,
      },

    });


  const activeAdmins =
    Number(
      (rows?.[0] as any)
        ?.active_admins
      ||
      0
    );


  if (
    activeAdmins <
      1
  ) {

    throw new Error(
      'ADMIN_ACCESS_REQUIRED'
    );

  }


  return identity;

}


async function findDetailedBillingTable() {

  const [
    rows,
  ] =
    await bigquery.query({

      query: `

        SELECT
          table_name,
          creation_time

        FROM
          \`${PROJECT_ID}.${BILLING_DATASET}.INFORMATION_SCHEMA.TABLES\`

        WHERE
          STARTS_WITH(
            table_name,
            'gcp_billing_export_resource_v1_'
          )

          AND table_type =
            'BASE TABLE'

        ORDER BY
          creation_time DESC

        LIMIT 1

      `,

      location:
        BILLING_LOCATION,

    });


  const tableName =
    String(
      (rows?.[0] as any)
        ?.table_name
      ||
      ''
    ).trim();


  if (!tableName) {

    return null;

  }


  if (
    !/^gcp_billing_export_resource_v1_[A-Za-z0-9_-]+$/.test(
      tableName
    )
  ) {

    throw new Error(
      'BILLING_EXPORT_TABLE_NAME_INVALID'
    );

  }


  return tableName;

}


async function loadAllocationRules():
  Promise<
    AllocationRule[]
  > {

  try {

    const [
      rows,
    ] =
      await bigquery.query({

        query: `

          SELECT

            rule_id,
            priority,
            enabled,
            match_field,
            match_regex,
            module_id,
            workspace_id,
            brand_id,
            allocation_scope,
            lifecycle,
            note

          FROM
            \`${PROJECT_ID}.${CONTROL_DATASET}.${ALLOCATION_TABLE}\`

          WHERE
            enabled =
              TRUE

          ORDER BY
            priority ASC,
            rule_id ASC

        `,

        location:
          CONTROL_LOCATION,

      });


    return rows.map(
      (row: any) => ({

        ruleId:
          String(
            row.rule_id
            ||
            ''
          ),

        priority:
          Number(
            row.priority
            ||
            1000
          ),

        enabled:
          row.enabled !==
          false,

        matchField:
          String(
            row.match_field
            ||
            ''
          ),

        matchRegex:
          String(
            row.match_regex
            ||
            ''
          ),

        moduleId:
          row.module_id
          ??
          null,

        workspaceId:
          row.workspace_id
          ??
          null,

        brandId:
          row.brand_id
          ??
          null,

        allocationScope:
          row.allocation_scope
          ??
          null,

        lifecycle:
          row.lifecycle
          ??
          null,

        note:
          row.note
          ??
          null,

      })
    );

  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        error
        ||
        ''
      );


    if (
      message.includes(
        'Not found'
      )
      ||
      message.includes(
        'not found'
      )
    ) {

      return [];

    }


    throw error;

  }

}


async function loadCloudCosts(
  sourceTable:
    string,
  range:
    ReturnType<
      typeof resolveRange
    >,
  allocationRules:
    AllocationRule[]
) {

  const source =
    `${PROJECT_ID}.${BILLING_DATASET}.${sourceTable}`;


  const query = `

    CREATE TEMP TABLE source_coverage AS

    SELECT

      MIN(
        DATE(
          usage_start_time,
          '${REPORT_TIMEZONE}'
        )
      ) AS source_start_date,

      MAX(
        DATE(
          usage_start_time,
          '${REPORT_TIMEZONE}'
        )
      ) AS source_end_date,

      ARRAY_AGG(
        currency
        IGNORE NULLS
        LIMIT 1
      )[SAFE_OFFSET(0)]
        AS source_currency

    FROM
      \`${source}\`;


    CREATE TEMP TABLE allocation_rules AS

    SELECT

      JSON_VALUE(
        rule,
        '$.ruleId'
      )
        AS rule_id,

      SAFE_CAST(
        JSON_VALUE(
          rule,
          '$.priority'
        )
        AS INT64
      )
        AS priority,

      LOWER(
        JSON_VALUE(
          rule,
          '$.matchField'
        )
      )
        AS match_field,

      LOWER(
        JSON_VALUE(
          rule,
          '$.matchRegex'
        )
      )
        AS match_regex,

      NULLIF(
        JSON_VALUE(
          rule,
          '$.moduleId'
        ),
        ''
      )
        AS module_id,

      NULLIF(
        JSON_VALUE(
          rule,
          '$.workspaceId'
        ),
        ''
      )
        AS workspace_id,

      NULLIF(
        JSON_VALUE(
          rule,
          '$.brandId'
        ),
        ''
      )
        AS brand_id,

      NULLIF(
        JSON_VALUE(
          rule,
          '$.allocationScope'
        ),
        ''
      )
        AS allocation_scope,

      NULLIF(
        JSON_VALUE(
          rule,
          '$.lifecycle'
        ),
        ''
      )
        AS lifecycle

    FROM
      UNNEST(
        JSON_QUERY_ARRAY(
          @allocation_rules_json
        )
      )
        AS rule

    WHERE
      LOWER(
        JSON_VALUE(
          rule,
          '$.enabled'
        )
      )
      =
      'true';


    CREATE TEMP TABLE filtered AS

    SELECT

      DATE(
        usage_start_time,
        '${REPORT_TIMEZONE}'
      ) AS cost_date,

      billing_account_id,

      project.id AS project_id,
      project.name AS project_name,

      service.id AS service_id,
      service.description AS service_description,

      sku.id AS sku_id,
      sku.description AS sku_description,

      location.location AS location_name,
      location.country AS location_country,
      location.region AS location_region,
      location.zone AS location_zone,

      resource.name AS resource_name,
      resource.global_name AS resource_global_name,

      invoice.month AS invoice_month,

      currency,

      SAFE_CAST(
        cost
        AS NUMERIC
      )
        AS gross_cost,

      SAFE_CAST(
        COALESCE(
          (
            SELECT
              SUM(
                credit.amount
              )

            FROM
              UNNEST(
                credits
              )
                AS credit
          ),
          0
        )
        AS NUMERIC
      )
        AS credits,

      SAFE_CAST(
        cost
        +
        COALESCE(
          (
            SELECT
              SUM(
                credit.amount
              )

            FROM
              UNNEST(
                credits
              )
                AS credit
          ),
          0
        )
        AS NUMERIC
      )
        AS net_cost,

      (
        SELECT
          ANY_VALUE(
            label.value
          )

        FROM
          UNNEST(
            labels
          )
            AS label

        WHERE
          LOWER(
            label.key
          )
          IN
          (
            'workspace_id',
            'growthos_workspace_id'
          )
      )
        AS label_workspace_id,

      (
        SELECT
          ANY_VALUE(
            label.value
          )

        FROM
          UNNEST(
            labels
          )
            AS label

        WHERE
          LOWER(
            label.key
          )
          IN
          (
            'brand_id',
            'growthos_brand_id'
          )
      )
        AS label_brand_id,

      (
        SELECT
          ANY_VALUE(
            label.value
          )

        FROM
          UNNEST(
            labels
          )
            AS label

        WHERE
          LOWER(
            label.key
          )
          IN
          (
            'module',
            'module_id',
            'growthos_module'
          )
      )
        AS explicit_module_id,

      (
        SELECT
          ANY_VALUE(
            label.value
          )

        FROM
          UNNEST(
            labels
          )
            AS label

        WHERE
          LOWER(
            label.key
          )
          IN
          (
            'workload',
            'growthos_workload'
          )
      )
        AS workload,

      CASE

        WHEN
          REGEXP_CONTAINS(
            LOWER(
              IFNULL(
                service.description,
                ''
              )
            ),
            r'(^|[^a-z])invoice([^a-z]|$)'
          )
        THEN TRUE

        WHEN
          REGEXP_CONTAINS(
            LOWER(
              IFNULL(
                sku.description,
                ''
              )
            ),
            r'(^|[^a-z])(tax|invoice|billing adjustment)([^a-z]|$)'
          )
        THEN TRUE

        ELSE FALSE

      END
        AS is_billing_adjustment

    FROM
      \`${source}\`

    WHERE
      DATE(
        usage_start_time,
        '${REPORT_TIMEZONE}'
      )
      BETWEEN
        CAST(
          @baseline_start
          AS DATE
        )
        AND
        CAST(
          @end_date
          AS DATE
        );


    CREATE TEMP TABLE base_normalized AS

    SELECT

      GENERATE_UUID()
        AS billing_row_id,

      *,

      REGEXP_EXTRACT(
        COALESCE(
          resource_global_name,
          resource_name,
          ''
        ),
        r'(?i)/jobs/([^/?]+)'
      )
        AS bigquery_job_id,

      REGEXP_EXTRACT(
        COALESCE(
          resource_global_name,
          resource_name,
          ''
        ),
        r'(?i)/datasets/([^/?]+)'
      )
        AS bigquery_dataset_id,

      COALESCE(
        NULLIF(
          explicit_module_id,
          ''
        ),
        CASE

          WHEN
            REGEXP_CONTAINS(
              LOWER(
                IFNULL(
                  resource_name,
                  ''
                )
              ),
              r'call[-_ ]commerce'
            )
          THEN
            'call-commerce'

          WHEN
            REGEXP_CONTAINS(
              LOWER(
                CONCAT(
                  IFNULL(
                    resource_name,
                    ''
                  ),
                  ' ',
                  IFNULL(
                    workload,
                    ''
                  )
                )
              ),
              r'google[-_ ]?ads'
            )
          THEN
            'google'

          WHEN
            REGEXP_CONTAINS(
              LOWER(
                CONCAT(
                  IFNULL(
                    resource_name,
                    ''
                  ),
                  ' ',
                  IFNULL(
                    workload,
                    ''
                  )
                )
              ),
              r'(^|[^a-z])meta([^a-z]|$)'
            )
          THEN
            'meta'

          WHEN
            REGEXP_CONTAINS(
              LOWER(
                CONCAT(
                  IFNULL(
                    resource_name,
                    ''
                  ),
                  ' ',
                  IFNULL(
                    workload,
                    ''
                  )
                )
              ),
              r'attribution'
            )
          THEN
            'attribution'

          WHEN
            REGEXP_CONTAINS(
              LOWER(
                CONCAT(
                  IFNULL(
                    resource_name,
                    ''
                  ),
                  ' ',
                  IFNULL(
                    workload,
                    ''
                  )
                )
              ),
              r'retention'
            )
          THEN
            'retention'

          WHEN
            REGEXP_CONTAINS(
              LOWER(
                CONCAT(
                  IFNULL(
                    resource_name,
                    ''
                  ),
                  ' ',
                  IFNULL(
                    workload,
                    ''
                  )
                )
              ),
              r'shopify'
            )
          THEN
            'shopify'

          WHEN
            STARTS_WITH(
              LOWER(
                IFNULL(
                  resource_name,
                  ''
                )
              ),
              'growthos-'
            )
          THEN
            'platform'

          ELSE
            'unallocated'

        END
      )
        AS inferred_module_id

    FROM
      filtered;


    CREATE TEMP TABLE ruled AS

    SELECT

      base.* EXCEPT(
        billing_row_id
      ),

      STRUCT(

        rule.priority
          AS priority,

        rule.module_id
          AS module_id,

        rule.workspace_id
          AS workspace_id,

        rule.brand_id
          AS brand_id,

        rule.allocation_scope
          AS allocation_scope,

        rule.lifecycle
          AS lifecycle

      )
        AS matched_rule

    FROM
      base_normalized
        AS base

    LEFT JOIN
      allocation_rules
        AS rule

    ON
      REGEXP_CONTAINS(

        LOWER(
          CASE
            WHEN
              rule.match_field =
                'resource_name'
            THEN
              IFNULL(
                base.resource_name,
                ''
              )

            WHEN
              rule.match_field =
                'resource_global_name'
            THEN
              IFNULL(
                base.resource_global_name,
                ''
              )

            WHEN
              rule.match_field =
                'dataset_id'
            THEN
              IFNULL(
                base.bigquery_dataset_id,
                ''
              )

            WHEN
              rule.match_field =
                'service'
            THEN
              IFNULL(
                base.service_description,
                ''
              )

            WHEN
              rule.match_field =
                'sku'
            THEN
              IFNULL(
                base.sku_description,
                ''
              )

            WHEN
              rule.match_field =
                'location'
            THEN
              COALESCE(
                base.location_region,
                base.location_name,
                base.location_country,
                ''
              )

            WHEN
              rule.match_field =
                'module'
            THEN
              IFNULL(
                base.inferred_module_id,
                ''
              )

            ELSE
              ''

          END
        ),

        rule.match_regex

      )

    QUALIFY
      ROW_NUMBER()
      OVER
      (
        PARTITION BY
          base.billing_row_id

        ORDER BY
          rule.priority ASC NULLS LAST,
          rule.rule_id ASC NULLS LAST
      )
      =
      1;


    CREATE TEMP TABLE normalized AS

    SELECT

      * EXCEPT(
        matched_rule
      ),

      COALESCE(
        matched_rule.module_id,
        inferred_module_id,
        'unallocated'
      )
        AS module_id,

      COALESCE(
        NULLIF(
          label_workspace_id,
          ''
        ),
        matched_rule.workspace_id
      )
        AS allocated_workspace_id,

      COALESCE(
        NULLIF(
          label_brand_id,
          ''
        ),
        matched_rule.brand_id
      )
        AS allocated_brand_id,

      COALESCE(
        matched_rule.allocation_scope,

        CASE

          WHEN
            NULLIF(
              label_workspace_id,
              ''
            )
            IS NOT NULL
            OR
            NULLIF(
              label_brand_id,
              ''
            )
            IS NOT NULL
          THEN
            'brand'

          WHEN
            matched_rule.workspace_id
              IS NOT NULL
            OR
            matched_rule.brand_id
              IS NOT NULL
          THEN
            'brand'

          WHEN
            COALESCE(
              matched_rule.module_id,
              inferred_module_id,
              'unallocated'
            )
            !=
            'unallocated'
          THEN
            'shared-platform'

          ELSE
            'unallocated'

        END

      )
        AS allocation_scope,

      COALESCE(
        matched_rule.lifecycle,

        CASE

          WHEN
            LOWER(
              IFNULL(
                bigquery_dataset_id,
                ''
              )
            )
            =
            'brillare_shopify'
          THEN
            'legacy'

          WHEN
            LOWER(
              IFNULL(
                location_region,
                ''
              )
            )
            =
            'asia-southeast1'
          THEN
            'legacy'

          WHEN
            LOWER(
              IFNULL(
                location_region,
                ''
              )
            )
            =
            'asia-south1'
          THEN
            'current'

          WHEN
            STARTS_WITH(
              LOWER(
                IFNULL(
                  resource_name,
                  ''
                )
              ),
              'growthos-'
            )
          THEN
            'current'

          ELSE
            'unclassified'

        END

      )
        AS lifecycle

    FROM
      ruled;


    CREATE TEMP TABLE coverage AS

    SELECT

      source_start_date,
      source_end_date,
      source_currency,

      CASE

        WHEN
          source_start_date
            IS NULL
          OR
          source_end_date
            IS NULL
          OR
          source_end_date <
            CAST(
              @start_date
              AS DATE
            )
          OR
          source_start_date >
            CAST(
              @end_date
              AS DATE
            )
        THEN
          NULL

        ELSE
          GREATEST(
            source_start_date,
            CAST(
              @start_date
              AS DATE
            )
          )

      END
        AS covered_start_date,

      CASE

        WHEN
          source_start_date
            IS NULL
          OR
          source_end_date
            IS NULL
          OR
          source_end_date <
            CAST(
              @start_date
              AS DATE
            )
          OR
          source_start_date >
            CAST(
              @end_date
              AS DATE
            )
        THEN
          NULL

        ELSE
          LEAST(
            source_end_date,
            CAST(
              @end_date
              AS DATE
            )
          )

      END
        AS covered_end_date

    FROM
      source_coverage;


    SELECT

      TO_JSON_STRING(
        STRUCT(

          @start_date
            AS startDate,

          @end_date
            AS endDate,

          @previous_start
            AS previousStart,

          @previous_end
            AS previousEnd,

          '${REPORT_TIMEZONE}'
            AS timezone,

          '${BILLING_LOCATION}'
            AS billingLocation,

          '${BILLING_DATASET}'
            AS billingDataset,

          '${sourceTable}'
            AS sourceTable,

          (
            SELECT
              source_currency

            FROM
              coverage

            LIMIT 1
          )
            AS currency,

          (
            SELECT AS STRUCT

              FORMAT_DATE(
                '%Y-%m-%d',
                source_start_date
              )
                AS sourceStartDate,

              FORMAT_DATE(
                '%Y-%m-%d',
                source_end_date
              )
                AS sourceEndDate,

              FORMAT_DATE(
                '%Y-%m-%d',
                covered_start_date
              )
                AS coveredStartDate,

              FORMAT_DATE(
                '%Y-%m-%d',
                covered_end_date
              )
                AS coveredEndDate,

              @actual_days
                AS requestedDays,

              CASE

                WHEN
                  covered_start_date
                    IS NULL
                  OR
                  covered_end_date
                    IS NULL
                THEN
                  0

                ELSE
                  DATE_DIFF(
                    covered_end_date,
                    covered_start_date,
                    DAY
                  )
                  +
                  1

              END
                AS coveredDays,

              SAFE_MULTIPLY(
                SAFE_DIVIDE(

                  CASE

                    WHEN
                      covered_start_date
                        IS NULL
                      OR
                      covered_end_date
                        IS NULL
                    THEN
                      0

                    ELSE
                      DATE_DIFF(
                        covered_end_date,
                        covered_start_date,
                        DAY
                      )
                      +
                      1

                  END,

                  NULLIF(
                    @actual_days,
                    0
                  )

                ),
                100
              )
                AS coveragePct,

              (
                source_end_date <
                CAST(
                  @end_date
                  AS DATE
                )
              )
                AS backfillInProgress,

              (
                covered_start_date =
                  CAST(
                    @start_date
                    AS DATE
                  )
                AND
                covered_end_date =
                  CAST(
                    @end_date
                    AS DATE
                  )
              )
                AS complete,

              (
                source_start_date <=
                  CAST(
                    @previous_start
                    AS DATE
                  )
                AND
                source_end_date >=
                  CAST(
                    @previous_end
                    AS DATE
                  )
              )
                AS previousPeriodComplete

            FROM
              coverage

          )
            AS coverage,

          (
            SELECT AS STRUCT

              CAST(
                COALESCE(
                  SUM(
                    IF(
                      cost_date
                      BETWEEN
                        CAST(
                          @start_date
                          AS DATE
                        )
                        AND
                        CAST(
                          @end_date
                          AS DATE
                        )
                      AND
                      is_billing_adjustment =
                        FALSE,
                      gross_cost,
                      0
                    )
                  ),
                  0
                )
                AS FLOAT64
              )
                AS infrastructureGrossCost,

              CAST(
                COALESCE(
                  SUM(
                    IF(
                      cost_date
                      BETWEEN
                        CAST(
                          @start_date
                          AS DATE
                        )
                        AND
                        CAST(
                          @end_date
                          AS DATE
                        )
                      AND
                      is_billing_adjustment =
                        FALSE,
                      credits,
                      0
                    )
                  ),
                  0
                )
                AS FLOAT64
              )
                AS infrastructureCredits,

              CAST(
                COALESCE(
                  SUM(
                    IF(
                      cost_date
                      BETWEEN
                        CAST(
                          @start_date
                          AS DATE
                        )
                        AND
                        CAST(
                          @end_date
                          AS DATE
                        )
                      AND
                      is_billing_adjustment =
                        FALSE,
                      net_cost,
                      0
                    )
                  ),
                  0
                )
                AS FLOAT64
              )
                AS infrastructureNetCost,

              CAST(
                COALESCE(
                  SUM(
                    IF(
                      cost_date
                      BETWEEN
                        CAST(
                          @start_date
                          AS DATE
                        )
                        AND
                        CAST(
                          @end_date
                          AS DATE
                        )
                      AND
                      is_billing_adjustment =
                        TRUE,
                      net_cost,
                      0
                    )
                  ),
                  0
                )
                AS FLOAT64
              )
                AS billingAdjustmentsNetCost,

              CAST(
                COALESCE(
                  SUM(
                    IF(
                      cost_date
                      BETWEEN
                        CAST(
                          @start_date
                          AS DATE
                        )
                        AND
                        CAST(
                          @end_date
                          AS DATE
                        ),
                      net_cost,
                      0
                    )
                  ),
                  0
                )
                AS FLOAT64
              )
                AS totalBilledNetCost,

              CAST(
                COALESCE(
                  SUM(
                    IF(
                      cost_date
                      BETWEEN
                        CAST(
                          @previous_start
                          AS DATE
                        )
                        AND
                        CAST(
                          @previous_end
                          AS DATE
                        )
                      AND
                      is_billing_adjustment =
                        FALSE,
                      net_cost,
                      0
                    )
                  ),
                  0
                )
                AS FLOAT64
              )
                AS previousInfrastructureNetCost,

              COUNT(
                DISTINCT IF(
                  cost_date
                  BETWEEN
                    CAST(
                      @start_date
                      AS DATE
                    )
                    AND
                    CAST(
                      @end_date
                      AS DATE
                    )
                  AND
                  is_billing_adjustment =
                    FALSE,
                  project_id,
                  NULL
                )
              )
                AS projectCount,

              COUNT(
                DISTINCT IF(
                  cost_date
                  BETWEEN
                    CAST(
                      @start_date
                      AS DATE
                    )
                    AND
                    CAST(
                      @end_date
                      AS DATE
                    )
                  AND
                  is_billing_adjustment =
                    FALSE,
                  service_description,
                  NULL
                )
              )
                AS serviceCount,

              COUNT(
                DISTINCT IF(
                  cost_date
                  BETWEEN
                    CAST(
                      @start_date
                      AS DATE
                    )
                    AND
                    CAST(
                      @end_date
                      AS DATE
                    )
                  AND
                  is_billing_adjustment =
                    FALSE,
                  COALESCE(
                    location_region,
                    location_name
                  ),
                  NULL
                )
              )
                AS locationCount,

              CAST(
                COALESCE(
                  SUM(
                    IF(
                      cost_date
                      BETWEEN
                        CAST(
                          @start_date
                          AS DATE
                        )
                        AND
                        CAST(
                          @end_date
                          AS DATE
                        )
                      AND
                      is_billing_adjustment =
                        FALSE
                      AND
                      allocation_scope !=
                        'unallocated',
                      net_cost,
                      0
                    )
                  ),
                  0
                )
                AS FLOAT64
              )
                AS allocatedInfrastructureNetCost

            FROM
              normalized

          )
            AS summary,

          ARRAY(

            SELECT AS STRUCT

              FORMAT_DATE(
                '%Y-%m-%d',
                cost_date
              )
                AS date,

              CAST(
                SUM(
                  gross_cost
                )
                AS FLOAT64
              )
                AS grossCost,

              CAST(
                SUM(
                  credits
                )
                AS FLOAT64
              )
                AS credits,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                FALSE

            GROUP BY
              cost_date

            ORDER BY
              cost_date

          )
            AS daily,

          ARRAY(

            SELECT AS STRUCT

              service_description
                AS service,

              CAST(
                SUM(
                  gross_cost
                )
                AS FLOAT64
              )
                AS grossCost,

              CAST(
                SUM(
                  credits
                )
                AS FLOAT64
              )
                AS credits,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost,

              COUNT(
                DISTINCT sku_id
              )
                AS skuCount

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                FALSE

            GROUP BY
              service_description

            ORDER BY
              netCost DESC

            LIMIT 30

          )
            AS services,

          ARRAY(

            SELECT AS STRUCT

              service_description
                AS service,

              sku_description
                AS sku,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                TRUE

            GROUP BY
              service,
              sku

            ORDER BY
              ABS(
                netCost
              )
              DESC

            LIMIT 30

          )
            AS adjustments,

          ARRAY(

            SELECT AS STRUCT

              project_id
                AS projectId,

              ANY_VALUE(
                project_name
              )
                AS projectName,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                FALSE

            GROUP BY
              project_id

            ORDER BY
              netCost DESC

            LIMIT 30

          )
            AS projects,

          ARRAY(

            SELECT AS STRUCT

              COALESCE(
                location_region,
                location_name,
                location_country,
                'unspecified'
              )
                AS location,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                FALSE

            GROUP BY
              location

            ORDER BY
              netCost DESC

            LIMIT 40

          )
            AS locations,

          ARRAY(

            SELECT AS STRUCT

              module_id
                AS moduleId,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                FALSE

            GROUP BY
              module_id

            ORDER BY
              netCost DESC

          )
            AS modules,

          ARRAY(

            SELECT AS STRUCT

              lifecycle,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                FALSE

            GROUP BY
              lifecycle

            ORDER BY
              netCost DESC

          )
            AS lifecycles,

          ARRAY(

            SELECT AS STRUCT

              allocation_scope
                AS allocationScope,

              COALESCE(
                allocated_workspace_id,
                CASE
                  WHEN
                    allocation_scope =
                      'shared-platform'
                  THEN
                    'platform'
                  ELSE
                    'unallocated'
                END
              )
                AS workspaceId,

              COALESCE(
                allocated_brand_id,
                CASE
                  WHEN
                    allocation_scope =
                      'shared-platform'
                  THEN
                    'shared'
                  ELSE
                    'unallocated'
                END
              )
                AS brandId,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                FALSE

            GROUP BY
              allocationScope,
              workspaceId,
              brandId

            ORDER BY
              netCost DESC

            LIMIT 50

          )
            AS allocations,

          ARRAY(

            SELECT AS STRUCT

              service_description
                AS service,

              sku_description
                AS sku,

              resource_name
                AS resourceName,

              resource_global_name
                AS resourceGlobalName,

              module_id
                AS moduleId,

              lifecycle,

              allocation_scope
                AS allocationScope,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                FALSE

            GROUP BY
              service,
              sku,
              resourceName,
              resourceGlobalName,
              moduleId,
              lifecycle,
              allocationScope

            HAVING
              ABS(
                netCost
              )
              >
              0

            ORDER BY
              netCost DESC

            LIMIT 80

          )
            AS resources,

          ARRAY(

            SELECT AS STRUCT

              FORMAT_DATE(
                '%Y-%m-%d',
                cost_date
              )
                AS date,

              bigquery_job_id
                AS jobId,

              ANY_VALUE(
                project_id
              )
                AS projectId,

              ANY_VALUE(
                sku_description
              )
                AS sku,

              ANY_VALUE(
                location_region
              )
                AS location,

              ANY_VALUE(
                module_id
              )
                AS moduleId,

              ANY_VALUE(
                lifecycle
              )
                AS lifecycle,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                FALSE

              AND LOWER(
                service_description
              )
              LIKE
                '%bigquery%'

              AND bigquery_job_id
                IS NOT NULL

            GROUP BY
              date,
              jobId

            ORDER BY
              netCost DESC

            LIMIT 150

          )
            AS bigqueryJobs,

          ARRAY(

            SELECT AS STRUCT

              bigquery_dataset_id
                AS datasetId,

              ANY_VALUE(
                project_id
              )
                AS projectId,

              ANY_VALUE(
                module_id
              )
                AS moduleId,

              ANY_VALUE(
                lifecycle
              )
                AS lifecycle,

              CAST(
                SUM(
                  net_cost
                )
                AS FLOAT64
              )
                AS netCost

            FROM
              normalized

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND is_billing_adjustment =
                FALSE

              AND LOWER(
                service_description
              )
              LIKE
                '%bigquery%'

              AND bigquery_dataset_id
                IS NOT NULL

            GROUP BY
              datasetId

            ORDER BY
              netCost DESC

            LIMIT 150

          )
            AS bigqueryDatasets,

          ARRAY(

            SELECT AS STRUCT

              FORMAT_DATE(
                '%Y-%m-%d',
                cost_date
              )
                AS date,

              CAST(
                daily_net_cost
                AS FLOAT64
              )
                AS netCost,

              CAST(
                baseline_avg
                AS FLOAT64
              )
                AS baselineAverage,

              SAFE_MULTIPLY(
                SAFE_DIVIDE(
                  daily_net_cost
                  -
                  baseline_avg,
                  NULLIF(
                    baseline_avg,
                    0
                  )
                ),
                100
              )
                AS deltaPct,

              CASE

                WHEN
                  daily_net_cost >
                    baseline_avg
                    +
                    (
                      3
                      *
                      IFNULL(
                        baseline_stddev,
                        0
                      )
                    )
                  AND
                  daily_net_cost >=
                    baseline_avg
                    *
                    2
                THEN
                  'critical'

                WHEN
                  daily_net_cost >
                    baseline_avg
                    +
                    (
                      2
                      *
                      IFNULL(
                        baseline_stddev,
                        0
                      )
                    )
                  AND
                  daily_net_cost >=
                    baseline_avg
                    *
                    1.5
                THEN
                  'warning'

                ELSE
                  'watch'

              END
                AS severity

            FROM
            (

              SELECT

                cost_date,
                daily_net_cost,

                AVG(
                  daily_net_cost
                )
                OVER
                (
                  ORDER BY
                    cost_date

                  ROWS BETWEEN
                    28 PRECEDING
                    AND
                    1 PRECEDING
                )
                  AS baseline_avg,

                STDDEV_POP(
                  daily_net_cost
                )
                OVER
                (
                  ORDER BY
                    cost_date

                  ROWS BETWEEN
                    28 PRECEDING
                    AND
                    1 PRECEDING
                )
                  AS baseline_stddev

              FROM
              (

                SELECT

                  cost_date,

                  SUM(
                    net_cost
                  )
                    AS daily_net_cost

                FROM
                  normalized

                WHERE
                  is_billing_adjustment =
                    FALSE

                GROUP BY
                  cost_date

              )

            )

            WHERE
              cost_date
              BETWEEN
                CAST(
                  @start_date
                  AS DATE
                )
                AND
                CAST(
                  @end_date
                  AS DATE
                )

              AND baseline_avg
                IS NOT NULL

              AND baseline_avg >
                0

              AND daily_net_cost >=
                baseline_avg
                *
                1.25

            ORDER BY
              cost_date DESC

            LIMIT 30

          )
            AS anomalies

        )
      )
        AS payload

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      location:
        BILLING_LOCATION,

      params: {

        baseline_start:
          range.baselineStart,

        start_date:
          range.start,

        end_date:
          range.end,

        previous_start:
          range.previousStart,

        previous_end:
          range.previousEnd,

        actual_days:
          range.actualDays,

        allocation_rules_json:
          JSON.stringify(
            allocationRules
          ),

      },

      types: {

        baseline_start:
          'STRING',

        start_date:
          'STRING',

        end_date:
          'STRING',

        previous_start:
          'STRING',

        previous_end:
          'STRING',

        actual_days:
          'INT64',

        allocation_rules_json:
          'STRING',

      },

    });


  const payload =
    String(
      (rows?.[0] as any)
        ?.payload
      ||
      ''
    );


  if (!payload) {

    throw new Error(
      'BILLING_QUERY_RETURNED_NO_PAYLOAD'
    );

  }


  return JSON.parse(
    payload
  );

}


function calculateDerivedSummary(
  data:
    any
) {

  const summary =
    data?.summary
    ||
    {};

  const coverage =
    data?.coverage
    ||
    {};


  const infrastructureNetCost =
    Number(
      summary.infrastructureNetCost
      ||
      0
    );

  const previousInfrastructureNetCost =
    Number(
      summary.previousInfrastructureNetCost
      ||
      0
    );

  const coveredDays =
    Number(
      coverage.coveredDays
      ||
      0
    );

  const currentComplete =
    coverage.complete ===
    true;

  const previousComplete =
    coverage.previousPeriodComplete ===
    true;


  const changePct =
    currentComplete
    &&
    previousComplete
    &&
    previousInfrastructureNetCost !==
      0

      ?
        (
          (
            infrastructureNetCost
            -
            previousInfrastructureNetCost
          )
          /
          Math.abs(
            previousInfrastructureNetCost
          )
        )
        *
        100

      :
        null;


  const allocatedInfrastructureNetCost =
    Number(
      summary.allocatedInfrastructureNetCost
      ||
      0
    );


  const allocationCoveragePct =
    infrastructureNetCost ===
      0

      ?
        null

      :
        (
          allocatedInfrastructureNetCost
          /
          infrastructureNetCost
        )
        *
        100;


  return {

    ...summary,

    changePct,

    dailyAverageInfrastructure:
      coveredDays >
        0

        ?
          infrastructureNetCost
          /
          coveredDays

        :
          0,

    allocationCoveragePct,

  };

}


export async function GET(
  request:
    NextRequest
) {

  try {

    await requirePlatformAdmin(
      request
    );


    const range =
      resolveRange(
        request
      );


    let sourceTable:
      string |
      null =
        null;


    try {

      sourceTable =
        await findDetailedBillingTable();

    } catch (
      error: any
    ) {

      const message =
        String(
          error?.message
          ||
          error
          ||
          ''
        );


      if (
        message.includes(
          'Not found'
        )
        ||
        message.includes(
          'not found'
        )
      ) {

        return NextResponse.json({

          ok:
            true,

          configured:
            false,

          state:
            'BILLING_DATASET_NOT_READY',

          billingDataset:
            BILLING_DATASET,

          billingLocation:
            BILLING_LOCATION,

          message:
            'The billing dataset is not available yet.',

        });

      }


      throw error;

    }


    if (!sourceTable) {

      return NextResponse.json({

        ok:
          true,

        configured:
          false,

        state:
          'DETAILED_EXPORT_NOT_READY',

        billingDataset:
          BILLING_DATASET,

        billingLocation:
          BILLING_LOCATION,

        message:
          'Waiting for Google Cloud Detailed usage cost export.',

      });

    }


    const allocationRules =
      await loadAllocationRules();


    const data =
      await loadCloudCosts(
        sourceTable,
        range,
        allocationRules
      );


    return NextResponse.json({

      ok:
        true,

      configured:
        true,

      version:
        '1.1',

      range: {

        start:
          range.start,

        end:
          range.end,

        days:
          range.actualDays,

      },

      data: {

        ...data,

        allocationRuleCount:
          allocationRules.length,

        summary:
          calculateDerivedSummary(
            data
          ),

      },

    });

  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to load cloud costs'
      );


    if (
      message ===
      'UNAUTHENTICATED'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            message,

        },
        {
          status:
            401,
        }
      );

    }


    if (
      message ===
      'ADMIN_ACCESS_REQUIRED'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            message,

        },
        {
          status:
            403,
        }
      );

    }


    console.error(
      'ADMIN_CLOUD_COSTS_V1_1_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          message,

      },
      {
        status:
          500,
      }
    );

  }

}
