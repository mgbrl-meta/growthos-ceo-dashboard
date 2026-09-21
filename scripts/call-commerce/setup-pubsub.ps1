param(
  [string]$ProjectId = "shopify-colab",
  [string]$Topic = "growthos-call-commerce-events",
  [string]$Subscription = "growthos-call-commerce-events-push",
  [Parameter(Mandatory=$true)]
  [string]$PushEndpoint,
  [string]$PushServiceAccountName = "growthos-call-commerce-push",
  [string]$PublisherServiceAccount = ""
)

$ErrorActionPreference = "Stop"

function Run-Gcloud {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
  & gcloud @Args
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud failed: gcloud $($Args -join ' ')"
  }
}

Write-Host ""
Write-Host "Growth OS Call Commerce Pub/Sub setup"
Write-Host "Project:      $ProjectId"
Write-Host "Topic:        $Topic"
Write-Host "Subscription: $Subscription"
Write-Host "Push endpoint:$PushEndpoint"
Write-Host ""

Run-Gcloud config set project $ProjectId | Out-Null

$topicExists = (& gcloud pubsub topics describe $Topic --project=$ProjectId --format="value(name)" 2>$null)
if (-not $topicExists) {
  Run-Gcloud pubsub topics create $Topic --project=$ProjectId
} else {
  Write-Host "Topic already exists."
}

$PushServiceAccount = "$PushServiceAccountName@$ProjectId.iam.gserviceaccount.com"
$saExists = (& gcloud iam service-accounts describe $PushServiceAccount --project=$ProjectId --format="value(email)" 2>$null)
if (-not $saExists) {
  Run-Gcloud iam service-accounts create $PushServiceAccountName `
    --project=$ProjectId `
    --display-name="Growth OS Call Commerce PubSub Push"
} else {
  Write-Host "Push service account already exists."
}

$ProjectNumber = (& gcloud projects describe $ProjectId --format="value(projectNumber)").Trim()
if (-not $ProjectNumber) { throw "Unable to resolve project number." }
$PubSubServiceAgent = "service-$ProjectNumber@gcp-sa-pubsub.iam.gserviceaccount.com"

# Pub/Sub's service agent must be able to mint the OIDC token for the push identity.
Run-Gcloud iam service-accounts add-iam-policy-binding $PushServiceAccount `
  --project=$ProjectId `
  --member="serviceAccount:$PubSubServiceAgent" `
  --role="roles/iam.serviceAccountTokenCreator" | Out-Null

if ($PublisherServiceAccount) {
  Run-Gcloud pubsub topics add-iam-policy-binding $Topic `
    --project=$ProjectId `
    --member="serviceAccount:$PublisherServiceAccount" `
    --role="roles/pubsub.publisher" | Out-Null
} else {
  Write-Warning "PublisherServiceAccount was not supplied. Ensure the service account used by Vercel (GCP_CLIENT_EMAIL) has roles/pubsub.publisher on topic $Topic."
}

$subscriptionExists = (& gcloud pubsub subscriptions describe $Subscription --project=$ProjectId --format="value(name)" 2>$null)
if ($subscriptionExists) {
  Write-Host "Updating existing push subscription..."
  Run-Gcloud pubsub subscriptions update $Subscription `
    --project=$ProjectId `
    --push-endpoint=$PushEndpoint `
    --push-auth-service-account=$PushServiceAccount `
    --push-auth-token-audience=$PushEndpoint `
    --ack-deadline=60 `
    --min-retry-delay=10s `
    --max-retry-delay=600s
} else {
  Run-Gcloud pubsub subscriptions create $Subscription `
    --project=$ProjectId `
    --topic=$Topic `
    --push-endpoint=$PushEndpoint `
    --push-auth-service-account=$PushServiceAccount `
    --push-auth-token-audience=$PushEndpoint `
    --ack-deadline=60 `
    --min-retry-delay=10s `
    --max-retry-delay=600s `
    --message-retention-duration=604800s
}

Write-Host ""
Write-Host "Pub/Sub setup complete."
Write-Host ""
Write-Host "Set these Vercel environment variables:"
Write-Host "GROWTHOS_CALL_COMMERCE_TOPIC=$Topic"
Write-Host "CALL_COMMERCE_PUBSUB_AUDIENCE=$PushEndpoint"
Write-Host "CALL_COMMERCE_PUBSUB_SERVICE_ACCOUNT=$PushServiceAccount"
Write-Host ""
Write-Host "Also verify the Vercel GCP service account can publish to $Topic."
