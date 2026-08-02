# M0-004 pnpm workspace与Turborepo交接

## 1. 身份

- 阶段/任务：`M0 / M0-004 初始化pnpm workspace与Turborepo`
- 日期/时区：2026-08-02，UTC-04:00
- 本地仓库：`C:\Users\lichuanjun\Documents\flt1`
- 开发分支：`codex/m0-pnpm-workspace-turborepo`
- 实现提交：`9067c36c87949693bc53432a57b149314b592cc2`
- P0映射：无；本任务为M0工程基础任务
- 远程/PR/CI：`BLOCKED_EXTERNAL / NOT_EXECUTED`，本地没有origin

## 2. 结果与范围

M0-004建立了TypeScript工程后续可承载的pnpm workspace与Turborepo基础，精确锁定Node、pnpm和Turborepo版本，明确 `apps/*`、`packages/*` 的唯一包范围、目录职责和依赖方向，并提交可冻结安装的锁文件。

本任务没有创建NestJS、Prisma、MySQL、Redis、BullMQ、Web后台、门户或小程序应用，也没有建立空壳 `pnpm verify`。这些分别属于M0-005至M0-011。

## 3. 固定版本与真源

| 工具 | 固定版本 | 真源 |
|---|---:|---|
| Node.js | `22.23.1` | `package.json#engines.node`、`.node-version`、`.nvmrc` |
| pnpm | `10.12.1` | `package.json#packageManager`、`package.json#engines.pnpm` |
| Turborepo | `2.10.8` | `package.json#devDependencies.turbo`、`pnpm-lock.yaml` |
| pnpm锁文件 | `lockfileVersion: 9.0` | `pnpm-lock.yaml` |

- `engine-strict=true`；Node/pnpm版本不匹配时安装失败。
- `save-exact=true`；新增依赖默认精确保存。
- `strict-peer-dependencies=true`；peer依赖冲突不静默放行。
- `node_modules/`、`.turbo/`、构建和测试输出均被忽略，未纳入提交。

关键文件SHA-256：

| 文件 | SHA-256 |
|---|---|
| `package.json` | `123E664391D5FF0681BE35B462D61ED9EB1A2DAD19FA1C24F9B9D43A3B5EBA4A` |
| `pnpm-lock.yaml` | `99EF4BBA7D29A53F65C206DB0D7A19F9B05E70F9A6FC5B45CA2F9C909D4B98C2` |
| `pnpm-workspace.yaml` | `60CE4D1DBF137701A4683D171391C51662700C2F3E32A7CAAB8B2EFC22540E65` |
| `turbo.json` | `1C27ABE8B43EA073BC3A524CD0496006581A4511E5CCF4CB1CF9352AA9F3EAE8` |

## 4. 工作区责任

- `apps/*`：只放可独立启动、构建或部署的API、公司后台、供应商后台、企业门户和两个原生小程序。
- `packages/*`：只放无独立部署入口的数据库、契约、UI、配置、适配器和测试能力。
- 应用可以依赖共享包；共享包不得反向依赖应用；应用之间不得直接导入源码。
- 方案、提示词包、执行包、UI资产、证据和工具输出不属于npm工作区，不能被通配误收。

目录名称及最早创建任务已经登记在 `apps/README.md`、`packages/README.md` 和 `docs/architecture/WORKSPACE_LAYOUT.md`。M0-004只有两个README占位，不包含伪造应用代码。

## 5. 先红后绿与验收证据

| 验证 | 命令/证据 | 结果 |
|---|---|---|
| 失败测试 | `./tests/workspace/workspace-foundation.test.ps1` | 预期失败：缺少 `package.json` |
| 初次回归 | 同一测试 | 冻结安装成功；dry-run因Turbo遥测提示混入JSON而失败，修正为只解析stdout |
| focused test | 同一测试 | PASS：版本锁定、目录职责、干净冻结安装和Turbo任务图均可复核 |
| 根目录冻结安装 | `pnpm install --frozen-lockfile` | PASS：锁文件无需更新 |
| 工作区契约 | `pnpm workspace:check` | PASS：Node 22.23.1、pnpm 10.12.1、Turbo 2.10.8 |
| Turbo任务图 | `pnpm workspace:graph` | PASS：`monorepo=true`，`packages=[]`、`tasks=[]` |
| 机器证据 | `artifacts/verification/M0-004/workspace-foundation.json` | PASS，无错误项，明确verify延后至M0-011 |
| 工作簿渲染 | `outputs/019fb64c-v11-workbook/after`、`after-formula-errors.json` | PASS：12个工作表完成渲染，公式错误扫描0项 |
| 本地执行包 | `福礼社Codex5.6开发执行包V1.1/scripts/verify-execution-pack.ps1` | PASS：任务149、P0 119、字段658、页面80、权限22 |
| 桌面执行包 | 桌面副本独立执行同一校验器 | PASS：综合方案与工作簿哈希一致；工作簿SHA-256为 `FF7CE84FF891A84135C1C5C36688A031F663A38869B9FD469C0CDA01F5268259` |

干净安装测试只复制清单、锁文件、目录README和校验器到系统临时目录，不复制 `node_modules`；执行 `pnpm install --frozen-lockfile --ignore-scripts --prefer-offline` 后验证Turbo版本和任务图，随后只清理已校验位于系统临时目录的测试副本。

## 6. 明确未执行

- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`：`NOT_EXECUTED`；尚无真实应用或共享包，M0-004不建立零任务脚本冒充通过。
- `pnpm verify`：`NOT_EXECUTED`；归属M0-011。
- Prisma validate、migration dry-run、数据库/Redis启动：`NOT_EXECUTED`；归属M0-005/M0-010。
- OpenAPI生成、类型和兼容性检查：`NOT_EXECUTED`；归属M0-008。
- Schema/migration/OpenAPI/DTO/错误码/页面：本任务无变更。
- 真机、预发布、生产、真实支付：`NOT_EXECUTED`。

## 7. 本任务文件

- `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`turbo.json`
- `.node-version`、`.nvmrc`、`.npmrc`、`.gitignore`
- `.editorconfig`、`.gitattributes`
- `README.md`、`CONTRIBUTING.md`
- `apps/README.md`、`packages/README.md`
- `docs/architecture/WORKSPACE_LAYOUT.md`
- `scripts/verify-workspace-foundation.mjs`
- `tests/workspace/workspace-foundation.test.ps1`
- `artifacts/verification/M0-004/workspace-foundation.json`

## 8. 风险与回滚

- 当前Turbo任务图为空是阶段事实；M0-005/M0-006创建真实包后必须出现任务，M0-011再建立完整质量门禁。
- 精确Node版本提高复现性，也要求所有开发和CI运行22.23.1；不能用忽略engines的方式绕过。
- 回滚使用本任务实现提交的 `git revert`；删除依赖文件前应确认后续任务尚未依赖，禁止破坏性reset。

## 9. 下一任务

- 唯一允许开始：`M0-005 初始化NestJS/Prisma/MySQL/Redis/BullMQ底座`。
- M0-005必须在当前workspace内创建真实API/基础服务和健康检查，不得实现商品、订单、支付或配送业务。
- GitHub目标确认前，push、PR、Issue和CI持续为 `BLOCKED_EXTERNAL/NOT_EXECUTED`。
