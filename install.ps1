param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 4317
)
$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path -LiteralPath $PSScriptRoot).Path.TrimEnd('\')
Push-Location -LiteralPath $projectDirectory
try {
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'O Tesseract requer Windows de 64 bits.' }
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $nodeCommand -or -not $npmCommand) { throw 'Node.js e npm não estão no PATH. Instale uma versão aprovada pela organização e reabra o PowerShell.' }
    $nodeVersionText = (& node.exe --version 2>$null).Trim().TrimStart('v')
    $nodeVersion = [Version]$nodeVersionText
    if ($nodeVersion -lt [Version]'20.9.0') { throw "Node.js $nodeVersionText é antigo demais. Este projeto requer Node.js 20.9.0 ou superior; use uma versão LTS aprovada pela organização." }
    $npmVersionText = (& npm.cmd --version 2>$null).Trim()
    $npmVersion = [Version]($npmVersionText -replace '-.*$', '')
    if ($npmVersion.Major -lt 9) { throw "npm $npmVersionText não é suportado para o lockfile atual. Use npm 9 ou superior com a instalação aprovada de Node.js." }

    $registryValue = (& npm.cmd config get registry 2>$null | Select-Object -Last 1).Trim()
    $registryHost = 'não identificado'
    try { $registryHost = ([Uri]$registryValue).Host } catch { }
    $strictSslValue = (& npm.cmd config get strict-ssl 2>$null | Select-Object -Last 1).Trim()
    $proxyValue = (& npm.cmd config get proxy 2>$null | Select-Object -Last 1).Trim()
    $httpsProxyValue = (& npm.cmd config get https-proxy 2>$null | Select-Object -Last 1).Trim()
    $proxyConfigured = (($proxyValue -and $proxyValue -ne 'null') -or ($httpsProxyValue -and $httpsProxyValue -ne 'null'))
    Write-Host "Node.js: $nodeVersionText; npm: $npmVersionText; registry configurado: $registryHost; TLS estrito: $strictSslValue; proxy npm configurado: $([bool]$proxyConfigured)."
    Write-Host 'O instalador respeita registry, proxy, certificados e política de execução definidos pela organização; nenhum deles será alterado.'
    $executionPolicy = Get-ExecutionPolicy -Scope Process
    if ($executionPolicy -eq 'Restricted') {
        Write-Warning 'A política desta sessão bloqueia scripts. Se a organização permitir, execute somente este arquivo com -ExecutionPolicy Bypass; a política persistente não será alterada.'
    }

    $probe = Join-Path $projectDirectory ('.install-write-' + [guid]::NewGuid().ToString('N') + '.tmp')
    try { [IO.File]::WriteAllText($probe, 'ok'); Remove-Item -LiteralPath $probe -Force }
    catch { throw 'Sem permissão de gravação no diretório do checkout. Solicite acesso ao administrador; nenhuma permissão foi alterada.' }

    $minimumFreeBytes = 1GB
    $drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($projectDirectory).TrimEnd('\').TrimEnd(':')) -ErrorAction SilentlyContinue
    if ($drive -and $drive.Free -lt $minimumFreeBytes) { Write-Warning 'Há menos de 1 GB livre na unidade. npm ci ou o build podem ficar sem espaço.' }

    $metadataDirectory = Join-Path $env:LOCALAPPDATA 'AzureCostLocal\instances'
    if (Test-Path -LiteralPath $metadataDirectory) {
        $entryPoint = Join-Path $projectDirectory 'dist/server/main.js'
        foreach ($file in Get-ChildItem -LiteralPath $metadataDirectory -Filter 'service.json' -File -Recurse -ErrorAction SilentlyContinue) {
            try {
                $metadata = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
                if ([string]$metadata.projectRoot -ieq $projectDirectory -and $metadata.pid -gt 0) {
                    $exists = Get-Process -Id $metadata.pid -ErrorAction SilentlyContinue
                    if ($exists) {
                        try { $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($metadata.pid)" -ErrorAction Stop }
                        catch { throw "Não foi possível verificar a linha de comando do PID $($metadata.pid). O instalador interrompeu para preservar o processo." }
                        if (-not $process -or -not $process.CommandLine) { throw "O Windows não forneceu a linha de comando do PID $($metadata.pid). O instalador interrompeu sem alterar processos." }
                    } else { $process = $null }
                    if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine.IndexOf($entryPoint, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                        throw "O serviço deste checkout está ativo (PID $($metadata.pid), porta $($metadata.port)). Execute .\stop.ps1 -Port $($metadata.port) antes de instalar para evitar locks de arquivos."
                    }
                    if (-not $process -or $process.CommandLine.IndexOf($entryPoint, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
                        Write-Warning 'Foi encontrado um arquivo de PID obsoleto deste checkout; o instalador o preservou. Use status.ps1/start.ps1 para diagnóstico.'
                    }
                }
            } catch {
                if ($_.Exception.Message.StartsWith('O serviço deste checkout está ativo') -or
                    $_.Exception.Message.StartsWith('Não foi possível verificar a linha de comando') -or
                    $_.Exception.Message.StartsWith('O Windows não forneceu a linha de comando')) { throw }
                Write-Warning 'Não foi possível interpretar um registro local de serviço; nenhum processo ou dado foi alterado.'
            }
        }
    }

    $pingOutput = & npm.cmd ping --silent 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Warning "O registry $registryHost não respondeu a npm ping. O instalador tentará npm ci sem mudar a configuração; se falhar, verifique registry, proxy ou certificados com o administrador." }
    Write-Host 'Instalando exatamente as versões do package-lock.json com npm ci…'
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci falhou usando o registry configurado ($registryHost). Confira a mensagem do npm; valide registry/proxy/TLS com o suporte corporativo. O instalador não ajusta essas configurações." }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build de produção falhou. Revise a primeira mensagem de erro do build e os avisos corporativos abaixo; nenhuma credencial ou política foi alterada.' }
    & node.exe -e "require('koffi')"
    if ($LASTEXITCODE -ne 0) { throw 'O módulo nativo koffi não carregou. A política npm pode ter bloqueado seu script de instalação; peça ao administrador para revisar a dependência e a política allow-scripts. O instalador não aprova scripts automaticamente.' }
    Write-Host 'Instalação e build concluídos. Nenhum servidor MCP externo foi instalado e nenhum processo Node existente foi iniciado/encerrado.'
    Write-Host "Use .\start.ps1 -Port $Port para iniciar o serviço; o parâmetro de porta foi registrado para facilitar o próximo comando."
} finally { Pop-Location }
