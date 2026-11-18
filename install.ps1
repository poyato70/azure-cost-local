param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 4317,
    [switch]$SkipAzureEndpointChecks
)
$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path -LiteralPath $PSScriptRoot).Path.TrimEnd('\')
Push-Location -LiteralPath $projectDirectory
try {
    & (Join-Path $projectDirectory 'preflight.ps1') -Port $Port -SkipAzureEndpointChecks:$SkipAzureEndpointChecks

    $metadataDirectory = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'AzureCostLocal\instances' } else { '' }
    if ($metadataDirectory -and (Test-Path -LiteralPath $metadataDirectory)) {
        $entryPoint = Join-Path $projectDirectory 'dist/server/main.js'
        foreach ($file in Get-ChildItem -LiteralPath $metadataDirectory -Filter 'service.json' -File -Recurse -ErrorAction SilentlyContinue) {
            try {
                $metadata = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
                if ([string]$metadata.projectRoot -ieq $projectDirectory -and $metadata.pid -gt 0) {
                    $process = $null
                    if (Get-Process -Id $metadata.pid -ErrorAction SilentlyContinue) {
                        try { $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($metadata.pid)" -ErrorAction Stop }
                        catch { throw "Não foi possível verificar a linha de comando do PID $($metadata.pid). O instalador interrompeu para preservar o processo." }
                        if (-not $process -or -not $process.CommandLine) { throw "O Windows não forneceu a linha de comando do PID $($metadata.pid). Nenhum processo foi alterado." }
                    }
                    if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine.IndexOf($entryPoint, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                        throw "O serviço deste checkout está ativo (PID $($metadata.pid), porta $($metadata.port)). Pare-o com .\stop.ps1 antes de reinstalar."
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

    $npmCommand = Get-Command npm.cmd -ErrorAction Stop
    Write-Host 'Instalando as dependências declaradas em package-lock.json com npm ci, respeitando registry, proxy, certificados e políticas já configurados…'
    & $npmCommand.Source ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci falhou. Confira a saída sanitizada do npm e valide registry, proxy, certificados ou políticas com o suporte corporativo. Nenhuma configuração foi alterada.' }

    & $npmCommand.Source run build
    if ($LASTEXITCODE -ne 0) { throw 'Build de produção falhou. Nenhuma credencial ou política foi alterada.' }

    $requiredArtifacts = @('dist/server/main.js', 'dist/web/index.html')
    foreach ($relativePath in $requiredArtifacts) {
        $artifact = Join-Path $projectDirectory $relativePath
        if (-not (Test-Path -LiteralPath $artifact -PathType Leaf) -or (Get-Item -LiteralPath $artifact).Length -eq 0) {
            throw "Artefato de produção ausente ou vazio: $relativePath. A instalação não será declarada concluída."
        }
    }
    $webAssets = Get-ChildItem -LiteralPath (Join-Path $projectDirectory 'dist/web/_next/static') -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $webAssets) { throw 'Build não gerou arquivos estáticos web em dist/web/_next/static.' }

    & (Get-Command node.exe -ErrorAction Stop).Source -e 'require("koffi")'
    if ($LASTEXITCODE -ne 0) { throw 'O módulo nativo koffi não carregou. Peça à equipe responsável para revisar a política de scripts e binários npm; o Tesseract não aprova scripts automaticamente.' }

    Write-Host 'Instalação e build concluídos. Nenhum servidor MCP externo foi instalado e nenhum processo Node existente foi iniciado ou encerrado.'
    Write-Host "Para iniciar: .\start.ps1 -Port $Port"
} finally { Pop-Location }
