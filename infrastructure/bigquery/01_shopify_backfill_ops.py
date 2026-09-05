from google.cloud import bigquery
import os


# ============================================================
# GROWTH OS - SHOPIFY BACKFILL OPERATIONS
#
# Creates:
#
# growthos_ops.shopify_backfill_runs
# growthos_ops.shopify_backfill_windows
#
# This dataset stores mutable operational state.
#
# It does NOT contain:
#
# Shopify access tokens
# Shopify refresh tokens
# customer data
# order payloads
#
# Those remain in:
#
# Secret Manager
# growthos_data
# ============================================================


PROJECT_ID = (
    os.getenv("GROWTHOS_DATA_PROJECT")
    or os.getenv("GCP_PROJECT_ID")
    or "shopify-colab"
)

DATASET_ID = (
    os.getenv("GROWTHOS_OPS_DATASET")
    or "growthos_ops"
)

LOCATION = (
    os.getenv("GROWTHOS_OPS_LOCATION")
    or "asia-south1"
)


client = bigquery.Client(
    project=PROJECT_ID
)


# ============================================================
# DATASET
# ============================================================

def ensure_dataset():

    dataset_ref = bigquery.Dataset(
        f"{PROJECT_ID}.{DATASET_ID}"
    )

    dataset_ref.location = LOCATION

    dataset = client.create_dataset(
        dataset_ref,
        exists_ok=True
    )

    print(
        f"DATASET READY: "
        f"{dataset.project}.{dataset.dataset_id}"
    )


# ============================================================
# BACKFILL RUNS
#
# One row = one logical historical import.
#
# Example:
#
# Brillare
# Orders
# 2021-01-01 → 2026-09-05
#
# One run may create many windows.
# ============================================================

def ensure_backfill_runs():

    table_id = (
        f"{PROJECT_ID}."
        f"{DATASET_ID}."
        f"shopify_backfill_runs"
    )

    schema = [

        bigquery.SchemaField(
            "backfill_run_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "workspace_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "brand_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "connection_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "integration_account_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "provider_account_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "provider",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "entity",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "strategy",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "status",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "requested_from",
            "TIMESTAMP",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "requested_to",
            "TIMESTAMP",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "requested_by",
            "STRING",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "requested_at",
            "TIMESTAMP",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "total_windows",
            "INTEGER",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "queued_windows",
            "INTEGER",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "running_windows",
            "INTEGER",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "completed_windows",
            "INTEGER",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "failed_windows",
            "INTEGER",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "records_loaded",
            "INTEGER",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "started_at",
            "TIMESTAMP",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "completed_at",
            "TIMESTAMP",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "error",
            "STRING",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "created_at",
            "TIMESTAMP",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "updated_at",
            "TIMESTAMP",
            mode="REQUIRED"
        ),

    ]


    table = bigquery.Table(
        table_id,
        schema=schema
    )


    table.time_partitioning = (
        bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.DAY,
            field="created_at"
        )
    )


    table.clustering_fields = [
        "workspace_id",
        "brand_id",
        "entity",
        "status",
    ]


    client.create_table(
        table,
        exists_ok=True
    )


    print(
        f"TABLE READY: {table_id}"
    )


# ============================================================
# BACKFILL WINDOWS
#
# One row = one independently retryable historical window.
#
# Future example:
#
# 2025-01-01 → 2025-03-31
#
# Shopify Bulk Operation ID is attached after the worker
# successfully starts that window.
# ============================================================

def ensure_backfill_windows():

    table_id = (
        f"{PROJECT_ID}."
        f"{DATASET_ID}."
        f"shopify_backfill_windows"
    )

    schema = [

        bigquery.SchemaField(
            "backfill_window_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "backfill_run_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "workspace_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "brand_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "connection_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "integration_account_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "provider_account_id",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "entity",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "window_start",
            "TIMESTAMP",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "window_end",
            "TIMESTAMP",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "status",
            "STRING",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "bulk_operation_id",
            "STRING",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "bulk_operation_status",
            "STRING",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "bulk_object_count",
            "INTEGER",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "bulk_file_size_bytes",
            "INTEGER",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "records_received",
            "INTEGER",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "records_loaded",
            "INTEGER",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "records_skipped",
            "INTEGER",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "attempt_count",
            "INTEGER",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "next_retry_at",
            "TIMESTAMP",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "started_at",
            "TIMESTAMP",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "result_ready_at",
            "TIMESTAMP",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "loading_started_at",
            "TIMESTAMP",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "completed_at",
            "TIMESTAMP",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "error",
            "STRING",
            mode="NULLABLE"
        ),

        bigquery.SchemaField(
            "created_at",
            "TIMESTAMP",
            mode="REQUIRED"
        ),

        bigquery.SchemaField(
            "updated_at",
            "TIMESTAMP",
            mode="REQUIRED"
        ),

    ]


    table = bigquery.Table(
        table_id,
        schema=schema
    )


    table.time_partitioning = (
        bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.DAY,
            field="created_at"
        )
    )


    table.clustering_fields = [
        "workspace_id",
        "brand_id",
        "backfill_run_id",
        "status",
    ]


    client.create_table(
        table,
        exists_ok=True
    )


    print(
        f"TABLE READY: {table_id}"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print(
        "============================================================"
    )

    print(
        "GROWTH OS - SHOPIFY BACKFILL OPS SETUP"
    )

    print(
        "============================================================"
    )

    print(
        f"PROJECT  : {PROJECT_ID}"
    )

    print(
        f"DATASET  : {DATASET_ID}"
    )

    print(
        f"LOCATION : {LOCATION}"
    )


    ensure_dataset()

    ensure_backfill_runs()

    ensure_backfill_windows()


    print(
        "============================================================"
    )

    print(
        "SHOPIFY BACKFILL OPS READY"
    )

    print(
        "============================================================"
    )


if __name__ == "__main__":

    main()