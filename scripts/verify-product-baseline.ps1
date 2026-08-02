[CmdletBinding()]
param(
    [string]$RootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$LockPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'docs\product\baseline-lock.json'),
    [string]$SchemePath
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

function Add-Failure([string]$Message) { $failures.Add($Message) }
function Add-Warning([string]$Message) { $warnings.Add($Message) }

function Get-TreeDigest {
    param([string]$BasePath, [System.IO.FileInfo[]]$Files)
    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($file in @($Files | Sort-Object FullName)) {
        $relative = $file.FullName.Substring($BasePath.Length).TrimStart('\') -replace '\\', '/'
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToUpperInvariant()
        $lines.Add("$relative|$($file.Length)|$hash")
    }
    $payload = $lines -join "`n"
    $digest = [Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($payload))
    return [pscustomobject]@{ Count = $lines.Count; Sha256 = [Convert]::ToHexString($digest) }
}

if (-not (Test-Path -LiteralPath $LockPath)) {
    Write-Error "找不到基线锁文件：$LockPath"
    exit 1
}

$lock = Get-Content -LiteralPath $LockPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($lock.status -ne 'FROZEN') { Add-Failure "基线状态不是FROZEN：$($lock.status)" }
if ($lock.baselineId -ne 'FULISHE-V1.1-2026-08-02') { Add-Failure "未知基线ID：$($lock.baselineId)" }

$canonicalScheme = Join-Path $RootPath $lock.canonical.scheme.relativePath
if ([string]::IsNullOrWhiteSpace($SchemePath)) { $SchemePath = $canonicalScheme }
if (-not (Test-Path -LiteralPath $SchemePath)) {
    Add-Failure "找不到方案：$SchemePath"
} else {
    $schemeItem = Get-Item -LiteralPath $SchemePath
    $schemeHash = (Get-FileHash -LiteralPath $SchemePath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($schemeItem.Name -ne [IO.Path]::GetFileName($lock.canonical.scheme.relativePath)) {
        Add-Failure "当前方案文件名不是V1.1唯一基线：$($schemeItem.Name)"
    }
    if ($schemeHash -ne $lock.canonical.scheme.sha256) {
        Add-Failure "方案SHA-256不匹配：$schemeHash"
    }
    if ($schemeItem.Length -ne [long]$lock.canonical.scheme.bytes) {
        Add-Failure "方案字节数不匹配：$($schemeItem.Length)"
    }
}

$promptPath = Join-Path $RootPath $lock.canonical.promptPack.relativePath
if (-not (Test-Path -LiteralPath $promptPath)) {
    Add-Failure "找不到V1.1提示词包：$promptPath"
} else {
    $promptDigest = Get-TreeDigest -BasePath $promptPath -Files @(Get-ChildItem -LiteralPath $promptPath -Recurse -File)
    if ($promptDigest.Count -ne [int]$lock.canonical.promptPack.fileCount) {
        Add-Failure "提示词文件数不匹配：$($promptDigest.Count)"
    }
    if ($promptDigest.Sha256 -ne $lock.canonical.promptPack.treeSha256) {
        Add-Failure "提示词树SHA-256不匹配：$($promptDigest.Sha256)"
    }
}

if (Test-Path -LiteralPath $canonicalScheme) {
    $html = [IO.File]::ReadAllText($canonicalScheme, [Text.Encoding]::UTF8)
    $sources = [regex]::Matches($html, '<img[^>]+src=["'']([^"'']+)["'']', 'IgnoreCase') |
        ForEach-Object { $_.Groups[1].Value } |
        Sort-Object -Unique
    $uiFiles = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
    foreach ($source in $sources) {
        if ($source -match '^(data:|https?://)') { continue }
        $asset = Join-Path $RootPath ($source -replace '/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $asset)) {
            Add-Failure "方案引用的UI资产不存在：$source"
        } else {
            $uiFiles.Add((Get-Item -LiteralPath $asset))
        }
    }
    $uiDigest = Get-TreeDigest -BasePath $RootPath -Files @($uiFiles)
    if ($uiDigest.Count -ne [int]$lock.canonical.uiAssets.fileCount) {
        Add-Failure "正式UI引用数不匹配：$($uiDigest.Count)"
    }
    if ($uiDigest.Sha256 -ne $lock.canonical.uiAssets.treeSha256) {
        Add-Failure "正式UI引用树SHA-256不匹配：$($uiDigest.Sha256)"
    }
}

$executionPath = Join-Path $RootPath $lock.canonical.executionPackRelease.relativePath
$executionManifestPath = Join-Path $executionPath 'manifest.json'
if (-not (Test-Path -LiteralPath $executionManifestPath)) {
    Add-Failure "找不到执行包manifest：$executionManifestPath"
} else {
    $executionManifest = Get-Content -LiteralPath $executionManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($executionManifest.version -ne $lock.canonical.executionPackRelease.version) {
        Add-Failure "执行包版本不匹配：$($executionManifest.version)"
    }
    if ($executionManifest.baseline.schemeSha256 -ne $lock.canonical.scheme.sha256) {
        Add-Failure '执行包引用的方案哈希不匹配'
    }
    foreach ($entry in $lock.expectedCounts.PSObject.Properties) {
        if ($executionManifest.counts.($entry.Name) -ne $entry.Value) {
            Add-Failure "执行包计数不匹配：$($entry.Name)=$($executionManifest.counts.($entry.Name))，期望$($entry.Value)"
        }
    }

    $executionDigest = Get-TreeDigest -BasePath $executionPath -Files @(Get-ChildItem -LiteralPath $executionPath -Recurse -File)
    if ($executionDigest.Sha256 -ne $lock.canonical.executionPackRelease.treeSha256AtFreeze) {
        Add-Warning "执行包目录快照已变化：$($executionDigest.Sha256)；任务状态/证据允许追加，但执行包自检必须通过。"
    }

    $executionVerifier = Join-Path $executionPath 'scripts\verify-execution-pack.ps1'
    if (-not (Test-Path -LiteralPath $executionVerifier)) {
        Add-Failure "找不到执行包自检脚本：$executionVerifier"
    } else {
        $shellExe = (Get-Process -Id $PID).Path
        & $shellExe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $executionVerifier `
            -PackagePath $executionPath `
            -SchemePath $canonicalScheme *> $null
        if ($LASTEXITCODE -ne 0) { Add-Failure "执行包自检失败，退出码：$LASTEXITCODE" }
    }
}

foreach ($legacy in $lock.historyOnly) {
    if ($legacy -eq [IO.Path]::GetFileName($SchemePath)) {
        Add-Failure "历史文件不得作为当前开发基线：$legacy"
    }
}

if ($warnings.Count -gt 0) {
    Write-Host "基线校验警告（$($warnings.Count)项）：" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "- $_" -ForegroundColor Yellow }
}
if ($failures.Count -gt 0) {
    Write-Host "基线校验失败（$($failures.Count)项）：" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}

Write-Host '福礼社V1.1产品基线校验通过。' -ForegroundColor Green
Write-Host "方案SHA-256：$($lock.canonical.scheme.sha256)"
Write-Host "提示词：$($lock.canonical.promptPack.fileCount)份；正式UI引用：$($lock.canonical.uiAssets.fileCount)个；执行包：$($lock.canonical.executionPackRelease.version)"
exit 0
