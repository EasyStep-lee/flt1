[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

$requiredFiles = @(
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'turbo.json',
    '.npmrc',
    '.node-version',
    '.nvmrc',
    '.gitignore',
    '.editorconfig',
    '.gitattributes',
    'README.md',
    'CONTRIBUTING.md',
    'apps\README.md',
    'packages\README.md',
    'docs\architecture\WORKSPACE_LAYOUT.md',
    'scripts\verify-workspace-foundation.mjs'
)
foreach ($relativePath in $requiredFiles) {
    $fullPath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "缺少M0-004工作区文件：$relativePath"
    }
}

$packageJson = Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($packageJson.name -ne '@fulishe/root') { throw '根包名称必须为@fulishe/root。' }
if ($packageJson.private -ne $true) { throw '根包必须private=true，禁止误发布。' }
if ($packageJson.packageManager -ne 'pnpm@10.12.1') { throw 'packageManager必须精确锁定pnpm@10.12.1。' }
if ($packageJson.engines.node -ne '22.23.1') { throw 'Node engines必须精确锁定22.23.1。' }
if ($packageJson.engines.pnpm -ne '10.12.1') { throw 'pnpm engines必须精确锁定10.12.1。' }
if ($packageJson.devDependencies.turbo -ne '2.10.8') { throw 'Turborepo必须精确锁定2.10.8。' }
if (-not $packageJson.scripts.'workspace:check') { throw '缺少workspace:check脚本。' }
if (-not $packageJson.scripts.'workspace:graph') { throw '缺少workspace:graph脚本。' }
if ($packageJson.scripts.verify -ne 'node ./scripts/run-verification.mjs') {
    throw 'M0-011完成后根级verify必须精确指向run-verification.mjs。'
}

$workspaceText = Get-Content -LiteralPath (Join-Path $repoRoot 'pnpm-workspace.yaml') -Raw -Encoding UTF8
foreach ($glob in @("'apps/*'", "'packages/*'")) {
    if ($workspaceText -notmatch [regex]::Escape($glob)) { throw "pnpm workspace缺少范围：$glob" }
}

$turbo = Get-Content -LiteralPath (Join-Path $repoRoot 'turbo.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($task in @('build','dev','lint','typecheck','test')) {
    if ($null -eq $turbo.tasks.$task) { throw "turbo.json缺少任务定义：$task" }
}
if ($null -ne $turbo.tasks.verify) { throw 'M0-004不得提前定义空壳verify任务。' }

if ((Get-Content -LiteralPath (Join-Path $repoRoot '.node-version') -Raw -Encoding UTF8).Trim() -ne '22.23.1') {
    throw '.node-version不正确。'
}
if ((Get-Content -LiteralPath (Join-Path $repoRoot '.nvmrc') -Raw -Encoding UTF8).Trim() -ne '22.23.1') {
    throw '.nvmrc不正确。'
}

$statusBefore = @(& git -C $repoRoot status --porcelain=v1)
$nodeExe = (Get-Command node -ErrorAction Stop).Source
& $nodeExe (Join-Path $repoRoot 'scripts\verify-workspace-foundation.mjs') --root $repoRoot
if ($LASTEXITCODE -ne 0) { throw "工作区契约校验失败：$LASTEXITCODE" }

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("fulishe-workspace-{0}" -f [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    foreach ($relativePath in $requiredFiles) {
        $sourcePath = Join-Path $repoRoot $relativePath
        $targetPath = Join-Path $tempRoot $relativePath
        $targetDirectory = Split-Path $targetPath -Parent
        if (-not (Test-Path -LiteralPath $targetDirectory)) {
            New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
        }
        Copy-Item -LiteralPath $sourcePath -Destination $targetPath
    }

    Push-Location $tempRoot
    try {
        & pnpm install --frozen-lockfile --ignore-scripts --prefer-offline
        if ($LASTEXITCODE -ne 0) { throw "干净目录冻结安装失败：$LASTEXITCODE" }

        $turboVersion = @(& pnpm exec turbo --version)
        if ($LASTEXITCODE -ne 0 -or ($turboVersion | Select-Object -Last 1).Trim() -ne '2.10.8') {
            throw "Turborepo版本验证失败：$($turboVersion -join ' ')"
        }

        & $nodeExe '.\scripts\verify-workspace-foundation.mjs' --root $tempRoot
        if ($LASTEXITCODE -ne 0) { throw "干净目录工作区契约校验失败：$LASTEXITCODE" }

        $env:TURBO_TELEMETRY_DISABLED = '1'
        $dryRun = @(& pnpm exec turbo run build --dry=json 2>$null)
        if ($LASTEXITCODE -ne 0) { throw "Turborepo任务图dry-run失败：$($dryRun -join ' ')" }
        $dryJson = ($dryRun -join "`n") | ConvertFrom-Json
        if (@($dryJson.tasks).Count -ne 0) { throw 'M0-004不应伪造尚未创建的应用构建任务。' }
    } finally {
        Pop-Location
    }
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        $resolvedTemp = (Resolve-Path -LiteralPath $tempRoot).Path
        $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
        if (-not $resolvedTemp.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
            throw "拒绝清理非临时目录：$resolvedTemp"
        }
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
}

$statusAfter = @(& git -C $repoRoot status --porcelain=v1)
if (($statusBefore -join "`n") -ne ($statusAfter -join "`n")) { throw '工作区测试改变了仓库工作树。' }

Write-Host 'M0-004工作区测试通过：版本锁定、目录职责、冻结安装和Turbo任务图均可复核。' -ForegroundColor Green
