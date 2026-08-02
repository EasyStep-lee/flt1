[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$statusBefore = @(& git -C $repoRoot status --porcelain=v1)
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("fulishe-m0-007-{0}" -f [guid]::NewGuid().ToString('N'))

$rootFiles = @(
    '.env.example',
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
    'turbo.json',
    'docs\architecture\CONFIGURATION_AND_SECRETS.md',
    'scripts\check-config.mjs',
    'scripts\scan-secrets.mjs'
)

function Copy-ConfigurationFile {
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
        Copy-ConfigurationFile $relativePath
    }

    foreach ($sourceDirectory in @('apps\api', 'packages\config', 'packages\db', 'tests\configuration')) {
        $fullSourceDirectory = Join-Path $repoRoot $sourceDirectory
        Get-ChildItem -LiteralPath $fullSourceDirectory -Recurse -File |
            Where-Object {
                $_.FullName -notmatch '[\/](dist|node_modules|coverage|\.next|\.turbo)[\/]'
            } |
            ForEach-Object {
                $relativePath = [IO.Path]::GetRelativePath($repoRoot, $_.FullName)
                Copy-ConfigurationFile $relativePath
            }
    }

    Push-Location $tempRoot
    try {
        & git init --quiet
        if ($LASTEXITCODE -ne 0) { throw "临时Git仓库初始化失败：$LASTEXITCODE" }
        & git add -- '.env.example' '.gitattributes' '.gitignore' '.node-version' '.npmrc' '.nvmrc' 'eslint.config.mjs' 'package.json' 'pnpm-lock.yaml' 'pnpm-workspace.yaml' 'tsconfig.base.json' 'turbo.json' 'apps/api' 'packages/config' 'packages/db' 'tests/configuration' 'docs/architecture/CONFIGURATION_AND_SECRETS.md' 'scripts/check-config.mjs' 'scripts/scan-secrets.mjs'
        if ($LASTEXITCODE -ne 0) { throw "临时Git索引建立失败：$LASTEXITCODE" }

        & pnpm install --frozen-lockfile --ignore-scripts --prefer-offline
        if ($LASTEXITCODE -ne 0) { throw "干净目录冻结安装失败：$LASTEXITCODE" }

        foreach ($scriptName in @('config:check', 'secrets:scan', 'test:config')) {
            & pnpm $scriptName
            if ($LASTEXITCODE -ne 0) {
                throw "干净目录命令失败：pnpm $scriptName，exit=$LASTEXITCODE"
            }
        }

        foreach ($packageName in @('@fulishe/config', '@fulishe/api')) {
            foreach ($scriptName in @('lint', 'typecheck', 'build')) {
                & pnpm --filter $packageName $scriptName
                if ($LASTEXITCODE -ne 0) {
                    throw "干净目录包命令失败：$packageName $scriptName，exit=$LASTEXITCODE"
                }
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
    throw 'M0-007干净安装测试改变了仓库工作树。'
}

Write-Output 'M0-007干净安装测试通过：冻结安装、配置校验、秘密扫描、18项测试、lint、typecheck和API构建均可从零复现。'
