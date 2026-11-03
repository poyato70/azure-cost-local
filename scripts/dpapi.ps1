$ErrorActionPreference = 'Stop'
try {
    $inputData = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($inputData.operation -eq 'acl') {
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $icacls = Join-Path $env:SystemRoot 'System32/icacls.exe'
        & $icacls $inputData.path '/inheritance:r' '/grant:r' ('*' + $sid.Value + ':(OI)(CI)F') | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'ACL failed' }
        [Console]::Out.Write('ok')
    } else {
        Add-Type -AssemblyName System.Security
        $bytes = [Convert]::FromBase64String($inputData.data)
        $scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
        if ($inputData.operation -eq 'protect') {
            $result = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, $scope)
        } elseif ($inputData.operation -eq 'unprotect') {
            $result = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, $scope)
        } else { throw 'Unsupported operation' }
        [Console]::Out.Write([Convert]::ToBase64String($result))
    }
} catch {
    [Console]::Error.Write('Windows data protection failed')
    exit 1
}
