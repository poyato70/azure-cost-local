param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('start', 'status', 'stop')]
    [string]$Action,
    [ValidateRange(1024, 65535)]
    [int]$Port = 4317,
    [ValidateRange(5, 300)]
    [int]$StartupTimeoutSeconds = 60,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$ProjectRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path.TrimEnd('\')
if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA não está disponível para a conta atual.' }
$identity = $ProjectRoot.ToLowerInvariant()
$sha = [Security.Cryptography.SHA256]::Create()
try { $digest = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($identity))).Replace('-', '').ToLowerInvariant() }
finally { $sha.Dispose() }
$ServiceDataDirectory = Join-Path $env:LOCALAPPDATA (Join-Path 'AzureCostLocal\instances' $digest)
$MetadataPath = Join-Path $ServiceDataDirectory 'service.json'
$LogDirectory = Join-Path $ServiceDataDirectory 'logs'
$StdoutLog = Join-Path $LogDirectory 'service.out.log'
$StderrLog = Join-Path $LogDirectory 'service.err.log'
$EntryPoint = Join-Path $ProjectRoot 'dist/server/main.js'

function Get-HttpHealth {
    param([int]$TargetPort)
    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.UseProxy = $false
    $client = [Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(2)
    try {
        $response = $client.GetAsync("http://127.0.0.1:$TargetPort/api/health").GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) { return $null }
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        return $body | ConvertFrom-Json
    } catch { return $null }
    finally { $client.Dispose(); $handler.Dispose() }
}

function Get-ListenerProcessId {
    try {
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
        if ($listener) { return [int]$listener.OwningProcess }
    } catch {
        $line = (& netstat.exe -ano -p tcp 2>$null | Where-Object { $_ -match "(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]|::):$Port\s+.*LISTENING\s+(\d+)\s*$" } | Select-Object -First 1)
        if ($line -match '(\d+)\s*$') { return [int]$Matches[1] }
    }
    return $null
}

function Read-ServiceMetadata {
    if (-not (Test-Path -LiteralPath $MetadataPath)) { return $null }
    try {
        $data = Get-Content -LiteralPath $MetadataPath -Raw | ConvertFrom-Json
        if ($data.projectRoot -and $data.pid -gt 0 -and $data.port -ge 1024 -and $data.port -le 65535) { return $data }
    } catch { }
    return [pscustomobject]@{ invalid = $true }
}

