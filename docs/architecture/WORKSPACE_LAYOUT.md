# pnpm workspace与Turborepo布局

## 1. 本任务范围

M0-004只建立可重复安装的工作区、版本锁定、目录责任和Turborepo任务图。它不创建NestJS、Prisma、MySQL、Redis、BullMQ或五端应用，不建立空壳 `pnpm verify`。

## 2. 工作区边界

```text
root
├─ apps/*       可独立运行、构建或部署
├─ packages/*   可复用、无独立部署入口
├─ scripts/*    工程校验与确定性生成
├─ tests/*      失败测试和回归证据
└─ docs/*       产品、架构、验收和交接
```

唯一工作区通配范围为 `apps/*` 和 `packages/*`。方案、提示词包、执行包、UI资产、证据和工具输出都不能被误识别为npm包。

## 3. 依赖方向

```text
apps/*  ──────> packages/*
packages/high-level ──────> packages/low-level
packages/*  -X-> apps/*
apps/A      -X-> apps/B源码
```

- 跨工作区依赖必须在各包 `package.json` 中使用 `workspace:` 协议声明。
- 应用之间通过API/契约协作，不以相对路径导入另一个应用源码。
- 共享包不得隐藏业务权限或泄露供应价；服务端授权与DTO白名单仍是安全边界。
- 循环依赖由后续M0质量门禁阻断。

## 4. 版本真源

| 工具 | 固定版本 | 登记位置 |
|---|---:|---|
| Node.js | 22.23.1 | `package.json#engines.node`、`.node-version`、`.nvmrc` |
| pnpm | 10.12.1 | `package.json#packageManager`、`package.json#engines.pnpm` |
| Turborepo | 2.10.8 | `package.json#devDependencies.turbo`、`pnpm-lock.yaml` |

`engine-strict=true`使不匹配的Node/pnpm安装失败；锁文件必须由固定pnpm版本更新并提交。

## 5. Turborepo任务图

M0-004只声明后续包应实现的 `dev`、`build`、`lint`、`typecheck` 和 `test` 任务及缓存边界。当前没有应用包，因此 `workspace:graph`返回零项是正确的范围证据，不是build通过。

M0-005至M0-010逐步补齐真实包任务；M0-011建立根级完整质量命令和 `pnpm verify`，届时任何缺失或空套件策略必须显式可审计。

## 6. 可复现安装

```powershell
pnpm install --frozen-lockfile
pnpm workspace:check
pnpm workspace:graph
```

验收必须在不复制 `node_modules` 的临时干净目录中执行冻结安装。通过只表示工作区和锁文件可安装，不表示业务应用、数据库、OpenAPI或CI已完成。
