[CmdletBinding()]
param(
    [string]$PackagePath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$SchemePath = (Join-Path (Split-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path -Parent) '福礼社单商户供应链平台V1.1综合方案.html')
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { $failures.Add($Message) }
}

$required = @(
    '00-执行包使用说明.md', '01-项目总控与启动门禁.md', '02-M0-M6阶段门禁.md',
    '03-任务台账.csv', '04-P0-1至P0-119验收矩阵.csv', '05-字段字典初始版.csv',
    '06-状态机总表.csv', '07-权限与数据可见矩阵.csv', '08-页面路由接口P0映射.csv',
    '09-外部依赖与人工事项.csv', '10-测试证据登记.csv', '11-数据库迁移台账.csv',
    '12-OpenAPI-DTO-错误码台账.csv', '13-GitHub-Issue导入.csv', '14-阶段交接模板.md',
    '15-发布与回滚模板.md', '16-项目状态.json', '17-福礼社Codex5.6执行总控工作簿.xlsx',
    '18-仓库接入与启动指令.md', 'manifest.json',
    'github-bootstrap/.github/workflows/ci.yml', 'github-bootstrap/.github/pull_request_template.md',
    'github-bootstrap/.github/ISSUE_TEMPLATE/feature.yml', 'github-bootstrap/.github/ISSUE_TEMPLATE/bug.yml'
)

foreach ($relative in $required) {
    Assert-Condition (Test-Path -LiteralPath (Join-Path $PackagePath $relative)) "缺少必需文件：$relative"
}

if (Test-Path -LiteralPath $SchemePath) {
    $actualHash = (Get-FileHash -LiteralPath $SchemePath -Algorithm SHA256).Hash.ToUpperInvariant()
    Assert-Condition ($actualHash -eq '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92') "综合方案哈希不匹配：$actualHash"
} else {
    $failures.Add("找不到综合方案：$SchemePath")
}

$p0 = Import-Csv -LiteralPath (Join-Path $PackagePath '04-P0-1至P0-119验收矩阵.csv')
Assert-Condition ($p0.Count -eq 119) "P0行数应为119，实际$($p0.Count)"
Assert-Condition (($p0.P0ID | Sort-Object -Unique).Count -eq 119) 'P0编号存在重复'
$expectedP0 = 1..119 | ForEach-Object { 'P0-{0:D3}' -f $_ }
Assert-Condition (@(Compare-Object $expectedP0 @($p0.P0ID)).Count -eq 0) 'P0编号不连续或缺失'
$p047 = @($p0 | Where-Object P0ID -eq 'P0-047')
$p060 = @($p0 | Where-Object P0ID -eq 'P0-060')
$p072 = @($p0 | Where-Object P0ID -eq 'P0-072')
$p082 = @($p0 | Where-Object P0ID -eq 'P0-082')
Assert-Condition ($p047.Count -eq 1 -and $p047[0].Acceptance -match 'openapi-typescript' -and $p047[0].Acceptance -match 'wx.request' -and $p047[0].Acceptance -match 'oasdiff') 'P0-047未冻结确定性OpenAPI与分端适配'
Assert-Condition ($p060.Count -eq 1 -and $p060[0].Acceptance -match '不提供个人现金充值') 'P0-060未永久排除个人现金充值'
Assert-Condition ($p072.Count -eq 1 -and $p072[0].Acceptance -match 'identityId' -and $p072[0].Acceptance -match '超级管理员') 'P0-072未冻结自然人级职责分离'
Assert-Condition ($p082.Count -eq 1 -and $p082[0].Acceptance -match 'Next.js' -and $p082[0].Acceptance -match 'noindex' -and $p082[0].Acceptance -match '公共缓存') 'P0-082未冻结门户渲染、索引和缓存边界'

$tasks = Import-Csv -LiteralPath (Join-Path $PackagePath '03-任务台账.csv')
Assert-Condition (($tasks.TaskID | Sort-Object -Unique).Count -eq $tasks.Count) '任务编号存在重复'
$mappedTaskP0 = @($tasks | Where-Object { $_.P0ID -match '^P0-\d{3}$' })
Assert-Condition ($mappedTaskP0.Count -eq 119) "主P0任务应为119，实际$($mappedTaskP0.Count)"
Assert-Condition (($mappedTaskP0.P0ID | Sort-Object -Unique).Count -eq 119) '任务台账P0映射不是一对一'
Assert-Condition (($tasks | Where-Object Status -eq 'IN_PROGRESS').Count -le 1) '同时存在多个IN_PROGRESS任务'
Assert-Condition (($tasks | Where-Object TaskID -eq 'M0-001').Count -eq 1) '缺少当前任务M0-001'
foreach ($stage in 'M0','M1','M2','M3','M4','M5','M6') {
    Assert-Condition (($tasks | Where-Object TaskID -eq "$stage-GATE").Count -eq 1) "缺少阶段门禁：$stage-GATE"
}

