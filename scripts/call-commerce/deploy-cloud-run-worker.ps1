param(
  [string]$ProjectId = "shopify-colab",
  [string]$Region = "asia-south1",
  [string]$ServiceName = "growthos-call-commerce-worker",
  [string]$ShopifyServiceName = "growthos-shopify-sync-worker",
  [string]$ShopifyTopic = "growthos-shopify-sync-jobs",
  [string]$Topic = "growthos-call-commerce-events",
  [string]$Subscription = "growthos-call-commerce-events-push",
  [string]$Dataset = "growthos_call_commerce",
  [string]$ControlDataset = "growthos_control"
)

$ErrorActionPreference = "Stop"

function Invoke-Gcloud {
  param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
  )

  & gcloud @Args

  if ($LASTEXITCODE -ne 0) {
    throw "gcloud failed: gcloud $($Args -join ' ')"
  }
}

function Get-GcloudValue {
  param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
  )

  $output = & gcloud @Args 2>$null

  if ($LASTEXITCODE -ne 0) {
    return ""
  }

  return ([string]$output).Trim()
}

Write-Host ""
Write-Host "Growth OS Call Commerce Cloud Run worker deployment"
Write-Host "Project:      $ProjectId"
Write-Host "Region:       $Region"
Write-Host "Service:      $ServiceName"
Write-Host "Topic:        $Topic"
Write-Host "Subscription: $Subscription"
Write-Host ""

Invoke-Gcloud config set project $ProjectId | Out-Null

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$WorkerDir = Join-Path $ProjectRoot "workers\call-commerce-worker"

if (-not (Test-Path (Join-Path $WorkerDir "server.js"))) {
  throw "Call Commerce worker source not found: $WorkerDir"
}

# ============================================================
# REUSE EXISTING SHOPIFY CLOUD RUN RUNTIME IDENTITY
# ============================================================

$RuntimeServiceAccount = Get-GcloudValue run services describe $ShopifyServiceName `
  --project=$ProjectId `
  --region=$Region `
  --format="value(spec.template.spec.serviceAccountName)"

if (-not $RuntimeServiceAccount) {
  throw "Unable to resolve runtime service account from existing $ShopifyServiceName Cloud Run service."
}

Write-Host "Reusing Cloud Run runtime service account:"
Write-Host "  $RuntimeServiceAccount"

# ============================================================
# REUSE EXISTING SHOPIFY PUB/SUB PUSH IDENTITY
# ============================================================

$SubscriptionsJson = & gcloud pubsub subscriptions list `
  --project=$ProjectId `
  --format=json

if ($LASTEXITCODE -ne 0) {
  throw "Unable to list Pub/Sub subscriptions."
}

$Subscriptions = $SubscriptionsJson | ConvertFrom-Json
$ShopifyTopicPath = "projects/$ProjectId/topics/$ShopifyTopic"

$ShopifyPushSubscription = $Subscriptions |
  Where-Object {
    $_.topic -eq $ShopifyTopicPath -and
    $_.pushConfig -and
    $_.pushConfig.pushEndpoint
  } |
  Select-Object -First 1

if (-not $ShopifyPushSubscription) {
  throw "Unable to find an authenticated push subscription for existing Shopify topic $ShopifyTopic."
}

$PushServiceAccount = ([string]$ShopifyPushSubscription.pushConfig.oidcToken.serviceAccountEmail).Trim()

if (-not $PushServiceAccount) {
  throw "Existing Shopify push subscription does not expose an OIDC push service account."
}

Write-Host "Reusing Pub/Sub push identity:"
Write-Host "  $PushServiceAccount"

# ============================================================
# TOPIC
# ============================================================

$TopicPath = Get-GcloudValue pubsub topics describe $Topic `
  --project=$ProjectId `
  --format="value(name)"

if (-not $TopicPath) {
  Write-Host "Creating Call Commerce Pub/Sub topic..."

  Invoke-Gcloud pubsub topics create $Topic `
    --project=$ProjectId
}
else {
  Write-Host "Call Commerce topic already exists."
}

# Keep message persistence in Mumbai, consistent with Growth OS.
try {
  Invoke-Gcloud pubsub topics update $Topic `
    --project=$ProjectId `
    --message-storage-policy-allowed-regions=$Region | Out-Null
}
catch {
  Write-Warning "Unable to update topic storage policy. Existing topic remains usable. $($_.Exception.Message)"
}

