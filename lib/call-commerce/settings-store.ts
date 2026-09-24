import 'server-only';

import {
  bigquery,
} from '@/lib/bigquery';

import {
  CALL_COMMERCE_DATASET,
  CALL_COMMERCE_DEFAULTS,
  CALL_COMMERCE_LOCATION,
} from './config';


const PROJECT_ID =
  process.env.GCP_PROJECT_ID ||
  process.env.BQ_PROJECT_ID ||
  '';


const SETTINGS_TABLE =
  'call_commerce_settings';


const table =
  (name: string) =>
    `\`${PROJECT_ID}.${CALL_COMMERCE_DATASET}.${name}\``;


export type CallCommerceSettings = {

  contactMinDurationSeconds:
    number;

  reopenGraceMinutes:
    number;

  autoArchiveTerminalLeads:
    boolean;

  terminalArchiveDays:
    number;

  requireUnqualifiedReason:
    boolean;

  requireClosedLostReason:
    boolean;

  requirePurchaseOrderId:
    boolean;

  requirePurchaseAmount:
    boolean;

  updatedAt:
    string |
    null;

  updatedBy:
    string |
    null;

};


export const CALL_COMMERCE_SETTINGS_DEFAULTS:
  CallCommerceSettings = {

  contactMinDurationSeconds:
    Number(
      CALL_COMMERCE_DEFAULTS
        .contactMinDurationSeconds
    ),

  reopenGraceMinutes:
    Number(
      CALL_COMMERCE_DEFAULTS
        .reopenGraceMinutes
    ),

  autoArchiveTerminalLeads:
    true,

  terminalArchiveDays:
    Number(
      CALL_COMMERCE_DEFAULTS
        .terminalArchiveDays
    ),

  requireUnqualifiedReason:
    false,

  requireClosedLostReason:
    false,

  requirePurchaseOrderId:
    false,

  requirePurchaseAmount:
    false,

  updatedAt:
    null,

  updatedBy:
    null,

};


type CacheEntry = {
  expiresAt:
    number;

  value:
    CallCommerceSettings;
};


const cache =
  new Map<
    string,
    CacheEntry
  >();


const CACHE_TTL_MS =
  60_000;


let ensurePromise:
  Promise<void> |
  null =
    null;


function requireProject() {

  if (
    !PROJECT_ID
  ) {

    throw new Error(
      'Call Commerce settings require GCP project configuration'
    );
  }
}


function cacheKey(
  workspaceId: string,
  brandId: string
) {

  return `${workspaceId}:${brandId}`;
}


function scalar(
  value: any
) {

  if (
    value &&
    typeof value === 'object' &&
    'value' in value
  ) {
    return value.value;
  }

  return value;
}


