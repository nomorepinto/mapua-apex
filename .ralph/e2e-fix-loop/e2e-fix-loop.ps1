# Runs the APEX end-to-end suite. On a product bug, asks the Qoder CLI
# (qodercli) agent to fix that one bug, commits the application change, and runs again.
#
# Usage, from mapua-apex:
#   powershell -File .\.ralph\e2e-fix-loop\e2e-fix-loop.ps1
#   powershell -File .\.ralph\e2e-fix-loop\e2e-fix-loop.ps1 -MaxIterations 3 -EventDate 2026-11-03
#
# Stop between iterations by creating mapua-apex\.ralph\e2e-fix-loop\reports\STOP
# The bug list and each iteration's agent output live under reports\.

[CmdletBinding()]
param(
  [int]$MaxIterations = 5,
  [string]$EventDate = ""
)

$ErrorActionPreference = "Stop"

$ApexRepo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Workspace = (Resolve-Path (Join-Path $ApexRepo "..")).Path
$E2E = Join-Path $ApexRepo "e2e-tests"
$SuiteReports = Join-Path $E2E "reports"
$LoopReports = Join-Path $PSScriptRoot "reports"
$PromptPath = Join-Path $PSScriptRoot "e2e-fix-prompt.md"
$BugLog = Join-Path $LoopReports "bug-log.md"
$StopFile = Join-Path $LoopReports "STOP"

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

function Stop-Loop {
  param([int]$Code)
  Write-Host ""
  Write-Host "Log: $BugLog"
  Read-Host "Press Enter to close"
  exit $Code
}

trap {
  Write-Host ""
  Write-Host "The loop stopped because of an error:"
  Write-Host $_.Exception.Message
  if ($_.ScriptStackTrace) { Write-Host $_.ScriptStackTrace }
  Write-Host ""
  Read-Host "Press Enter to close"
  break
}

function Test-BlockedPath([string]$Path) {
  $norm = ($Path -replace '\\', '/').TrimStart("./")
  # Block e2e-tests/tests (specs) but allow e2e-tests/support and e2e-tests/pages (harness)
  if ($norm -match '(?i)^e2e-tests/tests/') { return $true }
  if ($norm -match '(?i)^e2e-tests/(support|pages)/') { return $false }
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
  $onPath = Get-Command qodercli -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  $installed = Join-Path $env:USERPROFILE ".qoder\bin\qodercli\qodercli.exe"
  if (Test-Path -LiteralPath $installed) { return $installed }
  throw @"
Qoder CLI (qodercli) is not installed. Install it, open a new terminal, then sign in:
  Install the Qoder IDE (bundles qodercli under .qoder\bin\qodercli) or the standalone Qoder CLI.
  qodercli            # first run starts an interactive sign-in, or export QODER_PERSONAL_ACCESS_TOKEN
"@
}

function Save-SuiteReport([string]$SourceDir, [string]$DestDir) {
  foreach ($name in @("report.md", "report.json")) {
    $source = Join-Path $SourceDir $name
    if (Test-Path -LiteralPath $source) {
      Copy-Item -LiteralPath $source -Destination (Join-Path $DestDir $name) -Force
    }
  }
}

$Agent = Resolve-Agent

if (-not (Test-Path -LiteralPath (Join-Path $E2E "run_e2e.py"))) {
  throw "mapua-apex\e2e-tests\run_e2e.py is not there yet. Start the loop after the suite agent finishes."
}

New-Item -ItemType Directory -Force -Path $LoopReports | Out-Null
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
# True when the previous iteration ended with the agent unable to produce a fix
# (max-turns). Lets the same-signature guard tell "a committed fix did not work"
# apart from "a flake the agent could not reproduce came back on a plain re-run".
$previousWasNoFix = $false

