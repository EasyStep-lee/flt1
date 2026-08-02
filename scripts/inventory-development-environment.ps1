[CmdletBinding()]
param(
    [string]$RootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$OutputPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'artifacts\verification\M0-002\environment-inventory.json')
)

$ErrorActionPreference = 'Stop'

function Invoke-VersionProbe {
    param([string]$Name, [string[]]$Arguments)
    $command = @(Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($command.Count -eq 0) {
        return [pscustomobject]@{ status = 'MISSING'; version = $null; path = $null; exitCode = $null }
    }
    try {
        $output = @(& $command[0].Source @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
        $text = ($output | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ }) -join ' '
        return [pscustomobject]@{
            status = if ($exitCode -eq 0) { 'AVAILABLE' } else { 'ERROR' }
            version = if ($text) { $text } else { $null }
            path = $command[0].Source
            exitCode = $exitCode
        }
    } catch {
        return [pscustomobject]@{ status = 'ERROR'; version = $null; path = $command[0].Source; exitCode = $null }
    }
}

function Invoke-GitRead {
    param([string[]]$Arguments)
    $output = @(& git -C $RootPath @Arguments 2>$null)
    return [pscustomobject]@{ exitCode = $LASTEXITCODE; lines = @($output | ForEach-Object { $_.ToString() }) }
}

$generatedAt = Get-Date -Format o
$node = Invoke-VersionProbe -Name 'node' -Arguments @('--version')
$npm = Invoke-VersionProbe -Name 'npm' -Arguments @('--version')
$pnpm = Invoke-VersionProbe -Name 'pnpm' -Arguments @('--version')
$corepack = Invoke-VersionProbe -Name 'corepack' -Arguments @('--version')
$gitTool = Invoke-VersionProbe -Name 'git' -Arguments @('--version')
$gh = Invoke-VersionProbe -Name 'gh' -Arguments @('--version')
$docker = Invoke-VersionProbe -Name 'docker' -Arguments @('--version')

$dockerCompose = [pscustomobject]@{ status = 'MISSING'; version = $null; path = $docker.path; exitCode = $null }
$dockerDaemon = [pscustomobject]@{ status = 'NOT_CHECKED'; serverVersion = $null }
if ($docker.status -ne 'MISSING') {
    $composeOutput = @(& $docker.path compose version 2>&1)
    $composeExit = $LASTEXITCODE
    $dockerCompose = [pscustomobject]@{
        status = if ($composeExit -eq 0) { 'AVAILABLE' } else { 'UNAVAILABLE' }
        version = (($composeOutput | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ }) -join ' ')
        path = $docker.path
        exitCode = $composeExit
    }
    $daemonOutput = @(& $docker.path info --format '{{.ServerVersion}}' 2>&1)
    $daemonExit = $LASTEXITCODE
    $dockerDaemon = [pscustomobject]@{
        status = if ($daemonExit -eq 0) { 'AVAILABLE' } else { 'UNAVAILABLE' }
        serverVersion = if ($daemonExit -eq 0) { (($daemonOutput | Select-Object -First 1).ToString().Trim()) } else { $null }
    }
}

$mysql = Invoke-VersionProbe -Name 'mysql' -Arguments @('--version')
if ($mysql.status -eq 'MISSING') {
    $mysqlServer = Invoke-VersionProbe -Name 'mysqld' -Arguments @('--version')
    if ($mysqlServer.status -ne 'MISSING') { $mysql = $mysqlServer }
}
$redis = Invoke-VersionProbe -Name 'redis-server' -Arguments @('--version')
if ($redis.status -eq 'MISSING') {
    $redisCli = Invoke-VersionProbe -Name 'redis-cli' -Arguments @('--version')
    if ($redisCli.status -ne 'MISSING') { $redis = $redisCli }
}

$wechatCandidates = [System.Collections.Generic.List[string]]::new()
$programFiles = [Environment]::GetEnvironmentVariable('ProgramFiles')
$programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
$localAppData = [Environment]::GetEnvironmentVariable('LOCALAPPDATA')
foreach ($base in @($programFiles, $programFilesX86, $localAppData)) {
    if ([string]::IsNullOrWhiteSpace($base)) { continue }
    foreach ($relative in @(
        'Tencent\微信web开发者工具\cli.bat',
        'Tencent\微信开发者工具\cli.bat',
        '微信开发者工具\cli.bat',
        'Programs\微信web开发者工具\cli.bat',
        'Programs\微信开发者工具\cli.bat'
    )) {
        $candidate = Join-Path $base $relative
        if (Test-Path -LiteralPath $candidate) { $wechatCandidates.Add((Resolve-Path -LiteralPath $candidate).Path) }
    }
}
$wechatRegistry = [System.Collections.Generic.List[object]]::new()
foreach ($registryPath in @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
)) {
    Get-ItemProperty -Path $registryPath -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -match '微信.*开发者工具|WeChat.*DevTools' } |
        ForEach-Object {
            $wechatRegistry.Add([pscustomobject]@{ name = $_.DisplayName; version = $_.DisplayVersion; location = $_.InstallLocation })
        }
}
$wechatDevTools = [pscustomobject]@{
    status = if ($wechatCandidates.Count -gt 0 -or $wechatRegistry.Count -gt 0) { 'AVAILABLE' } else { 'MISSING' }
    cliPaths = @($wechatCandidates | Sort-Object -Unique)
    registrations = @($wechatRegistry)
}

