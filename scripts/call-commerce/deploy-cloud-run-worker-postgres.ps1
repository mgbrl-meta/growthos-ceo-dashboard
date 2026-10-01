param(
  [string]$ProjectId = "shopify-colab",
  [string]$Region = "asia-south1",
  [string]$ServiceName = "growthos-call-commerce-worker",
  [string]$ShopifyServiceName = "growthos-shopify-sync-worker",
  [string]$ShopifyTopic = "growthos-shopify-sync-jobs",
  [string]$Topic = "growthos-call-commerce-events",
  [string]$Subscription = "growthos-call-commerce-events-push",
  [string]$MetaEventsTopic = "growthos-meta-events",
  [string]$InstanceName = "growthos-operational",
  [string]$Database = "growthos",
  [string]$DatabaseUser = "growthos_app",
  [string]$PasswordSecret = "growthos-postgres-password",
  [string]$IpType = "PUBLIC"
)

$ErrorActionPreference = "Stop"

function Invoke-Gcloud {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
  & gcloud @Args
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud failed: gcloud $($Args -join ' ')"
  }
}

function Get-GcloudValue {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
  $output = & gcloud @Args 2>$null
  if ($LASTEXITCODE -ne 0) { return "" }
  return ([string]$output).Trim()
}

Write-Host ""
Write-Host "Growth OS Call Commerce PostgreSQL worker deployment" -ForegroundColor Cyan
Write-Host "Project:      $ProjectId"
Write-Host "Region:       $Region"
Write-Host "Service:      $ServiceName"
Write-Host "PostgreSQL:   $InstanceName / $Database"
Write-Host "Topic:        $Topic"
Write-Host "Meta topic:   $MetaEventsTopic"
Write-Host ""

Invoke-Gcloud config set project $ProjectId | Out-Null

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$WorkerDir = Join-Path $ProjectRoot "workers\call-commerce-worker"
if (-not (Test-Path (Join-Path $WorkerDir "server.js"))) {
  throw "Call Commerce worker source not found: $WorkerDir"
}

$InstanceConnectionName = Get-GcloudValue sql instances describe $InstanceName `
  --project=$ProjectId `
  --format="value(connectionName)"
if (-not $InstanceConnectionName) {
  throw "Cloud SQL instance not found: $InstanceName. Run scripts\operational-postgres\provision-cloud-sql.ps1 first."
}

# Prefer the worker's current identity. Fall back to the proven Shopify worker identity.
$RuntimeServiceAccount = Get-GcloudValue run services describe $ServiceName `
  --project=$ProjectId --region=$Region `
  --format="value(spec.template.spec.serviceAccountName)"
if (-not $RuntimeServiceAccount) {
  $RuntimeServiceAccount = Get-GcloudValue run services describe $ShopifyServiceName `
    --project=$ProjectId --region=$Region `
    --format="value(spec.template.spec.serviceAccountName)"
}
if (-not $RuntimeServiceAccount) {
  throw "Unable to resolve a Cloud Run runtime service account."
}

Write-Host "Runtime service account: $RuntimeServiceAccount"

