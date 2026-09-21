Write-Host ""
Write-Warning "This script is retired for Call Commerce worker deployment."
Write-Host "Call Commerce now uses the same Pub/Sub -> private Cloud Run worker pattern as Shopify."
Write-Host ""
Write-Host "Run instead:"
Write-Host ""
Write-Host "powershell.exe -ExecutionPolicy Bypass -File `".\scripts\call-commerce\deploy-cloud-run-worker.ps1`" -ProjectId `"shopify-colab`""
Write-Host ""
exit 1
