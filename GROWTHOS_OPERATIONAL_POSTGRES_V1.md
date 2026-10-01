# Growth OS Operational PostgreSQL V1

## Purpose

Growth OS now separates transactional application state from analytical warehouse workloads.

- **Cloud SQL PostgreSQL** is the operational/control-plane database for migrated modules.
- **BigQuery** remains the analytics, historical warehouse, attribution, retention, and large-scale intelligence engine.
- **Pub/Sub + Cloud Run** remain the event transport/worker pattern.
- **Call Commerce** is the first production module migrated end-to-end.

This avoids using BigQuery for high-frequency CRM reads/writes, small DML jobs, mapping saves, workflow transitions, and live call state.

## V1 architecture

```text
Calling provider
  -> Growth OS webhook (Vercel)
  -> Pub/Sub: growthos-call-commerce-events
  -> Cloud Run: growthos-call-commerce-worker
  -> Cloud SQL PostgreSQL (operational truth)
       -> leads
       -> call attempts
       -> connections
       -> mapping versions
       -> raw events
       -> workflow/activity
       -> settings
       -> Meta source-event outbox
       -> analytics outbox
  -> Pub/Sub: growthos-meta-events
  -> Meta Events worker
  -> Meta CAPI

PostgreSQL analytics outbox
  -> async batch export
  -> BigQuery growthos_call_commerce.operational_events
```

The existing BigQuery Call Commerce tables are **not deleted** and remain the migration/rollback reference copy.

## PostgreSQL schemas

V1 creates shared operational schemas:

- `growthos_core`
- `integrations`
- `ops`
- `call_commerce`

`growthos_core` contains the shared tenant registry, migration registry, runtime key/value store and generic transactional outbox. Future Growth OS modules should reuse this same operational database rather than creating module-specific database instances.

## Call Commerce tables

- `call_commerce.calling_connections`
- `call_commerce.calling_mapping_versions`
- `call_commerce.calling_test_events`
- `call_commerce.raw_call_events`
- `call_commerce.call_leads`
- `call_commerce.call_attempts`
- `call_commerce.activity_log`
- `call_commerce.meta_event_queue`
- `call_commerce.meta_event_log`
- `call_commerce.settings`
- `call_commerce.analytics_outbox`

All tenant-owned data retains `workspace_id` + `brand_id`.

## MSG91 inbound + outbound

The normalizer is direction-aware.

**Inbound**

```text
source      -> customerPhone
callerId    -> businessNumber
```

**Outbound**

```text
destination -> customerPhone
callerId    -> businessNumber
```

Common mappings:

```text
uuid            -> providerCallId
requestId       -> providerEventId
eventName       -> rawEventType
direction       -> direction
startTime       -> startedAt
endTime         -> endedAt
statusUpdatedAt -> updatedAt
duration        -> durationSeconds
agentName       -> agentName
disconnectedBy  -> disconnectedBy
```

Legacy MSG91 mappings that marked `source -> customerPhone` as required are tolerated: the normalizer applies the direction-aware fallback before final customer-phone validation.

A completed outbound MSG91 call with a positive duration is treated as answered even when MSG91 omits an explicit `answered` status. Outbound `disconnectedBy=destination` is correctly interpreted as the **customer** side.

## Application cutover

`GROWTHOS_CALL_COMMERCE_STORE` supports:

```text
postgres  (V1 default)
bigquery  (rollback only)
```

The PostgreSQL connection defaults are intentionally portable from the existing Growth OS GCP configuration:

```text
GCP_PROJECT_ID=<project>
GROWTHOS_PG_REGION=asia-south1
GROWTHOS_PG_INSTANCE_NAME=growthos-operational
GROWTHOS_PG_DATABASE=growthos
GROWTHOS_PG_USER=growthos_app
GROWTHOS_PG_PASSWORD_SECRET=growthos-postgres-password
GROWTHOS_PG_IP_TYPE=PUBLIC
```

`GROWTHOS_PG_INSTANCE_CONNECTION_NAME` can override the inferred `<project>:<region>:<instance>` value.

The app uses the Cloud SQL Node.js Connector. The database password is read from Secret Manager; it is not committed to the repository.

## One-go installation

From the repository root after applying the patch bundle:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\operational-postgres\install-v1.ps1 -RepoRoot "F:\Sunil\Tools and software\growthos-ceo-dashboard"
```

The installer:

1. installs/updates Node dependencies and lockfiles;
2. syntax-checks the worker;
3. runs the complete Next.js production build;
4. creates/reuses the Cloud SQL PostgreSQL instance;
5. creates/rotates the DB user password and stores it in Secret Manager;
6. applies versioned PostgreSQL migrations;
7. backfills the existing BigQuery Call Commerce data;
8. creates the append-only BigQuery analytics event table;
9. validates row counts and foreign-key integrity;
10. deploys the PostgreSQL-backed Call Commerce Cloud Run worker.

Cloud SQL is billable. The provisioner defaults to the deliberately small `db-g1-small` tier and 20 GB SSD for the initial migration; both are parameters and can be resized later.

## Rollback

No BigQuery Call Commerce table is deleted.

If the app must temporarily read the old operational store, set:

```text
GROWTHOS_CALL_COMMERCE_STORE=bigquery
```

The PostgreSQL worker should also be rolled back to the previous Cloud Run revision if ingestion itself must return to BigQuery. Do not run both ingestion workers as authoritative stores at the same time.

## What remains in BigQuery

BigQuery continues to be the correct home for warehouse/intelligence workloads such as Shopify historical data, Meta reporting, attribution, retention/LTV/cohorts, cross-brand analysis and long-term event analytics.

Other Growth OS operational modules remain on their current stores until their module cutover is validated. They should migrate onto this same `growthos-operational` PostgreSQL foundation rather than creating separate databases.
