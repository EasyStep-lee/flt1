# M1-P068 公司独立页面完整性交接

## 结论与边界

- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 基线：`main@aa7b9a7a7f8a8b763c1e17c5f471996cc0af9a2e`；分支：`codex/m1-m1-p068`；实现提交：`a2cb8a66ac4b3827757203dfde5c10dcb1f08f12`。
- 当前结论：`LOCAL_PASS`。`pnpm verify` 17/17 与真实 MySQL 迁移演练均通过；Issue #25 已创建，Draft PR 尚未创建，CI/预发布/生产未执行。
- 本切片只完成 P0-068。M1-P069 供应商注册登录与职能选择，以及 M2-M5 商品、价格、订单、福利卡、财务、物流、CMS 业务内容均未进入。

## 实际变更

- 新增 API-083 `GET /v1/company-auth/workspace/page`。服务端只从 Secure HttpOnly Cookie 解析当前公司职能，会话固定路由必须与请求 `route` 精确一致。
- 十类公司职能各有独立模块目录、筛选、详情与交付时间线。可共用渲染组件，但角色变化会重置查询和详情状态，服务端不会返回其他职能模块。
- PAGE-003 至 PAGE-012 统一覆盖 `loading`、`empty`、`error`、`permission-denied`、`offline-or-timeout`、`success`。PAGE-004 供应商准入和 PAGE-012 审计事件原有 M1 功能保留。
- 后续阶段模块使用 `DEFERRED` 明确标记，不生成假商品、假订单、假财务或假配送数据。
- OpenAPI 与生成类型已同步；新增 `WORKSPACE_MODULE_NOT_FOUND`。响应白名单禁止内部归属、令牌、供应价、供应商应付、毛利和银行字段。
- Prisma schema 与迁移链无变化。

## 先红后绿证据

| 证据 | RED | GREEN |
| --- | --- | --- |
| API-083 行为 | 4/4 因端点与模块错误码不存在而失败 | 4/4 通过 |
| 公司鉴权/工作台回归 | N/A | 20/20 通过 |
| OpenAPI | 新操作不存在 | 1/1 通过 |
| P0-068 Chromium | 页面完整性行为未实现 | 2/2 通过 |
| P003/P045/P046/P067 回归 | N/A | 6/6 通过 |
| 静态门禁 | N/A | `pnpm lint`、`pnpm typecheck` 通过 |
| 全量门禁 | N/A | `pnpm verify` 17/17 通过，P0 E2E 15/15 |
| 迁移演练 | N/A | empty=2、upgrade=2、restore=2、product=8、cleanup=PASS |

RED 未通过删除测试、降断言或文本锚点规避。完整命令和环境记录见 `artifacts/verification/M1-P068/company-workspace-completeness.json`；MySQL 原始报告见 `artifacts/verification/M1-P068/prisma-migration-rehearsal.json`。

## P0 与安全证据

- P0-068：10 个固定公司页面均有工作台、内部模块列表/筛选/详情/时间线和六类页面状态，证据等级 `LOCAL_PASS`。
- NEG-M1-068-01：六类状态由 Playwright 行为测试触发并断言。
- NEG-M1-068-02：跨职能路由与客户端上下文覆盖先拒绝；十类模块目录互斥。
- NEG-M1-068-03：API 与页面对成功、错误响应执行敏感字段泄露检查。
- 缓存边界：API-083 为 `private, no-store`；本切片没有公开缓存、搜索索引或埋点写入。
- 金额、库存、福利卡账本、支付和退款：本切片未触及。

## 环境、风险与回滚

- 本地：Windows、Node 22.23.1、pnpm 10.12.1、Playwright Chromium。
- 真机：本 PC Web 切片不要求；`NOT_REQUIRED_PC_WEB_SLICE`。
- staging / production：`NOT_EXECUTED`。
- 风险：API-083 当前返回页面能力元数据；后续真实业务模块接入时必须继续由服务端职能会话定界，不得把 `DEFERRED` 当作业务完成。
- 回滚：`git revert` P068 实现与证据提交；无数据库迁移或数据回滚。

## GitHub 与下一门禁

- 仓库：`EasyStep-lee/flt1`；Issue：[#25](https://github.com/EasyStep-lee/flt1/issues/25)。
- 开发分支：`codex/m1-m1-p068`；PR：尚未创建；评论/检查/合并：`NOT_EXECUTED`。
- 下一步仅允许：完成全量验证、审查差异、推送分支、创建 Draft PR、读取精确 head Actions 并修复同切片问题。
- P068 未经精确 head CI、人工审查、用户对精确 head 授权合并且合并后 main CI 成功前，M1-P069 明确禁止进入。