for ($i = 1; $i -le $MaxIterations; $i++) {
  if (Test-Path -LiteralPath $StopFile) {
    Write-Host "Found $StopFile. Loop stopped."
    Stop-Loop 0
  }

  Write-Host "=== Iteration $i : python run_e2e.py --event-date $EventDate --no-servers ==="
  $beforeDirs = @()
  if (Test-Path -LiteralPath $SuiteReports) {
    $beforeDirs = @(Get-ChildItem -LiteralPath $SuiteReports -Directory | Select-Object -ExpandProperty Name)
  }

  Push-Location $E2E
  try {
    python run_e2e.py --event-date $EventDate --no-servers
    $code = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }

  $newDir = $null
  if (Test-Path -LiteralPath $SuiteReports) {
    $newDir = Get-ChildItem -LiteralPath $SuiteReports -Directory |
      Where-Object { $beforeDirs -notcontains $_.Name } |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
  }
  if (-not $newDir) {
    throw "The suite did not write a new report directory."
  }

  $iterDir = Join-Path $LoopReports ("{0:d2}-{1}" -f $i, $newDir.Name)
  New-Item -ItemType Directory -Force -Path $iterDir | Out-Null
  Save-SuiteReport $newDir.FullName $iterDir

  $reportPath = Join-Path $newDir.FullName "report.json"
  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json

  if ($report.passed -and $code -eq 0) {
    # Check if event-date is not today, which means arcus/postevals were skipped
    $today = (Get-Date).ToString("yyyy-MM-dd")
    if ($EventDate -ne $today) {
      Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "`r`n## Iteration $i`r`nSuite passed but event-date $EventDate is not today ($today). Arcus and post-eval specs were skipped.`r`nRe-run with today's date to validate the full chain.`r`nSaved: $iterDir`r`n"
      Write-Host "WARNING: Suite passed but arcus/postevals were skipped because event-date $EventDate is not today ($today)."
      Write-Host "Re-run with today's date to validate the full chain."
      Stop-Loop 6
    }
    Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "`r`nSuite passed on iteration $i ($EventDate).`r`nSaved: $iterDir`r`n"
    Write-Host "Suite passed. Loop finished."
    Stop-Loop 0
  }

  $fails = @($report.steps | Where-Object { $_.status -eq "fail" -and -not $_.gap })
  $product = @($fails | Where-Object { $Operational -notcontains $_.name })
  $ops = @($fails | Where-Object { $Operational -contains $_.name })

  if ($code -eq 2 -or ($product.Count -eq 0 -and $ops.Count -gt 0)) {
    $detail = ($ops | ForEach-Object { "- $($_.name): $($_.detail)" }) -join "`r`n"
    Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "`r`n## Iteration $i`r`nNot a product bug. Loop stopped.`r`n$detail`r`nSaved: $iterDir`r`n"
    Write-Host "Stopped. This failure is environment or cleanup, not a product bug."
    Write-Host $detail
    Stop-Loop 2
  }

  if ($product.Count -eq 0) {
    Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "`r`n## Iteration $i`r`nSuite failed with no product fail step (exit $code). Loop stopped.`r`nSaved: $iterDir`r`n"
    Write-Host "Stopped. Exit $code and no product failure in $reportPath"
    Stop-Loop 1
  }

  $bug = $product[0]
  $signature = "$($bug.name)|$($bug.http)|$($bug.detail)"
  if ($signature -eq $previousSignature) {
    if ($previousWasNoFix) {
      # The agent could not fix this on the previous pass and we re-ran the suite
      # to check whether it was a flake. The identical failure came back with no
      # fix applied, so another re-run will not help either: this needs operator
      # input (an env/config value the agent cannot edit, or a harder fix).
      Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "`r`n## Iteration $i`r`nSame failure returned after a no-fix re-run. Loop stopped for operator input.`r`n- $($bug.name): $($bug.detail)`r`nSaved: $iterDir`r`n"
      Write-Host "Stopped. The same failure returned after the agent could not fix it and a re-run did not clear it: $($bug.name)"
      Stop-Loop 7
    }
    Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "`r`n## Iteration $i`r`nSame failure as the previous run. Loop stopped.`r`n- $($bug.name): $($bug.detail)`r`nSaved: $iterDir`r`n"
    Write-Host "Stopped. The same failure came back after a fix attempt: $($bug.name)"
    Stop-Loop 3
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

  $TaskPath = Join-Path $iterDir "task.md"
  $VerdictPath = Join-Path $iterDir "verdict.json"
  $AgentLog = Join-Path $iterDir "agent.txt"

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

You may edit e2e-tests/support/** and e2e-tests/pages/** (harness). Do not edit e2e-tests/tests/** (specs).
"@ | Set-Content -LiteralPath $TaskPath -Encoding utf8

  $previousWasNoFix = $false
  Write-Host "Product bug: $($bug.name)"
  $agentOutput = @()
  & $Agent -p --output-format text --permission-mode bypass_permissions --no-session-persistence --max-turns 40 --cwd $Workspace "Follow the task file exactly: $TaskPath" 2>&1 |
    ForEach-Object {
      $line = "$_"
      $agentOutput += $line
      Add-Content -LiteralPath $AgentLog -Encoding utf8 -Value $line
      Write-Host $line
    }
  $agentExit = $LASTEXITCODE
  
  # Write bug-log entry BEFORE checking agent exit, so max-turns exits are logged
  $verdictKind = "unknown"
  $verdictSummary = "Agent exited with code $agentExit before writing verdict"
  if (Test-Path -LiteralPath $VerdictPath) {
    try {
      $verdict = Get-Content -LiteralPath $VerdictPath -Raw | ConvertFrom-Json
      $verdictKind = $verdict.kind
      $verdictSummary = $verdict.summary
    } catch {
      $verdictSummary = "Verdict file exists but could not be parsed: $_"
    }
  }
  
  Add-Content -LiteralPath $BugLog -Encoding utf8 -Value @"

## Iteration $i - $($bug.name)
- HTTP: $($bug.http)
- Detail: $($bug.detail)
- Verdict: $verdictKind
- Summary: $verdictSummary
- Saved: $iterDir
"@

  if ($agentExit -ne 0) {
    # The agent burned its turn budget without writing a product verdict. More often
    # than not this is a flaky/intermittent failure it could not reproduce, not a
    # bug that genuinely needs a human. Do NOT halt the whole run here: discard the
    # agent's unreviewed partial edits and re-run the suite. If it was a flake, the
    # re-run clears it and the loop advances to the next real bug; if the identical
    # failure comes back, the same-signature guard above stops the loop for operator
    # input on the next iteration.
    Add-Content -LiteralPath $BugLog -Encoding utf8 -Value "- Agent stopped without a fix (exit $agentExit, likely max-turns). Discarded its unreviewed edits and re-running; if the same failure returns the loop stops for operator input. Agent log: $AgentLog`r`n"
    foreach ($repo in $Repos) {
      Push-Location $repo
      try {
        git checkout -- . 2>&1 | Out-Null
      }
      finally {
        Pop-Location
      }
    }
    Write-Host ""
    Write-Host "The agent stopped without a fix (exit $agentExit, most likely the 40-turn budget)."
    Write-Host "Discarded its unreviewed edits and re-running the suite instead of stopping: a flake will clear and the loop advances, and if this exact failure returns the loop stops for operator input."
    Write-Host "Agent output: $AgentLog"
    $previousWasNoFix = $true
    continue
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

  if ($verdict.kind -ne "product") {
    Write-Host "Stopped. Verdict is '$($verdict.kind)': $($verdict.summary)"
    Stop-Loop 4
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
      $short = (git rev-parse --short HEAD).Trim()
      $committed += "$(Split-Path $repo -Leaf) $short"
      Set-Content -LiteralPath (Join-Path $iterDir "commit.txt") -Encoding utf8 -Value @"
repo: $repo
commit: $short
message: $message
"@
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
  Write-Host "Saved: $iterDir"
}

Write-Host "Stopped at the iteration cap ($MaxIterations)."
Stop-Loop 5
