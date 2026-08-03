[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$statusBefore = @(& git -C $repoRoot status --porcelain=v1)
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("fulishe-m0-008-{0}" -f [guid]::NewGuid().ToString('N'))

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
    'tsconfig.openapi.json',
    'turbo.json',
    'scripts\check-openapi-breaking.mjs',
    'scripts\check-openapi-generated.mjs',
    'scripts\generate-openapi.ts'
)

function Copy-ContractFile {
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
        Copy-ContractFile $relativePath
    }

    foreach ($sourceDirectory in @('apps', 'packages', 'tests\openapi')) {
        $fullSourceDirectory = Join-Path $repoRoot $sourceDirectory
        Get-ChildItem -LiteralPath $fullSourceDirectory -Recurse -File |
            Where-Object {
                $_.FullName -notmatch '[\/](dist|node_modules|coverage|\.next|\.turbo|\.cache)[\/]'
            } |
            ForEach-Object {
                $relativePath = [IO.Path]::GetRelativePath($repoRoot, $_.FullName)
                Copy-ContractFile $relativePath
            }
    }

    Push-Location $tempRoot
    try {
        & pnpm install --frozen-lockfile --ignore-scripts --prefer-offline
        if ($LASTEXITCODE -ne 0) { throw "干净目录冻结安装失败：$LASTEXITCODE" }

        & pnpm openapi:generate
        if ($LASTEXITCODE -ne 0) { throw "首次OpenAPI生成失败：$LASTEXITCODE" }
        $firstSpec = (Get-FileHash -Algorithm SHA256 -LiteralPath 'packages\contracts\openapi.json').Hash
        $firstTypes = (Get-FileHash -Algorithm SHA256 -LiteralPath 'packages\contracts\types.ts').Hash

        & pnpm openapi:generate
        if ($LASTEXITCODE -ne 0) { throw "二次OpenAPI生成失败：$LASTEXITCODE" }
        $secondSpec = (Get-FileHash -Algorithm SHA256 -LiteralPath 'packages\contracts\openapi.json').Hash
        $secondTypes = (Get-FileHash -Algorithm SHA256 -LiteralPath 'packages\contracts\types.ts').Hash
        if ($firstSpec -ne $secondSpec -or $firstTypes -ne $secondTypes) {
            throw '干净目录OpenAPI或生成类型不是字节稳定输出。'
        }

        foreach ($scriptName in @('openapi:check', 'test:openapi', 'typecheck')) {
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
    throw 'M0-008干净安装测试改变了仓库工作树。'
}

Write-Output 'M0-008干净安装测试通过：冻结安装、两次字节稳定生成、漂移检查、8项契约测试和12包typecheck均可从零复现。'