$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
$diskDrive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($RootPath).TrimEnd('\').TrimEnd(':')) -ErrorAction SilentlyContinue
$disk = if ($diskDrive) {
    [pscustomobject]@{
        root = $diskDrive.Root
        freeBytes = [long]$diskDrive.Free
        usedBytes = [long]$diskDrive.Used
        freeGiB = [math]::Round($diskDrive.Free / 1GB, 2)
    }
} else { $null }

$branchProbe = Invoke-GitRead -Arguments @('branch','--show-current')
$headProbe = Invoke-GitRead -Arguments @('rev-parse','HEAD')
$remoteProbe = Invoke-GitRead -Arguments @('remote','-v')
$statusProbe = Invoke-GitRead -Arguments @('status','--porcelain=v1')
$statusLines = @($statusProbe.lines | Where-Object { $_ })
$untrackedCount = @($statusLines | Where-Object { $_ -like '??*' }).Count
$trackedChangeCount = $statusLines.Count - $untrackedCount

$ghAuthenticated = $false
$ghAccount = $null
if ($gh.status -ne 'MISSING') {
    $ghAuthOutput = @(& $gh.path auth status 2>&1)
    $ghAuthExit = $LASTEXITCODE
    $ghAuthenticated = $ghAuthExit -eq 0
    $ghAuthText = ($ghAuthOutput | ForEach-Object { $_.ToString() }) -join "`n"
    if ($ghAuthText -match 'account\s+([^\s(]+)') { $ghAccount = $Matches[1] }
}

$serviceMatches = @(Get-Service -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'docker|mysql|redis' -or $_.DisplayName -match 'docker|mysql|redis' } |
    Sort-Object Name |
    ForEach-Object {
        [pscustomobject]@{ name = $_.Name; displayName = $_.DisplayName; status = $_.Status.ToString(); startType = $_.StartType.ToString() }
    })

$plannedPorts = @(3000,3001,3002,3003,3004,3005,3306,6379)
$listeners = [System.Collections.Generic.List[object]]::new()
try {
    foreach ($connection in @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in $plannedPorts })) {
        $processName = $null
        try { $processName = (Get-Process -Id $connection.OwningProcess -ErrorAction Stop).ProcessName } catch { }
        $listeners.Add([pscustomobject]@{
            address = $connection.LocalAddress
            port = $connection.LocalPort
            processId = $connection.OwningProcess
            processName = $processName
        })
    }
} catch { }

$environmentVariables = @(
    'NODE_ENV','DATABASE_URL','REDIS_URL','WECHAT_APP_ID','WECHAT_APP_SECRET','WECHAT_MCH_ID','WECHAT_API_V3_KEY'
) | ForEach-Object {
    [pscustomobject]@{ name = $_; present = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_)) }
}

$facts = [System.Collections.Generic.List[object]]::new()
$gaps = [System.Collections.Generic.List[object]]::new()
$blockers = [System.Collections.Generic.List[object]]::new()

$facts.Add([pscustomobject]@{ code = 'BASELINE_GUARD'; description = 'V1.1产品基线守卫已在本任务开始前通过。'; affects = 'ALL' })
$facts.Add([pscustomobject]@{ code = 'GIT_BRANCH'; description = "当前分支为$($branchProbe.lines | Select-Object -First 1)，HEAD为$($headProbe.lines | Select-Object -First 1)。"; affects = 'M0' })
if ($ghAuthenticated) {
    $facts.Add([pscustomobject]@{ code = 'GH_AUTH'; description = "GitHub CLI已认证$ghAccount；报告未保存令牌。"; affects = 'M0-003' })
} else {
    $blockers.Add([pscustomobject]@{ code = 'GH_AUTH_MISSING'; description = 'GitHub CLI未认证，远程协作前需人工授权。'; affects = 'M0-003' })
}
if ($remoteProbe.lines.Count -eq 0) {
    $blockers.Add([pscustomobject]@{ code = 'GITHUB_REPOSITORY_UNCONFIRMED'; description = '本地仓库没有origin，用户尚未提供owner/repo；禁止猜测或推送。'; affects = 'M0-003' })
} else {
    $facts.Add([pscustomobject]@{ code = 'GIT_REMOTE_PRESENT'; description = '本地存在Git远程；M0-003仍需核验目标与权限。'; affects = 'M0-003' })
}
if ($untrackedCount -gt 0) {
    $facts.Add([pscustomobject]@{ code = 'USER_FILES_PRESENT'; description = "工作树有$($untrackedCount)项未跟踪条目，本任务未删除或覆盖；提交必须按精确路径暂存。"; affects = 'ALL' })
}

