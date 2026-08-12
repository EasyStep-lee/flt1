# M2-P018 强监管默认关闭契约

## 唯一目标

P0-018 只实现强监管品类的默认拒绝、公司人工开关、资质有效期、商品提交/物化/公开目录门禁和审计。不进入 P0-019 调价、订单、支付或正式生产资质配置。

## 字段与状态

- `CategoryTemplate.regulatoryMode`: `STANDARD | HIGH_RISK`，历史模板版本不可改写。
- `RegulatedCategoryControl.status`: `DISABLED | ENABLED`；无记录等价于 `DISABLED`。
- 公司资质快照仅持久化受控对象引用、引用数和 `qualificationValidUntil`；响应只返回引用数和有效期。
- `SupplierProduct.qualificationValidUntil` 与 `Product.qualificationValidUntil` 固化商品资质有效期，公开 DTO 不返回资质引用。
- 开关历史只追加 `ENABLE | DISABLE`；命令以作用域和 `Idempotency-Key` 幂等。

## 权限与接口

- 固定职能：`COMPANY_PRODUCT_OPS`，固定 workspace `/company-admin/workspaces/product-ops`。
- `GET /v1/company/regulated-category-controls`：公司范围内已配置控制列表。
- `POST /v1/company/regulated-category-controls/{categoryId}/enable`：二次验证后启用。
- `POST /v1/company/regulated-category-controls/{categoryId}/disable`：二次验证后停用。
- 客户端提交的 `companyId`、`functionalAccountId`、`identityId` 一律拒绝；归属来自已验证会话。

## 默认拒绝顺序

1. `HIGH_RISK` 模板缺已发布合规资质、固定警示或资质展示模块：`CATEGORY_TEMPLATE_INVALID`。
2. 无公司显式启用记录或状态非 `ENABLED`：`REGULATED_CATEGORY_DISABLED`。
3. 公司或商品资质缺失、过期：`QUALIFICATION_REQUIRED`。

## 固定反例

- `NEG-M2-018-01`：未显式启用的强监管分类不得提交、物化或进入公开目录。
- `NEG-M2-018-02`：公司或商品资质缺失/过期不得通过门禁。
- `NEG-M2-018-03`：无已发布合规模板的强监管分类拒绝商品提交。

## 外部边界

`EXT-007` 正式分类树、公司/商品资质和法务口径仍为 `NOT_PROVIDED`。本切片仅交付可配置代码、测试桩和本地/CI 证据，不伪造正式资质、真机、staging 或生产验收。
