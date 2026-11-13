[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'status')]
    [string] $Action = 'status',

    [int] $Port = 4317,

    [int] $StartupTimeoutSeconds = 20
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot
$PidFile = Join-Path $ProjectRoot 'data\service.pid'
$HealthUrl = "http://127.0.0.1:$Port/api/health"
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$TsxCli = Join-Path $ProjectRoot 'node_modules\tsx\dist\cli.mjs'
$EntryPoint = Join-Path $ProjectRoot 'src\server\main.ts'

function Get-ServiceHealth {
    try {
        return Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2
    } catch {
        return $null
    }
}

function Get-ManagedProcess {
    if (-not (Test-Path -LiteralPath $PidFile)) { return $null }

    $storedPid = 0
    if (-not [int]::TryParse((Get-Content -LiteralPath $PidFile -Raw).Trim(), [ref] $storedPid)) {
        Remove-Item -LiteralPath $PidFile -Force
        return $null
    }

    $process = Get-Process -Id $storedPid -ErrorAction SilentlyContinue
    if (-not $process) {
        Remove-Item -LiteralPath $PidFile -Force
        return $null
    }

    $details = Get-CimInstance Win32_Process -Filter "ProcessId = $storedPid" -ErrorAction SilentlyContinue
    if (-not $details -or $details.CommandLine -notlike "*$ProjectRoot*") {
        throw "O PID $storedPid não corresponde a um processo deste Tesseract. Arquivo PID preservado: $PidFile"
    }

    return $process
}

switch ($Action) {
    'status' {
        $health = Get-ServiceHealth
        if ($health -and $health.app -eq 'Tesseract 2.0') {
            Write-Output "Tesseract 2.0 está ativo em http://127.0.0.1:$Port (health: $($health.status))."
        } else {
            Write-Output "Tesseract 2.0 não está respondendo em http://127.0.0.1:$Port."
        }
    }

    'start' {
        $health = Get-ServiceHealth
        if ($health -and $health.app -eq 'Tesseract 2.0') {
            Write-Output "Tesseract 2.0 já está ativo em http://127.0.0.1:$Port."
            break
        }
        if ($health) { throw "A porta $Port responde com outro serviço; nada foi iniciado." }
        if (-not (Test-Path -LiteralPath $TsxCli) -or -not (Test-Path -LiteralPath $EntryPoint)) {
            throw 'Dependências ou entrypoint ausentes. Execute npm install neste diretório antes de iniciar.'
        }

        $managed = Get-ManagedProcess
        if ($managed) { Stop-Process -Id $managed.Id -Force }

        New-Item -ItemType Directory -Path (Split-Path -Parent $PidFile) -Force | Out-Null
        $process = Start-Process -FilePath $Node `
            -ArgumentList @($TsxCli, $EntryPoint) `
            -WorkingDirectory $ProjectRoot `
            -WindowStyle Hidden `
            -PassThru
        Set-Content -LiteralPath $PidFile -Value $process.Id -NoNewline

        $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
        do {
            Start-Sleep -Milliseconds 400
            $process.Refresh()
            $health = Get-ServiceHealth
            if ($health -and $health.app -eq 'Tesseract 2.0') {
                Write-Output "Tesseract 2.0 iniciado em http://127.0.0.1:$Port (PID $($process.Id))."
                break
            }
            if ($process.HasExited) {
                Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
                throw "O processo do serviço encerrou com código $($process.ExitCode)."
            }
        } while ((Get-Date) -lt $deadline)

        if (-not ($health -and $health.app -eq 'Tesseract 2.0')) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
            throw "O serviço não respondeu dentro de $StartupTimeoutSeconds segundos."
        }
    }

    'stop' {
        $health = Get-ServiceHealth
        $managed = Get-ManagedProcess
        if (-not $managed) {
            if ($health -and $health.app -eq 'Tesseract 2.0') {
                throw 'O serviço responde, mas não foi iniciado por service.ps1. Nenhum processo foi encerrado.'
            }
            Write-Output 'Tesseract 2.0 já está parado.'
            break
        }

        Stop-Process -Id $managed.Id -Force
        $managed.WaitForExit(5000) | Out-Null
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        $health = Get-ServiceHealth
        if ($health -and $health.app -eq 'Tesseract 2.0') {
            throw 'O processo controlado foi encerrado, mas outro Tesseract continua respondendo na mesma porta.'
        }
        Write-Output 'Tesseract 2.0 parado.'
    }
}
