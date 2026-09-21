# Growth OS Call Commerce — Cloud Run Worker

## Locked async architecture

Call Commerce now follows the same proven Growth OS worker pattern as Shopify:

```text
Calling provider (MSG91 or any mapped provider)
        ↓
Growth OS public calling webhook (Vercel)
        ↓
growthos-call-commerce-events (Pub/Sub)
        ↓
PRIVATE Cloud Run: growthos-call-commerce-worker
        ↓
growthos_call_commerce BigQuery
```

The public provider webhook only authenticates the calling connection, parses the provider JSON, publishes a durable Pub/Sub message and returns immediately.

The Cloud Run worker performs the slower work:

- preserves the complete provider JSON in `raw_call_events.payload`
- validates the persisted workspace / brand / connection / mapping identity
- normalizes configured provider fields
- maintains Growth OS `CA_*` call-attempt identity
- attaches repeated calls to the eligible `CL_*` lead/thread
- preserves the 30-minute terminal grace behavior
- updates lead call counters/latest call fields
- queues Call Commerce Meta signals
- handles Meta queue flush as a separate Pub/Sub message

## Important

The worker does **not** provision BigQuery schema on every message. Call Commerce schema provisioning remains part of module/integration setup in the Growth OS application.

The worker uses Application Default Credentials from the Cloud Run service account. No private key is copied into the worker container.

## Reused Growth OS infrastructure

The deployment script discovers and reuses:

1. the runtime service account attached to `growthos-shopify-sync-worker`
2. the OIDC Pub/Sub push service account used by the existing Shopify push subscription

The Call Commerce topic/subscription remain separate from Shopify.

## Deploy

From the Growth OS repository root:

```powershell
powershell.exe -ExecutionPolicy Bypass -File `
  ".\scripts\call-commerce\deploy-cloud-run-worker.ps1" `
  -ProjectId "shopify-colab"
```

The script deploys the worker in `asia-south1`, keeps it private, grants only the reused Pub/Sub push identity `roles/run.invoker`, and updates `growthos-call-commerce-events-push` to:

```text
https://<cloud-run-worker>/pubsub/call-commerce
```

The OIDC audience is the base Cloud Run service URL.

## Vercel

The Vercel public webhook still needs:

```text
GROWTHOS_CALL_COMMERCE_TOPIC=growthos-call-commerce-events
```

The previous Vercel Pub/Sub worker route can remain temporarily as rollback code, but the active Pub/Sub subscription no longer points to it.

## Verify

### Subscription

```powershell
gcloud pubsub subscriptions describe `
  growthos-call-commerce-events-push `
  --project=shopify-colab `
  --format="yaml(topic,pushConfig,ackDeadlineSeconds)"
```

### Worker logs

```powershell
gcloud run services logs read `
  growthos-call-commerce-worker `
  --region=asia-south1 `
  --project=shopify-colab `
  --limit=100
```

### Raw data

```powershell
bq query `
  --project_id=shopify-colab `
  --location=asia-south1 `
  --use_legacy_sql=false `
  "SELECT received_at,provider_call_id,raw_event_type,raw_status,processing_status,processing_error FROM ``shopify-colab.growthos_call_commerce.raw_call_events`` ORDER BY received_at DESC LIMIT 50"
```

### Attempts

```powershell
bq query `
  --project_id=shopify-colab `
  --location=asia-south1 `
  --use_legacy_sql=false `
  "SELECT attempt_id,lead_id,provider_call_id,phone,business_number,call_status,duration_seconds,updated_at FROM ``shopify-colab.growthos_call_commerce.call_attempts`` ORDER BY updated_at DESC LIMIT 50"
```

### Lead/thread merge

For a consumer who calls multiple times, expect:

```text
one CL_* lead/thread
multiple CA_* call attempts
different provider_call_id values
```

## Rollback

The old Vercel internal worker route has deliberately not been deleted in this migration. To roll back, repoint the push subscription to the previous Vercel endpoint. Remove the old route only after Cloud Run is validated with live traffic.
