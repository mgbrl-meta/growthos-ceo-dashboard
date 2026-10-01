param(
  [Parameter(Mandatory=$true)]
  [string]$RepoRoot,
  [string]$ProjectId = "shopify-colab",
  [string]$Region = "asia-south1",
  [string]$InstanceName = "growthos-operational",
  [string]$DatabaseName = "growthos",
  [string]$DatabaseUser = "growthos_app",
  [string]$PasswordSecret = "growthos-postgres-password",
  [switch]$Cutover
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path $RepoRoot).Path

function Run-Step {
  param([string]$Name,[scriptblock]$Action)
  Write-Host ""
  Write-Host "===== $Name =====" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

Push-Location $RepoRoot
try {
  Write-Host ""
  Write-Host "Growth OS Operational PostgreSQL V1 - Node 22 resume" -ForegroundColor Green
  Write-Host "Repository: $RepoRoot"
  Write-Host "Mode:       $($(if ($Cutover) { 'PREPARE + CUTOVER' } else { 'PREPARE ONLY' }))"
  Write-Host ""
  Write-Host "This resume path does NOT rerun Cloud SQL provisioning and does NOT rotate the database password." -ForegroundColor Yellow

  Run-Step "NODE 22 RUNTIME" {
    & npx.cmd --yes node@22 -e "console.log('Node runtime:', process.version); if (Number(process.versions.node.split('.')[0]) !== 22) process.exit(2)"
  }

  $ConnectionName = (& gcloud sql instances describe $InstanceName `
    --project=$ProjectId `
    --format="value(connectionName)" 2>$null | Out-String).Trim()

  if (-not $ConnectionName) {
    throw "Unable to resolve Cloud SQL instance connection name for $InstanceName"
  }

  $env:GCP_PROJECT_ID = $ProjectId
  $env:GROWTHOS_PG_INSTANCE_CONNECTION_NAME = $ConnectionName
  $env:GROWTHOS_PG_DATABASE = $DatabaseName
  $env:GROWTHOS_PG_USER = $DatabaseUser
  $env:GROWTHOS_PG_PASSWORD_SECRET = $PasswordSecret
  $env:GROWTHOS_PG_IP_TYPE = "PUBLIC"
  $env:GROWTHOS_CALL_COMMERCE_DATASET = "growthos_call_commerce"
  $env:GROWTHOS_CALL_COMMERCE_LOCATION = $Region
  $env:GROWTHOS_CALL_COMMERCE_ANALYTICS_DATASET = "growthos_call_commerce"
  $env:GROWTHOS_CALL_COMMERCE_ANALYTICS_TABLE = "operational_events"

  Write-Host ""
  Write-Host "Cloud SQL: $ConnectionName"
  Write-Host "Database:  $DatabaseName"
  Write-Host "User:      $DatabaseUser"

  Run-Step "POSTGRES MIGRATIONS" {
    & npx.cmd --yes node@22 "scripts/operational-postgres/migrate.mjs"
  }

  Run-Step "BIGQUERY -> POSTGRES BACKFILL" {
    & npx.cmd --yes node@22 "scripts/operational-postgres/backfill-call-commerce.mjs"
  }

  Run-Step "BIGQUERY ANALYTICS TABLE" {
    & npx.cmd --yes node@22 "scripts/operational-postgres/bootstrap-call-commerce-analytics.mjs"
  }

  # Freeze the BigQuery source view for parity before the final tail reconciliation.
  # The live production worker is still writing to BigQuery during PREPARE ONLY,
  # so a fixed SYSTEM_TIME snapshot removes the race between backfill and validation.
  $env:GROWTHOS_MIGRATION_BQ_SNAPSHOT_AT = [DateTime]::UtcNow.ToString("o")
  Write-Host ""
  Write-Host "BigQuery validation snapshot: $env:GROWTHOS_MIGRATION_BQ_SNAPSHOT_AT" -ForegroundColor Yellow

  Run-Step "TAIL RECONCILIATION" {
    & npx.cmd --yes node@22 "scripts/operational-postgres/backfill-call-commerce.mjs"
  }

  Run-Step "PRE-CUTOVER VALIDATION" {
    & npx.cmd --yes node@22 "scripts/operational-postgres/validate-call-commerce.mjs"
  }

  if (-not $Cutover) {
    Write-Host ""
    Write-Host "===== PREPARATION COMPLETE =====" -ForegroundColor Green
    Write-Host "PostgreSQL is migrated/backfilled and parity validation completed."
    Write-Host "The live Call Commerce worker has NOT been cut over."
    return
  }

  Write-Host ""
  Write-Warning "LIVE CUTOVER: this changes the Call Commerce Cloud Run worker from BigQuery writes to PostgreSQL."
  $answer = Read-Host "Type CUTOVER to continue"
  if ($answer -ne "CUTOVER") {
    throw "Cutover cancelled."
  }

  Run-Step "DEPLOY POSTGRES CALL COMMERCE WORKER" {
    powershell -ExecutionPolicy Bypass -File ".\scripts\call-commerce\deploy-cloud-run-worker-postgres.ps1" `
      -ProjectId $ProjectId `
      -Region $Region `
      -InstanceName $InstanceName
  }

  Run-Step "FINAL BIGQUERY -> POSTGRES RECONCILIATION" {
    & npx.cmd --yes node@22 "scripts/operational-postgres/backfill-call-commerce.mjs"
  }

  Run-Step "FINAL MIGRATION VALIDATION" {
    & npx.cmd --yes node@22 "scripts/operational-postgres/validate-call-commerce.mjs"
  }

  Write-Host ""
  Write-Host "===== POSTGRES CUTOVER COMPLETE =====" -ForegroundColor Green
  Write-Host "Call Commerce worker operational store: PostgreSQL"
  Write-Host "BigQuery remains the analytics/history plane."
} finally {
  Pop-Location
}
