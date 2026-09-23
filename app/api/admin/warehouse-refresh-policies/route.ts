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

const DATASET_ID =
  String(
    process.env.GROWTHOS_DATA_DATASET
    ||
    'growthos_data'
  ).trim();

const LOCATION =
  String(
    process.env.GCP_BQ_LOCATION
    ||
    'asia-south1'
  ).trim();

const POLICY_TABLE =
  'warehouse_refresh_policies';

const PENDING_TABLE =
  'shopify_warehouse_pending';


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
        LOCATION,

      params: {
        user_id:
          userId,
      },

    });


  if (
    Number(
      (rows?.[0] as any)
        ?.active_admins
      ||
      0
    )
    <
    1
  ) {

    throw new Error(
      'ADMIN_ACCESS_REQUIRED'
    );

  }


  return identity;

}


function cleanTimestamp(
  value:
    any
) {

  return value?.value
  ??
  value
  ??
  null;

}


export async function GET(
  request:
    NextRequest
) {

  try {

    await requirePlatformAdmin(
      request
    );


    const [
      rows,
    ] =
      await bigquery.query({

        query: `

          WITH pending AS
          (

            SELECT

              landing.workspace_id,
              landing.brand_id,

              COUNT(*)
                AS pending_records,

              COUNTIF(
                landing.entity =
                  'orders'
              )
                AS pending_orders,

              COUNTIF(
                landing.entity =
                  'customers'
              )
                AS pending_customers,

              COUNTIF(
                landing.entity =
                  'products'
              )
                AS pending_products,

              MIN(
                landing.queued_at
              )
                AS oldest_pending_at

            FROM
              \`${PROJECT_ID}.${DATASET_ID}.${PENDING_TABLE}\`
              AS landing

            LEFT JOIN
              \`${PROJECT_ID}.${CONTROL_DATASET}.${POLICY_TABLE}\`
              AS pending_policy

            ON
              pending_policy.workspace_id =
                landing.workspace_id

              AND pending_policy.brand_id =
                landing.brand_id

            WHERE
              landing.queued_at >=
                TIMESTAMP_SUB(
                  CURRENT_TIMESTAMP(),
                  INTERVAL 14 DAY
                )

              AND landing.queued_at >
                COALESCE(
                  pending_policy.last_pending_cutoff,
                  TIMESTAMP('1970-01-01')
                )

            GROUP BY
              landing.workspace_id,
              landing.brand_id

          )

          SELECT

            brand.workspace_id,
            brand.brand_id,
            brand.brand_name,
            brand.status AS brand_status,

            COALESCE(
              policy.refresh_interval_minutes,
              60
            )
              AS refresh_interval_minutes,

            COALESCE(
              policy.enabled,
              TRUE
            )
              AS enabled,

            policy.last_refresh_at,
            policy.next_refresh_at,
            policy.last_pending_cutoff,
            policy.last_status,
            policy.last_error,
            policy.updated_at,

            COALESCE(
              pending.pending_records,
              0
            )
              AS pending_records,

            COALESCE(
              pending.pending_orders,
              0
            )
              AS pending_orders,

            COALESCE(
              pending.pending_customers,
              0
            )
              AS pending_customers,

            COALESCE(
              pending.pending_products,
              0
            )
              AS pending_products,

            pending.oldest_pending_at

          FROM
            \`${PROJECT_ID}.${CONTROL_DATASET}.brands\`
            AS brand

          LEFT JOIN
            \`${PROJECT_ID}.${CONTROL_DATASET}.${POLICY_TABLE}\`
            AS policy

          ON
            policy.workspace_id =
              brand.workspace_id

            AND policy.brand_id =
              brand.brand_id

          LEFT JOIN
            pending

          ON
            pending.workspace_id =
              brand.workspace_id

            AND pending.brand_id =
              brand.brand_id

          ORDER BY
            brand.brand_name,
            brand.brand_id

        `,

        location:
          LOCATION,

      });


    return NextResponse.json({

      ok:
        true,

      policies:
        rows.map(
          (row: any) => ({

            workspaceId:
              String(
                row.workspace_id
              ),

            brandId:
              String(
                row.brand_id
              ),

            brandName:
              String(
                row.brand_name
                ||
                row.brand_id
              ),

            brandStatus:
              String(
                row.brand_status
                ||
                'active'
              ),

            refreshIntervalMinutes:
              Number(
                row.refresh_interval_minutes
                ||
                60
              ),

            enabled:
              row.enabled !==
              false,

            lastRefreshAt:
              cleanTimestamp(
                row.last_refresh_at
              ),

            nextRefreshAt:
              cleanTimestamp(
                row.next_refresh_at
              ),

            lastPendingCutoff:
              cleanTimestamp(
                row.last_pending_cutoff
              ),

            lastStatus:
              row.last_status
              ??
              null,

            lastError:
              row.last_error
              ??
              null,

            updatedAt:
              cleanTimestamp(
                row.updated_at
              ),

            pendingRecords:
              Number(
                row.pending_records
                ||
                0
              ),

            pendingOrders:
              Number(
                row.pending_orders
                ||
                0
              ),

            pendingCustomers:
              Number(
                row.pending_customers
                ||
                0
              ),

            pendingProducts:
              Number(
                row.pending_products
                ||
                0
              ),

            oldestPendingAt:
              cleanTimestamp(
                row.oldest_pending_at
              ),

          })
        ),

    });

  } catch (
    error: any
  ) {

    return handleError(
      error
    );

  }

}


