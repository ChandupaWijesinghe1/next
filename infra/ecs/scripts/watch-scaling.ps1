param(
  [string]$Cluster = "wseek-cluster",
  [string]$Service = "wseek-api",
  [string]$Region = "eu-north-1",
  [int]$IntervalSeconds = 15
)

Write-Host "Watching ECS service $Service (Ctrl+C to stop)" -ForegroundColor Cyan

while ($true) {
  $svc = aws ecs describe-services `
    --cluster $Cluster `
    --services $Service `
    --region $Region `
    --query "services[0].{desired:desiredCount,running:runningCount,pending:pendingCount,events:events[0].message}" `
    --output json | ConvertFrom-Json

  $ts = Get-Date -Format "HH:mm:ss"
  Write-Host "$ts  desired=$($svc.desired)  running=$($svc.running)  pending=$($svc.pending)"
  if ($svc.events) {
    Write-Host "       latest: $($svc.events)"
  }
  Start-Sleep -Seconds $IntervalSeconds
}