$pages = Import-Csv -LiteralPath (Join-Path $PackagePath '08-页面路由接口P0映射.csv')
Assert-Condition ($pages.Count -eq 80) "页面总数应为80，实际$($pages.Count)"
$expectedPages = @{ COMPANY_ADMIN=12; SUPPLIER_ADMIN=12; PORTAL_ENTERPRISE=24; CONSUMER_MINIPROGRAM=22; RUNNER_MINIPROGRAM=10 }
foreach ($platform in $expectedPages.Keys) {
    $count = @($pages | Where-Object Platform -eq $platform).Count
    Assert-Condition ($count -eq $expectedPages[$platform]) "$platform 页面应为$($expectedPages[$platform])，实际$count"
}
$portalPages = @($pages | Where-Object Platform -eq 'PORTAL_ENTERPRISE')
Assert-Condition (@($portalPages | Where-Object { $_.Notes -match 'Next.js' -and $_.Notes -match 'ISR' }).Count -eq 12) '门户公开SSG/ISR页面应为12个'
Assert-Condition (@($portalPages | Where-Object { $_.Notes -match 'private/no-store' }).Count -eq 10) '门户登录后private/no-store页面应为10个'
Assert-Condition (@($portalPages | Where-Object { $_.Notes -match '禁止索引和公共缓存' }).Count -eq 2) '门户注册/登录noindex且禁止公共缓存页面应为2个'
$sourceRoot = Split-Path $PackagePath -Parent
foreach ($page in $pages) {
    $assetPath = Join-Path $sourceRoot ($page.SourceAsset -replace '/', [IO.Path]::DirectorySeparatorChar)
    Assert-Condition (Test-Path -LiteralPath $assetPath) "页面UI资产不存在：$($page.PageID) $($page.SourceAsset)"
}
$forbiddenPageSupplyExposure = @($pages | Where-Object {
    $_.SupplyPricePolicy -ne 'NEVER_RETURN' -and
    $_.PageName -notin @('价格审核','财务结算','价格管理','财务对账')
})
Assert-Condition ($forbiddenPageSupplyExposure.Count -eq 0) '非授权页面被配置为可见供应价'

$fields = Import-Csv -LiteralPath (Join-Path $PackagePath '05-字段字典初始版.csv')
Assert-Condition ($fields.Count -eq 658) "字段字典应为658项，实际$($fields.Count)"
Assert-Condition (@($fields | Where-Object Sensitivity -eq 'STRICT_INTERNAL_SUPPLY_PRICE').Count -gt 0) '字段字典未识别供应价严格隔离字段'
$approvalApplicant = @($fields | Where-Object { $_.Entity -eq 'ApprovalTask' -and $_.Field -eq 'applicantId' })
$approvalReviewer = @($fields | Where-Object { $_.Entity -eq 'ApprovalTask' -and $_.Field -eq 'reviewedBy' })
$approvalAccountType = @($fields | Where-Object { $_.Entity -eq 'ApprovalTask' -and $_.Field -eq 'assignedAccountTypeCode' })
Assert-Condition ($approvalApplicant.Count -eq 1 -and $approvalApplicant[0].UnitOrFormat -match '自然人身份主键' -and $approvalApplicant[0].Validation -match 'identityId') 'ApprovalTask.applicantId未按自然人身份冻结'
Assert-Condition ($approvalReviewer.Count -eq 1 -and $approvalReviewer[0].Validation -match '不得等于applicantId') 'ApprovalTask.reviewedBy未阻止同一自然人复核'
Assert-Condition ($approvalAccountType.Count -eq 1 -and $approvalAccountType[0].SuggestedType -eq 'Enum/String') 'ApprovalTask.assignedAccountTypeCode类型不正确'

$permissions = Import-Csv -LiteralPath (Join-Path $PackagePath '07-权限与数据可见矩阵.csv')
Assert-Condition (@($permissions | Where-Object OwnerType -eq 'COMPANY').Count -eq 10) '公司职能账号应为10个'
Assert-Condition (@($permissions | Where-Object OwnerType -eq 'SUPPLIER').Count -eq 8) '供应商职能账号应为8个'

