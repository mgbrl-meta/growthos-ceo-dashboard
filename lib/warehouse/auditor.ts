import {
  bigquery,
} from '@/lib/bigquery';


type WarehouseTableAudit = {

  projectId: string;

  datasetId: string;

  tableId: string;

  tableType: string;

  rows: number;

  bytes: number;

  sizeMB: number;

  sizeGB: number;

  partitioned: boolean;

  partitionField: string | null;

  partitionType: string | null;

  clusteringFields: string[];

  createdAt: string | null;

  modifiedAt: string | null;

  issues: string[];

  health:
    | 'healthy'
    | 'review'
    | 'critical';

};


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  ||
  process.env.BQ_PROJECT_ID
  ||
  '';


function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Warehouse auditor requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


function getAuditDatasets() {

  const raw =
    process.env.GROWTHOS_AUDIT_DATASETS
    ||
    '';


  return raw

    .split(',')

    .map(
      item =>
        item.trim()
    )

    .filter(
      Boolean
    );

}


// ============================================================
// HELPERS
// ============================================================

function asNumber(
  value: unknown
) {

  const number =
    Number(
      value
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;

}


function asIso(
  value: unknown
) {

  if (!value) {

    return null;

  }


  const date =
    new Date(
      value as any
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  return date.toISOString();

}


// ============================================================
// CLASSIFICATION
//
// Read-only recommendations.
// No schema or table changes occur here.
// ============================================================

function classifyTable(
  input: {

    tableId: string;

    tableType: string;

    rows: number;

    bytes: number;

    partitioned: boolean;

    clusteringFields: string[];

  }
) {

  const issues:
    string[] = [];


  const tableName =
    input.tableId
      .toLowerCase();


  const sizeGB =
    input.bytes /
    1024 /
    1024 /
    1024;


  // ==========================================================
  // LARGE UNPARTITIONED TABLE
  // ==========================================================

  if (
    input.tableType ===
      'TABLE'
    &&
    sizeGB >= 1
    &&
    !input.partitioned
  ) {

    issues.push(
      'LARGE_UNPARTITIONED'
    );

  }


  // ==========================================================
  // LARGE TABLE WITHOUT CLUSTERING
  // ==========================================================

  if (
    input.tableType ===
      'TABLE'
    &&
    sizeGB >= 1
    &&
    input.clusteringFields.length ===
      0
  ) {

    issues.push(
      'LARGE_UNCLUSTERED'
    );

  }


  // ==========================================================
  // VERSION CHAINS
  //
  // Advisory only.
  // Do not delete anything automatically.
  // ==========================================================

  if (
    /_v\d+($|_)/i.test(
      input.tableId
    )
  ) {

    issues.push(
      'VERSIONED_TABLE'
    );

  }


  // ==========================================================
  // POSSIBLE TEST / TEMP TABLE
  // ==========================================================

  if (
    tableName.includes(
      'test'
    )
    ||
    tableName.includes(
      'temp'
    )
    ||
    tableName.includes(
      'tmp'
    )
    ||
    tableName.includes(
      'backup'
    )
    ||
    tableName.includes(
      'old'
    )
  ) {

    issues.push(
      'POSSIBLE_TEMP_OR_LEGACY'
    );

  }


  let health:
    | 'healthy'
    | 'review'
    | 'critical' =
      'healthy';


  if (
    issues.includes(
      'LARGE_UNPARTITIONED'
    )
  ) {

    health =
      'critical';

  } else if (
    issues.length > 0
  ) {

    health =
      'review';

  }


  return {
    issues,
    health,
  };

}


// ============================================================
// AUDIT ONE DATASET
// ============================================================

async function auditDataset(
  datasetId: string
) {

  const projectId =
    requireProjectId();


  const dataset =
    bigquery.dataset(
      datasetId
    );


  const [
    exists,
  ] =
    await dataset.exists();


  if (!exists) {

    return {

      datasetId,

      exists:
        false,

      tables:
        [] as WarehouseTableAudit[],

    };

  }


  const [
    tables,
  ] =
    await dataset.getTables();


  const auditedTables:
    WarehouseTableAudit[] =
      [];


  for (
    const table of tables
  ) {

    try {

      const [
        metadata,
      ] =
        await table.getMetadata();


      const rows =
        asNumber(
          metadata?.numRows
        );


      const bytes =
        asNumber(
          metadata?.numBytes
        );


      const timePartitioning =
        metadata?.timePartitioning
        ||
        null;


      const rangePartitioning =
        metadata?.rangePartitioning
        ||
        null;


      const partitioned =
        Boolean(
          timePartitioning
          ||
          rangePartitioning
        );


      const partitionField =
        timePartitioning?.field
        ||
        rangePartitioning?.field
        ||
        null;


      const partitionType =
        timePartitioning?.type
        ||
        (
          rangePartitioning
            ? 'RANGE'
            : null
        );


      const clusteringFields =
        Array.isArray(
          metadata?.clustering?.fields
        )
          ? metadata.clustering.fields
          : [];


      const tableType =
        String(
          metadata?.type
          ||
          'TABLE'
        );


      const classification =
        classifyTable({

          tableId:
            String(
              table.id
            ),

          tableType,

          rows,

          bytes,

          partitioned,

          clusteringFields,

        });


      auditedTables.push({

        projectId,

        datasetId,

        tableId:
          String(
            table.id
          ),

        tableType,

        rows,

        bytes,

        sizeMB:
          Number(
            (
              bytes /
              1024 /
              1024
            ).toFixed(
              2
            )
          ),

        sizeGB:
          Number(
            (
              bytes /
              1024 /
              1024 /
              1024
            ).toFixed(
              3
            )
          ),

        partitioned,

        partitionField,

        partitionType,

        clusteringFields,

        createdAt:
          asIso(
            metadata?.creationTime
          ),

        modifiedAt:
          asIso(
            metadata?.lastModifiedTime
          ),

        issues:
          classification.issues,

        health:
          classification.health,

      });


    } catch (
      error: any
    ) {

      console.error(
        'WAREHOUSE_TABLE_AUDIT_ERROR',
        datasetId,
        table.id,
        error
      );

    }

  }


  return {

    datasetId,

    exists:
      true,

    tables:
      auditedTables,

  };

}


// ============================================================
// COMPLETE WAREHOUSE AUDIT
// ============================================================

export async function auditWarehouse() {

  const projectId =
    requireProjectId();


  const datasets =
    getAuditDatasets();


  if (
    datasets.length ===
    0
  ) {

    throw new Error(
      'GROWTHOS_AUDIT_DATASETS is not configured'
    );

  }


  const results =
    [];


  for (
    const datasetId
    of datasets
  ) {

    results.push(
      await auditDataset(
        datasetId
      )
    );

  }


  const tables =
    results.flatMap(
      result =>
        result.tables
    );


  const totalBytes =
    tables.reduce(
      (
        total,
        table
      ) =>
        total +
        table.bytes,
      0
    );


  return {

    projectId,

    datasets:
      results,

    summary: {

      datasets:
        results.length,

      tables:
        tables.length,

      totalRows:
        tables.reduce(
          (
            total,
            table
          ) =>
            total +
            table.rows,
          0
        ),

      totalSizeGB:
        Number(
          (
            totalBytes /
            1024 /
            1024 /
            1024
          ).toFixed(
            2
          )
        ),

      partitionedTables:
        tables.filter(
          table =>
            table.partitioned
        ).length,

      unpartitionedTables:
        tables.filter(
          table =>
            !table.partitioned
            &&
            table.tableType ===
              'TABLE'
        ).length,

      clusteredTables:
        tables.filter(
          table =>
            table
              .clusteringFields
              .length > 0
        ).length,

      criticalTables:
        tables.filter(
          table =>
            table.health ===
            'critical'
        ).length,

      reviewTables:
        tables.filter(
          table =>
            table.health ===
            'review'
        ).length,

      versionedTables:
        tables.filter(
          table =>
            table.issues.includes(
              'VERSIONED_TABLE'
            )
        ).length,

      possibleLegacyTables:
        tables.filter(
          table =>
            table.issues.includes(
              'POSSIBLE_TEMP_OR_LEGACY'
            )
        ).length,

    },

  };

}