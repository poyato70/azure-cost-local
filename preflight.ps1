[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 4317,
    [ValidateRange(1, 30)]
    [int]$NetworkTimeoutSeconds = 6,
    [switch]$SkipAzureEndpointChecks,
    [switch]$ExportReport,
    [string]$ReportPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'scripts\preflight-core.psm1') -Force
$checks = [System.Collections.Generic.List[object]]::new()
function Add-PreflightCheck {
    param([string]$Category, [string]$Name, [ValidateSet('APROVADO', 'AVISO', 'BLOQUEADO', 'INFORMATIVO')][string]$State, [string]$Summary)
    $checks.Add([pscustomobject]@{ Category = $Category; Name = $Name; State = $State; Summary = $Summary }) | Out-Null
}
function Get-NpmValue {
    param([string]$Name)
    $command = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $command) { return '' }
    try {
        $lines = & $command.Source config get $Name 2>$null
        if ($LASTEXITCODE -ne 0) { return '' }
        return [string]($lines | Select-Object -Last 1).Trim()
    } catch { return '' }
}
function Test-ConfiguredBoolean {
    param([string]$Value)
    return [bool]($Value -and $Value.Trim().ToLowerInvariant() -notin @('', 'null', 'false', 'undefined'))
}
function Test-WriteAccessInCheckout {
    $probe = Join-Path $PSScriptRoot ('.preflight-' + [guid]::NewGuid().ToString('N') + '.tmp')
    $stream = $null
    try {
        $stream = [System.IO.File]::Open($probe, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('tesseract-preflight')
        $stream.Write($bytes, 0, $bytes.Length)
        return $true
    } catch { return $false }
    finally {
        if ($stream) { $stream.Dispose() }
        if (Test-Path -LiteralPath $probe) { Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue }
    }
}
function Get-ListeningPortState {
    param([int]$TargetPort)
    try {
        $listener = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction Stop | Select-Object -First 1
        if ($listener) { return 'ocupada' }
        return 'disponível'
    } catch {
        try {
            $matches = & netstat.exe -ano -p tcp 2>$null | Where-Object { $_ -match "(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]|::):$TargetPort\s+.*LISTENING\s+\d+\s*$" }
            if ($matches) { return 'ocupada' }
            return 'disponível'
        } catch { return 'indeterminada' }
    }
}
function Get-ExplicitProxyUri {
    $candidate = ''
    foreach ($name in @('HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy')) {
        $candidate = [Environment]::GetEnvironmentVariable($name)
        if (Test-ConfiguredBoolean $candidate) { break }
        $candidate = ''
    }
    if (-not $candidate) {
        foreach ($name in @('https-proxy', 'proxy')) {
            $candidate = Get-NpmValue $name
            if (Test-ConfiguredBoolean $candidate) { break }
            $candidate = ''
        }
    }
    if (-not $candidate) { return $null }
    try {
        $uri = [Uri]$candidate
        if (-not $uri.IsAbsoluteUri -or $uri.Scheme -notin @('http', 'https')) { return $null }
        $builder = [UriBuilder]::new($uri)
        $builder.UserName = ''; $builder.Password = ''; $builder.Path = '/'; $builder.Query = ''; $builder.Fragment = ''
        return $builder.Uri
    } catch { return $null }
}
function Test-NoProxyMatch {
    param([string]$HostName)
    $raw = $env:NO_PROXY
    if (-not $raw) { $raw = $env:no_proxy }
    if (-not $raw) { $raw = Get-NpmValue 'noproxy' }
    if (-not $raw) { return $false }
    foreach ($entry in ($raw -split ',')) {
        $candidate = $entry.Trim()
        if (-not $candidate) { continue }
        $candidate = ($candidate -split ':')[0].TrimStart('.')
        if ($HostName -ieq $candidate -or $HostName.EndsWith('.' + $candidate, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}
function Invoke-UnauthenticatedHead {
    param([Uri]$Uri, [int]$TimeoutSeconds)
    $request = [System.Net.HttpWebRequest]::Create($Uri)
    $request.Method = 'HEAD'; $request.Timeout = $TimeoutSeconds * 1000; $request.ReadWriteTimeout = $TimeoutSeconds * 1000
    $request.AllowAutoRedirect = $false; $request.UseDefaultCredentials = $false; $request.PreAuthenticate = $false
    $proxyUri = Get-ExplicitProxyUri
    if (Test-NoProxyMatch $Uri.DnsSafeHost) {
        $request.Proxy = [System.Net.GlobalProxySelection]::GetEmptyWebProxy()
    } elseif ($proxyUri) {
        $proxy = [System.Net.WebProxy]::new($proxyUri)
        $proxy.Credentials = $null
        $request.Proxy = $proxy
    } else {
        $systemProxy = [System.Net.WebRequest]::DefaultWebProxy
        if ($systemProxy -and -not $systemProxy.IsBypassed($Uri)) {
            $systemProxyUri = $systemProxy.GetProxy($Uri)
            $proxy = [System.Net.WebProxy]::new($systemProxyUri)
            $proxy.Credentials = $null
            $request.Proxy = $proxy
        } else {
            $request.Proxy = [System.Net.GlobalProxySelection]::GetEmptyWebProxy()
        }
    }
    try {
        $response = [System.Net.HttpWebResponse]$request.GetResponse()
        try { return New-PreflightNetworkResult -StatusCode ([int]$response.StatusCode) }
        finally { $response.Dispose() }
    } catch [System.Net.WebException] {
        $statusCode = 0
        if ($_.Exception.Response -is [System.Net.HttpWebResponse]) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $_.Exception.Response.Dispose()
        }
        if ($statusCode) { return New-PreflightNetworkResult -StatusCode $statusCode }
        $kind = Get-PreflightFailureKind -Exception $_.Exception
        return New-PreflightNetworkResult -FailureKind $kind
    } catch {
        $kind = Get-PreflightFailureKind -Exception $_.Exception
        return New-PreflightNetworkResult -FailureKind $kind
    }
}
function Test-Endpoint {
    param([string]$Label, [string]$RawUri, [int]$TimeoutSeconds, [string]$Category = 'Rede')
    try {
        $uri = [Uri]$RawUri
        if (-not $uri.IsAbsoluteUri -or $uri.Scheme -notin @('http', 'https')) { throw 'invalid endpoint' }
        $proxyUri = Get-ExplicitProxyUri
        $usingProxy = $proxyUri -and -not (Test-NoProxyMatch $uri.DnsSafeHost)
        $dnsTarget = if ($usingProxy) { $proxyUri.DnsSafeHost } else {
            $systemProxy = [System.Net.WebRequest]::DefaultWebProxy
            if ($systemProxy -and -not $systemProxy.IsBypassed($uri)) { $systemProxy.GetProxy($uri).DnsSafeHost }
            else { $uri.DnsSafeHost }
        }
        $dns = Resolve-DnsName -Name $dnsTarget -Type A -DnsOnly -QuickTimeout -ErrorAction Stop
        if (-not $dns) { throw [System.Net.WebException]::new('DNS', [System.Net.WebExceptionStatus]::NameResolutionFailure) }
        $network = Invoke-UnauthenticatedHead -Uri $uri -TimeoutSeconds $TimeoutSeconds
        $state = Get-PreflightCheckState -Category $Category -NetworkState $network.State
        Add-PreflightCheck -Category $Category -Name $Label -State $state -Summary $network.Summary
        if ($uri.Scheme -ne 'https') { Add-PreflightCheck -Category $Category -Name "$Label TLS" -State 'AVISO' -Summary 'Endpoint configurado usa HTTP; nenhuma configuração foi alterada.' }
    } catch {
        $kind = Get-PreflightFailureKind -Exception $_.Exception
        if ($kind -eq 'unknown') { $kind = 'dns' }
        $network = New-PreflightNetworkResult -FailureKind $kind
        $state = Get-PreflightCheckState -Category $Category -NetworkState $network.State
        Add-PreflightCheck -Category $Category -Name $Label -State $state -Summary $network.Summary
    }
}
$isWindowsPlatform = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
if ($isWindowsPlatform) { Add-PreflightCheck 'Sistema' 'Windows' 'APROVADO' "Sistema Windows detectado (versão $([Environment]::OSVersion.Version))." }
else { Add-PreflightCheck 'Sistema' 'Windows' 'BLOQUEADO' 'Este pacote de instalação foi preparado para Windows.' }
Add-PreflightCheck 'Ferramentas' 'PowerShell' 'APROVADO' "PowerShell $($PSVersionTable.PSVersion) em execução."
if (-not [Environment]::Is64BitOperatingSystem) { Add-PreflightCheck 'Sistema' 'Arquitetura' 'BLOQUEADO' 'O produto requer Windows 64 bits.' }
else { Add-PreflightCheck 'Sistema' 'Arquitetura' 'APROVADO' "Processo $env:PROCESSOR_ARCHITECTURE em Windows 64 bits." }

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) { Add-PreflightCheck 'Ferramentas' 'Node.js' 'BLOQUEADO' 'Node.js 24 LTS não está no PATH.' }
else {
    $nodeVersionText = ''
    try { $nodeVersionText = (& $nodeCommand.Source --version 2>$null).Trim() } catch { }
    $nodeMatch = [regex]::Match($nodeVersionText, '^v(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)')
    $nodeSupported = $false
    if ($nodeMatch.Success) { $major = [int]$nodeMatch.Groups['major'].Value; $minor = [int]$nodeMatch.Groups['minor'].Value; $nodeSupported = ($major -eq 24 -and $minor -ge 6) -or ($major -eq 22 -and $minor -ge 21) }
    if ($nodeSupported) {
        Add-PreflightCheck 'Ferramentas' 'Node.js' 'APROVADO' "Versão $nodeVersionText compatível com a faixa requerida pelo toolchain."
        & $nodeCommand.Source -e 'process.exit(0)' 2>$null
        if ($LASTEXITCODE -eq 0) { Add-PreflightCheck 'Políticas' 'Subprocesso Node.js' 'APROVADO' 'Execução básica de subprocesso Node.js permitida.' }
        else { Add-PreflightCheck 'Políticas' 'Subprocesso Node.js' 'BLOQUEADO' 'O Windows ou uma política local bloqueou a execução de Node.js.' }
        & $nodeCommand.Source --use-env-proxy -e 'process.exit(0)' 2>$null
        if ($LASTEXITCODE -eq 0) { Add-PreflightCheck 'Rede' 'Proxy do Node.js' 'APROVADO' 'Node.js reconhece HTTP_PROXY, HTTPS_PROXY e NO_PROXY; o serviço repassa essas variáveis sem imprimi-las. Clientes com transporte próprio ainda requerem validação individual.' }
        else { Add-PreflightCheck 'Rede' 'Proxy do Node.js' 'BLOQUEADO' 'Node.js não reconheceu o suporte oficial a proxy deste pacote.' }
    } else { Add-PreflightCheck 'Ferramentas' 'Node.js' 'BLOQUEADO' 'Requer Node.js 24.6.x ou superior na linha 24, ou Node.js 22.21.x ou superior na linha 22.' }
}

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) { Add-PreflightCheck 'Ferramentas' 'npm' 'BLOQUEADO' 'npm.cmd não está no PATH.' }
else {
    $npmVersionText = ''
    try { $npmVersionText = (& $npmCommand.Source --version 2>$null | Select-Object -Last 1).Trim() } catch { }
    $npmMatch = [regex]::Match($npmVersionText, '^(?<major>\d+)\.(?<minor>\d+)')
    if ($npmMatch.Success -and [int]$npmMatch.Groups['major'].Value -ge 9) { Add-PreflightCheck 'Ferramentas' 'npm' 'APROVADO' "npm $npmVersionText disponível." }
    else { Add-PreflightCheck 'Ferramentas' 'npm' 'BLOQUEADO' 'Requer npm 9 ou superior.' }
    $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if ($npxCommand) { Add-PreflightCheck 'Ferramentas' 'npx' 'APROVADO' 'npx.cmd disponível com a instalação atual do Node.js/npm.' }
    else { Add-PreflightCheck 'Ferramentas' 'npx' 'BLOQUEADO' 'npx.cmd não está no PATH.' }

    $gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($gitCommand) {
        $gitVersionText = (& $gitCommand.Source --version 2>$null | Select-Object -Last 1).Trim()
        Add-PreflightCheck 'Ferramentas' 'Git' 'APROVADO' "$gitVersionText disponível."
    } else { Add-PreflightCheck 'Ferramentas' 'Git' 'BLOQUEADO' 'Git não está no PATH; é necessário para clonar e atualizar.' }

    $registry = Get-NpmValue 'registry'
    $registryUri = $null
    try { $registryUri = [Uri]$registry } catch { }
    if ($registryUri -and $registryUri.IsAbsoluteUri) {
        Add-PreflightCheck 'Rede' 'Registry npm configurado' 'INFORMATIVO' "Scheme $($registryUri.Scheme); host oculto no relatório."
        $registryProbe = [UriBuilder]::new($registryUri); $registryProbe.UserName = ''; $registryProbe.Password = ''; $registryProbe.Path = '/'; $registryProbe.Query = ''; $registryProbe.Fragment = ''
        Test-Endpoint -Label 'Registry npm' -RawUri $registryProbe.Uri.AbsoluteUri -TimeoutSeconds $NetworkTimeoutSeconds
    } else { Add-PreflightCheck 'Rede' 'Registry npm configurado' 'BLOQUEADO' 'Não foi possível interpretar o registry configurado. O valor foi ocultado.' }

    $strictSsl = Get-NpmValue 'strict-ssl'
    if ($strictSsl -and $strictSsl.ToLowerInvariant() -eq 'false') { Add-PreflightCheck 'TLS' 'Validação npm' 'BLOQUEADO' 'npm strict-ssl está desativado; o preflight não alterará a configuração.' }
    else { Add-PreflightCheck 'TLS' 'Validação npm' 'APROVADO' 'Validação TLS do npm não está explicitamente desativada.' }
    $cafile = Get-NpmValue 'cafile'
    $caConfigured = (Test-ConfiguredBoolean $env:NODE_EXTRA_CA_CERTS) -or ($env:NODE_USE_SYSTEM_CA -eq '1') -or (Test-ConfiguredBoolean $env:SSL_CERT_FILE) -or (Test-ConfiguredBoolean $env:SSL_CERT_DIR) -or (Test-ConfiguredBoolean $cafile)
    $caSummary = if ($caConfigured) { 'Configuração adicional de CA detectada; valores e caminhos ocultados.' } else { 'Nenhuma configuração adicional de CA detectada.' }
    Add-PreflightCheck 'TLS' 'CA adicional' 'INFORMATIVO' $caSummary
    if ($env:NODE_TLS_REJECT_UNAUTHORIZED -eq '0') { Add-PreflightCheck 'TLS' 'Validação TLS do Node.js' 'BLOQUEADO' 'NODE_TLS_REJECT_UNAUTHORIZED está configurado para desativar validação. O valor não foi exibido.' }
}

$proxyConfigured = (Test-ConfiguredBoolean $env:HTTPS_PROXY) -or (Test-ConfiguredBoolean $env:https_proxy) -or (Test-ConfiguredBoolean $env:HTTP_PROXY) -or (Test-ConfiguredBoolean $env:http_proxy) -or (Test-ConfiguredBoolean (Get-NpmValue 'https-proxy')) -or (Test-ConfiguredBoolean (Get-NpmValue 'proxy'))
$proxySummary = if ($proxyConfigured) { 'Proxy configurado detectado; endereços e credenciais ocultados.' } else { 'Nenhum proxy de ambiente ou npm detectado; configuração de sistema não foi alterada.' }
Add-PreflightCheck 'Rede' 'Proxy' 'INFORMATIVO' $proxySummary
if ($proxyConfigured -and $env:NODE_USE_ENV_PROXY -eq '0') { Add-PreflightCheck 'Rede' 'Proxy do serviço' 'BLOQUEADO' 'NODE_USE_ENV_PROXY está explicitamente desativado enquanto há proxy configurado; o valor não foi alterado.' }
if ($SkipAzureEndpointChecks) {
    Add-PreflightCheck 'Rede' 'Azure endpoints' 'INFORMATIVO' 'Teste omitido por opção. Nenhum endpoint Azure foi acessado nesta execução.'
} else {
    Test-Endpoint -Label 'Azure sign-in' -RawUri 'https://login.microsoftonline.com/' -TimeoutSeconds $NetworkTimeoutSeconds -Category 'Rede opcional'
    Test-Endpoint -Label 'Azure Resource Manager' -RawUri 'https://management.azure.com/' -TimeoutSeconds $NetworkTimeoutSeconds -Category 'Rede opcional'
}
Test-Endpoint -Label 'MCP Registry opcional' -RawUri 'https://registry.modelcontextprotocol.io/' -TimeoutSeconds $NetworkTimeoutSeconds 'Rede opcional'

$policies = Get-ExecutionPolicy -List
$effectivePolicy = Get-ExecutionPolicy
$policyEnforced = $policies | Where-Object { $_.Scope -in @('MachinePolicy', 'UserPolicy') -and $_.ExecutionPolicy -ne 'Undefined' } | Select-Object -First 1
$signatureStatus = 'Unknown'
try { $signatureStatus = (Get-AuthenticodeSignature -FilePath $PSCommandPath).Status.ToString() } catch { }
if ($effectivePolicy -eq 'Restricted' -or ($effectivePolicy -eq 'AllSigned' -and $signatureStatus -ne 'Valid')) { Add-PreflightCheck 'Políticas' 'PowerShell ExecutionPolicy' 'BLOQUEADO' 'A política efetiva requer assinatura aprovada ou impede scripts. Contate a equipe responsável; nenhum bypass será sugerido ou aplicado.' }
else {
    $policyName = if ($policyEnforced) { "política corporativa efetiva $effectivePolicy" } else { "política efetiva $effectivePolicy" }
    Add-PreflightCheck 'Políticas' 'PowerShell ExecutionPolicy' 'APROVADO' "$policyName; nenhuma política foi alterada."
}

if (Test-WriteAccessInCheckout) { Add-PreflightCheck 'Permissões' 'Checkout' 'APROVADO' 'Usuário atual pode criar e remover um arquivo temporário de prova no checkout.' }
else { Add-PreflightCheck 'Permissões' 'Checkout' 'BLOQUEADO' 'Usuário atual não conseguiu criar um arquivo temporário no checkout.' }
$driveRoot = [System.IO.Path]::GetPathRoot($PSScriptRoot)
$driveName = $driveRoot.TrimEnd('\').TrimEnd(':')
$drive = Get-PSDrive -Name $driveName -ErrorAction SilentlyContinue
if ($drive) {
    $freeGiB = [Math]::Round($drive.Free / 1GB, 1)
    if ($drive.Free -lt 1GB) { Add-PreflightCheck 'Sistema' 'Espaço livre' 'AVISO' "Unidade do checkout tem aproximadamente $freeGiB GiB livres; npm ci/build podem precisar de mais." }
    else { Add-PreflightCheck 'Sistema' 'Espaço livre' 'APROVADO' "Unidade do checkout tem aproximadamente $freeGiB GiB livres." }
} else { Add-PreflightCheck 'Sistema' 'Espaço livre' 'AVISO' 'Não foi possível consultar espaço livre da unidade.' }
$portState = Get-ListeningPortState $Port
if ($portState -eq 'disponível') { Add-PreflightCheck 'Rede local' 'Porta de aplicação' 'APROVADO' "Porta local $Port não aparece ocupada; nenhum serviço local foi consultado." }
elseif ($portState -eq 'ocupada') { Add-PreflightCheck 'Rede local' 'Porta de aplicação' 'AVISO' "Porta local $Port está em uso. Preflight não consultou, parou ou reiniciou o processo; start.ps1 poderá exigir outra porta." }
else { Add-PreflightCheck 'Rede local' 'Porta de aplicação' 'AVISO' "Não foi possível determinar se a porta $Port está disponível." }

$operationalDataPath = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'AzureCostLocal' } else { '' }
if ($operationalDataPath -and (Test-Path -LiteralPath $operationalDataPath)) { Add-PreflightCheck 'Dados operacionais' 'Armazenamento existente' 'INFORMATIVO' 'Diretório de dados existente detectado. Preflight não leu conteúdo, não avaliou ACLs e não alterou armazenamento.' }
else { Add-PreflightCheck 'Dados operacionais' 'Armazenamento existente' 'INFORMATIVO' 'Nenhum diretório de dados do produto observado neste contexto. Nenhum diretório foi criado.' }
$nativePath = Join-Path $PSScriptRoot 'node_modules\koffi'
if (Test-Path -LiteralPath $nativePath) {
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        & $nodeCommand.Source -e 'require("koffi")' 2>$null
        if ($LASTEXITCODE -eq 0) { Add-PreflightCheck 'Componentes nativos' 'koffi' 'APROVADO' 'Componente nativo instalado carregou neste Windows.' }
        else { Add-PreflightCheck 'Componentes nativos' 'koffi' 'BLOQUEADO' 'Componente nativo instalado não carregou; revise política npm de scripts/binários com a equipe responsável.' }
    }
} else { Add-PreflightCheck 'Componentes nativos' 'koffi' 'INFORMATIVO' 'Ainda não instalado. O instalador verificará o carregamento após npm ci; nenhum script npm foi aprovado automaticamente.' }

