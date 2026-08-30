param(
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "http://wseek-alb-183297113.eu-north-1.elb.amazonaws.com"
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "alb.e2e.$stamp@example.com"
$password = "AlbTest123!"
$tmpFile = Join-Path $env:TEMP "wseek-alb-upload-$stamp.txt"
Set-Content -Path $tmpFile -Value "ALB e2e upload $stamp"

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Path,
    [hashtable]$Headers = @{},
    [object]$Body = $null,
    [int[]]$ExpectStatus = @(200, 201)
  )

  $uri = "$BaseUrl$Path"
  $params = @{
    Uri             = $uri
    Method          = $Method
    Headers         = $Headers
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 6)
  }

  try {
    $response = Invoke-WebRequest @params
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $text = $reader.ReadToEnd()
      throw "HTTP $status $Method $Path failed: $text"
    }
    throw
  }

  if ($ExpectStatus -notcontains [int]$response.StatusCode) {
    throw "Unexpected status $([int]$response.StatusCode) for $Method $Path"
  }

  if ([string]::IsNullOrWhiteSpace($response.Content)) {
    return $null
  }
  return $response.Content | ConvertFrom-Json
}

Write-Host "== ALB E2E against $BaseUrl ==" -ForegroundColor Cyan

# 1) Health
$health = Invoke-Json -Method GET -Path "/health"
if ($health.status -ne "ok") { throw "Health check failed: $($health | ConvertTo-Json)" }
Write-Host "[OK] Health /health" -ForegroundColor Green

# 2) Auth — register + login
Invoke-Json -Method POST -Path "/auth/register" -Body @{
  email     = $email
  username  = "albuser$stamp"
  password  = $password
  full_name = "ALB E2E User"
} | Out-Null
Write-Host "[OK] Register $email" -ForegroundColor Green

$tokens = Invoke-Json -Method POST -Path "/auth/login" -Body @{
  email    = $email
  password = $password
}
if (-not $tokens.access_token) { throw "Login did not return access_token" }
$auth = @{ Authorization = "Bearer $($tokens.access_token)" }
Write-Host "[OK] Login" -ForegroundColor Green

# 3) CRUD — team / project / task
$team = Invoke-Json -Method POST -Path "/teams" -Headers $auth -Body @{
  name        = "ALB Team $stamp"
  description = "Created via ALB e2e"
}
$project = Invoke-Json -Method POST -Path "/teams/$($team.id)/projects" -Headers $auth -Body @{
  name        = "ALB Project $stamp"
  description = "Project via ALB"
}
$task = Invoke-Json -Method POST -Path "/teams/$($team.id)/projects/$($project.id)/tasks" -Headers $auth -Body @{
  title       = "ALB Task $stamp"
  description = "Task via ALB"
}
$updated = Invoke-Json -Method PATCH -Path "/teams/$($team.id)/projects/$($project.id)/tasks/$($task.id)" -Headers $auth -Body @{
  status = "in_progress"
}
Write-Host "[OK] CRUD team=$($team.id) project=$($project.id) task=$($task.id) status=$($updated.status)" -ForegroundColor Green

# 4) File upload (S3 via ALB → ECS)
$uploadUri = "$BaseUrl/tasks/$($task.id)/attachments"
$uploadRaw = curl.exe -s -X POST $uploadUri `
  -H "Authorization: Bearer $($tokens.access_token)" `
  -F "file=@$tmpFile"
$upload = $uploadRaw | ConvertFrom-Json
if (-not $upload.id) { throw "Upload failed: $uploadRaw" }
Write-Host "[OK] File upload attachment_id=$($upload.id)" -ForegroundColor Green

# Cleanup local temp file
Remove-Item $tmpFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "All ALB end-to-end checks passed." -ForegroundColor Green
Write-Host "API base URL for Vercel: NEXT_PUBLIC_API_URL=$BaseUrl"
