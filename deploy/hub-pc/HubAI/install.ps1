param([string]$InstallDir = "C:\HubAI")
$ErrorActionPreference="Stop"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item "$PSScriptRoot\hub-ai-worker.ps1" "$InstallDir\hub-ai-worker.ps1" -Force
if (!(Test-Path "$InstallDir\config.json")) { Copy-Item "$PSScriptRoot\config.example.json" "$InstallDir\config.json" }
$action=New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\hub-ai-worker.ps1`""
$trigger=New-ScheduledTaskTrigger -AtStartup
$settings=New-ScheduledTaskSettingsSet -RestartCount 20 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName "Hub Local AI Companion" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -User "SYSTEM" -Force | Out-Null
Start-ScheduledTask -TaskName "Hub Local AI Companion"
Write-Host "Installed. Edit $InstallDir\config.json with the Render agent token, then restart the task."