function Get-ManagedProcess {
    param($Metadata)
    if (-not $Metadata -or $Metadata.invalid) { return $null }
    try { $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($Metadata.pid)" -ErrorAction Stop }
    catch {
        if (Get-Process -Id $Metadata.pid -ErrorAction SilentlyContinue) {
            return [pscustomobject]@{ unverified = $true; ProcessId = [int]$Metadata.pid }
        }
        return $null
    }
    if (-not $process -and (Get-Process -Id $Metadata.pid -ErrorAction SilentlyContinue)) {
        return [pscustomobject]@{ unverified = $true; ProcessId = [int]$Metadata.pid }
    }
    if (-not $process -or $process.Name -ne 'node.exe' -or -not $process.CommandLine) { return $null }
    if ($process.CommandLine.IndexOf($EntryPoint, [StringComparison]::OrdinalIgnoreCase) -lt 0) { return $null }
    return $process
}

function Write-ServiceMetadata {
    param([int]$ProcessId, [int]$TargetPort)
    New-Item -ItemType Directory -Path $ServiceDataDirectory -Force | Out-Null
    $temporary = $MetadataPath + '.tmp'
    $record = [ordered]@{
        projectRoot = $ProjectRoot
        entryPoint = $EntryPoint
        pid = $ProcessId
        port = $TargetPort
        startedAt = (Get-Date).ToString('o')
        stdoutLog = $StdoutLog
        stderrLog = $StderrLog
    }
    $record | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $MetadataPath -Force
}

function Remove-ServiceMetadata {
    Remove-Item -LiteralPath $MetadataPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath ($MetadataPath + '.tmp') -Force -ErrorAction SilentlyContinue
}

function Rotate-Log {
    param([string]$Path)
    if ((Test-Path -LiteralPath $Path) -and (Get-Item -LiteralPath $Path).Length -ge 5MB) {
        $old = $Path + '.1'
        Remove-Item -LiteralPath $old -Force -ErrorAction SilentlyContinue
        Move-Item -LiteralPath $Path -Destination $old
    }
}

function Stop-VerifiedProcess {
    param($ProcessInfo, [int]$ProcessId)
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    & $node -e 'try { process.kill(process.argv[1], ''SIGTERM'') } catch (e) { process.exit(2) }' ([string]$ProcessId) 2>$null
    $waitUntil = (Get-Date).AddSeconds(10)
    do {
        Start-Sleep -Milliseconds 250
        try { Get-Process -Id $ProcessId -ErrorAction Stop | Out-Null } catch { return }
    } while ((Get-Date) -lt $waitUntil)
    $stillRunning = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if ($stillRunning -and $stillRunning.Name -eq 'node.exe' -and $stillRunning.CommandLine.IndexOf($EntryPoint, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Stop-Process -Id $ProcessId -Force
        try { Wait-Process -Id $ProcessId -Timeout 5 -ErrorAction Stop } catch { }
    }
    try { Get-Process -Id $ProcessId -ErrorAction Stop | Out-Null; throw "O processo Tesseract PID $ProcessId não encerrou. Consulte $StderrLog." } catch { if ($_.Exception.Message -like 'O processo Tesseract*') { throw } }
}

$metadata = Read-ServiceMetadata
$ownedProcess = Get-ManagedProcess $metadata

switch ($Action) {
    'status' {
        if ($ownedProcess -and $ownedProcess.unverified) { throw "O PID $($metadata.pid) existe, mas o Windows não permitiu verificar sua linha de comando. Nenhum processo foi alterado; consulte o administrador." }
        if ($metadata -and $ownedProcess) {
            $health = Get-HttpHealth ([int]$metadata.port)
            if ($health -and $health.ok -eq $true -and $health.app -eq 'Tesseract 2.0') {
                Write-Output "Processo: ativo e pertencente a este checkout (PID $($metadata.pid))."
                Write-Output "HTTP/health: http://127.0.0.1:$($metadata.port)/api/health respondeu."
            } else {
                Write-Output "Processo: ativo (PID $($metadata.pid)); health check pendente/falhou. O processo foi preservado."
            }
            Write-Output "Iniciado em: $($metadata.startedAt)"
            Write-Output "Logs: $LogDirectory"
            return
        }
        if ($metadata) {
            Write-Output "PID obsoleto ou não pertencente a este checkout no arquivo $MetadataPath; nenhum processo foi encerrado."
            Write-Output 'Ação: start.ps1 pode limpar somente esse metadado após confirmar a porta.'
            throw 'Metadado de serviço não corresponde a um processo ativo deste checkout.'
        }
        $listenerPid = Get-ListenerProcessId
        if ($listenerPid) {
            $listener = Get-CimInstance Win32_Process -Filter "ProcessId=$listenerPid" -ErrorAction SilentlyContinue
            Write-Output "Processo: parado neste checkout; porta $Port ocupada pelo PID $listenerPid ($($listener.Name))."
            throw 'A porta configurada está ocupada por outro processo.'
        }
        Write-Output "Tesseract parado neste checkout. Porta $Port disponível."
        return
    }
    'start' {
        if ($ownedProcess -and $ownedProcess.unverified) { throw "O PID $($metadata.pid) existe, mas o Windows não permitiu verificar sua linha de comando. Nenhum processo foi alterado; consulte o administrador." }
        if ($metadata -and $ownedProcess) {
            if ([int]$metadata.port -ne $Port) { throw "Este checkout já possui serviço ativo na porta $($metadata.port), PID $($metadata.pid). Use .\stop.ps1 -Port $($metadata.port) antes de mudar a porta." }
            $health = Get-HttpHealth $Port
            if ($health -and $health.ok -eq $true -and $health.app -eq 'Tesseract 2.0') {
                Write-Output "Tesseract já está ativo nesta instalação (PID $($metadata.pid)) em http://127.0.0.1:$Port."
                return
            }
            throw "O processo deste checkout (PID $($metadata.pid)) está ativo sem health check. Foi preservado. Consulte $StderrLog e execute status.ps1."
        }
        if ($metadata) {
            Remove-ServiceMetadata
            Write-Warning 'Metadado de PID obsoleto removido; o processo associado não existia ou não correspondia a este checkout.'
        }
        $listenerPid = Get-ListenerProcessId
        if ($listenerPid) {
            $health = Get-HttpHealth $Port
            $listener = Get-CimInstance Win32_Process -Filter "ProcessId=$listenerPid" -ErrorAction SilentlyContinue
            if ($health -and $health.ok -eq $true -and $health.app -eq 'Tesseract 2.0') {
                throw "A porta $Port já responde como Tesseract 2.0, mas o processo não pertence a este checkout (PID $listenerPid). Nada foi iniciado nem encerrado. Use status.ps1 para verificar a outra instalação."
            }
            throw "A porta 127.0.0.1:$Port está ocupada por outro processo (PID $listenerPid, $($listener.Name)). Nada foi iniciado. Escolha outra porta com .\start.ps1 -Port <1024-65535> ou encerre o processo identificado."
        }
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'node_modules'))) {
            & (Join-Path $ProjectRoot 'install.ps1')
            if ($LASTEXITCODE -ne 0) { throw 'Instalação falhou. Consulte a mensagem do instalador.' }
        } elseif (-not $SkipBuild) {
            Push-Location -LiteralPath $ProjectRoot
            try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build falhou antes da inicialização.' } }
            finally { Pop-Location }
        }
        if (-not (Test-Path -LiteralPath $EntryPoint)) { throw "Build ausente em $EntryPoint. Execute .\install.ps1." }
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
        Rotate-Log $StdoutLog
        Rotate-Log $StderrLog
        $previousPort = $env:PORT
        $previousProxySupport = $env:NODE_USE_ENV_PROXY
        try {
            $env:PORT = [string]$Port
            if (-not $env:NODE_USE_ENV_PROXY) { $env:NODE_USE_ENV_PROXY = '1' }
            $process = Start-Process -FilePath $node -ArgumentList @('"' + $EntryPoint + '"') -WorkingDirectory $ProjectRoot -RedirectStandardOutput $StdoutLog -RedirectStandardError $StderrLog -WindowStyle Hidden -PassThru
        } finally {
            $env:PORT = $previousPort
            $env:NODE_USE_ENV_PROXY = $previousProxySupport
        }
        Write-ServiceMetadata -ProcessId $process.Id -TargetPort $Port
        $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
        do {
            Start-Sleep -Milliseconds 300
            try { $process.Refresh() } catch { }
            if ($process.HasExited) {
                Remove-ServiceMetadata
                throw "O processo encerrou durante a inicialização (código $($process.ExitCode)). Consulte $StderrLog. Verifique também se a porta escolhida estava livre."
            }
            $health = Get-HttpHealth $Port
            if ($health -and $health.ok -eq $true -and $health.app -eq 'Tesseract 2.0') {
                Write-Output "Tesseract iniciado em http://127.0.0.1:$Port (PID $($process.Id))."
                Write-Output "Health check: aprovado em até $StartupTimeoutSeconds s. Logs: $LogDirectory"
                return
            }
            $listenerPid = Get-ListenerProcessId
            if ($listenerPid -and $listenerPid -ne $process.Id) {
                throw "A porta $Port passou a pertencer ao PID $listenerPid durante a inicialização. O processo deste checkout (PID $($process.Id)) foi preservado para inspeção. Consulte $StderrLog."
            }
        } while ((Get-Date) -lt $deadline)
        throw "Health check excedeu $StartupTimeoutSeconds s, mas o processo continua ativo (PID $($process.Id)); ele foi preservado. Consulte $StderrLog e verifique status.ps1. Para aguardar mais, use -StartupTimeoutSeconds <5-300>."
    }
    'stop' {
        if (-not $metadata) {
            $listenerPid = Get-ListenerProcessId
            if ($listenerPid) { throw "Nenhum PID deste checkout foi registrado. A porta $Port pertence ao PID $listenerPid; nenhum processo foi encerrado." }
            Write-Output 'Tesseract já está parado neste checkout.'
            return
        }
        if ($ownedProcess -and $ownedProcess.unverified) { throw "O PID $($metadata.pid) existe, mas sua propriedade não pôde ser comprovada. Nenhum processo foi encerrado; consulte o administrador." }
        if (-not $ownedProcess) {
            Remove-ServiceMetadata
            throw 'O PID registrado está obsoleto ou foi reutilizado por outro processo. O metadado local foi removido; nenhum processo foi encerrado.'
        }
        if ([int]$metadata.port -ne $Port) { throw "O serviço deste checkout está registrado na porta $($metadata.port), não $Port. Use .\stop.ps1 -Port $($metadata.port)." }
        Stop-VerifiedProcess -ProcessInfo $ownedProcess -ProcessId ([int]$metadata.pid)
        Remove-ServiceMetadata
        Write-Output "Tesseract encerrado (PID $($metadata.pid)). Dados e logs locais foram preservados."
    }
}
