[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$statusBefore = @(& git -C $repoRoot status --porcelain=v1)
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("fulishe-m0-011-{0}" -f [guid]::NewGuid().ToString('N'))
$sourceSha = (& git -C $repoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceSha -notmatch '^[0-9a-f]{40}$') {
    throw "源仓库提交无效：$sourceSha"
}

try {
    & git clone --quiet --no-hardlinks --no-checkout -- $repoRoot $tempRoot
    if ($LASTEXITCODE -ne 0) { throw "完整历史临时克隆失败：$LASTEXITCODE" }
    & git -C $tempRoot checkout --quiet --detach $sourceSha
    if ($LASTEXITCODE -ne 0) { throw "临时克隆检出源提交失败：$LASTEXITCODE" }

    Push-Location $tempRoot
    try {
        $baseSha = (& git rev-parse HEAD).Trim()
        if ($LASTEXITCODE -ne 0 -or $baseSha -notmatch '^[0-9a-f]{40}$' -or $baseSha -ne $sourceSha) {
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
