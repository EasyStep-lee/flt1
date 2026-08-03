# M0-005 API与基础设施底座

## 1. 范围

本切片只建立统一NestJS API、Prisma/MySQL、Redis、BullMQ和可诊断健康检查，不包含供应商、商品、价格、库存、订单、福利卡、支付、配送、对账或页面业务。

- API运行入口：`apps/api`
- Prisma真源：`packages/db/prisma/schema.prisma`
- 本地编排：根目录`compose.yaml`
- 本地配置模板：根目录`.env.example`
- 下一阶段目录未创建：五端应用壳归M0-006；共享配置包归M0-007；OpenAPI归M0-008；Vitest/Supertest/Playwright归M0-009；迁移演练归M0-010；`pnpm verify`和CI归M0-011。

## 2. 固定版本

| 组件 | 固定版本 | 位置 |
|---|---:|---|
| NestJS | 11.1.28 | `apps/api/package.json` |
| Prisma CLI/Client | 6.19.2 | `packages/db/package.json` |
| BullMQ | 6.0.5 | `apps/api/package.json` |
| ioredis | 5.11.1 | `apps/api/package.json` |
| MySQL | 8.4.11 + image digest | `compose.yaml` |
| Redis | 7.4.10-alpine + image digest | `compose.yaml` |
| TypeScript | 5.9.3 | 工作区包清单 |

Prisma固定在6.19.2，以保持本切片的MySQL直连和既定schema结构稳定；升级到新主版本必须作为独立兼容性任务评估，不能随手漂移。

Prisma 6.19.2的配置依赖原始锁定`effect 3.18.4`存在已披露问题，根包通过pnpm override精确固定已修复的`effect 3.20.0`；`pnpm audit --prod`必须保持0项已知漏洞。BullMQ 6.0.5当前带有一个上游deprecated提示（`cron-parser 5.6.2`），审计无已知漏洞，不以无验证的大版本降级替代后续依赖维护。

## 3. 本地启动

Docker Desktop后台必须已经运行。开发默认密码只用于本机容器，不能复制到预发布或生产。

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
pnpm install --frozen-lockfile
pnpm infra:config
pnpm infra:up
pnpm prisma:validate
pnpm build
pnpm --filter @fulishe/api start
```

默认监听：API `127.0.0.1:3000`、MySQL `127.0.0.1:3306`、Redis `127.0.0.1:6379`。端口可在未提交的`.env`内覆盖。MySQL和Redis只绑定回环地址，不对局域网公开。

查看和停止：

```powershell
pnpm infra:status
pnpm infra:down
```

`infra:down`只移除本项目容器和网络，不删除`fulishe_mysql_data`、`fulishe_redis_data`命名卷；不得使用`down -v`处理正常停止。

## 4. 健康检查契约

| 路由 | 成功 | 失败 | 用途 |
|---|---|---|---|
| `GET /health/live` | 200、`status=UP` | 仅进程不可服务时失败 | 进程存活 |
| `GET /health/ready` | 200、三个依赖均`UP` | 503、返回失败依赖和安全错误码 | MySQL、Redis、BullMQ就绪 |

每个响应回传或生成`x-request-id`。就绪响应仅包含`database`、`redis`、`queue`的状态、代码和耗时，不返回连接URL、用户名、密码、堆栈或底层异常文本。依赖未就绪时API仍可启动并提供诊断，不把“进程存活”伪装成“基础设施就绪”。

## 5. 超时与重试

| 边界 | 默认值 | 规则 |
|---|---:|---|
| 连接超时 | 3000ms | Redis/BullMQ连接使用有界超时；MySQL URL固定`connect_timeout=3` |
| 单个健康探针 | 1500ms | 超时返回`PROBE_TIMEOUT`，不无限等待 |
| 连接重试 | 最多3次 | 250ms、500ms、1000ms指数退避，之后停止 |
| BullMQ任务默认尝试 | 3次 | 1000ms指数退避；业务队列建立后仍需逐队列审定 |
| BullMQ保留结果 | 成功1000、失败5000 | 仅为工程默认，不代替业务审计或账本 |

环境变量可在规定上下限内覆盖这些开发默认值；完整配置Schema、生产凭据策略和秘密扫描属于M0-007。

## 6. Prisma与迁移边界

当前schema只有generator和MySQL datasource，没有业务模型、占位表或SQL迁移。`pnpm prisma:validate`和Client生成不连接数据库；`pnpm --filter @fulishe/db seed`只验证真实连接，不写入业务数据。

迁移一律向前追加，已发布SQL不得修改。空库/升级路径、备份恢复、dry-run和向前修复演练属于M0-010；生产迁移始终需要授权人工。

## 7. 验证命令

```powershell
./tests/infrastructure/foundation-stack.contract.ps1
pnpm infra:config
pnpm lint
pnpm typecheck
pnpm test
pnpm test:api
pnpm prisma:validate
pnpm build
pnpm infra:up
pnpm test:infra
pnpm infra:down
pnpm test:infra:degraded
```

`pnpm test`和`pnpm test:api`中的Node内置测试仍保留M0-005先红后绿证据；M0-009已另行建立固定的Vitest、Supertest和Playwright测试金字塔，详见`TEST_PYRAMID.md`。不能用后建底座改写M0-005当时的验证边界。

pnpm 10可能提示部分依赖生命周期脚本未获自动批准。本底座不依赖隐式postinstall：Prisma Client由`prisma:generate`显式、可复核地生成；构建脚本在忽略依赖生命周期脚本的干净安装中也必须通过。正式CI的依赖脚本允许清单归M0-011冻结。
