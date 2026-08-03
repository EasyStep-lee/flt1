[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$statusBefore = @(& git -C $repoRoot status --porcelain=v1)
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("fulishe-m0-011-{0}" -f [guid]::NewGuid().ToString('N'))

$rootFiles = @(
    '.editorconfig',
    '.env.example',
    '.gitattributes',
    '.gitignore',
    '.node-version',
    '.npmrc',
    '.nvmrc',
    'AGENTS.md',
    'compose.yaml',
    'CONTRIBUTING.md',
    'eslint.config.mjs',
    'package.json',
    'playwright.config.ts',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'README.md',
    'tsconfig.base.json',
    'tsconfig.openapi.json',
    'tsconfig.tests.json',
    'turbo.json',
    'vitest.config.ts',
    'vitest.report.config.ts'
)

function Copy-CiGateFile {
    param([Parameter(Mandatory)] [string] $RelativePath)

    $source = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "干净安装缺少受控源文件：$RelativePath"
    }
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
        Copy-CiGateFile $relativePath
    }

    foreach ($sourceDirectory in @('.github', 'apps', 'packages', 'scripts', 'tests', 'docs\architecture', 'docs\testing')) {
        $fullSourceDirectory = Join-Path $repoRoot $sourceDirectory
        Get-ChildItem -LiteralPath $fullSourceDirectory -Recurse -File |
            Where-Object {
                $_.FullName -notmatch '[\/\\](dist|node_modules|coverage|\.next|\.turbo|\.cache|artifacts)[\/\\]'
            } |
            ForEach-Object {
                $expectedPrefix = $repoRoot + [IO.Path]::DirectorySeparatorChar
                if (-not $_.FullName.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                    throw "拒绝复制仓库外文件：$($_.FullName)"
                }
                Copy-CiGateFile $_.FullName.Substring($repoRoot.Length + 1)
            }
    }

    foreach ($executionFile in @(
        '福礼社Codex5.6开发执行包V1.1\16-项目状态.json',
        '福礼社Codex5.6开发执行包V1.1\data\阶段门禁.csv'
    )) {
        Copy-CiGateFile $executionFile
    }

    Push-Location $tempRoot
    try {
        & git init --quiet
        if ($LASTEXITCODE -ne 0) { throw "临时Git仓库初始化失败：$LASTEXITCODE" }
        & git config user.email 'm0-011@example.invalid'
        & git config user.name 'M0-011 Clean Install'
        & git add -- .
        if ($LASTEXITCODE -ne 0) { throw "临时Git仓库暂存失败：$LASTEXITCODE" }
        & git commit --quiet -m 'M0-011 clean-install baseline'
        if ($LASTEXITCODE -ne 0) { throw "临时Git仓库提交失败：$LASTEXITCODE" }

        $baseSha = (& git rev-parse HEAD).Trim()
        if ($LASTEXITCODE -ne 0 -or $baseSha -notmatch '^[0-9a-f]{40}$') {
            throw "临时Git基线提交无效：$baseSha"
        }

        & pnpm install --frozen-lockfile --ignore-scripts --prefer-offline
        if ($LASTEXITCODE -ne 0) { throw "干净目录冻结安装失败：$LASTEXITCODE" }

        & pnpm verify -- --base-ref $baseSha
        if ($LASTEXITCODE -ne 0) { throw "干净目录完整门禁失败：$LASTEXITCODE" }

        $reportPath = Join-Path $tempRoot 'artifacts\test-results\verification\pnpm-verify.json'
        if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) {
            throw '干净目录完整门禁没有生成机器报告。'
        }
        $report = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($report.status -ne 'PASS') { throw "干净目录报告状态异常：$($report.status)" }
        if ($report.commit -ne $baseSha -or $report.baseRef -ne $baseSha) {
            throw '干净目录报告没有绑定当前提交与不可变比较基线。'
        }
        if (@($report.steps).Count -ne 17 -or @($report.steps | Where-Object status -ne 'PASS').Count -ne 0) {
            throw '干净目录报告没有记录17项全部通过。'
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
    throw 'M0-011干净安装测试改变了原仓库工作树。'
}

Write-Output 'M0-011干净安装测试通过：冻结安装、不可变基线和17项完整门禁均可从零复现。'