# ============================================================
# DEPLOY PRIVATE CLOUD RUN WORKER
# ============================================================

Write-Host "Deploying private Call Commerce Cloud Run worker..."

$EnvVars = @(
  "GCP_PROJECT_ID=$ProjectId",
  "GROWTHOS_CALL_COMMERCE_DATASET=$Dataset",
  "GROWTHOS_CALL_COMMERCE_LOCATION=$Region",
  "GROWTHOS_CONTROL_DATASET=$ControlDataset",
  "GROWTHOS_CALL_COMMERCE_TOPIC=$Topic",
  "CALL_COMMERCE_REOPEN_GRACE_MINUTES=30",
  "CALL_COMMERCE_CONTACT_MIN_DURATION_SECONDS=20",
  "CALL_COMMERCE_META_MAX_ATTEMPTS=3",
  "CALL_COMMERCE_META_RETRY_DELAY_MINUTES=60",
  "META_GRAPH_API_VERSION=v24.0"
) -join ","

Invoke-Gcloud run deploy $ServiceName `
  --project=$ProjectId `
  --region=$Region `
  --platform=managed `
  --source=$WorkerDir `
  --service-account=$RuntimeServiceAccount `
  --no-allow-unauthenticated `
  --cpu=1 `
  --memory=1Gi `
  --concurrency=20 `
  --timeout=300 `
  --max-instances=10 `
  --set-env-vars=$EnvVars

$WorkerUrl = Get-GcloudValue run services describe $ServiceName `
  --project=$ProjectId `
  --region=$Region `
  --format="value(status.url)"

if (-not $WorkerUrl) {
  throw "Cloud Run worker deployed but service URL could not be resolved."
}

$PushEndpoint = "$WorkerUrl/pubsub/call-commerce"

Write-Host "Cloud Run worker URL:"
Write-Host "  $WorkerUrl"
Write-Host "Push endpoint:"
Write-Host "  $PushEndpoint"

# ============================================================
# CLOUD RUN INVOKER
#
# Same model as Shopify:
# authenticated Pub/Sub push identity -> private Cloud Run.
# ============================================================

Write-Host "Granting the existing Pub/Sub push identity Cloud Run Invoker..."

Invoke-Gcloud run services add-iam-policy-binding $ServiceName `
  --project=$ProjectId `
  --region=$Region `
  --member="serviceAccount:$PushServiceAccount" `
  --role="roles/run.invoker" | Out-Null

# ============================================================
# PUSH SUBSCRIPTION
#
# Endpoint includes path.
# OIDC audience remains the base Cloud Run service URL, which
# is the standard Cloud Run authenticated-push pattern.
# ============================================================

$SubscriptionPath = Get-GcloudValue pubsub subscriptions describe $Subscription `
  --project=$ProjectId `
  --format="value(name)"

if ($SubscriptionPath) {
  Write-Host "Updating existing Call Commerce push subscription..."

  Invoke-Gcloud pubsub subscriptions update $Subscription `
    --project=$ProjectId `
    --push-endpoint=$PushEndpoint `
    --push-auth-service-account=$PushServiceAccount `
    --push-auth-token-audience=$WorkerUrl `
    --ack-deadline=60 `
    --min-retry-delay=10s `
    --max-retry-delay=600s
}
else {
  Write-Host "Creating Call Commerce push subscription..."

  Invoke-Gcloud pubsub subscriptions create $Subscription `
    --project=$ProjectId `
    --topic=$Topic `
    --push-endpoint=$PushEndpoint `
    --push-auth-service-account=$PushServiceAccount `
    --push-auth-token-audience=$WorkerUrl `
    --ack-deadline=60 `
    --min-retry-delay=10s `
    --max-retry-delay=600s `
    --message-retention-duration=604800s
}

Write-Host ""
Write-Host "Deployment complete."
Write-Host ""
Write-Host "Architecture:"
Write-Host "  MSG91"
Write-Host "    -> Growth OS Vercel calling webhook"
Write-Host "    -> $Topic"
Write-Host "    -> $ServiceName"
Write-Host "    -> growthos_call_commerce BigQuery"
Write-Host ""
Write-Host "Verify with:"
Write-Host "  gcloud pubsub subscriptions describe $Subscription --project=$ProjectId"
Write-Host "  gcloud run services logs read $ServiceName --region=$Region --project=$ProjectId --limit=50"
Write-Host ""
