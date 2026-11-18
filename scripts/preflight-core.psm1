Set-StrictMode -Version Latest

function Get-SafeEndpointLabel {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Value)
    try {
        $uri = [Uri]$Value
        if (-not $uri.IsAbsoluteUri -or $uri.Scheme -notin @('http', 'https')) { return 'endpoint inválido' }
        $port = if (($uri.Scheme -eq 'https' -and $uri.Port -ne 443) -or ($uri.Scheme -eq 'http' -and $uri.Port -ne 80)) { ":$($uri.Port)" } else { '' }
        return "$($uri.Scheme)://$($uri.DnsSafeHost)$port"
    } catch { return 'endpoint inválido' }
}

function Get-PreflightFailureKind {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][System.Exception]$Exception)
    $current = $Exception
    while ($current) {
        if ($current -is [System.Net.WebException]) {
            switch ($current.Status.ToString()) {
                { $_ -in @('ProxyNameResolutionFailure', 'ProxyConnectFailure') } { return 'proxy' }
                'NameResolutionFailure' { return 'dns' }
                { $_ -in @('TrustFailure', 'SecureChannelFailure') } { return 'tls' }
                { $_ -in @('Timeout', 'RequestCanceled') } { return 'timeout' }
                { $_ -in @('ConnectFailure', 'ConnectionClosed', 'KeepAliveFailure') } { return 'connection' }
            }
        }
        if ($current -is [System.Security.Authentication.AuthenticationException]) { return 'tls' }
        $current = $current.InnerException
    }
    return 'unknown'
}

function New-PreflightNetworkResult {
    [CmdletBinding()]
    param(
        [int]$StatusCode = 0,
        [ValidateSet('proxy', 'dns', 'tls', 'timeout', 'connection', 'unknown', '')]
        [string]$FailureKind = ''
    )
    if ($StatusCode -ge 200 -and $StatusCode -lt 400) { return [pscustomobject]@{ State = 'APROVADO'; Summary = "Destino respondeu HTTP $StatusCode sem autenticação." } }
    if ($StatusCode -in @(401, 403)) { return [pscustomobject]@{ State = 'AVISO'; Summary = "Destino alcançável; HTTP $StatusCode indica autenticação ou autorização. Nenhuma credencial foi enviada." } }
    if ($StatusCode -eq 407) { return [pscustomobject]@{ State = 'AVISO'; Summary = 'Destino alcançável, mas o proxy exige autenticação que este diagnóstico não fornece.' } }
    if ($StatusCode -ge 400 -and $StatusCode -lt 600) { return [pscustomobject]@{ State = 'AVISO'; Summary = "Destino respondeu HTTP $StatusCode sem autenticação." } }
    switch ($FailureKind) {
        'proxy' { return [pscustomobject]@{ State = 'BLOQUEADO'; Summary = 'Falha ao resolver ou conectar ao proxy configurado.' } }
        'dns' { return [pscustomobject]@{ State = 'BLOQUEADO'; Summary = 'Falha de resolução DNS para o destino.' } }
        'tls' { return [pscustomobject]@{ State = 'BLOQUEADO'; Summary = 'Falha na negociação TLS ou validação do certificado.' } }
        'timeout' { return [pscustomobject]@{ State = 'BLOQUEADO'; Summary = 'Tempo limite de conectividade excedido.' } }
        'connection' { return [pscustomobject]@{ State = 'BLOQUEADO'; Summary = 'A conexão foi recusada ou encerrada.' } }
        default { return [pscustomobject]@{ State = 'BLOQUEADO'; Summary = 'Falha de rede não classificada; consulte a equipe de infraestrutura.' } }
    }
}

function Get-PreflightCheckState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][ValidateSet('Rede', 'Rede opcional')][string]$Category,
        [Parameter(Mandatory = $true)][ValidateSet('APROVADO', 'AVISO', 'BLOQUEADO', 'INFORMATIVO')][string]$NetworkState
    )
    if ($Category -eq 'Rede opcional' -and $NetworkState -eq 'BLOQUEADO') { return 'AVISO' }
    return $NetworkState
}
Export-ModuleMember -Function Get-SafeEndpointLabel, Get-PreflightFailureKind, New-PreflightNetworkResult, Get-PreflightCheckState
