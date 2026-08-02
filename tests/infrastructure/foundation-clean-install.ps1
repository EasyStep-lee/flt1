[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$statusBefore = @(& git -C $repoRoot status --porcelain=v1)
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("fulishe-m0-005-{0}" -f [guid]::NewGuid().ToString('N'))

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
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.base.json',
    'turbo.json'
)

function Copy-FoundationFile {
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
        Copy-FoundationFile $relativePath
    }

    foreach ($sourceDirectory in @('apps\api', 'packages\db')) {
        $fullSourceDirectory = Join-Path $repoRoot $sourceDirectory
        Get-ChildItem -LiteralPath $fullSourceDirectory -Recurse -File |
            Where-Object {
                $_.FullName -notmatch '[\\/](dist|node_modules|coverage)[\\/]'
            } |
            ForEach-Object {
                $relativePath = [IO.Path]::GetRelativePath($repoRoot, $_.FullName)
                Copy-FoundationFile $relativePath
            }
    }

    Push-Location $tempRoot
    try {
        & pnpm install --frozen-lockfile --ignore-scripts --prefer-offline
        if ($LASTEXITCODE -ne 0) { throw "干净目录冻结安装失败：$LASTEXITCODE" }

        foreach ($scriptName in @(
            'infra:config',
            'lint',
            'typecheck',
            'test',
            'test:api',
            'prisma:validate',
            'build'
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
    throw 'M0-005干净安装测试改变了仓库工作树。'
}

Write-Output 'M0-005干净安装测试通过：冻结安装、Compose解析、lint、typecheck、unit、API contract、Prisma validate和build均可从零复现。'
