# Done Trigger Bridge - auto-start helper
# Called by Windows Task Scheduler at logon. Starts the bridge if not already running.
$bridge = "D:\Personal\Tasks\tools\trigger-bridge.mjs"
$node = "C:\Program Files\nodejs\node.exe"

# Check if already listening on 8788
$already = Test-NetConnection -ComputerName 127.0.0.1 -Port 8788 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($already) {
  Write-Output "Bridge already running - nothing to do."
  exit 0
}

if (-not (Test-Path $bridge)) {
  Write-Output "Bridge script missing: $bridge"
  exit 1
}

Start-Process -FilePath $node -ArgumentList "`"$bridge`"" -WindowStyle Hidden
Write-Output "Done Trigger Bridge started (hidden)."
