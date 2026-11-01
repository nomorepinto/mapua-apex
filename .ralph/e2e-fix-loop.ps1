# Runs the APEX end-to-end suite. On a product bug, asks the Cursor CLI
# agent to fix that one bug, commits the application change, and runs again.
#
# Usage, from mapua-apex:
#   powershell -File .\.ralph\e2e-fix-loop.ps1
#   powershell -File .\.ralph\e2e-fix-loop.ps1 -MaxIterations 3 -EventDate 2026-11-03
#
# Stop between iterations by creating mapua-apex\e2e-tests\reports\STOP
# The bug list is mapua-apex\e2e-tests\reports\bug-log.md (gitignored).

[CmdletBinding()]
param(
  [int]$MaxIterations = 5,
  [string]$EventDate = ""
)

$ErrorActionPreference = "Stop"

$Workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ApexRepo = Join-Path $Workspace "mapua-apex"
$E2E = Join-Path $ApexRepo "e2e-tests"
$Reports = Join-Path $E2E "reports"
$PromptPath = Join-Path $PSScriptRoot "e2e-fix-prompt.md"
$BugLog = Join-Path $Reports "bug-log.md"
$StopFile = Join-Path $Reports "STOP"
$VerdictPath = Join-Path $Reports "loop-verdict.json"
$TaskPath = Join-Path $Reports "loop-task.md"

$Repos = @(
  $ApexRepo,
  (Join-Path $Workspace "arcus-attendance-system"),
  (Join-Path $Workspace "arcus-evaluation-system")
)

$Operational = @(
  "preflight",
  "cleanup before",
  "cleanup after",
  "restore approval settings",
  "restore cdm holder"
)

function Test-BlockedPath([string]$Path) {
  $norm = ($Path -replace '\\', '/').TrimStart("./")
  if ($norm -match '(?i)^e2e-tests/') { return $true }
  if ($norm -match '(?i)^\.ralph/') { return $true }
  if ($norm -match '(?i)(^|/)\.env($|\.)') { return $true }
  if ($norm -match '(?i)(^|/)\.grokadmin$') { return $true }
  if ($norm -match '(?i)accounts\.local\.json$') { return $true }
  if ($norm -match '(?i)\.(pem|key)$') { return $true }
  if ($norm -match '(?i)(^|/)(__pycache__|node_modules)/') { return $true }
  return $false
}

function Get-DirtyHashes([string]$Repo) {
  Push-Location $Repo
  try {
    $paths = @()
    $paths += @(git diff --name-only HEAD)
    $paths += @(git diff --cached --name-only)
    $paths += @(git ls-files --others --exclude-standard)
    $map = @{}
    foreach ($path in ($paths | Where-Object { $_ } | Select-Object -Unique)) {
      $key = ($path -replace '\\', '/')
      $full = Join-Path (Get-Location) $path
      if (Test-Path -LiteralPath $full -PathType Leaf) {
        $map[$key] = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
      }
      else {
        $map[$key] = "MISSING"
      }
    }
    return $map
  }
  finally {
    Pop-Location
  }
}

function Get-Head([string]$Repo) {
  Push-Location $Repo
  try {
    return (git rev-parse HEAD).Trim()
  }
  finally {
    Pop-Location
  }
}

function Resolve-Agent {
  $onPath = Get-Command agent -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  $installed = Join-Path $env:LOCALAPPDATA "cursor-agent\agent.cmd"
  if (Test-Path -LiteralPath $installed) { return $installed }
  throw @"
Cursor CLI is not installed. Install it, open a new terminal, then sign in:
  irm 'https://cursor.com/install?win32=true' | iex
  agent login
"@
}

$Agent = Resolve-Agent

if (-not (Test-Path -LiteralPath (Join-Path $E2E "run_e2e.py"))) {
  throw "mapua-apex\e2e-tests\run_e2e.py is not there yet. Start the loop after the suite agent finishes."
}

