param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 4317
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
& (Join-Path $root 'stop.ps1') -Port $Port
