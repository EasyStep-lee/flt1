# M2-P008 供应商独立价格页面与初始三价提交契约

- 方案哈希：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 基线：`main@15a10daae913e2dae8c97f3a47d92ef1497a3c1e`
- Issue：[#41](https://github.com/EasyStep-lee/flt1/issues/41)
- 分支：`codex/m2-supplier-pricing`
- 唯一 P0：`P0-008 供应商独立价格页面`

## 目标与完成定义

`SUPPLIER_PRICING` 在 PAGE-018 为当前供应商已提交资料的商品逐 SKU 设置供应价、个人零售价和企业集采价（全部为非负安全整数分），经 API-022 幂等冻结为初始价格审核快照。PAGE-017 与 `SUPPLIER_PRODUCT` API 不读取、不提交也不缓存三类价格；公司价格审核只能决定冻结快照，不能改写供应商报价。

## 字段与白名单

- 请求：`requestId`、`prices[]`；价格行只允许 `supplierSkuCode`、`requestedSupplyPrice`、`requestedRetailSalePrice`、`requestedEnterpriseSalePrice`。
- 归属：`supplierId`、`identityId`、`functionalAccountId` 均由固定会话派生，客户端提供即拒绝。
- 响应：仅 PAGE-018 返回当前供应商的商品、SKU、三价冻结值和审核状态；不得返回公司归属、其他供应商归属、审核人私有字段或结算字段。
- 金额：禁止浮点、负数、非安全整数；SKU 编码必须无重复且与商品 SKU 集合完全一致。

## 权限、状态与失败

- `SUPPLIER_PRICING` 固定路由 `/supplier/workspaces/pricing`；其他职能调用返回 `WORKSPACE_FORBIDDEN`。
- 只有 `PENDING_MATERIAL_REVIEW` 或 `MATERIAL_APPROVED` 商品可提交初始价格；`ACTIVE` 的后续调价属于 M2-P019/M2-P071。
- 同一商品只能有一个 `PENDING` 初始价格审核；驳回后可用新幂等键重新提交，旧快照不覆盖。
- 跨供应商或不存在对象统一返回 `SUPPLIER_SCOPE_FORBIDDEN`，不产生任务、历史或审计。
- 关键错误：`PRICE_INVALID`、`SUPPLIER_SCOPE_FORBIDDEN`、`WORKSPACE_FORBIDDEN`、`INITIAL_PRICE_STATE_INVALID`、`INITIAL_PRICE_REVIEW_PENDING`、`IDEMPOTENCY_CONFLICT`、`AUDIT_REQUIRED`。
- 审批任务、历史、幂等响应和脱敏审计必须同事务成功；审计快照不得记录三类价格。

## 非范围

- 不实现 API-023 已上架供应价变更。
- 不实现 API-024 零售/集采销售价免审调价。
- 不声明 P0-019 或 P0-071 完成。
- 不进入分类模板、库存、货架、订单、支付或配送。

## 验收路径

1. 行为 RED：API-022 未接入时提交初始三价失败。
2. API：职能隔离、供应商隔离、整数分、完整 SKU 集合、幂等/并发、审计回滚、冻结快照。
3. 页面：PAGE-018 真实读取与提交；覆盖 loading/empty/error/permission/offline/validation/unknown-result/success；PAGE-017 无价格请求和字段。
4. focused、相关 API/E2E、OpenAPI、迁移演练和 `pnpm verify` 提供新鲜证据。
