import {
  bigquery,
} from '@/lib/bigquery';

import {
  auditWarehouse,
} from './auditor';


// ============================================================
// TYPES
// ============================================================

export type RuntimeTableUsage = {

  projectId: string;

  datasetId: string;

  tableId: string;

  fullName: string;

  queryCount: number;

  totalBytesProcessed: number;

  totalGBProcessed: number;

  firstQueriedAt: string | null;

  lastQueriedAt: string | null;

  activeLast7Days: boolean;

  activeLast30Days: boolean;

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


const JOB_REGION =
  process.env.GROWTHOS_BQ_JOB_REGION
  ||
  'asia-south1';


const LOOKBACK_DAYS =
  Math.max(
    1,
    Math.min(
      Number(
        process.env.GROWTHOS_LINEAGE_LOOKBACK_DAYS
        ||
        90
      ),
      180
    )
  );


// ============================================================
// VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Runtime lineage requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// FORMAT TIMESTAMP
// ============================================================

function iso(
  value: any
) {

  if (!value) {

    return null;

  }


  const date =
    new Date(
      value.value
      ||
      value
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
// RUNTIME LINEAGE
//
// Uses BigQuery INFORMATION_SCHEMA job history.
//
// READ ONLY.
// ============================================================

export async function scanRuntimeLineage() {

  const projectId =
    requireProjectId();


  // ==========================================================
  // PHYSICAL TABLE LIST
  //
  // Restrict results to datasets Growth OS is auditing.
  // ==========================================================

  const warehouse =
    await auditWarehouse();


  const physicalSet =
    new Set(

      warehouse.datasets.flatMap(
        dataset =>
          dataset.tables.map(
            table =>
              `${table.projectId}.${table.datasetId}.${table.tableId}`
          )
      )

    );


  // ==========================================================
  // BIGQUERY JOB HISTORY
  // ==========================================================

  const query = `

    WITH runtime_usage AS (

      SELECT

        referenced.project_id
          AS project_id,

        referenced.dataset_id
          AS dataset_id,

        referenced.table_id
          AS table_id,

        COUNT(*)
          AS query_count,

        SUM(
          IFNULL(
            total_bytes_processed,
            0
          )
        )
          AS total_bytes_processed,

        MIN(
          creation_time
        )
          AS first_queried_at,

        MAX(
          creation_time
        )
          AS last_queried_at

      FROM

        \`region-${JOB_REGION}.INFORMATION_SCHEMA.JOBS_BY_PROJECT\`,

        UNNEST(
          referenced_tables
        )
          AS referenced

      WHERE

        creation_time >=
          TIMESTAMP_SUB(
            CURRENT_TIMESTAMP(),
            INTERVAL @lookback_days DAY
          )

        AND job_type =
          'QUERY'

        AND state =
          'DONE'

      GROUP BY

        project_id,

        dataset_id,

        table_id

    )

    SELECT *

    FROM
      runtime_usage

    ORDER BY
      total_bytes_processed DESC

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      params: {

        lookback_days:
          LOOKBACK_DAYS,

      },

      location:
        JOB_REGION,

    });


  // ==========================================================
  // NORMALIZE + FILTER
  // ==========================================================

  const now =
    Date.now();


  const usage:
    RuntimeTableUsage[] =
      [];


  for (
    const row
    of rows
  ) {

    const fullName =
      `${row.project_id}.${row.dataset_id}.${row.table_id}`;


    /*
     * Only keep tables that physically exist
     * inside the audited warehouse scope.
     */
    if (
      !physicalSet.has(
        fullName
      )
    ) {

      continue;

    }


    const bytes =
      Number(
        row.total_bytes_processed
        ||
        0
      );


    const lastQueriedAt =
      iso(
        row.last_queried_at
      );


    let ageDays:
      number | null =
        null;


    if (
      lastQueriedAt
    ) {

      ageDays =
        (
          now -
          new Date(
            lastQueriedAt
          ).getTime()
        )
        /
        1000
        /
        60
        /
        60
        /
        24;

    }


    usage.push({

      projectId:
        String(
          row.project_id
        ),

      datasetId:
        String(
          row.dataset_id
        ),

      tableId:
        String(
          row.table_id
        ),

      fullName,

      queryCount:
        Number(
          row.query_count
          ||
          0
        ),

      totalBytesProcessed:
        bytes,

      totalGBProcessed:
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

      firstQueriedAt:
        iso(
          row.first_queried_at
        ),

      lastQueriedAt,

      activeLast7Days:
        ageDays !==
          null
        &&
        ageDays <=
          7,

      activeLast30Days:
        ageDays !==
          null
        &&
        ageDays <=
          30,

    });

  }


  // ==========================================================
  // UNUSED IN LOOKBACK WINDOW
  //
  // This STILL does not mean safe to delete.
  // ==========================================================

  const usedSet =
    new Set(
      usage.map(
        item =>
          item.fullName
      )
    );


  const notObserved =
    Array.from(
      physicalSet
    )
      .filter(
        fullName =>
          !usedSet.has(
            fullName
          )
      );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const totalBytes =
    usage.reduce(
      (
        total,
        item
      ) =>
        total +
        item.totalBytesProcessed,
      0
    );


  return {

    summary: {

      lookbackDays:
        LOOKBACK_DAYS,

      region:
        JOB_REGION,

      physicalTables:
        physicalSet.size,

      runtimeUsedTables:
        usage.length,

      notObservedTables:
        notObserved.length,

      activeLast7Days:
        usage.filter(
          item =>
            item.activeLast7Days
        ).length,

      activeLast30Days:
        usage.filter(
          item =>
            item.activeLast30Days
        ).length,

      totalQueries:
        usage.reduce(
          (
            total,
            item
          ) =>
            total +
            item.queryCount,
          0
        ),

      totalGBProcessed:
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

    },


    tables:
      usage,


    notObservedTables:
      notObserved,

  };

}