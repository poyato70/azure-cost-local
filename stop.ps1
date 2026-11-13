$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $env:LOCALAPPDATA 'AzureCostLocal\service.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'Nenhum serviço iniciado pelo script.'; exit 0 }
$serviceProcessId = [int](Get-Content -LiteralPath $pidFile)
$appProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$serviceProcessId"
$entryPoint = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'dist/server/main.js'
if ($appProcess -and $appProcess.Name -eq 'node.exe' -and $appProcess.CommandLine.Contains($entryPoint)) { Stop-Process -Id $serviceProcessId; Remove-Item -LiteralPath $pidFile; Write-Host 'Serviço encerrado.' }
elseif ($appProcess) { throw 'O PID pertence a outro processo; nenhuma ação executada.' }
else { Remove-Item -LiteralPath $pidFile; Write-Host 'O serviço já estava encerrado.' }
