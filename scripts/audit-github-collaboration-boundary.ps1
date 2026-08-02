[CmdletBinding()]
param(
    [string]$RootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$OutputPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'artifacts\verification\M0-003\github-collaboration-boundary.json')
)

$ErrorActionPreference = 'Stop'

function Invoke-GitRead {
    param([string[]]$Arguments)
    $output = @(& git -C $RootPath @Arguments 2>$null)
    [pscustomobject]@{
        exitCode = $LASTEXITCODE
        lines = @($output | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ })
    }
}

function ConvertTo-GitHubOwnerRepo {
    param([AllowNull()][string]$RemoteUrl)
    if ([string]::IsNullOrWhiteSpace($RemoteUrl)) { return $null }

    $candidate = $RemoteUrl.Trim()
    $owner = $null
    $repo = $null
    if ($candidate -match '^https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$') {
        $owner = $Matches[1]
        $repo = $Matches[2]
    } elseif ($candidate -match '^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$') {
        $owner = $Matches[1]
        $repo = $Matches[2]
    } elseif ($candidate -match '^ssh://git@github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$') {
        $owner = $Matches[1]
        $repo = $Matches[2]
    }
    if (-not $owner -or -not $repo) { return $null }
    return "$owner/$repo"
}

$generatedAt = Get-Date -Format o
$branchProbe = Invoke-GitRead -Arguments @('branch','--show-current')
$headProbe = Invoke-GitRead -Arguments @('rev-parse','HEAD')
$statusProbe = Invoke-GitRead -Arguments @('status','--porcelain=v1')
$remotesProbe = Invoke-GitRead -Arguments @('remote')
$originProbe = Invoke-GitRead -Arguments @('remote','get-url','origin')
$originUrl = if ($originProbe.exitCode -eq 0) { $originProbe.lines | Select-Object -First 1 } else { $null }
$ownerRepo = ConvertTo-GitHubOwnerRepo -RemoteUrl $originUrl

$remoteNames = @($remotesProbe.lines | Sort-Object -Unique)
$statusLines = @($statusProbe.lines)
$untrackedCount = @($statusLines | Where-Object { $_ -like '??*' }).Count
$trackedChangeCount = $statusLines.Count - $untrackedCount

$ghCommand = @(Get-Command gh -ErrorAction SilentlyContinue | Select-Object -First 1)
$ghAvailable = $ghCommand.Count -gt 0
$ghAuthenticated = $false
$ghApiReachable = $false
$ghAccount = $null
if ($ghAvailable) {
    & $ghCommand[0].Source auth status --hostname github.com *> $null
    $ghAuthenticated = $LASTEXITCODE -eq 0
    if ($ghAuthenticated) {
        $accountOutput = @(& $ghCommand[0].Source api user --jq '.login' 2>$null)
        $accountExit = $LASTEXITCODE
        if ($accountExit -eq 0 -and $accountOutput.Count -gt 0) {
            $ghAccount = $accountOutput[0].ToString().Trim()
            $ghApiReachable = -not [string]::IsNullOrWhiteSpace($ghAccount)
        }
    }
}

$targetStatus = if ($ownerRepo) { 'CONFIRMED_FROM_ORIGIN' } else { 'UNCONFIRMED' }
$targetSource = if ($ownerRepo) { 'ORIGIN' } else { 'NONE' }
$defaultBranch = $null
$visibility = $null
$permission = $null
if ($ownerRepo -and $ghApiReachable) {
    $repositoryJson = @(& $ghCommand[0].Source api "repos/$ownerRepo" --jq '{defaultBranch:.default_branch,visibility:.visibility,permission:.permissions}' 2>$null)
    if ($LASTEXITCODE -eq 0 -and $repositoryJson.Count -gt 0) {
        try {
            $repository = (($repositoryJson | ForEach-Object { $_.ToString() }) -join "`n") | ConvertFrom-Json
            $defaultBranch = $repository.defaultBranch
            $visibility = $repository.visibility
            $permission = $repository.permission
        } catch { }
    }
}

$remoteWriteAllowed = $false
if ($ownerRepo -and $ghAuthenticated -and $permission -and $permission.push -eq $true) {
    $remoteWriteAllowed = $true
}

