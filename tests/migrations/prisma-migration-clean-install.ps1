[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$statusBefore = @(& git -C $repoRoot status --porcelain=v1)
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("fulishe-m0-010-{0}" -f [guid]::NewGuid().ToString('N'))

$rootFiles = @(
    '.editorconfig',
    '.env.example',
    '.gitattributes',
    '.gitignore',
    '.node-version',
    '.npmrc',
    '.nvmrc',
    'compose.yaml',
    'eslint.config.mjs',
    'package.json',
    'playwright.config.ts',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.base.json',
    'tsconfig.openapi.json',
    'tsconfig.tests.json',
    'turbo.json',
    'vitest.config.ts',
    'vitest.report.config.ts'
)

function Copy-MigrationFoundationFile {
    param([Parameter(Mandatory)] [string] $RelativePath)

    $source = Join-Path $repoRoot $RelativePath
    $destination = Join-Path $tempRoot $RelativePath
    $destinationDirectory = Split-Path $destination -Parent
    if (-not (Test-Path -LiteralPath $destinationDirectory)) {
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }
    Copy-Item -LiteralPath $source -Destination $destination
}

try {
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    foreach ($relativePath in $rootFiles) {
        Copy-MigrationFoundationFile $relativePath
    }

    foreach ($sourceDirectory in @('apps', 'packages', 'scripts', 'tests', 'docs\architecture', 'docs\testing')) {
        $fullSourceDirectory = Join-Path $repoRoot $sourceDirectory
        Get-ChildItem -LiteralPath $fullSourceDirectory -Recurse -File |
            Where-Object {
                $_.FullName -notmatch '[\/](dist|node_modules|coverage|\.next|\.turbo|\.cache|artifacts)[\/]'
            } |
            ForEach-Object {
                if (-not $_.FullName.StartsWith(($repoRoot + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) {
                    throw "拒绝复制仓库外文件：$($_.FullName)"
                }
                $relativePath = $_.FullName.Substring($repoRoot.Length + 1)
                Copy-MigrationFoundationFile $relativePath
            }
    }

    Push-Location $tempRoot
    try {
        & git init --quiet
        if ($LASTEXITCODE -ne 0) { throw "临时Git仓库初始化失败：$LASTEXITCODE" }
        & git config user.email 'm0-010@example.invalid'
        & git config user.name 'M0-010 Clean Install'
        & git add -- .
        if ($LASTEXITCODE -ne 0) { throw "临时Git仓库暂存失败：$LASTEXITCODE" }
        & git commit --quiet -m 'M0-010 clean-install baseline'
        if ($LASTEXITCODE -ne 0) { throw "临时Git仓库提交失败：$LASTEXITCODE" }

        & pnpm install --frozen-lockfile --ignore-scripts --prefer-offline
        if ($LASTEXITCODE -ne 0) { throw "干净目录冻结安装失败：$LASTEXITCODE" }

        foreach ($scriptName in @(
            'prisma:validate',
            'prisma:migrations:check',
            'test:migrations',
            'lint',
            'typecheck',
            'build',
            'prisma:migrate:dry-run'
        )) {
            & pnpm $scriptName
            if ($LASTEXITCODE -ne 0) {
                throw "干净目录命令失败：pnpm $scriptName，exit=$LASTEXITCODE"
            }
        }
    } finally {
        Pop-Location
    }
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        $resolvedTemp = (Resolve-Path -LiteralPath $tempRoot).Path
        if (-not $resolvedTemp.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
            throw "拒绝清理非系统临时目录：$resolvedTemp"
        }
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
}

$statusAfter = @(& git -C $repoRoot status --porcelain=v1)
if (($statusBefore -join "`n") -ne ($statusAfter -join "`n")) {
    throw 'M0-010干净安装测试改变了原仓库工作树。'
}

Write-Output 'M0-010干净安装测试通过：冻结安装、迁移完整性、契约、lint、typecheck、构建和真实三库演练均可从零复现。'