$states = Import-Csv -LiteralPath (Join-Path $PackagePath '06-状态机总表.csv')
Assert-Condition ($states.Count -eq 104) "状态迁移应为104条，实际$($states.Count)"
Assert-Condition (@($states | Where-Object StateMachine -eq 'DeliveryTask').Count -gt 0) '缺少个人跑腿状态机'
Assert-Condition (@($states | Where-Object StateMachine -eq 'EnterpriseDeliveryOrder').Count -gt 0) '缺少企业统一配送状态机'

$external = Import-Csv -LiteralPath (Join-Path $PackagePath '09-外部依赖与人工事项.csv')
Assert-Condition ($external.Count -eq 28) "外部人工事项应为28项，实际$($external.Count)"
$migrations = Import-Csv -LiteralPath (Join-Path $PackagePath '11-数据库迁移台账.csv')
Assert-Condition ($migrations.Count -eq 22) "计划迁移应为22项，实际$($migrations.Count)"
$mig004 = @($migrations | Where-Object MigrationID -eq 'MIG-004')
$mig014 = @($migrations | Where-Object MigrationID -eq 'MIG-014')
$mig021 = @($migrations | Where-Object MigrationID -eq 'MIG-021')
Assert-Condition ($mig004.Count -eq 1 -and $mig004[0].Verification -match 'identityId') 'MIG-004未覆盖自然人双审约束'
Assert-Condition ($mig014.Count -eq 1 -and $mig014[0].Verification -match '仅三类' -and $mig014[0].Verification -match '无PERSONAL_RECHARGE') 'MIG-014未排除个人充值资金来源'
Assert-Condition ($mig021.Count -eq 1 -and $mig021[0].Verification -match 'slug失效') 'MIG-021未覆盖门户缓存失效'
$apis = Import-Csv -LiteralPath (Join-Path $PackagePath '12-OpenAPI-DTO-错误码台账.csv')
Assert-Condition ($apis.Count -eq 80) "初始API契约应为80项，实际$($apis.Count)"
$api043 = @($apis | Where-Object ContractID -eq 'API-043')
$api073 = @($apis | Where-Object ContractID -eq 'API-073')
$api075 = @($apis | Where-Object ContractID -eq 'API-075')
$api078 = @($apis | Where-Object ContractID -eq 'API-078')
Assert-Condition ($api043.Count -eq 1 -and $api043[0].ErrorCodes -match 'SAME_NATURAL_PERSON_REVIEW_FORBIDDEN') '退款复核接口缺少同自然人拒绝错误码'
Assert-Condition ($api073.Count -eq 1 -and $api073[0].ErrorCodes -match 'SAME_NATURAL_PERSON_REVIEW_FORBIDDEN') '付款登记接口缺少同自然人拒绝错误码'
Assert-Condition ($api075.Count -eq 1 -and $api075[0].Notes -match 'SSG/ISR') '门户公开内容接口未标记SSG/ISR边界'
Assert-Condition ($api078.Count -eq 1 -and $api078[0].ErrorCodes -match 'CACHE_REVALIDATION_FAILED' -and $api078[0].Notes -match 'slug失效') '门户发布接口未覆盖缓存失效失败'
$publicApiLeak = @($apis | Where-Object {
    ($_.Actor -match 'PUBLIC|CONSUMER|ENTERPRISE|RUNNER') -and
    $_.SensitiveFieldPolicy -notmatch '^NEVER_RETURN'
})
Assert-Condition ($publicApiLeak.Count -eq 0) '对客/企业/跑腿API存在供应价可见策略异常'