Invoke-Gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$RuntimeServiceAccount" `
  --role="roles/cloudsql.client" `
  --condition=None | Out-Null

Invoke-Gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$RuntimeServiceAccount" `
  --role="roles/secretmanager.secretAccessor" `
  --condition=None | Out-Null

# Reuse the already-proven authenticated Pub/Sub push identity.
$SubscriptionsJson = & gcloud pubsub subscriptions list --project=$ProjectId --format=json
if ($LASTEXITCODE -ne 0) { throw "Unable to list Pub/Sub subscriptions." }
$Subscriptions = $SubscriptionsJson | ConvertFrom-Json
$ShopifyTopicPath = "projects/$ProjectId/topics/$ShopifyTopic"
$ShopifyPushSubscription = $Subscriptions |
  Where-Object { $_.topic -eq $ShopifyTopicPath -and $_.pushConfig -and $_.pushConfig.pushEndpoint } |
  Select-Object -First 1
if (-not $ShopifyPushSubscription) {
  throw "Unable to find an authenticated push subscription for $ShopifyTopic."
}
$PushServiceAccount = ([string]$ShopifyPushSubscription.pushConfig.oidcToken.serviceAccountEmail).Trim()
if (-not $PushServiceAccount) { throw "Shopify push subscription has no OIDC service account." }

foreach ($TopicName in @($Topic, $MetaEventsTopic)) {
  $TopicPath = Get-GcloudValue pubsub topics describe $TopicName --project=$ProjectId --format="value(name)"
  if (-not $TopicPath) {
    Invoke-Gcloud pubsub topics create $TopicName --project=$ProjectId
  }
}

$EnvVars = @(
  "GCP_PROJECT_ID=$ProjectId",
  "GROWTHOS_CALL_COMMERCE_STORE=postgres",
  "GROWTHOS_PG_INSTANCE_CONNECTION_NAME=$InstanceConnectionName",
  "GROWTHOS_PG_DATABASE=$Database",
  "GROWTHOS_PG_USER=$DatabaseUser",
  "GROWTHOS_PG_IP_TYPE=$($IpType.ToUpper())",
  "GROWTHOS_PG_POOL_MAX=5",
  "GROWTHOS_CALL_COMMERCE_TOPIC=$Topic",
  "GROWTHOS_META_EVENTS_TOPIC=$MetaEventsTopic",
  "GROWTHOS_CALL_COMMERCE_ANALYTICS_DATASET=growthos_call_commerce",
  "GROWTHOS_CALL_COMMERCE_ANALYTICS_TABLE=operational_events",
  "CALL_COMMERCE_REOPEN_GRACE_MINUTES=30",
  "CALL_COMMERCE_CONTACT_MIN_DURATION_SECONDS=20",
  "CALL_COMMERCE_META_MAX_ATTEMPTS=5",
  "CALL_COMMERCE_META_RETRY_DELAY_MINUTES=5",
  "CALL_COMMERCE_ANALYTICS_MAX_ATTEMPTS=10",
  "CALL_COMMERCE_ANALYTICS_RETRY_DELAY_MINUTES=15"
) -join ","

Write-Host "Deploying PostgreSQL-backed worker..." -ForegroundColor Cyan
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
  --set-env-vars=$EnvVars `
  --set-secrets="GROWTHOS_PG_PASSWORD=$PasswordSecret`:latest"

$WorkerUrl = Get-GcloudValue run services describe $ServiceName `
  --project=$ProjectId --region=$Region --format="value(status.url)"
if (-not $WorkerUrl) { throw "Cloud Run service URL could not be resolved." }
$PushEndpoint = "$WorkerUrl/pubsub/call-commerce"

Invoke-Gcloud run services add-iam-policy-binding $ServiceName `
  --project=$ProjectId --region=$Region `
  --member="serviceAccount:$PushServiceAccount" `
  --role="roles/run.invoker" | Out-Null

$SubscriptionPath = Get-GcloudValue pubsub subscriptions describe $Subscription `
  --project=$ProjectId --format="value(name)"
if ($SubscriptionPath) {
  Invoke-Gcloud pubsub subscriptions update $Subscription `
    --project=$ProjectId `
    --push-endpoint=$PushEndpoint `
    --push-auth-service-account=$PushServiceAccount `
    --push-auth-token-audience=$WorkerUrl `
    --ack-deadline=60 `
    --min-retry-delay=10s `
    --max-retry-delay=600s
} else {
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
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host ""
Write-Host "Architecture:"
Write-Host "  Calling provider"
Write-Host "    -> Growth OS webhook"
Write-Host "    -> $Topic"
Write-Host "    -> $ServiceName"
Write-Host "    -> Cloud SQL PostgreSQL ($InstanceConnectionName)"
Write-Host "    -> $MetaEventsTopic (Call Commerce source events)"
Write-Host "    -> Meta Events worker"
Write-Host ""
Write-Host "Verify:"
Write-Host "  gcloud run services describe $ServiceName --region=$Region --project=$ProjectId"
Write-Host "  gcloud run services logs read $ServiceName --region=$Region --project=$ProjectId --limit=100"
Write-Host ""
