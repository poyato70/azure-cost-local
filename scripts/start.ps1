param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 4317,
    [ValidateRange(5, 300)]
    [int]$StartupTimeoutSeconds = 60,
    [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ($SkipBuild) {
    & (Join-Path $root 'start.ps1') -Port $Port -StartupTimeoutSeconds $StartupTimeoutSeconds -SkipBuild
} else {
    & (Join-Path $root 'start.ps1') -Port $Port -StartupTimeoutSeconds $StartupTimeoutSeconds
}
