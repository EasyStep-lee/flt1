# M2-P006 商品两层模型契约

## 目标与范围

- 阶段：M2。
- 唯一目标：供应商先维护不可售的 `SupplierProduct/SupplierProductSku`，只有公司商品资料与初始价格均批准后，系统才能幂等生成公司持有的可售 `Product/Sku`。
- 对应方案：§5 分类与模板、§6 商品/价格/库存。
- P0：P0-006。
- 当前结论：`LOCAL_PASS`；Draft PR、精确 head CI、人工合并和合并后 `main` CI 均为 `NOT_EXECUTED`。

## 明确非目标

- 不实现 M2-P007 公司商品资料审核页面和价格审核页面。
- 不实现 M2-P008 供应商独立价格页，不让商品资料页承载任何价格字段。
- 不实现分类树、分类模板、销售价、供应价审批、库存预扣、订单、支付或配送。
- 不把供应商解释成店铺，也不允许供应商成为收款主体。

## 数据与不变量

| 层 | 模型 | 归属 | 当前行为 |
| --- | --- | --- | --- |
| 上游资料 | `SupplierProduct` / `SupplierProductSku` | 会话派生的供应商 | 草稿、资料提交；不可直接对客销售 |
| 公司货架 | `Product` / `Sku` | 江苏福礼团供应链科技有限公司 | 仅双审完成后由内部服务幂等物化 |

- `Product.supplierProductId` 和 `Sku.supplierProductSkuId` 均有唯一约束，避免并发重复映射。
- `SupplierProductStatusHistory` 只追加；迁移用更新/删除触发器阻止历史覆盖。
- 命令以 `scope + idempotencyKey` 唯一，重复同请求返回快照，不同请求复用键返回冲突。
- 分类与模板实体将在 M2-P011/M2-P012 实现；本切片只冻结 UUID 与版本格式，不伪造真实分类/模板审核。

## 权限、数据范围与 DTO

- 供应商身份、`supplierId`、职能账号均从已验证会话派生；请求体出现归属字段、状态字段或任一价格字段直接拒绝。
- 只有 `SUPPLIER_PRODUCT` 职能可创建、修改和提交本供应商商品；跨供应商对象按 404 处理且不写入。
- `SupplierProductResponseDto` 仅返回商品资料白名单；不返回 `supplierId`、`companyId`、职能账号、供应价、零售价或集采价。
- 交易区响应为 `private, no-store, max-age=0`。

## API 与错误码

| 契约 | 方法与路径 | 幂等 | 主要错误 |
| --- | --- | --- | --- |
| API-019 | `POST /v1/supplier/products` | `Idempotency-Key` | `AUTH_REQUIRED`, `FUNCTIONAL_ACCOUNT_FORBIDDEN`, `IDEMPOTENCY_KEY_REUSED`, `SUPPLIER_PRODUCT_FIELD_FORBIDDEN` |
| API-020 | `PATCH /v1/supplier/products/{supplierProductId}` | `Idempotency-Key` | `SUPPLIER_PRODUCT_NOT_FOUND`, `VERSION_CONFLICT`, `STATE_TRANSITION_INVALID` |
| API-021 | `POST /v1/supplier/products/{supplierProductId}/submit-material` | `Idempotency-Key` | `SUPPLIER_PRODUCT_NOT_FOUND`, `PRODUCT_MATERIAL_INCOMPLETE`, `STATE_TRANSITION_INVALID` |

内部物化在资料与价格审批未同时完成时返回 `PRODUCT_APPROVAL_INCOMPLETE`，不会生成 `Product/Sku`。

## 验收证据

- RED：`pnpm exec vitest run apps/api/test/supertest/supplier-products-api.test.mjs --config vitest.config.ts --project api-contract` 因缺少仓储实现模块失败。
- GREEN：同一命令 5 项通过；覆盖缺省拒绝、禁止字段、幂等重放/冲突、跨供应商 404、双审前不物化和并发只生成一份映射。
- 页面：`pnpm exec playwright test tests/e2e/p0/p0-006-product-two-layer.spec.ts --config playwright.p0.config.ts --project chromium`，1 项通过。
- 数据库：`pnpm prisma:validate`、`pnpm prisma:migrate:dry-run` 通过；迁移尚未在 staging 或 production 执行。
- 契约：`pnpm openapi:generate` 与 `pnpm openapi:check` 通过并保持字节确定性。

## 门禁

M2-P007 保持 `NOT_EXECUTED`。只有本切片 Draft PR 的最新 head CI 成功、获得人工精确 head 合并授权、完成合并并在合并后 `main` CI 成功，才可解锁下一切片。
