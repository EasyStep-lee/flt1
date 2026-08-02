# M0-007 配置Schema与秘密扫描交接

## 1. 身份

- 阶段/任务：`M0 / M0-007 建立配置Schema与秘密扫描`
- 日期/时区：2026-08-02，UTC-04:00
- 本地仓库：`C:\Users\lichuanjun\Documents\flt1`
- 开发分支：`codex/m0-schema`
- 实现提交：`4d46293f668dcbd0dc5465ed65803e4fda9a3618`
- P0映射：无；本任务为M0工程基础任务
- 远程/PR/CI：`BLOCKED_EXTERNAL / NOT_EXECUTED`，本地没有origin

## 2. 结果与范围

M0-007建立了共享`@fulishe/config`包，统一API配置Schema、四层部署环境、非本地环境防误配、结构化日志脱敏和Git已跟踪文件秘密扫描。API保留原`loadRuntimeConfig`/`RuntimeConfigError`调用入口，由共享包提供实现，既有健康检查和基础设施能力未改变。

仓库只跟踪`.env.example`；没有提交真实密钥，也没有选择或假装接入生产秘密管理服务。本任务未创建业务页面、业务API、OpenAPI、DTO、错误码、Prisma业务模型或SQL迁移。

## 3. 环境与配置契约

| APP_ENV | NODE_ENV | 凭据来源 | 防误配 |
|---|---|---|---|
| development | development | 本机未跟踪`.env` | 允许本机开发值 |
| test | test | 测试进程/隔离环境 | 允许测试专用值 |
| staging | production | 部署平台运行时注入 | 拒绝回环依赖、缺失凭据和已知占位值 |
| production | production | 受控秘密系统运行时注入 | 同上；错误只给字段名和规则 |

- `DATABASE_URL`和`REDIS_URL`缺失时一次汇总并快速失败。
- MySQL/Redis协议、端口、超时、重试和BullMQ前缀均按Schema约束。
- `API_HOST=0.0.0.0`作为容器监听地址允许使用；staging/production的MySQL和Redis仍禁止通配、localhost、IPv6回环及完整`127.0.0.0/8`。
- `.env.example`只用于development结构验证；API生产启动不回退到开发样例。
- 基础设施测试先加载`.env.example`，再允许未跟踪`.env`覆盖，因此无需把本地秘密写入仓库。

## 4. 密钥管理与秘密扫描

`pnpm secrets:scan`调用`git ls-files`，只扫描已跟踪内容，不读取用户未跟踪的UI资产和本机文件。本次对218个已跟踪文件通过扫描，规则覆盖秘密赋值、含凭据连接URL、GitHub令牌和私钥头；命中输出只给路径、行列、规则和`[REDACTED]`，不回显值。

扫描是确定性本地门禁，不是完整DLP或生产秘密管理替代品。开发、测试、预发布和生产必须账户隔离；轮换采用新增版本、部署验证、切换、撤销旧版本和审计复核的顺序。真实生产授权与凭据仍由具名人工安全管理员提供。

## 5. 日志脱敏

- `redactLogValue`递归处理对象、数组、错误和循环引用，不修改输入对象。
- authorization、cookie、password、secret、token、各类key、连接串和福利卡卡密字段按键脱敏。
- 文本中的凭据URL、Bearer/Basic值和秘密赋值同样替换。
- API`SafeJsonLogger`在写出前统一调用共享脱敏器，并保留安全的结构化字段。

脱敏不代表允许主动记录敏感信息；综合方案第十四章的供应价、个人信息和业务审计禁止项仍需后续业务切片单独执行。

## 6. 先红后绿与问题收敛

| 阶段 | 证据 |
|---|---|
| 首轮失败测试 | 0通过、5失败：共享包、APP_ENV、策略文档和扫描器均不存在 |
| 首轮仓库扫描 | 误报检测正则、临时CI数据库值和测试哨兵；把环境变量、源码字面量与明确测试占位规则分开后收敛，仍保留真实命中 |
| 首轮真实基础设施命令 | 因按规定没有未跟踪`.env`而在连接前失败；测试命令改为安全样例基线加可选本地覆盖后，真实就绪与降级测试均通过 |
| 生产防误配复核 | 允许容器通配监听，但拒绝依赖回环网段和文档占位凭据；错误中不含原值 |
| 最终干净复现 | M0-006五端壳冻结安装与M0-007配置安全冻结安装均PASS |

## 7. 最终验证

| 验证 | 结果 |
|---|---|
| 配置、扫描与日志测试 | PASS：18/18 |
| Git已跟踪文件秘密扫描 | PASS：218个文件，0命中 |
| 工作区lint/typecheck/build | PASS：10/10、10/10、10/10 |
| 包级构建与测试任务 | PASS：18/18 |
| API单元/契约 | PASS：5/5、3/3 |
| 真实MySQL/Redis/BullMQ就绪 | PASS：1/1；验证后容器已停止，数据卷保留 |
| 基础设施不可用降级 | PASS：1/1，错误有界且不泄漏 |
| M0-006 / M0-007干净冻结安装 | PASS / PASS |
| Prisma Schema / Compose配置 | PASS / PASS，零新增业务模型和迁移 |
| `pnpm audit --prod` | PASS：0项已知漏洞 |
| 产品基线 | PASS；只有执行状态追加导致的预期目录快照告警 |
| 执行包自检 | PASS |

机器证据：`artifacts/verification/M0-007/configuration-and-secrets.json`。

## 8. 明确未执行

- OpenAPI、DTO、错误码、生成契约和分端传输接入：`NOT_EXECUTED`，归属M0-008。
- Vitest、Supertest、Playwright和P0 E2E：`NOT_EXECUTED`，归属M0-009。
- migration dry-run、备份恢复和升级演练：`NOT_EXECUTED`，归属M0-010。
- 根级`pnpm verify`与GitHub CI：`NOT_EXECUTED`，归属M0-011。
- 生产秘密管理供应商选型、真实凭据注入、轮换演练、预发布、真机和生产：`NOT_EXECUTED`。

## 9. 主要文件与回滚

- 配置与脱敏：`packages/config/src/configuration.ts`、`packages/config/src/redaction.ts`
- 秘密扫描：`packages/config/src/secret-scanner.ts`、`scripts/scan-secrets.mjs`
- API接入：`apps/api/src/config/runtime-config.ts`、`apps/api/src/logging/safe-json.logger.ts`
- 验证：`tests/configuration/**`、`artifacts/verification/M0-007/configuration-and-secrets.json`
- 策略：`docs/architecture/CONFIGURATION_AND_SECRETS.md`

代码回滚使用`git revert 4d46293f668dcbd0dc5465ed65803e4fda9a3618`。没有数据库迁移、数据回写或真实秘密需要撤销；构建产物可重新生成，不得删除用户未跟踪的UI资产。

## 10. 下一任务

- 唯一允许开始：`M0-008 建立确定性OpenAPI、统一类型与传输适配`。
- M0-008只能建立契约生成、DTO白名单、错误结构、Web/小程序适配和破坏性变更门禁，不得提前实现业务交易流程。
- GitHub目标确认前，push、PR、Issue和CI持续为`BLOCKED_EXTERNAL/NOT_EXECUTED`。
