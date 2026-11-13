$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location -LiteralPath $projectDirectory
try {
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Node.js e npm precisam estar instalados e disponíveis no PATH.' }
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Falha na instalação reproduzível das dependências.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Falha no build do Tesseract.' }
    Write-Host 'Instalação concluída. Nenhum servidor MCP externo foi instalado.'
    Write-Host 'Use .\start.ps1 para iniciar o Tesseract.'
} finally { Pop-Location }