$humanApprovals = @(
    [ordered]@{ id = 'TARGET_OWNER_REPO'; status = if ($ownerRepo) { 'CONFIRMED_FROM_ORIGIN' } else { 'PENDING_USER_CONFIRMATION' }; requiredFor = '添加或使用origin、远程读写、Issue/PR/CI'; evidence = if ($ownerRepo) { $ownerRepo } else { '未提供owner/repo或URL，本地origin不存在' } },
    [ordered]@{ id = 'DEFAULT_BRANCH'; status = if ($defaultBranch) { 'CONFIRMED_FROM_GITHUB' } else { 'PENDING_USER_CONFIRMATION' }; requiredFor = '基线分支、PR目标和保护规则'; evidence = if ($defaultBranch) { $defaultBranch } else { '推荐main但不得代替人工确认' } },
    [ordered]@{ id = 'REMOTE_WRITE'; status = if ($remoteWriteAllowed) { 'PERMISSION_OBSERVED' } else { 'BLOCKED_EXTERNAL' }; requiredFor = '推送开发分支和创建Draft PR'; evidence = if ($remoteWriteAllowed) { 'GitHub仓库权限显示push=true' } else { '目标仓库或写权限未确认' } },
    [ordered]@{ id = 'BRANCH_PROTECTION'; status = 'PENDING_REPOSITORY_ADMIN'; requiredFor = 'main保护、必需检查和人工审批'; evidence = '只能由仓库管理员在目标仓库确认' },
    [ordered]@{ id = 'SECRETS_AND_ENVIRONMENTS'; status = 'PENDING_REPOSITORY_ADMIN'; requiredFor = 'CI外部服务、预发布和生产'; evidence = '秘密不得进入聊天、仓库或本报告' }
)

$report = [ordered]@{
    schemaVersion = '1.0.0'
    taskId = 'M0-003'
    mode = 'READ_ONLY'
    generatedAt = $generatedAt
    rootPath = $RootPath
    localRepository = [ordered]@{
        currentBranch = ($branchProbe.lines | Select-Object -First 1)
        head = ($headProbe.lines | Select-Object -First 1)
        remoteNames = $remoteNames
        statusEntryCount = $statusLines.Count
        trackedChangeCount = $trackedChangeCount
        untrackedCount = $untrackedCount
    }
    repositoryTarget = [ordered]@{
        status = $targetStatus
        source = $targetSource
        ownerRepo = $ownerRepo
        originUrl = $originUrl
        defaultBranch = $defaultBranch
        recommendedDefaultBranch = 'main'
        visibility = $visibility
        permission = $permission
    }
    authentication = [ordered]@{
        cliAvailable = $ghAvailable
        status = if ($ghAuthenticated -and $ghApiReachable) { 'AUTHENTICATED' } elseif ($ghAuthenticated) { 'AUTHENTICATED_API_UNVERIFIED' } else { 'NOT_AUTHENTICATED' }
        account = $ghAccount
        apiReachable = $ghApiReachable
        credentialMaterialRecorded = $false
    }
    remotePolicy = [ordered]@{
        localDevelopmentAllowed = $true
        remoteReadAllowed = [bool]$ownerRepo
        remoteWriteAllowed = $remoteWriteAllowed
        allowedActions = @(
            'READ_LOCAL_GIT',
            'CREATE_CODEX_BRANCH',
            'COMMIT_EXACT_TASK_FILES',
            'CONTINUE_M0_LOCAL'
        )
        prohibitedActions = @(
            'ADD_ORIGIN_WITHOUT_USER_TARGET',
            'PUSH_ANY_REMOTE',
            'CREATE_OR_UPDATE_REMOTE_PR',
            'CREATE_OR_UPDATE_REMOTE_ISSUE',
            'DIRECT_MAIN_WRITE',
            'FORCE_PUSH_OR_REWRITE_PUBLIC_HISTORY',
            'MODIFY_REPOSITORY_ADMIN',
            'MODIFY_SECRETS_OR_ENVIRONMENTS',
            'MERGE_OR_RELEASE_OR_DEPLOY'
        )
    }
    humanApprovals = $humanApprovals
    evidence = [ordered]@{
        commands = @(
            'git status --short',
            'git branch --show-current',
            'git remote -v',
            'git log -5 --oneline',
            'gh auth status',
            'gh api user --jq .login'
        )
        remote = if ($ownerRepo) { 'LOCAL_ORIGIN_OBSERVED' } else { 'NO_ORIGIN' }
        pullRequest = 'NOT_EXECUTED'
        continuousIntegration = 'NOT_EXECUTED'
    }
    conclusion = [ordered]@{
        status = if ($ownerRepo) { 'REMOTE_TARGET_OBSERVED' } else { 'LOCAL_ONLY_BOUNDARY_CONFIRMED' }
        nextAllowedTask = 'M0-004'
        localEngineering = 'ALLOWED'
        remoteEvidence = if ($remoteWriteAllowed) { 'REMOTE_WRITE_PERMISSION_OBSERVED' } else { 'BLOCKED_EXTERNAL' }
        note = if ($ownerRepo) { '已从origin读取目标；任何远程写入仍需服从任务与管理员边界。' } else { '目标owner/repo与默认分支未确认；M0本地工程可继续，所有远程操作保持阻塞。' }
    }
}

$outputDirectory = Split-Path $OutputPath -Parent
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}
$json = $report | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($OutputPath, $json, [Text.UTF8Encoding]::new($false))

Write-Host 'M0-003 GitHub协作边界审计完成。' -ForegroundColor Green
Write-Host "报告：$OutputPath"
Write-Host "仓库目标：$targetStatus；远程写入：$remoteWriteAllowed；下一任务：M0-004"
exit 0
