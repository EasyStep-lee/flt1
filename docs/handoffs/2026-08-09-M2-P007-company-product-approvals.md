# M2-P007 公司双页面审核上架交接

## 结论与边界

- 结论：`LOCAL_PASS`；`CI_PASS`、合并和合并后 `main` CI 均未执行。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 基线：`main@ae7abc827f1759cd2dc00201ce23fab4710fe6ce`；实现提交 `b4fb026383ecfab86bccf47965377a827d2cd149`；分支 `codex/m2-product-approval`；Issue [#39](https://github.com/EasyStep-lee/flt1/issues/39)。
- 唯一范围：`P0-007` 公司商品资料审核与公司初始三价审核分离，双通过后唯一物化 `Product/Sku`。
- 明确未进入：供应商价格页面/API、上架后调价、分类模板、库存、货架、订单、支付、配送；`M2-P008` 仍锁定。

## 实际变更

- 新增资料审核和初始价格审核的两个独立控制器、DTO、服务、固定职能会话解析器。
- 新增 `GET/POST /v1/company/product-material-reviews` 与 `GET/POST /v1/company/price-reviews`；全部 `private, no-store`。
- `COMPANY_PRODUCT_OPS` 只能看到冻结资料白名单且不含价格；`COMPANY_PRICE_REVIEW` 才能看到冻结三价。
- 审批按任务版本和幂等键推进；申请人与审核人按自然人 `identityId` 隔离；审计写入失败整体回滚。
- 仅一项通过时不创建公司商品；两项均通过后调用既有唯一映射事务，并发只生成一组 `Product/Sku`。
- 驳回后供应商补正不会覆盖旧资料/价格申请快照；资料补正期间旧价格任务不能被批准。
- PAGE-005 和 PAGE-006 已替换为真实审核队列、决定弹窗以及 loading/empty/error/permission/offline/unknown-result 恢复状态。
- `stageInitialPrices` 当前仅为仓储领域入口和测试装配，不暴露供应商 HTTP 路由；供应商价格页面/API 属于锁定的 `M2-P008`。

## 数据、迁移与历史

- Prisma 追加 `ApprovalType.PRODUCT_INITIAL_PRICE` 与 `ApprovalAccountTypeCode.COMPANY_PRICE_REVIEW`。
- 新迁移：`packages/db/prisma/migrations/20260809100000_m2_company_product_approval/migration.sql`。
- 既有 `ApprovalTask/History/Command` 与 `AuditLog` 继续承载只追加历史和幂等响应；未创建供应商钱包、支付、库存或第二套商品资源。
- 本地真实 MySQL 演练：`empty=2 / upgrade=2 / restore=2 / product=13 / cleanup=PASS`；staging/production 未应用。
- 回滚：应用代码可回退到 `ae7abc8`；已应用数据库迁移不得回改，失败时使用应用兼容窗口并创建前向修复迁移，或按受控备份恢复流程处理。

## OpenAPI、错误码与权限

- 确定性 OpenAPI/类型已生成，字节稳定检查通过。
- 决定 DTO：`decision=APPROVE|REJECT`、非空 `opinion`、`version`；公司、供应商、审核人和职能账号均从会话/任务派生。
- 关键错误：`WORKSPACE_FORBIDDEN`、`APPROVAL_NOT_FOUND`、`APPROVAL_VERSION_CONFLICT`、`APPROVAL_STATE_INVALID`、`SELF_APPROVAL_FORBIDDEN`、`IDEMPOTENCY_CONFLICT`、`AUDIT_REQUIRED`。
- 普通审计快照仅记录状态、版本和决定，不写三类价格。

## 测试证据

| 证据 | 命令/结果 | 状态 |
| --- | --- | --- |
| RED | focused API 首跑 5/5 因缺少 `stageInitialPrices` 失败 | 已确认 |
| API GREEN | `company-product-approvals-api.test.mjs` 6/6 | PASS |
| 相邻回归 | `supplier-products-api.test.mjs` 5/5 | PASS |
| 页面 focused | `p0-007-company-product-approvals.spec.ts` 2/2 | PASS |
| lint / typecheck | 全仓命令退出 0 | PASS |
| Prisma | validate 通过；13 条迁移链演练通过 | PASS |
| OpenAPI | generate/check 字节一致 | PASS |
| `pnpm verify` | `PNPM_VERIFY_OK:steps=17:base=HEAD`；报告绑定实现提交 `b4fb026383ecfab86bccf47965377a827d2cd149` | PASS |

行为覆盖：双审门禁、职能交叉拒绝、同人自审拒绝、幂等并发重放、旧版本冲突、审计失败回滚、历史快照、资料端价格字段泄露和页面失败恢复。

## 风险、外部边界与下一步

- 本地使用内存仓储验证失败恢复，并用真实 MySQL 验证迁移链；未连接生产数据、真实供应商、staging 或生产环境。
- 非阻塞警告：公司/供应商后台存在大于 500 kB 的构建 chunk，部分 Ant Design `Spin.tip` / `Card.bordered` API 已弃用；本切片不改变性能预算或跨范围重构，后续同阶段维护时处理。
- 真机、微信和真实支付不适用于本切片；不可据此升级任何 DEVICE/STAGING/PRODUCTION 证据。
- Draft PR 尚未创建，CI/评论/合并状态均为 `NOT_EXECUTED`。
- 下一动作是完成证据复验、复核 diff、提交推送并创建 Draft PR；只有精确 head CI 成功且人工授权合并、合并后 main CI 成功，才允许开始 `M2-P008`。
