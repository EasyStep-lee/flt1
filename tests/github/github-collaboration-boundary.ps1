[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$auditScript = Join-Path $repoRoot 'scripts\audit-github-collaboration-boundary.ps1'

if (-not (Test-Path -LiteralPath $auditScript)) {
    throw "缺少GitHub协作边界审计脚本：$auditScript"
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("fulishe-github-boundary-{0}" -f [guid]::NewGuid().ToString('N'))
$outputPath = Join-Path $tempRoot 'github-collaboration-boundary.json'
$shellExe = (Get-Process -Id $PID).Path
$statusBefore = @(& git -C $repoRoot status --porcelain=v1)

try {
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    & $shellExe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $auditScript `
        -RootPath $repoRoot `
        -OutputPath $outputPath *> $null
    if ($LASTEXITCODE -ne 0) { throw "GitHub协作边界审计退出码异常：$LASTEXITCODE" }
    if (-not (Test-Path -LiteralPath $outputPath)) { throw 'GitHub协作边界审计未生成JSON证据。' }

    $raw = Get-Content -LiteralPath $outputPath -Raw -Encoding UTF8
    $report = $raw | ConvertFrom-Json

    if ($report.schemaVersion -ne '1.0.0') { throw '协作边界报告schemaVersion不正确。' }
    if ($report.taskId -ne 'M0-003') { throw '协作边界报告taskId不正确。' }
    if ($report.mode -ne 'READ_ONLY') { throw '协作边界报告没有声明READ_ONLY。' }
    if (-not $report.generatedAt) { throw '协作边界报告缺少generatedAt。' }
    if (-not $report.localRepository.currentBranch) { throw '协作边界报告缺少当前分支。' }

    if ($report.repositoryTarget.status -ne 'UNCONFIRMED') { throw '无origin时仓库目标必须为UNCONFIRMED。' }
    if ($report.repositoryTarget.source -ne 'NONE') { throw '无origin时仓库来源必须为NONE。' }
    if ($null -ne $report.repositoryTarget.ownerRepo) { throw '不得猜测owner/repo。' }
    if ($null -ne $report.repositoryTarget.defaultBranch) { throw '不得猜测默认分支。' }

    if ($report.authentication.status -ne 'AUTHENTICATED') { throw '当前已认证账号没有被正确登记。' }
    if (-not $report.authentication.account) { throw '认证证据缺少账号名。' }
    if ($report.remotePolicy.remoteWriteAllowed -ne $false) { throw '目标未确认时必须禁止远程写入。' }
    if ($report.remotePolicy.localDevelopmentAllowed -ne $true) { throw '目标未确认时仍应允许M0本地工程。' }

    $requiredProhibitions = @(
        'ADD_ORIGIN_WITHOUT_USER_TARGET',
        'PUSH_ANY_REMOTE',
        'CREATE_OR_UPDATE_REMOTE_PR',
        'DIRECT_MAIN_WRITE',
        'MODIFY_REPOSITORY_ADMIN'
    )
    foreach ($rule in $requiredProhibitions) {
        if ($rule -notin @($report.remotePolicy.prohibitedActions)) { throw "缺少禁止动作：$rule" }
    }

    $requiredApprovals = @('TARGET_OWNER_REPO','DEFAULT_BRANCH','REMOTE_WRITE','BRANCH_PROTECTION','SECRETS_AND_ENVIRONMENTS')
    foreach ($approval in $requiredApprovals) {
        if ($approval -notin @($report.humanApprovals.id)) { throw "缺少人工确认项：$approval" }
    }

    if ($report.conclusion.status -ne 'LOCAL_ONLY_BOUNDARY_CONFIRMED') { throw '结论必须明确为本地开发边界已确认。' }
    if ($report.conclusion.nextAllowedTask -ne 'M0-004') { throw 'M0-003完成后下一任务必须为M0-004。' }
    if ($report.conclusion.remoteEvidence -ne 'BLOCKED_EXTERNAL') { throw '远程证据必须保持BLOCKED_EXTERNAL。' }

    if ($raw -match 'gh[opsu]_[A-Za-z0-9]{20,}') { throw '协作边界报告疑似泄露GitHub令牌。' }
    if ($raw -match '"token"\s*:') { throw '协作边界报告不得包含token字段。' }

    $statusAfter = @(& git -C $repoRoot status --porcelain=v1)
    if (($statusBefore -join "`n") -ne ($statusAfter -join "`n")) { throw '只读审计改变了仓库工作树。' }

    Write-Host 'GitHub协作边界测试通过：未猜测仓库，远程写入受阻，本地M0可继续。' -ForegroundColor Green
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
