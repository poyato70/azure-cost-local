param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d{2}$')]
    [string] $Mission,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string] $Title
)

$ErrorActionPreference = 'Stop'
$reportsPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'docs/relatorios'
$templatePath = Join-Path $reportsPath 'TEMPLATE.md'
$reportPath = Join-Path $reportsPath "missao-$Mission.md"

if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
    throw "Template de relatório não encontrado: $templatePath"
}
if (Test-Path -LiteralPath $reportPath) {
    throw "O relatório já existe e não será sobrescrito: $reportPath"
}

$startedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
$content = Get-Content -LiteralPath $templatePath -Raw
$content = $content.Replace('{{MISSION}}', $Mission)
$content = $content.Replace('{{TITLE}}', $Title.Trim())
$content = $content.Replace('{{STARTED_AT}}', $startedAt)
Set-Content -LiteralPath $reportPath -Value $content -Encoding utf8NoBOM
Write-Output "Relatório criado: $reportPath"
