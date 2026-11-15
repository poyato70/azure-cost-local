param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 4317,
    [ValidateRange(5, 300)]
    [int]$StartupTimeoutSeconds = 60,
    [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
if ($SkipBuild) {
    & (Join-Path $PSScriptRoot 'service.ps1') -Action start -Port $Port -StartupTimeoutSeconds $StartupTimeoutSeconds -SkipBuild
} else {
    & (Join-Path $PSScriptRoot 'service.ps1') -Action start -Port $Port -StartupTimeoutSeconds $StartupTimeoutSeconds
}
