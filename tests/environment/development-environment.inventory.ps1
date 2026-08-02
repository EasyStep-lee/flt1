[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$inventoryScript = Join-Path $repoRoot 'scripts\inventory-development-environment.ps1'

if (-not (Test-Path -LiteralPath $inventoryScript)) {
    throw "缺少只读环境盘点脚本：$inventoryScript"
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("fulishe-env-inventory-{0}" -f [guid]::NewGuid().ToString('N'))
$outputPath = Join-Path $tempRoot 'environment-inventory.json'
$shellExe = (Get-Process -Id $PID).Path

try {
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    & $shellExe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $inventoryScript `
        -RootPath $repoRoot `
        -OutputPath $outputPath *> $null
    if ($LASTEXITCODE -ne 0) { throw "环境盘点脚本退出码异常：$LASTEXITCODE" }
    if (-not (Test-Path -LiteralPath $outputPath)) { throw '环境盘点未生成JSON证据。' }

    $raw = Get-Content -LiteralPath $outputPath -Raw -Encoding UTF8
    $report = $raw | ConvertFrom-Json

    if ($report.schemaVersion -ne '1.0.0') { throw '环境报告schemaVersion不正确。' }
    if ($report.mode -ne 'READ_ONLY') { throw '环境报告没有声明READ_ONLY。' }
    if (-not $report.generatedAt) { throw '环境报告缺少generatedAt。' }
    if (-not $report.repository.branch) { throw '环境报告缺少Git分支。' }
    if (-not $report.system.os) { throw '环境报告缺少操作系统信息。' }
    if ($null -eq $report.system.disk) { throw '环境报告缺少磁盘信息。' }

    $requiredTools = @('node','npm','pnpm','corepack','git','gh','docker','dockerCompose','mysql','redis','wechatDevTools')
    foreach ($tool in $requiredTools) {
        if ($null -eq $report.tools.$tool) { throw "环境报告缺少工具项：$tool" }
        if (-not $report.tools.$tool.status) { throw "工具项缺少状态：$tool" }
    }

    if ($null -eq $report.confirmedFacts) { throw '环境报告缺少confirmedFacts。' }
    if ($null -eq $report.gaps) { throw '环境报告缺少gaps。' }
    if ($null -eq $report.externalBlockers) { throw '环境报告缺少externalBlockers。' }
    if ($null -eq $report.environmentVariables) { throw '环境报告缺少环境变量存在性清单。' }

    $workingTreeFact = @($report.confirmedFacts | Where-Object { $_.code -eq 'USER_FILES_PRESENT' }) | Select-Object -First 1
    if ($report.repository.untrackedCount -gt 0) {
        if ($null -eq $workingTreeFact) { throw '存在未跟踪条目时，报告必须包含工作树保留事实。' }
        if ($workingTreeFact.description -notmatch [regex]::Escape([string]$report.repository.untrackedCount)) {
            throw '工作树保留事实没有写明未跟踪条目数量。'
        }
    }

    foreach ($entry in $report.environmentVariables) {
        $properties = @($entry.PSObject.Properties.Name)
        if ($properties -contains 'value') { throw "环境变量报告泄露value字段：$($entry.name)" }
    }
    if ($raw -match 'gh[opsu]_[A-Za-z0-9]{20,}') { throw '环境报告疑似泄露GitHub令牌。' }
    if ($raw -match 'mysql://[^"\s]+:[^"\s]+@') { throw '环境报告疑似泄露数据库凭据。' }

    Write-Host '只读环境盘点测试通过：结构完整，敏感值未写入。' -ForegroundColor Green
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
