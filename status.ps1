$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $env:LOCALAPPDATA 'AzureCostLocal\service.pid'
$port = if ($env:PORT) { $env:PORT } else { '4317' }
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'Serviço não iniciado pelo Tesseract.'; exit 0 }
$serviceProcessId = [int](Get-Content -LiteralPath $pidFile)
$appProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$serviceProcessId"
$entryPoint = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'dist/server/main.js'
if (-not $appProcess -or $appProcess.Name -ne 'node.exe' -or -not $appProcess.CommandLine.Contains($entryPoint)) { Write-Host 'O PID registrado não corresponde ao servidor deste checkout.'; exit 1 }
try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -NoProxy -TimeoutSec 3; if ($health.ok) { Write-Host "Tesseract ativo (PID $serviceProcessId) em http://127.0.0.1:$port"; exit 0 } } catch { }
Write-Host "Processo encontrado (PID $serviceProcessId), mas sem health check."; exit 1
