[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$statusBefore = @(& git -C $repoRoot status --porcelain=v1)
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("fulishe-m0-009-{0}" -f [guid]::NewGuid().ToString('N'))

$rootFiles = @(
    '.env.example',
    '.gitattributes',
    '.gitignore',
    '.node-version',
    '.npmrc',
    '.nvmrc',
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

function Copy-TestFoundationFile {
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
        Copy-TestFoundationFile $relativePath
    }

    foreach ($sourceDirectory in @('apps', 'packages', 'scripts', 'tests', 'docs\architecture', 'docs\testing')) {
        $fullSourceDirectory = Join-Path $repoRoot $sourceDirectory
        Get-ChildItem -LiteralPath $fullSourceDirectory -Recurse -File |
            Where-Object {
                $_.FullName -notmatch '[\/](dist|node_modules|coverage|\.next|\.turbo|\.cache|artifacts)[\/]'
            } |
            ForEach-Object {
                $relativePath = [IO.Path]::GetRelativePath($repoRoot, $_.FullName)
                Copy-TestFoundationFile $relativePath
            }
    }

    Push-Location $tempRoot
    try {
        & pnpm install --frozen-lockfile --ignore-scripts --prefer-offline
        if ($LASTEXITCODE -ne 0) { throw "干净目录冻结安装失败：$LASTEXITCODE" }

        foreach ($scriptName in @('test:foundation-contract', 'test:unit', 'test:api:supertest', 'lint', 'typecheck', 'build')) {
            & pnpm $scriptName
            if ($LASTEXITCODE -ne 0) {
                throw "干净目录命令失败：pnpm $scriptName，exit=$LASTEXITCODE"
            }
        }

        & pnpm exec playwright test --config ./playwright.config.ts --list
        if ($LASTEXITCODE -ne 0) { throw "干净目录Playwright发现用例失败：$LASTEXITCODE" }
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
    throw 'M0-009干净安装测试改变了仓库工作树。'
}

Write-Output 'M0-009干净安装测试通过：冻结安装、契约、Vitest单元、Supertest API、Playwright发现、lint、typecheck和13包构建均可从零复现。'
