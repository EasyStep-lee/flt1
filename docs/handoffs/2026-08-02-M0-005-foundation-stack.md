# M0-005 NestJS/Prisma/MySQL/Redis/BullMQ底座交接

## 1. 身份

- 阶段/任务：`M0 / M0-005 初始化NestJS/Prisma/MySQL/Redis/BullMQ底座`
- 日期/时区：2026-08-02，UTC-04:00
- 本地仓库：`C:\Users\lichuanjun\Documents\flt1`
- 开发分支：`codex/m0-nestjs-prisma-mysql-redis-bullmq`
- 实现提交：`5c8764c16ec2064ea146e51898b0716e0b43bd36`
- P0映射：无；本任务为M0工程基础任务
- 远程/PR/CI：`BLOCKED_EXTERNAL / NOT_EXECUTED`，本地没有origin

## 2. 结果与范围

M0-005建立了真实的`@fulishe/api`和`@fulishe/db`工作区包、本地MySQL/Redis编排、BullMQ连接、Prisma Client生成/校验/seed连接框架，以及带requestId、结构化安全日志、统一基础异常和依赖诊断的NestJS健康接口。

本任务没有创建供应商、商品、价格、库存、订单、福利卡、支付、配送、对账或页面业务，也没有创建五端应用壳、OpenAPI、业务DTO、错误码台账、业务数据模型或SQL迁移。

## 3. 固定版本与供应链

| 组件 | 固定版本/制品 |
|---|---|
| NestJS | `11.1.28` |
| Prisma CLI/Client | `6.19.2` |
| BullMQ / ioredis | `6.0.5 / 5.11.1` |
| MySQL | `8.4.11@sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb` |
| Redis | `7.4.10-alpine@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2` |
| TypeScript / ESLint | `5.9.3 / 9.39.5` |
| Prisma配置链安全override | `effect 3.20.0` |

- `pnpm audit --prod`：PASS，0项已知漏洞。
- Prisma保持6.19.2是有意兼容选择；7.9.1是需要驱动架构迁移的独立大版本，不能在M0-005顺手升级。
- BullMQ上游`cron-parser 5.6.2`产生deprecated提示，但当前审计无已知漏洞；后续依赖维护不得通过无验证降级处理。
- pnpm提示部分依赖生命周期脚本未自动批准；本底座通过显式`prisma:generate`工作，在`--ignore-scripts`干净安装中已实际通过全链验证。

## 4. API与基础设施契约

| 能力 | 契约 |
|---|---|
| 存活 | `GET /health/live`固定返回200和`UP` |
| 就绪 | `GET /health/ready`在MySQL、Redis、BullMQ全UP时返回200，否则返回503 |
| 诊断 | 只返回依赖状态、安全代码和耗时，不返回URL、密码、堆栈或底层异常 |
| requestId | 合法`x-request-id`原样回传，否则生成UUID；错误响应同样关联 |
| 连接超时 | 默认3000ms |
| 健康探针超时 | 默认1500ms，超时为`PROBE_TIMEOUT` |
| 连接重试 | 最多3次，250/500/1000ms指数退避后停止 |
| BullMQ任务默认 | 3次尝试、1000ms指数退避；尚无业务队列或Worker |

MySQL和Redis仅绑定`127.0.0.1:3306/6379`。Compose使用非生产开发默认密码、容器健康检查和命名卷；测试结束后容器已停止，`fulishe_mysql_data`与`fulishe_redis_data`卷保留。

## 5. Prisma与迁移边界

- 新增MySQL datasource和Prisma Client generator。
- `schemaModels=0`、`sqlMigrations=0`；没有占位表或业务表。
- seed只执行连接探测，实际写入业务行数为0。
- `prisma:validate`和Client生成已通过。
- 空库/升级路径、migration dry-run、备份恢复和向前修复演练严格留给M0-010。

## 6. 先红后绿与验证证据

