$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectDirectory
try {
    if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory 'node_modules'))) {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências.' }
    }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar a aplicação.' }
    $runtimeDirectory = Join-Path $env:LOCALAPPDATA 'AzureCostLocal'
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    $entryPoint = Join-Path $projectDirectory 'dist/server/main.js'
    $nodeCommand = (Get-Command node.exe).Source
    $appProcess = Start-Process -FilePath $nodeCommand -ArgumentList ('"' + $entryPoint + '"') -WorkingDirectory $projectDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDirectory 'service.log') -RedirectStandardError (Join-Path $runtimeDirectory 'service-error.log')
    $appProcess.Id | Set-Content -LiteralPath (Join-Path $runtimeDirectory 'service.pid')
    Start-Sleep -Seconds 2
    if ($appProcess.HasExited) { throw 'O serviço não iniciou. Verifique se a porta já está em uso.' }
    $localPort = if ($env:PORT) { $env:PORT } else { '4317' }
    Start-Process "http://localhost:$localPort"
    Write-Host 'Aplicação iniciada. Use scripts/stop.ps1 para encerrar.'
} finally { Pop-Location }
