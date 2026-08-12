# M2-P061 商品资源与集采标识契约

## 目标与非目标

- 唯一目标：个人零售与企业采购读取同一公司 `Product/Sku`、分类版本和详情媒体快照；只有 `Product.saleStatus=ACTIVE`、`Product.isEnterpriseProcurementEnabled=true` 且存在 ACTIVE SKU 时进入企业货架。
- 供应商商品职能可在固定本供应商会话中修改已上架商品的渠道可见设置；服务端同时更新对应的唯一 `SupplierProduct` 与唯一 `Product`，并追加不可变历史。
- 不创建企业专属 Product、Sku 或库存；`skuId` 是两渠道共用的后续库存资源键，真实唯一 `InventoryBalance` 由 M2-P063 实现。
- 不实现企业认证、采购车、订单、支付、配送或 M3 的完整采购货架交互；生产企业会话解析器继续默认拒绝。

## 数据与历史

- 新增 `ProductChannelVisibilityHistory`，保存 `productId`、`supplierProductId`、事件、前后版本、前后零售/集采标识、前后企业起订量/包装倍数、原因、自然人和职能账号以及发生时间。
- `INITIAL` 随公司 Product 首次物化创建；`CHANGE` 与 Product/SupplierProduct 渠道设置更新在同一事务追加。
- `(productId,toVersion)` 唯一；历史表禁止 UPDATE/DELETE。既有历史记录和未来订单固化快照不得被渠道启停反向修改。
- Product 与 SupplierProduct 必须一一对应；一次渠道变更只允许命中一个 Product，Sku 继续通过原 `productId` 归属，不复制资源。

## 权限与数据范围

- `PATCH /v1/supplier/products/{supplierProductId}/channel-visibility` 与历史读取只允许 `SUPPLIER_PRODUCT` 固定职能会话。
- `supplierId`、`identityId` 和 `functionalAccountId` 均从会话派生；客户端提交任一归属、渠道或企业身份覆盖字段均拒绝。
- 跨供应商对象统一返回 `SUPPLIER_PRODUCT_NOT_FOUND`，不泄露对象存在性。
- `GET /v1/enterprise/catalog/products` 只接受 `page/pageSize`；企业身份只从私有会话 Cookie 派生。

## DTO、错误码与缓存

- 渠道变更请求白名单：`version`、`isRetailEnabled`、`isEnterpriseProcurementEnabled`、`enterpriseMinOrderQty`、`enterprisePackageMultiple`、`reason`。
- 企业货架响应白名单：同一 `productId/supplierId/categoryId/templateVersion`、媒体快照、ACTIVE `skuId`、`enterpriseSalePrice`、分页和公司统一结账标识。
- 企业接口固定 `private,no-store,noindex`；不得返回 `retailSalePrice`、供应价、供应价快照、应付、毛利或第二套库存字段。
- 错误码：`AUTHENTICATION_REQUIRED`、`SUPPLIER_PRODUCT_NOT_FOUND`、`STATE_TRANSITION_INVALID`、`VERSION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`DUPLICATE_CATALOG_RESOURCE`、`PRODUCT_NOT_SALEABLE`、`VALIDATION_FAILED`、`SENSITIVE_FIELD_LEAK`、`FIELD_FORBIDDEN`。数据库触发器内部使用 `HISTORY_IMMUTABLE` 标识篡改拒绝，不作为对客 API 错误码。

## P0 与失败测试

- `P0-061`：零售详情和企业货架返回相同 Product/Sku/分类/媒体资源；未勾选集采或非 ACTIVE 商品不进入企业货架。
- `NEG-M2-061-01`：若渠道资源不是同一 Product/Sku，返回 `DUPLICATE_CATALOG_RESOURCE`，不写历史。
- `NEG-M2-061-02`：未启用集采或非 ACTIVE 商品被仓储候选污染时，服务层返回 `PRODUCT_NOT_SALEABLE`，不输出候选。
- `NEG-M2-061-03`：渠道变更追加新历史；原历史快照保持字节等价，数据库触发器拒绝修改/删除。

## 完成定义

- 迁移、领域规则、API/OpenAPI、企业私有货架最小页面、供应商集采标识页面文案、行为测试、P0 E2E、证据和回滚全部完成。
- focused、`pnpm verify`、Prisma dry-run、OpenAPI 确定性门禁通过；独立 Draft PR exact-head CI 成功后才能请求人工合并。