$package = Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json
$reportLines = [System.Collections.Generic.List[string]]::new()
$reportLines.Add('Tesseract — diagnóstico técnico de pré-instalação')
$reportLines.Add("Data/hora local: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))")
$reportLines.Add("Versão candidata: $($package.version)")
$reportLines.Add('Privacidade: caminhos de usuário, hostnames, URLs completas, credenciais, tokens, cookies e conteúdo de certificados não são registrados.')
$reportLines.Add('')
foreach ($check in $checks) {
    $line = "[$($check.State)] $($check.Category) — $($check.Name): $($check.Summary)"
    Write-Host $line
    $reportLines.Add($line)
}
$reportLines.Add('')
$reportLines.Add('Limites: não testa tenant, RBAC, credenciais, conexões MCP cadastradas nem todos os endpoints customizados.')
$reportLines.Add('Reachability usa HEAD sem Authorization; nenhuma autenticação no Azure, registry npm ou MCP Registry foi feita.')

if ($ExportReport -or $ReportPath) {
    $destination = $ReportPath
    if (-not $destination) {
        $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
        $destination = Join-Path ([System.IO.Path]::GetTempPath()) "tesseract-preflight-$stamp.txt"
        $suffix = 1
        while (Test-Path -LiteralPath $destination) { $destination = Join-Path ([System.IO.Path]::GetTempPath()) "tesseract-preflight-$stamp-$('{0:D2}' -f $suffix).txt"; $suffix++ }
    }
    $fullPath = [System.IO.Path]::GetFullPath($destination)
    if (Test-Path -LiteralPath $fullPath) { throw 'O destino do relatório já existe; nada foi sobrescrito.' }
    $parent = Split-Path -Parent $fullPath
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) { throw 'A pasta escolhida para exportar o relatório não existe.' }
    $writer = $null
    try {
        $writer = [System.IO.File]::Open($fullPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes(($reportLines -join [Environment]::NewLine))
        $writer.Write($bytes, 0, $bytes.Length)
        Write-Host "Relatório sanitizado exportado: $fullPath"
    } finally { if ($writer) { $writer.Dispose() } }
}

$blocked = @($checks | Where-Object State -eq 'BLOQUEADO')
if ($blocked.Count -gt 0) { throw "Pré-validação encontrou $($blocked.Count) bloqueio(s). Consulte os itens [BLOQUEADO]; nenhuma política ou configuração foi alterada." }
Write-Host 'Pré-validação concluída. Avisos indicam condições a confirmar com a infraestrutura; nenhum acesso Azure ou credencial foi usado.'
