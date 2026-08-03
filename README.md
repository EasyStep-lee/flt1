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
- React / React DOM `19.2.8`
- Vite `8.2.0`
- Next.js `16.2.12`
- Ant Design `6.5.3`
- TanStack Query `5.101.4`
- `@nestjs/swagger` `11.4.6`
- `openapi-typescript` `7.13.0`
- `openapi-fetch` `0.17.0`
- oasdiff `1.17.0`（下载包SHA-256校验）

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

M0-006之后，`workspace:graph`必须显示API、数据库、五端应用壳、共享UI和小程序请求边界共9个包。健康接口为`GET /health/live`和`GET /health/ready`；完整启动、停止、超时/重试和验证说明见`docs/architecture/FOUNDATION_INFRASTRUCTURE.md`。完整的 `pnpm verify` 仍由M0-011建立。

M0-007新增`@fulishe/config`，工作区现在共10个包。启动前可用`pnpm config:check`校验开发样例，用`pnpm secrets:scan`只扫描Git已跟踪文件；生产与预发布凭据必须在运行时注入，不能写入`.env.example`或仓库。完整边界见`docs/architecture/CONFIGURATION_AND_SECRETS.md`。

M0-008新增`@fulishe/contracts`和`@fulishe/web-api-client`，工作区现在共12个包。OpenAPI由NestJS后端确定生成，Web三端使用共享`openapi-fetch`客户端，两个原生小程序只复用生成类型并继续经过唯一`wx.request`适配器。完整边界见`docs/architecture/OPENAPI_CONTRACTS.md`。

```powershell
pnpm openapi:generate
pnpm openapi:check
pnpm test:openapi
pnpm openapi:breaking -- --base packages/contracts/openapi.json --revision packages/contracts/openapi.json
```

## 五端应用壳

```powershell
pnpm --filter @fulishe/company-admin dev   # 127.0.0.1:5173
pnpm --filter @fulishe/supplier-portal dev # 127.0.0.1:5174
pnpm --filter @fulishe/portal-web dev       # 127.0.0.1:3000
pnpm --filter @fulishe/user-miniapp build
pnpm --filter @fulishe/runner-miniapp build
pnpm test:shells
pnpm test:miniapp-transport
pnpm test:seo-cache
```

两个原生小程序构建后，分别用微信开发者工具打开`apps/user-miniapp`和`apps/runner-miniapp`；`project.config.json`固定使用非生产`touristappid`并指向`dist/`。当前只有一个内部壳页，不代表80个正式页面已实现。详细边界见`docs/architecture/APPLICATION_SHELLS.md`。

## 目录

- `apps/`：可独立启动或部署的API、Web后台、企业门户和两个原生小程序。
- `packages/`：无独立部署入口的共享数据库、契约、UI、适配器、配置和测试能力。
- `docs/`：产品基线、架构、验收和阶段交接证据。
- `scripts/`：确定性生成、校验和工程自动化脚本。
- `tests/`：当前切片的失败测试与回归测试。

详细依赖方向见 `docs/architecture/WORKSPACE_LAYOUT.md`。

## 当前外部边界

GitHub目标仓库尚未确认。允许本地 `codex/` 分支和原子提交；不得猜测origin、推送、创建PR或声称CI通过。