export async function PUT(
  request:
    NextRequest
) {

  try {

    const identity =
      await requirePlatformAdmin(
        request
      );


    const body =
      await request.json();


    const workspaceId =
      String(
        body?.workspaceId
        ||
        ''
      ).trim();

    const brandId =
      String(
        body?.brandId
        ||
        ''
      ).trim();

    const action =
      String(
        body?.action
        ||
        'save'
      ).trim();


    if (
      !workspaceId
      ||
      !brandId
    ) {

      return NextResponse.json(
        {
          ok:
            false,
          error:
            'WORKSPACE_BRAND_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    if (
      action ===
        'refresh_now'
    ) {

      await bigquery.query({

        query: `

          MERGE
            \`${PROJECT_ID}.${CONTROL_DATASET}.${POLICY_TABLE}\`
            AS target

          USING
          (
            SELECT
              @workspace_id AS workspace_id,
              @brand_id AS brand_id
          )
            AS source

          ON
            target.workspace_id =
              source.workspace_id

            AND target.brand_id =
              source.brand_id

          WHEN MATCHED THEN

            UPDATE SET

              enabled =
                TRUE,

              next_refresh_at =
                CURRENT_TIMESTAMP(),

              updated_at =
                CURRENT_TIMESTAMP(),

              updated_by =
                @updated_by

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
              'queued',
              NULL,
              CURRENT_TIMESTAMP(),
              @updated_by,
              NULL
            )

        `,

        location:
          LOCATION,

        params: {

          workspace_id:
            workspaceId,

          brand_id:
            brandId,

          updated_by:
            String(
              identity.userId
              ||
              'admin'
            ),

        },

      });


      return NextResponse.json({
        ok:
          true,
        action:
          'refresh_now',
      });

    }


    const refreshIntervalMinutes =
      Number(
        body?.refreshIntervalMinutes
      );


    const allowed =
      new Set([
        15,
        30,
        60,
        120,
        180,
        360,
        720,
        1440,
      ]);


    if (
      !allowed.has(
        refreshIntervalMinutes
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,
          error:
            'REFRESH_INTERVAL_UNSUPPORTED',
        },
        {
          status:
            400,
        }
      );

    }


    const enabled =
      body?.enabled !==
      false;


    await bigquery.query({

      query: `

        MERGE
          \`${PROJECT_ID}.${CONTROL_DATASET}.${POLICY_TABLE}\`
          AS target

        USING
        (
          SELECT
            @workspace_id AS workspace_id,
            @brand_id AS brand_id
        )
          AS source

        ON
          target.workspace_id =
            source.workspace_id

          AND target.brand_id =
            source.brand_id

        WHEN MATCHED THEN

          UPDATE SET

            refresh_interval_minutes =
              @refresh_interval_minutes,

            enabled =
              @enabled,

            next_refresh_at =
              CASE
                WHEN @enabled
                THEN COALESCE(
                  target.next_refresh_at,
                  CURRENT_TIMESTAMP()
                )
                ELSE NULL
              END,

            updated_at =
              CURRENT_TIMESTAMP(),

            updated_by =
              @updated_by

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
            @refresh_interval_minutes,
            @enabled,
            NULL,
            IF(
              @enabled,
              CURRENT_TIMESTAMP(),
              NULL
            ),
            'configured',
            NULL,
            CURRENT_TIMESTAMP(),
            @updated_by,
            NULL
          )

      `,

      location:
        LOCATION,

      params: {

        workspace_id:
          workspaceId,

        brand_id:
          brandId,

        refresh_interval_minutes:
          refreshIntervalMinutes,

        enabled,

        updated_by:
          String(
            identity.userId
            ||
            'admin'
          ),

      },

      types: {

        workspace_id:
          'STRING',

        brand_id:
          'STRING',

        refresh_interval_minutes:
          'INT64',

        enabled:
          'BOOL',

        updated_by:
          'STRING',

      },

    });


    return NextResponse.json({
      ok:
        true,
      action:
        'save',
    });

  } catch (
    error: any
  ) {

    return handleError(
      error
    );

  }

}


function handleError(
  error:
    any
) {

  const message =
    String(
      error?.message
      ||
      error
      ||
      'WAREHOUSE_POLICY_ERROR'
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
    'ADMIN_WAREHOUSE_REFRESH_POLICY_ERROR',
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