function numberValue(
  value: any,
  fallback: number
) {

  const parsed =
    Number(
      scalar(
        value
      )
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


function booleanValue(
  value: any,
  fallback: boolean
) {

  const raw =
    scalar(
      value
    );

  if (
    typeof raw ===
      'boolean'
  ) {
    return raw;
  }

  if (
    raw === null ||
    raw === undefined ||
    raw === ''
  ) {
    return fallback;
  }

  return [
    'true',
    '1',
    'yes',
  ].includes(
    String(
      raw
    ).toLowerCase()
  );
}


function textValue(
  value: any
) {

  const raw =
    scalar(
      value
    );

  if (
    raw === null ||
    raw === undefined ||
    raw === ''
  ) {
    return null;
  }

  return String(
    raw
  );
}


function isMissingTableError(
  error: unknown
) {

  const anyError =
    error as any;

  const message =
    String(
      anyError?.message ||
      ''
    ).toLowerCase();

  return (
    Number(
      anyError?.code
    ) === 404
    ||
    (
      message.includes(
        'not found'
      )
      &&
      message.includes(
        SETTINGS_TABLE
      )
    )
  );
}


async function ensureSettingsTable() {

  requireProject();

  if (
    !ensurePromise
  ) {

    ensurePromise =
      bigquery.query({

        location:
          CALL_COMMERCE_LOCATION,

        query: `
          CREATE TABLE IF NOT EXISTS
            ${table(
              SETTINGS_TABLE
            )}
          (
            workspace_id STRING NOT NULL,
            brand_id STRING NOT NULL,

            contact_min_duration_seconds INT64 NOT NULL,
            reopen_grace_minutes INT64 NOT NULL,

            auto_archive_terminal_leads BOOL NOT NULL,
            terminal_archive_days INT64 NOT NULL,

            require_unqualified_reason BOOL NOT NULL,
            require_closed_lost_reason BOOL NOT NULL,

            require_purchase_order_id BOOL NOT NULL,
            require_purchase_amount BOOL NOT NULL,

            updated_by STRING,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
          )
          CLUSTER BY
            workspace_id,
            brand_id
        `,
      })
        .then(
          () => undefined
        )
        .catch(
          error => {

            ensurePromise =
              null;

            throw error;
          }
        );
  }

  await ensurePromise;
}


function normalizeSettings(
  row: any
):
  CallCommerceSettings {

  return {

    contactMinDurationSeconds:
      numberValue(
        row?.contact_min_duration_seconds,
        CALL_COMMERCE_SETTINGS_DEFAULTS
          .contactMinDurationSeconds
      ),

    reopenGraceMinutes:
      numberValue(
        row?.reopen_grace_minutes,
        CALL_COMMERCE_SETTINGS_DEFAULTS
          .reopenGraceMinutes
      ),

    autoArchiveTerminalLeads:
      booleanValue(
        row?.auto_archive_terminal_leads,
        CALL_COMMERCE_SETTINGS_DEFAULTS
          .autoArchiveTerminalLeads
      ),

    terminalArchiveDays:
      numberValue(
        row?.terminal_archive_days,
        CALL_COMMERCE_SETTINGS_DEFAULTS
          .terminalArchiveDays
      ),

    requireUnqualifiedReason:
      booleanValue(
        row?.require_unqualified_reason,
        CALL_COMMERCE_SETTINGS_DEFAULTS
          .requireUnqualifiedReason
      ),

    requireClosedLostReason:
      booleanValue(
        row?.require_closed_lost_reason,
        CALL_COMMERCE_SETTINGS_DEFAULTS
          .requireClosedLostReason
      ),

    requirePurchaseOrderId:
      booleanValue(
        row?.require_purchase_order_id,
        CALL_COMMERCE_SETTINGS_DEFAULTS
          .requirePurchaseOrderId
      ),

    requirePurchaseAmount:
      booleanValue(
        row?.require_purchase_amount,
        CALL_COMMERCE_SETTINGS_DEFAULTS
          .requirePurchaseAmount
      ),

    updatedAt:
      textValue(
        row?.updated_at
      ),

    updatedBy:
      textValue(
        row?.updated_by
      ),

  };
}


export async function getCallCommerceSettings(
  workspaceId: string,
  brandId: string
):
  Promise<
    CallCommerceSettings
  > {

  requireProject();

  try {

    const [
      rows,
    ] =
      await bigquery.query({

        location:
          CALL_COMMERCE_LOCATION,

        query: `
          SELECT
            *

          FROM ${table(
            SETTINGS_TABLE
          )}

          WHERE
            workspace_id=@workspace_id
            AND brand_id=@brand_id

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


    const row =
      (
        rows as any[]
      )?.[0];


    if (
      !row
    ) {
      return {
        ...CALL_COMMERCE_SETTINGS_DEFAULTS,
      };
    }


    return normalizeSettings(
      row
    );

  } catch (
    error
  ) {

    if (
      isMissingTableError(
        error
      )
    ) {

      return {
        ...CALL_COMMERCE_SETTINGS_DEFAULTS,
      };
    }


    throw error;
  }
}


export async function getCallCommerceSettingsCached(
  workspaceId: string,
  brandId: string
):
  Promise<
    CallCommerceSettings
  > {

  const key =
    cacheKey(
      workspaceId,
      brandId
    );


  const current =
    cache.get(
      key
    );


  if (
    current &&
    current.expiresAt >
      Date.now()
  ) {
    return current.value;
  }


  const value =
    await getCallCommerceSettings(
      workspaceId,
      brandId
    );


  cache.set(
    key,
    {
      value,

      expiresAt:
        Date.now() +
        CACHE_TTL_MS,
    }
  );


  return value;
}


export async function updateCallCommerceSettings(
  input: {

    workspaceId:
      string;

    brandId:
      string;

    actorUserId:
      string;

    settings:
      Partial<
        CallCommerceSettings
      >;

  }
):
  Promise<
    CallCommerceSettings
  > {

  requireProject();

  await ensureSettingsTable();


  const current =
    await getCallCommerceSettings(
      input.workspaceId,
      input.brandId
    );


  const next =
    validateSettings({
      ...current,
      ...input.settings,
      updatedAt:
        current.updatedAt,
      updatedBy:
        current.updatedBy,
    });


  await bigquery.query({

    location:
      CALL_COMMERCE_LOCATION,

    query: `
      MERGE
        ${table(
          SETTINGS_TABLE
        )} AS target

      USING (
        SELECT
          @workspace_id AS workspace_id,
          @brand_id AS brand_id
      ) AS source

      ON
        target.workspace_id=
          source.workspace_id
        AND
        target.brand_id=
          source.brand_id

      WHEN MATCHED THEN
        UPDATE SET

          contact_min_duration_seconds=
            @contact_min_duration_seconds,

          reopen_grace_minutes=
            @reopen_grace_minutes,

          auto_archive_terminal_leads=
            @auto_archive_terminal_leads,

          terminal_archive_days=
            @terminal_archive_days,

          require_unqualified_reason=
            @require_unqualified_reason,

          require_closed_lost_reason=
            @require_closed_lost_reason,

          require_purchase_order_id=
            @require_purchase_order_id,

          require_purchase_amount=
            @require_purchase_amount,

          updated_by=
            @updated_by,

          updated_at=
            CURRENT_TIMESTAMP()

      WHEN NOT MATCHED THEN
        INSERT (
          workspace_id,
          brand_id,
          contact_min_duration_seconds,
          reopen_grace_minutes,
          auto_archive_terminal_leads,
          terminal_archive_days,
          require_unqualified_reason,
          require_closed_lost_reason,
          require_purchase_order_id,
          require_purchase_amount,
          updated_by,
          created_at,
          updated_at
        )

        VALUES (
          @workspace_id,
          @brand_id,
          @contact_min_duration_seconds,
          @reopen_grace_minutes,
          @auto_archive_terminal_leads,
          @terminal_archive_days,
          @require_unqualified_reason,
          @require_closed_lost_reason,
          @require_purchase_order_id,
          @require_purchase_amount,
          @updated_by,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `,

    params: {

      workspace_id:
        input.workspaceId,

      brand_id:
        input.brandId,

      contact_min_duration_seconds:
        next.contactMinDurationSeconds,

      reopen_grace_minutes:
        next.reopenGraceMinutes,

      auto_archive_terminal_leads:
        next.autoArchiveTerminalLeads,

      terminal_archive_days:
        next.terminalArchiveDays,

      require_unqualified_reason:
        next.requireUnqualifiedReason,

      require_closed_lost_reason:
        next.requireClosedLostReason,

      require_purchase_order_id:
        next.requirePurchaseOrderId,

      require_purchase_amount:
        next.requirePurchaseAmount,

      updated_by:
        input.actorUserId,
    },

    types: {

      contact_min_duration_seconds:
        'INT64',

      reopen_grace_minutes:
        'INT64',

      terminal_archive_days:
        'INT64',
    },
  });


  cache.delete(
    cacheKey(
      input.workspaceId,
      input.brandId
    )
  );


  return getCallCommerceSettings(
    input.workspaceId,
    input.brandId
  );
}


function validateSettings(
  settings:
    CallCommerceSettings
):
  CallCommerceSettings {

  const contactMinDurationSeconds =
    clampInteger(
      settings
        .contactMinDurationSeconds,
      1,
      600,
      'CALL_COMMERCE_CONTACT_DURATION_INVALID'
    );


  const reopenGraceMinutes =
    clampInteger(
      settings
        .reopenGraceMinutes,
      0,
      10080,
      'CALL_COMMERCE_REOPEN_GRACE_INVALID'
    );


  const terminalArchiveDays =
    clampInteger(
      settings
        .terminalArchiveDays,
      1,
      365,
      'CALL_COMMERCE_ARCHIVE_DAYS_INVALID'
    );


  return {

    contactMinDurationSeconds,

    reopenGraceMinutes,

    autoArchiveTerminalLeads:
      Boolean(
        settings
          .autoArchiveTerminalLeads
      ),

    terminalArchiveDays,

    requireUnqualifiedReason:
      Boolean(
        settings
          .requireUnqualifiedReason
      ),

    requireClosedLostReason:
      Boolean(
        settings
          .requireClosedLostReason
      ),

    requirePurchaseOrderId:
      Boolean(
        settings
          .requirePurchaseOrderId
      ),

    requirePurchaseAmount:
      Boolean(
        settings
          .requirePurchaseAmount
      ),

    updatedAt:
      settings.updatedAt ||
      null,

    updatedBy:
      settings.updatedBy ||
      null,

  };
}


function clampInteger(
  value: unknown,
  min: number,
  max: number,
  code: string
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
    ||
    !Number.isInteger(
      number
    )
    ||
    number < min
    ||
    number > max
  ) {

    throw new Error(
      code
    );
  }


  return number;
}
