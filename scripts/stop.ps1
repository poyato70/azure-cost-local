$ErrorActionPreference = 'Stop'
$runtimeDirectory = Join-Path $env:LOCALAPPDATA 'AzureCostLocal'
$pidFile = Join-Path $runtimeDirectory 'service.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'Nenhum serviço iniciado pelo script.'; exit }
$serviceProcessId = [int](Get-Content -LiteralPath $pidFile)
$appProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$serviceProcessId"
$projectDirectory = Split-Path -Parent $PSScriptRoot
$entryPoint = Join-Path $projectDirectory 'dist/server/main.js'
if ($appProcess -and $appProcess.Name -eq 'node.exe' -and $appProcess.CommandLine.Contains($entryPoint)) {
    Stop-Process -Id $serviceProcessId
    Remove-Item -LiteralPath $pidFile
    Write-Host 'Serviço encerrado.'
} elseif ($appProcess) { throw 'O identificador pertence a outro processo; nenhuma ação executada.' }
else { Remove-Item -LiteralPath $pidFile; Write-Host 'O serviço já estava encerrado.' }
