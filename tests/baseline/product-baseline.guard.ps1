[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$verifier = Join-Path $repoRoot 'scripts\verify-product-baseline.ps1'
$lockFile = Join-Path $repoRoot 'docs\product\baseline-lock.json'
$scheme = Join-Path $repoRoot '福礼社单商户供应链平台V1.1综合方案.html'
$legacyScheme = Join-Path $repoRoot '福礼社单商户供应链平台V1.0综合方案.html'

if (-not (Test-Path -LiteralPath $verifier)) {
    throw "缺少基线校验器：$verifier"
}
if (-not (Test-Path -LiteralPath $lockFile)) {
    throw "缺少基线锁文件：$lockFile"
}

$shellExe = (Get-Process -Id $PID).Path

function Invoke-Guard {
    param([string]$SchemePath)
    & $shellExe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $verifier `
        -RootPath $repoRoot `
        -LockPath $lockFile `
        -SchemePath $SchemePath *> $null
    return $LASTEXITCODE
}

$baselineExit = Invoke-Guard -SchemePath $scheme
if ($baselineExit -ne 0) {
    throw "当前V1.1基线应通过校验，实际退出码：$baselineExit"
}

$tempScheme = Join-Path ([IO.Path]::GetTempPath()) ("fulishe-v11-tampered-{0}.html" -f [guid]::NewGuid().ToString('N'))
try {
    Copy-Item -LiteralPath $scheme -Destination $tempScheme
    [IO.File]::AppendAllText($tempScheme, "`n<!-- unauthorized drift -->", [Text.UTF8Encoding]::new($false))
    $tamperedExit = Invoke-Guard -SchemePath $tempScheme
    if ($tamperedExit -eq 0) {
        throw '未经批准修改方案后，基线校验器仍然放行。'
    }
} finally {
    if (Test-Path -LiteralPath $tempScheme) {
        Remove-Item -LiteralPath $tempScheme -Force
    }
}

if (Test-Path -LiteralPath $legacyScheme) {
    $legacyExit = Invoke-Guard -SchemePath $legacyScheme
    if ($legacyExit -eq 0) {
        throw 'V1.0旧方案被错误接受为当前开发基线。'
    }
}

Write-Host '产品基线守卫测试通过：当前V1.1放行，篡改和V1.0回灌均被拒绝。' -ForegroundColor Green
