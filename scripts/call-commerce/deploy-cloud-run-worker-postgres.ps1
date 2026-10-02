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

# Deployment must not rewrite IAM on every release.
# IAM is an infrastructure/provisioning concern. Repeatedly mutating the
# Secret Manager policy also makes normal application deployment depend on
# secretmanager.secrets.setIamPolicy, which many deployer identities should
# intentionally not have.
#
# For an existing PostgreSQL-backed service, reuse the already-proven runtime
# service account and secret binding. For a brand-new service, require the
# one-time infrastructure IAM prerequisite to be established first.

$RuntimeMember = "serviceAccount:$RuntimeServiceAccount"

$ProjectIamJson = & gcloud projects get-iam-policy $ProjectId --format=json 2>$null
$ProjectIam = $null
if ($LASTEXITCODE -eq 0 -and $ProjectIamJson) {
  $ProjectIam = $ProjectIamJson | ConvertFrom-Json
}

$HasCloudSqlClient = $false
$HasProjectSecretAccessor = $false

if ($ProjectIam -and $ProjectIam.bindings) {
  foreach ($Binding in $ProjectIam.bindings) {
    $Members = @($Binding.members)
    if ($Members -contains $RuntimeMember) {
      if ($Binding.role -eq "roles/cloudsql.client") {
        $HasCloudSqlClient = $true
      }
      if ($Binding.role -eq "roles/secretmanager.secretAccessor") {
        $HasProjectSecretAccessor = $true
      }
    }
  }
}

if (-not $HasCloudSqlClient) {
  throw @"
Runtime service account is missing roles/cloudsql.client:

  $RuntimeMember

Grant this once from the infrastructure/provisioning path, then rerun deployment.
The deploy script intentionally does not mutate IAM.
"@
}

$HasSecretLevelAccessor = $false
$SecretIamReadable = $false
$SecretIamJson = & gcloud secrets get-iam-policy $PasswordSecret --project=$ProjectId --format=json 2>$null
if ($LASTEXITCODE -eq 0 -and $SecretIamJson) {
  $SecretIamReadable = $true
  $SecretIam = $SecretIamJson | ConvertFrom-Json
  if ($SecretIam -and $SecretIam.bindings) {
    foreach ($Binding in $SecretIam.bindings) {
      if (
        $Binding.role -eq "roles/secretmanager.secretAccessor" -and
        @($Binding.members) -contains $RuntimeMember
      ) {
        $HasSecretLevelAccessor = $true
      }
    }
  }
}

# Existing Cloud Run configuration is also useful evidence: if this exact
# runtime identity is already serving the PostgreSQL worker with the same
# Secret Manager secret, a release should not need to re-grant that policy.
$ExistingServiceJson = & gcloud run services describe $ServiceName `
  --project=$ProjectId `
  --region=$Region `
  --format=json 2>$null

$ExistingServiceUsesPasswordSecret = $false
if ($LASTEXITCODE -eq 0 -and $ExistingServiceJson) {
  try {
    $ExistingService = $ExistingServiceJson | ConvertFrom-Json
    $Containers = @($ExistingService.spec.template.spec.containers)
    foreach ($Container in $Containers) {
      foreach ($Env in @($Container.env)) {
        if (
          $Env.name -eq "GROWTHOS_PG_PASSWORD" -and
          $Env.valueFrom.secretKeyRef.name -eq $PasswordSecret
        ) {
          $ExistingServiceUsesPasswordSecret = $true
        }
      }
    }
  } catch {
    $ExistingServiceUsesPasswordSecret = $false
  }
}

if ($HasProjectSecretAccessor) {
  Write-Host "Secret access: project-level accessor already configured." -ForegroundColor DarkGray
} elseif ($HasSecretLevelAccessor) {
  Write-Host "Secret access: secret-level accessor already configured." -ForegroundColor DarkGray
} elseif ($ExistingServiceUsesPasswordSecret) {
  Write-Host "Secret access: existing PostgreSQL worker already uses this secret with the same runtime identity." -ForegroundColor DarkGray
  if (-not $SecretIamReadable) {
    Write-Host "Secret IAM policy is not readable by the deployer; no IAM mutation will be attempted." -ForegroundColor DarkGray
  }
} else {
  throw @"
Unable to verify Secret Manager access for:

  $RuntimeMember
  secret: $PasswordSecret

This is a one-time infrastructure IAM prerequisite. Have an authorized
infrastructure administrator grant roles/secretmanager.secretAccessor on the
secret (preferred) or appropriate project scope. Then rerun deployment.

The application deploy script intentionally does not modify secret IAM.
"@
}

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
