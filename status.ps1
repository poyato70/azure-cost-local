param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 4317
)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'service.ps1') -Action status -Port $Port