New-Item -ItemType Directory -Force -Path $Reports | Out-Null
if (-not (Test-Path -LiteralPath $BugLog)) {
  Set-Content -LiteralPath $BugLog -Encoding utf8 -Value "# E2E bug log`r`n"
}

if (-not $EventDate) {
  $day = Get-Date
  if ($day.DayOfWeek -eq [DayOfWeek]::Sunday) {
    $day = $day.AddDays(1)
    Write-Host "Today is Sunday, so the event date is $($day.ToString('yyyy-MM-dd')). The suite skips Arcus and post-evals when that date is not today."
  }
  $EventDate = $day.ToString("yyyy-MM-dd")
}

$previousSignature = ""

for ($i = 1; $i -le $MaxIterations; $i++) {
  if (Test-Path -LiteralPath $StopFile) {
    Write-Host "Found $StopFile. Loop stopped."
    exit 0
  }

  Write-Host "=== Iteration $i : python run_e2e.py --event-date $EventDate --no-servers ==="
  $beforeDirs = @()
  if (Test-Path -LiteralPath $Reports) {
    $beforeDirs = @(Get-ChildItem -LiteralPath $Reports -Directory | Select-Object -ExpandProperty Name)
  }

  Push-Location $E2E
  try {
    python run_e2e.py --event-date $EventDate --no-servers
    $code = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }

  $newDir = Get-ChildItem -LiteralPath $Reports -Directory |
    Where-Object { $beforeDirs -notcontains $_.Name } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $newDir) {
    throw "The suite did not write a new report directory."
  }

  $reportPath = Join-Path $newDir.FullName "report.json"
  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json

  if ($report.passed -and $code -eq 0) {
    Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "`r`nSuite passed on iteration $i ($EventDate).`r`n"
    Write-Host "Suite passed. Loop finished. Log: $BugLog"
    exit 0
  }

  $fails = @($report.steps | Where-Object { $_.status -eq "fail" -and -not $_.gap })
  $product = @($fails | Where-Object { $Operational -notcontains $_.name })
  $ops = @($fails | Where-Object { $Operational -contains $_.name })

  if ($code -eq 2 -or ($product.Count -eq 0 -and $ops.Count -gt 0)) {
    $detail = ($ops | ForEach-Object { "- $($_.name): $($_.detail)" }) -join "`r`n"
    Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "`r`n## Iteration $i`r`nNot a product bug. Loop stopped.`r`n$detail`r`n"
    Write-Host "Stopped. This failure is environment or cleanup, not a product bug."
    Write-Host $detail
    exit 2
  }

  if ($product.Count -eq 0) {
    Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "`r`n## Iteration $i`r`nSuite failed with no product fail step (exit $code). Loop stopped.`r`n"
    Write-Host "Stopped. Exit $code and no product failure in $reportPath"
    exit 1
  }

  $bug = $product[0]
  $signature = "$($bug.name)|$($bug.http)|$($bug.detail)"
  if ($signature -eq $previousSignature) {
    Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "`r`n## Iteration $i`r`nSame failure as the previous run. Loop stopped.`r`n- $($bug.name): $($bug.detail)`r`n"
    Write-Host "Stopped. The same failure came back after a fix attempt: $($bug.name)"
    exit 3
  }
  $previousSignature = $signature

  $snapshots = @{}
  $heads = @{}
  foreach ($repo in $Repos) {
    $snapshots[$repo] = Get-DirtyHashes $repo
    $heads[$repo] = Get-Head $repo
  }

  $others = @(
    $product |
      Select-Object -Skip 1 |
      ForEach-Object { "- $($_.name): $($_.detail)" }
  ) -join "`r`n"
  if (-not $others) { $others = "(none)" }

  @"
Follow the instructions in:
$PromptPath

This iteration's failure. Fix this one only:
- step: $($bug.name)
- http: $($bug.http)
- detail: $($bug.detail)
- report: $reportPath