$projectStatus = Get-Content -LiteralPath (Join-Path $PackagePath '16-项目状态.json') -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Condition ($projectStatus.baseline.schemeSha256 -eq '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92') '项目状态方案哈希不正确'
Assert-Condition ($projectStatus.schemaVersion -eq '1.1.0') '项目状态schemaVersion应为1.1.0'
$statusTask = @($tasks | Where-Object TaskID -eq $projectStatus.execution.currentTask)
Assert-Condition ($statusTask.Count -eq 1) '项目状态currentTask在任务台账中不存在或重复'
if ($statusTask.Count -eq 1) {
    Assert-Condition ($projectStatus.execution.currentStage -eq $statusTask[0].Stage) 'currentStage与currentTask阶段不一致'
}
Assert-Condition ($projectStatus.execution.nextAllowedTask -eq $projectStatus.execution.currentTask) 'nextAllowedTask必须等于当前唯一可执行任务'
Assert-Condition ([int]$projectStatus.execution.activeTaskCount -eq @($tasks | Where-Object Status -eq 'IN_PROGRESS').Count) 'activeTaskCount与任务台账不一致'
if ($projectStatus.execution.lastCompletedTask) {
    $lastCompleted = @($tasks | Where-Object TaskID -eq $projectStatus.execution.lastCompletedTask)
    Assert-Condition ($lastCompleted.Count -eq 1 -and $lastCompleted[0].Status -eq 'DONE') 'lastCompletedTask未在任务台账中标记DONE'
}
$stageGates = Import-Csv -LiteralPath (Join-Path $PackagePath 'data/阶段门禁.csv')
if ($projectStatus.execution.lastPassedGate -eq 'M0-GATE') {
    $m0GateTask = @($tasks | Where-Object TaskID -eq 'M0-GATE')
    $m1StartTask = @($tasks | Where-Object TaskID -eq 'M1-000')
    $m0StageGate = @($stageGates | Where-Object Stage -eq 'M0')
    $m1StageGate = @($stageGates | Where-Object Stage -eq 'M1')
    Assert-Condition ($projectStatus.execution.status -eq 'M0_GATE_PASSED') 'M0-GATE通过后项目状态必须为M0_GATE_PASSED'
    Assert-Condition ($projectStatus.execution.currentStage -eq 'M1' -and $projectStatus.execution.currentTask -eq 'M1-000') 'M0-GATE通过后只能解锁M1-000'
    Assert-Condition ($m0GateTask.Count -eq 1 -and $m0GateTask[0].Status -eq 'DONE' -and $m0GateTask[0].EvidenceStatus -eq 'CI_PASS') 'M0-GATE任务未以CI_PASS完成'
    Assert-Condition ($m1StartTask.Count -eq 1 -and $m1StartTask[0].Status -eq 'READY' -and $m1StartTask[0].EvidenceStatus -eq 'NOT_EXECUTED') 'M1-000未按唯一下一任务解锁'
    Assert-Condition ($m0StageGate.Count -eq 1 -and $m0StageGate[0].Status -eq 'GATE_PASSED' -and $m0StageGate[0].EvidenceStatus -eq 'CI_PASS') 'M0阶段门禁台账未通过'
    Assert-Condition ($m1StageGate.Count -eq 1 -and $m1StageGate[0].Status -eq 'READY' -and $m1StageGate[0].EvidenceStatus -eq 'NOT_EXECUTED') 'M1阶段未按READY/NOT_EXECUTED解锁'
}

$manifest = Get-Content -LiteralPath (Join-Path $PackagePath 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Condition ($manifest.counts.p0 -eq 119) 'manifest P0计数不正确'
Assert-Condition ($manifest.counts.pages -eq 80) 'manifest页面计数不正确'
Assert-Condition ($manifest.counts.apiContracts -eq 80) 'manifest API契约计数不正确'
Assert-Condition ($manifest.version -eq '1.1.0') 'manifest版本应为1.1.0'
Assert-Condition ($manifest.workbook.status -eq 'VERIFIED') '工作簿尚未标记为VERIFIED'
if (Test-Path -LiteralPath (Join-Path $PackagePath '17-福礼社Codex5.6执行总控工作簿.xlsx')) {
    $workbookHash = (Get-FileHash -LiteralPath (Join-Path $PackagePath '17-福礼社Codex5.6执行总控工作簿.xlsx') -Algorithm SHA256).Hash.ToUpperInvariant()
    Assert-Condition ($workbookHash -eq $manifest.workbook.sha256) '工作簿SHA-256与manifest不一致'
}

$workflowPath = Join-Path $PackagePath 'github-bootstrap/.github/workflows/ci.yml'
$workflow = Get-Content -LiteralPath $workflowPath -Raw -Encoding UTF8
$unpinnedUses = [regex]::Matches($workflow, 'uses:\s*[^@\s]+@(?![0-9a-f]{40}\b)[^\s]+')
Assert-Condition ($unpinnedUses.Count -eq 0) 'CI工作流存在未固定完整提交SHA的Action'
Assert-Condition ($workflow -match 'pnpm openapi:generate' -and $workflow -match 'pnpm openapi:check' -and $workflow -match 'git diff --exit-code') 'CI工作流缺少OpenAPI生成物一致性检查'

if ($failures.Count -gt 0) {
    Write-Host "执行包校验失败（$($failures.Count)项）：" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}

Write-Host '执行包校验通过。' -ForegroundColor Green
Write-Host "任务：$($tasks.Count)；P0：$($p0.Count)；字段：$($fields.Count)；页面：$($pages.Count)；权限：$($permissions.Count)"
Write-Host "综合方案SHA-256：$actualHash"
Write-Host "工作簿SHA-256：$workbookHash"