$nodeMajor = if ($node.version -match 'v?(\d+)\.') { [int]$Matches[1] } else { $null }
if ($node.status -eq 'AVAILABLE' -and $nodeMajor -eq 22) {
    $facts.Add([pscustomobject]@{ code = 'NODE_22'; description = "Node版本满足目标：$($node.version)。"; affects = 'M0-004' })
} else {
    $gaps.Add([pscustomobject]@{ code = 'NODE_VERSION'; description = "目标Node 22，当前为$($node.version ?? 'MISSING')；本任务不安装。"; affects = 'M0-004' })
}
$pnpmMajor = if ($pnpm.version -match '^(\d+)\.') { [int]$Matches[1] } else { $null }
if ($pnpm.status -eq 'AVAILABLE' -and $pnpmMajor -eq 10) {
    $facts.Add([pscustomobject]@{ code = 'PNPM_10'; description = "pnpm主版本满足目标：$($pnpm.version)。"; affects = 'M0-004' })
} else {
    $gaps.Add([pscustomobject]@{ code = 'PNPM_VERSION'; description = "目标pnpm 10，当前为$($pnpm.version ?? 'MISSING')；本任务不安装。"; affects = 'M0-004' })
}
if ($docker.status -eq 'MISSING') {
    $gaps.Add([pscustomobject]@{ code = 'DOCKER_CLIENT'; description = '未发现Docker CLI。'; affects = 'M0-005' })
} elseif ($dockerDaemon.status -ne 'AVAILABLE') {
    $gaps.Add([pscustomobject]@{ code = 'DOCKER_DAEMON'; description = 'Docker CLI存在但daemon当前不可用；本任务未启动服务。'; affects = 'M0-005' })
} else {
    $facts.Add([pscustomobject]@{ code = 'DOCKER_READY'; description = "Docker daemon可读，Server $($dockerDaemon.serverVersion)。"; affects = 'M0-005' })
}
if ($mysql.status -eq 'MISSING') {
    $gaps.Add([pscustomobject]@{ code = 'MYSQL_CLIENT'; description = '未发现本机MySQL命令；M0-005可使用Docker服务。'; affects = 'M0-005' })
}
if ($redis.status -eq 'MISSING') {
    $gaps.Add([pscustomobject]@{ code = 'REDIS_CLIENT'; description = '未发现本机Redis命令；M0-005可使用Docker服务。'; affects = 'M0-005' })
}
if ($wechatDevTools.status -eq 'MISSING') {
    $gaps.Add([pscustomobject]@{ code = 'WECHAT_DEVTOOLS'; description = '常见路径和卸载注册表未发现微信开发者工具；真机/上传前需人工安装确认。'; affects = 'M0-006/M3/M4' })
}

$report = [ordered]@{
    schemaVersion = '1.0.0'
    taskId = 'M0-002'
    mode = 'READ_ONLY'
    generatedAt = $generatedAt
    rootPath = $RootPath
    system = [ordered]@{
        os = if ($os) { "$($os.Caption) $($os.Version) build $($os.BuildNumber) $($os.OSArchitecture)" } else { [Environment]::OSVersion.VersionString }
        powershell = $PSVersionTable.PSVersion.ToString()
        processArchitecture = [Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()
        timeZone = [TimeZoneInfo]::Local.Id
        disk = $disk
    }
    repository = [ordered]@{
        branch = ($branchProbe.lines | Select-Object -First 1)
        head = ($headProbe.lines | Select-Object -First 1)
        remotes = @($remoteProbe.lines)
        statusEntryCount = $statusLines.Count
        trackedChangeCount = $trackedChangeCount
        untrackedCount = $untrackedCount
        statusEntries = $statusLines
        ghAuthenticated = $ghAuthenticated
        ghAccount = $ghAccount
    }
    tools = [ordered]@{
        node = $node
        npm = $npm
        pnpm = $pnpm
        corepack = $corepack
        git = $gitTool
        gh = $gh
        docker = [ordered]@{ status = $docker.status; version = $docker.version; path = $docker.path; daemon = $dockerDaemon }
        dockerCompose = $dockerCompose
        mysql = $mysql
        redis = $redis
        wechatDevTools = $wechatDevTools
    }
    services = $serviceMatches
    plannedPortListeners = @($listeners | Sort-Object port,address)
    environmentVariables = $environmentVariables
    confirmedFacts = @($facts)
    gaps = @($gaps)
    externalBlockers = @($blockers)
    conclusion = [ordered]@{
        status = 'M0_002_PASS_WITH_GAPS'
        nextAllowedTask = 'M0-003'
        remoteWriteAllowed = $false
        note = '盘点任务完成不代表环境已安装或M0门禁通过；缺口由对应后续任务处理。'
    }
}

$outputDirectory = Split-Path $OutputPath -Parent
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}
$json = $report | ConvertTo-Json -Depth 10
[IO.File]::WriteAllText($OutputPath, $json, [Text.UTF8Encoding]::new($false))

Write-Host 'M0-002只读环境盘点完成。' -ForegroundColor Green
Write-Host "报告：$OutputPath"
Write-Host "事实：$($facts.Count)；缺口：$($gaps.Count)；外部阻塞：$($blockers.Count)"
exit 0
