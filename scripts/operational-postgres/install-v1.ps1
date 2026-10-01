param(
  [string]$RepoRoot = "",
  [string]$ProjectId = "shopify-colab",
  [string]$Region = "asia-south1",
  [string]$InstanceName = "growthos-operational",
  [string]$Tier = "db-g1-small",
  [int]$StorageSizeGB = 20,
  [switch]$CodeOnly,
  [switch]$SkipBackfill,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
  $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
} else {
  $RepoRoot = (Resolve-Path $RepoRoot).Path
}

function Run-Step {
  param([string]$Name,[scriptblock]$Action)
  Write-Host ""
  Write-Host "===== $Name =====" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
}

Push-Location $RepoRoot
try {
  Write-Host ""
  Write-Host "Growth OS Operational PostgreSQL V1 installer" -ForegroundColor Green
  Write-Host "Repository: $RepoRoot"
  Write-Host "Call Commerce cutover: PostgreSQL"
  Write-Host "BigQuery role: downstream analytics only"

  Run-Step "ROOT DEPENDENCIES" {
    npm install --no-audit --no-fund
  }

  Run-Step "WORKER DEPENDENCIES" {
    Push-Location (Join-Path $RepoRoot "workers\call-commerce-worker")
    try { npm install --no-audit --no-fund } finally { Pop-Location }
  }

  Run-Step "WORKER SYNTAX" {
    $WorkerFiles = @(
      "workers/call-commerce-worker/server.js",
      "workers/call-commerce-worker/postgres.js",
      "workers/call-commerce-worker/call-commerce-mapping.js",
      "workers/call-commerce-worker/call-commerce-repository.js",
      "workers/call-commerce-worker/call-commerce-meta-worker.js",
      "workers/call-commerce-worker/call-commerce-meta-publisher.js",
      "workers/call-commerce-worker/call-commerce-analytics-worker.js",
      "workers/call-commerce-worker/call-commerce-queue.js"
    )
    foreach ($File in $WorkerFiles) {
      node --check $File
      if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $File" }
    }
  }

  Run-Step "ROOT BUILD" {
    npm run build
  }

  if ($CodeOnly) {
    Write-Host ""
    Write-Host "Code-only installation complete. Cloud resources were not changed." -ForegroundColor Yellow
    return
  }

  Write-Host ""
  Write-Warning "The next phase creates/reuses a BILLABLE Cloud SQL PostgreSQL instance."

  $ProvisionArgs = @{
    RepoRoot = $RepoRoot
    ProjectId = $ProjectId
    Region = $Region
    InstanceName = $InstanceName
    Tier = $Tier
    StorageSizeGB = $StorageSizeGB
  }
  if ($Yes) { $ProvisionArgs.Yes = $true }
  & (Join-Path $RepoRoot "scripts\operational-postgres\provision-cloud-sql.ps1") @ProvisionArgs

  Run-Step "POSTGRES MIGRATIONS" {
    node scripts/operational-postgres/migrate.mjs
  }

  if (-not $SkipBackfill) {
    Run-Step "BIGQUERY -> POSTGRES BACKFILL" {
      node scripts/operational-postgres/backfill-call-commerce.mjs
    }
  }

  Run-Step "BIGQUERY ANALYTICS TABLE" {
    node scripts/operational-postgres/bootstrap-call-commerce-analytics.mjs
  }

  Write-Host ""
  Write-Warning "CUTOVER WINDOW: do not edit Calling Connections/mappings until this installer finishes. Live provider calls can continue."

  Run-Step "DEPLOY POSTGRES CALL COMMERCE WORKER" {
    & (Join-Path $RepoRoot "scripts\call-commerce\deploy-cloud-run-worker-postgres.ps1") `
      -ProjectId $ProjectId `
      -Region $Region `
      -InstanceName $InstanceName
  }

  if (-not $SkipBackfill) {
    # Final reconciliation captures any BigQuery writes that landed between the
    # first backfill and Cloud Run traffic cutover. The backfill only overwrites
    # PostgreSQL rows when the BigQuery row is at least as fresh.
    Run-Step "FINAL BIGQUERY -> POSTGRES RECONCILIATION" {
      node scripts/operational-postgres/backfill-call-commerce.mjs
    }
  }

  Run-Step "FINAL MIGRATION VALIDATION" {
    node scripts/operational-postgres/validate-call-commerce.mjs
  }

  Write-Host ""
  Write-Host "===== INSTALL COMPLETE =====" -ForegroundColor Green
  Write-Host "Call Commerce operational store: PostgreSQL"
  Write-Host "BigQuery: preserved + append-only operational_events analytics mirror"
  Write-Host "Rollback switch: GROWTHOS_CALL_COMMERCE_STORE=bigquery"
  Write-Host ""
  Write-Host "IMPORTANT BEFORE PUSH/VERCEL DEPLOY:" -ForegroundColor Yellow
  Write-Host "  1. package-lock.json files were refreshed by npm install; include them in the commit."
  Write-Host "  2. Vercel must retain GCP_PROJECT_ID, GCP_CLIENT_EMAIL and GCP_PRIVATE_KEY."
  Write-Host "  3. If you override defaults, set GROWTHOS_PG_INSTANCE_CONNECTION_NAME / DB / USER / secret envs in Vercel."
  Write-Host "  4. The default code path is now PostgreSQL. Complete this installer BEFORE deploying the patched app."
  Write-Host ""
  git status --short
} finally {
  Pop-Location
}
