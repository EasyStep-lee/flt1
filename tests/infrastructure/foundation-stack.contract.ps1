[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$failures = [System.Collections.Generic.List[string]]::new()

function Assert-Foundation {
    param(
        [Parameter(Mandatory)] [bool] $Condition,
        [Parameter(Mandatory)] [string] $Message
    )

    if (-not $Condition) {
        $failures.Add($Message)
    }
}

$requiredFiles = @(
    '.env.example',
    'compose.yaml',
    'eslint.config.mjs',
    'tsconfig.base.json',
    'apps/api/package.json',
    'apps/api/src/main.ts',
    'apps/api/src/bootstrap.ts',
    'apps/api/src/config/runtime-config.ts',
    'apps/api/src/health/health.controller.ts',
    'apps/api/src/health/health.service.ts',
    'apps/api/src/infrastructure/foundation-policy.ts',
    'apps/api/src/infrastructure/prisma.service.ts',
    'apps/api/src/infrastructure/redis.service.ts',
    'apps/api/src/infrastructure/queue.service.ts',
    'apps/api/test/unit/foundation.test.mjs',
    'apps/api/test/contract/health-api.test.mjs',
    'apps/api/test/integration/foundation-runtime.test.mjs',
    'packages/db/package.json',
    'packages/db/prisma/schema.prisma',
    'packages/db/prisma/migrations/README.md',
    'packages/db/src/index.ts',
    'packages/db/src/seed.ts',
    'tests/infrastructure/foundation-clean-install.ps1',
    'docs/architecture/FOUNDATION_INFRASTRUCTURE.md'
)

foreach ($relativePath in $requiredFiles) {
    Assert-Foundation (Test-Path -LiteralPath (Join-Path $root $relativePath)) "缺少M0-005文件：$relativePath"
}

$rootPackagePath = Join-Path $root 'package.json'
if (Test-Path -LiteralPath $rootPackagePath) {
    $rootPackage = Get-Content -LiteralPath $rootPackagePath -Raw | ConvertFrom-Json
    foreach ($scriptName in @('infra:config', 'infra:up', 'infra:down', 'lint', 'typecheck', 'test', 'test:api', 'test:infra', 'prisma:validate', 'build')) {
        Assert-Foundation ($null -ne $rootPackage.scripts.$scriptName) "根package.json缺少真实脚本：$scriptName"
    }
    Assert-Foundation ($null -eq $rootPackage.scripts.verify) 'M0-005不得提前创建pnpm verify；该任务属于M0-011'
    Assert-Foundation ($null -eq $rootPackage.scripts.'openapi:generate') 'M0-005不得提前创建OpenAPI生成；该任务属于M0-008'
    Assert-Foundation ($rootPackage.pnpm.overrides.effect -eq '3.20.0') 'Prisma配置链的effect安全修复必须精确锁定3.20.0'
}

$apiPackagePath = Join-Path $root 'apps\api\package.json'
if (Test-Path -LiteralPath $apiPackagePath) {
    $apiPackage = Get-Content -LiteralPath $apiPackagePath -Raw | ConvertFrom-Json
    $expectedApiDependencies = [ordered]@{
        '@fulishe/db' = 'workspace:*'
        '@nestjs/common' = '11.1.28'
        '@nestjs/core' = '11.1.28'
        '@nestjs/platform-express' = '11.1.28'
        'bullmq' = '6.0.5'
        'ioredis' = '5.11.1'
        'reflect-metadata' = '0.2.2'
        'rxjs' = '7.8.2'
    }
    foreach ($entry in $expectedApiDependencies.GetEnumerator()) {
        Assert-Foundation ($apiPackage.dependencies.($entry.Key) -eq $entry.Value) "API依赖未精确锁定：$($entry.Key)=$($entry.Value)"
    }
}

$dbPackagePath = Join-Path $root 'packages\db\package.json'
if (Test-Path -LiteralPath $dbPackagePath) {
    $dbPackage = Get-Content -LiteralPath $dbPackagePath -Raw | ConvertFrom-Json
    Assert-Foundation ($dbPackage.dependencies.'@prisma/client' -eq '6.19.2') 'Prisma Client必须精确锁定为6.19.2'
    Assert-Foundation ($dbPackage.devDependencies.prisma -eq '6.19.2') 'Prisma CLI必须精确锁定为6.19.2'
}

$composePath = Join-Path $root 'compose.yaml'
if (Test-Path -LiteralPath $composePath) {
    $compose = Get-Content -LiteralPath $composePath -Raw
    Assert-Foundation ($compose -match 'mysql:8\.4\.11@sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb') 'MySQL镜像必须锁定8.4.11及其digest'
    Assert-Foundation ($compose -match 'redis:7\.4\.10-alpine@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2') 'Redis镜像必须锁定7.4.10-alpine及其digest'
    Assert-Foundation ($compose -match '127\.0\.0\.1:\$\{MYSQL_PORT:-3306\}:3306') 'MySQL端口必须只绑定本机并允许开发端口覆盖'
    Assert-Foundation ($compose -match '127\.0\.0\.1:\$\{REDIS_PORT:-6379\}:6379') 'Redis端口必须只绑定本机并允许开发端口覆盖'
    Assert-Foundation ($compose -match '(?s)mysql:.*?healthcheck:') 'MySQL必须配置容器健康检查'
    Assert-Foundation ($compose -match '(?s)redis:.*?healthcheck:') 'Redis必须配置容器健康检查'
    Assert-Foundation ($compose -notmatch ':latest(?:\s|@)') '容器镜像不得使用latest'
}

$schemaPath = Join-Path $root 'packages\db\prisma\schema.prisma'
if (Test-Path -LiteralPath $schemaPath) {
    $schema = Get-Content -LiteralPath $schemaPath -Raw
    Assert-Foundation ($schema -match 'provider\s*=\s*"mysql"') 'Prisma datasource必须使用MySQL'
    Assert-Foundation ($schema -notmatch '(?m)^\s*model\s+') 'M0-005不得提前创建任何业务或占位数据模型'
}

$apiSourcePath = Join-Path $root 'apps\api\src'
if (Test-Path -LiteralPath $apiSourcePath) {
    $forbiddenBusinessModule = Get-ChildItem -LiteralPath $apiSourcePath -Recurse -File -Filter '*.ts' |
        Select-String -Pattern 'ProductModule|OrderModule|PaymentModule|DeliveryModule|SupplierModule|WelfareCardModule'
    Assert-Foundation (@($forbiddenBusinessModule).Count -eq 0) 'M0-005检测到提前实现的业务模块'
}

foreach ($deferredPath in @('apps/company-admin', 'apps/supplier-portal', 'apps/portal-web', 'apps/user-miniapp', 'apps/runner-miniapp', 'packages/contracts', 'packages/config', 'packages/test-kit')) {
    Assert-Foundation (-not (Test-Path -LiteralPath (Join-Path $root $deferredPath))) "M0-005越界创建后续任务目录：$deferredPath"
}

if ($failures.Count -gt 0) {
    $details = $failures | ForEach-Object { "- $_" }
    throw "M0-005基础设施契约失败（$($failures.Count)项）：`n$($details -join "`n")"
}

Write-Output 'M0-005基础设施契约通过：API、Prisma、MySQL、Redis、BullMQ及阶段边界均可复核。'
