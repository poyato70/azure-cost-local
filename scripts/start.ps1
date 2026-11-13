param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectDirectory
try {
    if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory 'node_modules'))) {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências.' }
    }
    if (-not $SkipBuild) {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar a aplicação.' }
    } elseif (-not (Test-Path -LiteralPath (Join-Path $projectDirectory 'dist/web/index.html'))) {
        throw 'Build ausente. Inicie sem -SkipBuild.'
    }
    $runtimeDirectory = Join-Path $env:LOCALAPPDATA 'AzureCostLocal'
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    $entryPoint = Join-Path $projectDirectory 'dist/server/main.js'
    $nodeCommand = (Get-Command node.exe).Source
    # WMI creates the service outside the launcher's process tree, so closing
    # the invoking terminal or execution session does not terminate the server.
    $processEnvironment = [string[]]([Environment]::GetEnvironmentVariables('Process').GetEnumerator() | ForEach-Object { $_.Key + '=' + $_.Value })
    $startupInfo = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0;EnvironmentVariables=$processEnvironment}
    $createdProcess = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=('"' + $nodeCommand + '" "' + $entryPoint + '"');CurrentDirectory=$projectDirectory;ProcessStartupInformation=$startupInfo}
    if ($createdProcess.ReturnValue -ne 0) { throw "O Windows não iniciou o serviço (código $($createdProcess.ReturnValue))." }
    $createdProcess.ProcessId | Set-Content -LiteralPath (Join-Path $runtimeDirectory 'service.pid')
    $appProcess = Get-Process -Id $createdProcess.ProcessId -ErrorAction Stop
    Start-Sleep -Seconds 2
    $appProcess.Refresh()
    if ($appProcess.HasExited) { throw 'O serviço não iniciou. Verifique se a porta já está em uso.' }
    $localPort = if ($env:PORT) { $env:PORT } else { '4317' }
    $ready = $false
    $startupWatch = [Diagnostics.Stopwatch]::StartNew()
    while ($startupWatch.Elapsed.TotalSeconds -lt 60) {
        $appProcess.Refresh()
        if ($appProcess.HasExited) { throw 'O serviço encerrou antes de ficar pronto. Verifique a porta e o build.' }
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$localPort/api/health" -NoProxy -TimeoutSec 2
            if ($health.ok -eq $true) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'O serviço ainda não respondeu ao health check. Aguarde ou verifique o processo antes de iniciar novamente.' }
    Start-Process "http://localhost:$localPort"
    Write-Host 'Aplicação iniciada. Use scripts/stop.ps1 para encerrar.'
} finally { Pop-Location }
