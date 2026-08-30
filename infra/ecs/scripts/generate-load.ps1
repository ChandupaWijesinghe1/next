param(
  [string]$BaseUrl = "",
  [int]$Workers = 40,
  [int]$DurationSeconds = 600,
  [int]$LoadTestDuration = 45
)

$ErrorActionPreference = "Stop"

if (-not $BaseUrl) {
  Push-Location $PSScriptRoot\..
  $BaseUrl = (terraform output -raw api_url 2>$null)
  Pop-Location
  if (-not $BaseUrl) {
    throw "Pass -BaseUrl or run from infra/ecs after terraform apply"
  }
}

$BaseUrl = $BaseUrl.TrimEnd("/")
$uri = "$BaseUrl/load-test?duration=$LoadTestDuration"

Write-Host "Generating load: $Workers parallel workers for $DurationSeconds s" -ForegroundColor Cyan
Write-Host "Target: $uri" -ForegroundColor Cyan

$jobs = 1..$Workers | ForEach-Object {
  Start-Job -ScriptBlock {
    param($Target, $Until)
    while ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() -lt $Until) {
      try {
        Invoke-WebRequest -Uri $Target -UseBasicParsing -TimeoutSec 120 | Out-Null
      } catch {
        # keep hammering even if some requests fail during deploy
      }
    }
  } -ArgumentList $uri, ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + $DurationSeconds)
}

Write-Host "Load jobs started. Watch scaling in another terminal:" -ForegroundColor Yellow
Write-Host "  powershell -File scripts\watch-scaling.ps1" -ForegroundColor Yellow

Wait-Job $jobs | Out-Null
Remove-Job $jobs -Force
Write-Host "Load generation finished." -ForegroundColor Green
