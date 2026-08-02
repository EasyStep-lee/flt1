[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$statusBefore = @(& git -C $repoRoot status --porcelain=v1)
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("fulishe-m0-006-{0}" -f [guid]::NewGuid().ToString('N'))

$rootFiles = @(
    '.gitattributes',
    '.gitignore',
    '.node-version',
    '.npmrc',
    '.nvmrc',
    'eslint.config.mjs',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.base.json',
    'turbo.json'
)

function Copy-ShellFile {
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
        Copy-ShellFile $relativePath
    }

    foreach ($sourceDirectory in @('apps', 'packages', 'tests\application-shells')) {
        $fullSourceDirectory = Join-Path $repoRoot $sourceDirectory
        Get-ChildItem -LiteralPath $fullSourceDirectory -Recurse -File |
            Where-Object {
                $_.FullName -notmatch '[\/](dist|node_modules|coverage|\.next|\.turbo)[\/]'
            } |
            ForEach-Object {
                $relativePath = [IO.Path]::GetRelativePath($repoRoot, $_.FullName)
                Copy-ShellFile $relativePath
            }
    }

    Push-Location $tempRoot
    try {
        & pnpm install --frozen-lockfile --ignore-scripts --prefer-offline
        if ($LASTEXITCODE -ne 0) { throw "干净目录冻结安装失败：$LASTEXITCODE" }

        foreach ($scriptName in @('test:shells', 'test:miniapp-transport', 'lint', 'typecheck')) {
            & pnpm $scriptName
            if ($LASTEXITCODE -ne 0) {
                throw "干净目录命令失败：pnpm $scriptName，exit=$LASTEXITCODE"
            }
        }

        foreach ($packageName in @(
            '@fulishe/company-admin',
            '@fulishe/supplier-portal',
            '@fulishe/portal-web',
            '@fulishe/user-miniapp',
            '@fulishe/runner-miniapp'
        )) {
            & pnpm --filter $packageName build
            if ($LASTEXITCODE -ne 0) {
                throw "五端独立构建失败：$packageName，exit=$LASTEXITCODE"
            }
        }

        & pnpm test
        if ($LASTEXITCODE -ne 0) { throw "干净目录全包测试失败：$LASTEXITCODE" }
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
    throw 'M0-006干净安装测试改变了仓库工作树。'
}

Write-Output 'M0-006干净安装测试通过：冻结安装、静态边界、lint、typecheck、五端逐个构建和全包运行测试均可从零复现。'
