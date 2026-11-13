param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDirectory = Join-Path $env:LOCALAPPDATA 'AzureCostLocal'
$pidFile = Join-Path $runtimeDirectory 'service.pid'
Push-Location -LiteralPath $projectDirectory
try {
    if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory 'node_modules'))) { & (Join-Path $projectDirectory 'install.ps1') }
    if (-not $SkipBuild) { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Falha no build.' } }
    elseif (-not (Test-Path -LiteralPath (Join-Path $projectDirectory 'dist/server/main.js'))) { throw 'Build ausente. Inicie sem -SkipBuild.' }
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    $nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
    $entryPoint = Join-Path $projectDirectory 'dist/server/main.js'
    $processEnvironment = [string[]]([Environment]::GetEnvironmentVariables('Process').GetEnumerator() | ForEach-Object { $_.Key + '=' + $_.Value })
    $startupInfo = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0; EnvironmentVariables = $processEnvironment }
    $createdProcess = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ('"' + $nodeCommand + '" "' + $entryPoint + '"'); CurrentDirectory = $projectDirectory; ProcessStartupInformation = $startupInfo }
    if ($createdProcess.ReturnValue -ne 0) { throw "O Windows não iniciou o serviço (código $($createdProcess.ReturnValue))." }
    $createdProcess.ProcessId | Set-Content -LiteralPath $pidFile
    $appProcess = Get-Process -Id $createdProcess.ProcessId -ErrorAction Stop
    $port = if ($env:PORT) { $env:PORT } else { '4317' }
    $ready = $false; $watch = [Diagnostics.Stopwatch]::StartNew()
    while ($watch.Elapsed.TotalSeconds -lt 60) {
        $appProcess.Refresh()
        if ($appProcess.HasExited) { throw 'O serviço encerrou antes de responder. Verifique a porta e o build.' }
        try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -NoProxy -TimeoutSec 2; if ($health.ok -eq $true) { $ready = $true; break } } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Health check não respondeu. O processo foi preservado para inspeção; confira status.ps1.' }
    Write-Host "Tesseract 2.0 em http://127.0.0.1:$port (PID $($createdProcess.ProcessId)). Use .\stop.ps1 para encerrar."
} finally { Pop-Location }
