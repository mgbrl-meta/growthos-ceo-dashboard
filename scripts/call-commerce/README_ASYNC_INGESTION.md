# Call Commerce asynchronous calling ingestion

Live provider webhooks now perform only:

1. Resolve the Call Commerce connection.
2. Verify the connection webhook secret.
3. Parse the provider payload.
4. Publish a durable message to Google Pub/Sub.
5. Return HTTP 200 to the calling provider.

The Pub/Sub push worker then performs raw storage, mapping/normalization, CL/CA threading, lead summaries and Meta queueing.

## Default topic

`growthos-call-commerce-events`

## Push worker

`POST /api/internal/call-commerce/pubsub`

The endpoint is public at the Growth OS proxy layer but requires a Google-signed OIDC token from the configured Pub/Sub push service account.

## Setup

Example:

```powershell
powershell.exe -ExecutionPolicy Bypass -File `
  ".\scripts\call-commerce\setup-pubsub.ps1" `
  -ProjectId "shopify-colab" `
  -PushEndpoint "https://growthos-ceo-dashboard.vercel.app/api/internal/call-commerce/pubsub" `
  -PublisherServiceAccount "YOUR_GCP_CLIENT_EMAIL"
```

Then set on Vercel:

- `GROWTHOS_CALL_COMMERCE_TOPIC=growthos-call-commerce-events`
- `CALL_COMMERCE_PUBSUB_AUDIENCE=https://growthos-ceo-dashboard.vercel.app/api/internal/call-commerce/pubsub`
- `CALL_COMMERCE_PUBSUB_SERVICE_ACCOUNT=growthos-call-commerce-push@shopify-colab.iam.gserviceaccount.com`

`GROWTHOS_PUBSUB_PROJECT` may be set explicitly; otherwise the existing Growth OS Pub/Sub client falls back to the configured Growth OS/GCP data project.

After deployment, open Settings > Integrations > Calling once. That runs the normal Call Commerce schema reconciler and adds the asynchronous raw-event columns before live traffic is switched on.
