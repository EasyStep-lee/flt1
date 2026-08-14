# 2026-08-13 M3-P022 个人与企业跨供应商订单交接

阶段结论：`IN_PROGRESS / LOCAL_PASS`。M3-P020 已由 PR #78 合并为 `main@f2b64fa64520db4d5daf051b1a58d3f295519331`，合并后 Actions run `31756365765` 成功。本切片已完成实现、focused 验证和 `pnpm verify` 17/17；尚未取得 Draft PR 精确 head CI、人工合并及合并后 main CI，staging、真机与 production 均未执行。

## 基线、范围与 GitHub

- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线：`main@f2b64fa64520db4d5daf051b1a58d3f295519331`。
- 当前任务：M3-P022；P0-022；MIG-012；PAGE-055；API-036/API-048。
- Issue：[#79](https://github.com/EasyStep-lee/flt1/issues/79)；分支：`codex/m3-cross-supplier-orders`；实现提交：`5e95f3e6aad7483bd2fe13470c5c31fcb4bc80d4`；全量验证提交：`4e5a468c423848a4a70a011147f3f8cbe93be3b7`；PR：待创建。
- 非目标：库存预扣/确认/释放、购物车完整增删改、地址与结算页、福利卡、微信支付、退款、配送、售后、对账；M3-P023 及后续锁定。

## 实际变更

- 新增 `BuyerOrder`、`BuyerOrderItem`、`SupplierFulfillmentOrder`、`BuyerOrderEvent` Prisma 模型及 MIG-012。
- 新增个人和企业创建订单 API；归属只从会话派生，按渠道销售价在服务端重算，一张主订单按供应商精确拆分。
- 供应价只写内部订单项快照；对客 DTO、创建事件、OpenAPI 和小程序状态均不返回供应价或内部买家归属。
- 小程序购物车按供应来源分组，统一提交只发送 `skuId + quantity`；未知结果复用原幂等键。
- OpenAPI、生成类型、`miniapp-kit` 契约、P0/任务/页面/API/迁移/测试证据台账和总控工作簿已同步。

## RED / GREEN 新鲜证据

- RED：`pnpm --filter @fulishe/api build; pnpm exec vitest run apps/api/test/supertest/cross-supplier-order-api.test.mjs`，4/4 因两个 POST 端点均为 404 失败。
- GREEN：同一 API 测试 4/4 通过；验证个人/企业渠道价、3 供应商拆单、幂等重放/冲突、认证与归属字段拒绝。
- GREEN：`pnpm exec vitest run apps/api/test/unit/prisma-order-repository.test.mjs`，2/2 通过；验证事务写入、内部供应价快照和对客结果映射。
- GREEN：`pnpm --filter @fulishe/user-miniapp build; node --test apps/user-miniapp/test/cart-order-build.test.mjs`，2/2 通过；验证仅提交 SKU/数量及未知结果复用原幂等键。
- GREEN：`pnpm exec playwright test tests/e2e/p0/p0-022-cross-supplier-orders.spec.ts --config playwright.p0.config.ts`，1/1 通过。
- GREEN：`pnpm prisma:validate`、`pnpm prisma:migrations:check`、`pnpm prisma:migrate:dry-run`、`pnpm openapi:generate`、`pnpm openapi:check` 和 breaking 检查均通过；迁移 rehearsal 为 empty=2、upgrade=2、restore=2、product=25、cleanup=PASS。
- 全量：`pnpm verify` 于 `2026-08-14T01:33:26.100Z` 至 `2026-08-14T01:49:30.853Z` 在提交 `4e5a468c423848a4a70a011147f3f8cbe93be3b7` 执行，退出码 0，17/17 步骤通过；报告：`artifacts/test-results/verification/pnpm-verify.json`。

## 环境等级与缺口

- 当前证据：`LOCAL_PASS`，Windows / Node 22.23.1 / pnpm 10.12.1 / Docker MySQL rehearsal / 本地 mock 会话与外部依赖。
- `CI_PASS`：当前切片 `NOT_EXECUTED`；PR 尚未创建。
- `STAGING_PASS`、`DEVICE_PASS`、`PRODUCTION_PASS`：`NOT_EXECUTED`。
- 本切片不要求真实支付或真机交互；Mock 结果不得升级为 staging、真机或生产证据。

## 风险、回滚与下一门禁

- 风险：M3-P023 尚未实现，因此当前订单创建不预扣库存；这不是可上线的完整交易闭环，不能启用真实交易流量。
- 验证警告：既有 Vite 页面状态测试在未启动 API 时记录代理 `ECONNREFUSED`，Ant Design 记录 `Spin.tip`、`Card.bordered` 弃用警告；本次门禁退出码仍为 0。后续应独立治理，但不能据此进入库存或资金切片。
- 金额与数据风险：所有金额为整数分；服务端忽略客户端价格；供应价严格内部；数据库约束保护买家二选一归属、金额守恒、幂等唯一和创建事件不可变。
- 回滚：回退本切片应用/小程序/契约/文档提交；在确认没有新版本写入前保留新增表。已应用迁移不得改写，数据库修复使用向前迁移。
- 下一步：完成全量门禁、自审、原子提交、推送并创建 Draft PR，读取精确 head Actions 与未解决评论。只有人工按精确 head 授权合并且合并后 main CI 成功，才可开始 M3-P023。
