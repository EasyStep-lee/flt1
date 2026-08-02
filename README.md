# 福礼社单商户供应链平台

本仓库以 `福礼社单商户供应链平台V1.1综合方案.html` 为唯一产品基线，当前处于M0工程底座阶段。任何业务实现都必须按执行包任务顺序推进，不能用页面或空脚本冒充验收通过。

## 固定工具版本

- Node.js `22.23.1`
- pnpm `10.12.1`
- Turborepo `2.10.8`
- NestJS `11.1.28`
- Prisma `6.19.2`
- MySQL `8.4.11`
- Redis `7.4.10`
- BullMQ `6.0.5`

版本同时记录在 `package.json`、`.node-version`、`.nvmrc` 和 `pnpm-lock.yaml`。版本不匹配时先切换工具链，不得绕过 `engine-strict`。

## 本地安装与检查

```powershell
pnpm install --frozen-lockfile
pnpm workspace:check
pnpm workspace:graph
Copy-Item -LiteralPath .env.example -Destination .env
pnpm infra:up
pnpm prisma:validate
pnpm build
pnpm --filter @fulishe/api start
```

M0-005之后，`workspace:graph`必须显示`@fulishe/db`和依赖它的`@fulishe/api`两个构建任务。健康接口为`GET /health/live`和`GET /health/ready`；完整启动、停止、超时/重试和验证说明见`docs/architecture/FOUNDATION_INFRASTRUCTURE.md`。完整的 `pnpm verify` 仍由M0-011建立。

## 目录

- `apps/`：可独立启动或部署的API、Web后台、企业门户和两个原生小程序。
- `packages/`：无独立部署入口的共享数据库、契约、UI、适配器、配置和测试能力。
- `docs/`：产品基线、架构、验收和阶段交接证据。
- `scripts/`：确定性生成、校验和工程自动化脚本。
- `tests/`：当前切片的失败测试与回归测试。

详细依赖方向见 `docs/architecture/WORKSPACE_LAYOUT.md`。

## 当前外部边界

GitHub目标仓库尚未确认。允许本地 `codex/` 分支和原子提交；不得猜测origin、推送、创建PR或声称CI通过。