| 验证 | 结果 |
|---|---|
| 静态失败测试 | 预期失败33项：API、Compose、Prisma和基础设施文件不存在 |
| 单元/API失败测试 | 预期`ERR_MODULE_NOT_FOUND`：`dist`实现不存在 |
| 首次编译 | 暴露ioredis NodeNext默认导入问题；改为命名导入后通过 |
| 首次干净复现 | 暴露`@fulishe/db`类型入口依赖旧dist；类型入口改为源码后通过 |
| 第二次干净复现 | 暴露Turbo test未构建API自身；改为同包`build`依赖后通过 |
| 最终干净复现 | PASS：冻结安装、Compose、lint、typecheck、unit、API contract、Prisma validate、build |
| 单元测试 | PASS：5/5 |
| API契约测试 | PASS：3/3，覆盖live/ready/503/requestId/安全404/缺配置快速失败 |
| 真实基础设施 | PASS：MySQL、Redis、BullMQ就绪，Prisma seed连接成功且零业务写入 |
| 重复启动 | PASS：down后保留卷、重新up并再次通过三依赖就绪 |
| 真实降级 | PASS：基础设施停止时2.53秒内返回503，诊断无秘密 |
| lint/typecheck/build | PASS |
| `pnpm audit --prod` | PASS：0项已知漏洞 |
| 产品基线 | PASS；只有执行状态追加导致的预期目录快照告警 |

机器证据：`artifacts/verification/M0-005/foundation-stack.json`。

## 7. 明确未执行

- 五端应用壳：`NOT_EXECUTED`，归属M0-006。
- 完整共享配置Schema、环境分层和秘密扫描：`NOT_EXECUTED`，归属M0-007；M0-005只有启动所需最小校验和`.env.example`。
- OpenAPI、DTO白名单和错误码冻结：`NOT_EXECUTED`，归属M0-008。
- Vitest、Supertest、Playwright和P0 E2E：`NOT_EXECUTED`，归属M0-009。
- Prisma migration dry-run、备份恢复和升级演练：`NOT_EXECUTED`，归属M0-010。
- `pnpm verify`和GitHub CI：`NOT_EXECUTED`，归属M0-011。
- 真机、预发布、生产、真实支付与生产迁移：`NOT_EXECUTED`。

## 8. 主要文件

- 根工程：`package.json`、`pnpm-lock.yaml`、`turbo.json`、`tsconfig.base.json`、`eslint.config.mjs`
- 本地基础设施：`.env.example`、`compose.yaml`
- API：`apps/api/package.json`、`apps/api/src/**`、`apps/api/test/**`
- 数据库：`packages/db/package.json`、`packages/db/prisma/**`、`packages/db/src/**`、`packages/db/scripts/**`
- 说明与证据：`README.md`、`docs/architecture/FOUNDATION_INFRASTRUCTURE.md`、`tests/infrastructure/**`、`artifacts/verification/M0-005/foundation-stack.json`

## 9. 风险与回滚

- Docker Desktop后台已被本任务启动；测试结束后项目容器已删除，两个命名卷保留。正常清理不得使用`down -v`。
- `.env.example`中的密码明确只用于本地开发；M0-007必须补齐生产配置Schema、秘密扫描和正式日志脱敏门禁。
- Prisma 7、完整迁移演练、CI依赖脚本允许清单仍是后续任务，不能把本地通过写成这些门禁已完成。
- 代码回滚使用本任务实现提交的`git revert`；基础设施停止使用`pnpm infra:down`。数据卷不随代码回滚自动删除，需人工确认后单独处理。

## 10. 下一任务

- 唯一允许开始：`M0-006 初始化五端应用壳`。
- M0-006只建立两个后台、Next.js门户、用户小程序和跑腿小程序的独立可构建入口及规定的公开/私有与会话边界，不实现业务页面。
- GitHub目标确认前，push、PR、Issue和CI持续为`BLOCKED_EXTERNAL/NOT_EXECUTED`。