Other product failures in this run. Do not fix them now:
$others

Write the verdict to:
$VerdictPath
"@ | Set-Content -LiteralPath $TaskPath -Encoding utf8

  if (Test-Path -LiteralPath $VerdictPath) {
    Remove-Item -LiteralPath $VerdictPath -Force
  }

  Write-Host "Product bug: $($bug.name)"
  & $Agent -p --force --trust --output-format text --workspace $Workspace "Follow the task file exactly: $TaskPath"
  if ($LASTEXITCODE -ne 0) {
    throw "agent exited with code $LASTEXITCODE"
  }

  foreach ($repo in $Repos) {
    $now = Get-Head $repo
    if ($now -ne $heads[$repo]) {
      throw "The agent committed in $repo. The loop commits, so that commit was not reviewed. Loop stopped."
    }
  }

  if (-not (Test-Path -LiteralPath $VerdictPath)) {
    throw "The agent did not write $VerdictPath"
  }
  $verdict = Get-Content -LiteralPath $VerdictPath -Raw | ConvertFrom-Json

  Add-Content -LiteralPath $BugLog -Encoding utf8 -Value @"

## Iteration $i - $($bug.name)
- HTTP: $($bug.http)
- Detail: $($bug.detail)
- Verdict: $($verdict.kind)
- Summary: $($verdict.summary)
"@

  if ($verdict.kind -ne "product") {
    Write-Host "Stopped. Verdict is '$($verdict.kind)': $($verdict.summary)"
    Write-Host "Log: $BugLog"
    exit 4
  }

  $message = "$($verdict.commit_message)".Trim()
  $message = ($message -split "`r?`n")[0]
  if ($message.Length -gt 72 -or $message -notmatch '^[a-z0-9][a-z0-9 .''-]{7,71}$' -or $message -match '(?i)password|secret|api[_-]?key|token') {
    $safeName = ("$($bug.name)" -replace '[^a-zA-Z0-9 ]', '').ToLower().Trim()
    $message = "fixed $safeName"
    if ($message.Length -gt 72) { $message = $message.Substring(0, 72).Trim() }
  }

  $committed = @()
  foreach ($repo in $Repos) {
    $after = Get-DirtyHashes $repo
    $before = $snapshots[$repo]
    $stage = @()
    $touchedDirty = @()
    foreach ($path in @($after.Keys)) {
      $unchanged = $before.ContainsKey($path) -and $before[$path] -eq $after[$path]
      if ($unchanged) { continue }
      if ($before.ContainsKey($path)) {
        $touchedDirty += $path
        continue
      }
      if (Test-BlockedPath $path) {
        throw "The agent changed blocked path '$path' in $repo. Loop stopped without committing."
      }
      $stage += $path
    }

    if ($touchedDirty.Count -gt 0 -and $stage.Count -eq 0) {
      throw @"
The fix touched files that already had uncommitted work in ${repo}:
$($touchedDirty -join "`n")
Loop stopped without committing, so those edits stay uncommitted.
"@
    }
    if ($stage.Count -eq 0) { continue }

    Push-Location $repo
    try {
      git add -- @stage
      if ($LASTEXITCODE -ne 0) { throw "git add failed in $repo" }
      git commit -m $message
      if ($LASTEXITCODE -ne 0) {
        git reset HEAD -- @stage
        throw "git commit failed in $repo"
      }
      $committed += "$(Split-Path $repo -Leaf) $(git rev-parse --short HEAD)"
    }
    finally {
      Pop-Location
    }
  }

  if ($committed.Count -eq 0) {
    throw "Verdict was product, but no new application files changed. Loop stopped."
  }

  Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "- Commit: $($committed -join ', ') $message`r`n"
  Write-Host "Committed: $($committed -join ', ')"
}

Write-Host "Stopped at the iteration cap ($MaxIterations). Log: $BugLog"
exit 5

Read-Host "Press Enter to exit"