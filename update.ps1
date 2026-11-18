$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectDirectory = (Resolve-Path -LiteralPath $PSScriptRoot).Path.TrimEnd('\')
Push-Location -LiteralPath $projectDirectory
$checkDirectory = $null
try {
    if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory '.git'))) { throw 'Atualização automática requer clone Git. Atualize o checkout após revisar as alterações.' }
    $branch = (& git branch --show-current).Trim()
    if ($branch -ne 'main') { throw "Atualização bloqueada na branch '$branch'. Mude para main após revisar a versão publicada." }
    if ((& git status --porcelain).Length -gt 0) { throw 'Há alterações locais. Salve ou resolva-as antes de atualizar.' }

    # Não atualiza código sob um processo local que esteja usando o entrypoint deste checkout.
    $entryPoint = Join-Path $projectDirectory 'dist\server\main.js'
    $active = Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
        $_.Name -ieq 'node.exe' -and $_.CommandLine -and $_.CommandLine.IndexOf($entryPoint, [StringComparison]::OrdinalIgnoreCase) -ge 0
    } | Select-Object -First 1
    if ($active) { throw "Atualização recusada: serviço deste checkout ativo (PID $($active.ProcessId)). Pare-o normalmente antes de atualizar." }

    & git fetch origin main
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao buscar main remota.' }
    $current = (& git rev-parse HEAD).Trim()
    $target = (& git rev-parse origin/main).Trim()
    & git merge-base --is-ancestor $current $target
    if ($LASTEXITCODE -ne 0) { throw 'Atualização não é fast-forward. Nenhum arquivo foi alterado.' }
    if ($current -eq $target) { Write-Host 'Tesseract já está atualizado.'; return }

    $checkDirectory = Join-Path ([IO.Path]::GetTempPath()) ('tesseract-update-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $checkDirectory | Out-Null
    & git worktree add --detach $checkDirectory $target
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível preparar cópia temporária para validar a atualização.' }
    Push-Location -LiteralPath $checkDirectory
    try {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências da versão candidata.' }
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Falha no build da versão candidata; o checkout atual foi preservado.' }
    } finally { Pop-Location }

    & git worktree remove --force $checkDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao remover worktree temporário; atualização não aplicada.' }
    $checkDirectory = $null
    & git merge --ff-only $target
    if ($LASTEXITCODE -ne 0) { throw 'Fast-forward falhou; verifique o estado do checkout.' }
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'A fonte foi atualizada; reinstalação local falhou. Reexecute install.ps1 após revisar o estado.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'A fonte foi atualizada, mas o build local falhou. Reexecute install.ps1 após revisar o estado.' }
    Write-Host 'Tesseract atualizado, dependências instaladas e build local concluído.'
} finally {
    if ($checkDirectory -and (Test-Path -LiteralPath $checkDirectory)) {
        & git worktree remove --force $checkDirectory 2>$null
    }
    Pop-Location
}
