# M2-P009 无供应商店铺边界契约

## 唯一目标与完成定义

- 阶段：`M2`；唯一任务：`M2-P009`；唯一 P0：`P0-009`。
- 方案依据：§0 单商户总则、§2.1 供应商不是店铺、§6.4 供应来源筛选边界、§7.8 页面边界和 P0-009。
- 完成定义：消费者入口、公开契约、数据模型和迁移均不存在供应商装修页、供应商独立收款/结算、供应商店铺购物车或店铺优惠券；供应商供货后台仍被允许。
- 非目标：不实现 P0-010“看他还卖什么”、分类模板、库存、货架、购物车、优惠券、订单、支付、结算或任何数据库迁移。

## 字段、状态、权限和响应白名单

- 本切片不新增持久化字段或状态机；Prisma 与迁移链只接受既有供应商供货模型，拒绝 `SupplierStorefront`、`SupplierPaymentAccount`、`SupplierStoreCart` 等店铺型实体。
- `SUPPLIER_PRODUCT_SUBMISSION` 等供应商后台供货能力保持允许；扫描器不会把 `/supplier/workspaces/*` 职能页面误判为消费者店铺。
- 公开响应继续只返回 `platformName`、`legalName` 和公司统一销售/收款/退款主体；递归白名单策略拒绝 storefront、供应商支付账户、店铺购物车和店铺优惠券归属字段。
- 客户端不得用 query/body 选择供应商店铺、供应商收款账户或店铺购物车。上述请求统一返回安全错误 `FORBIDDEN_CAPABILITY`，不会创建资源或产生外部副作用。

## 接口、页面和仓库门禁

- 复用 `GET /v1/public/merchant-profile`（API-081）；新增的是禁止能力错误语义，不增加供应商商业入口。
- 门户公开首页增加 P0-009 责任边界说明：公司统一商品货架、统一结账、统一开票/退款/售后；页面继续为 SSG/ISR。
- `scripts/check-no-supplier-storefront.mjs` 确定性扫描客户路由、OpenAPI 公开 DTO、Prisma schema 和迁移建表语句；发现禁止能力即失败。
- `pnpm policy:no-supplier-storefront` 可单独运行，完整 `pnpm test` 通过契约测试自动覆盖相同门禁。

## 冻结负例与证据

| 测试 | 失败行为 | 实现前 RED | 实现后 focused |
| --- | --- | --- | --- |
| NEG-M2-009-01 | `SUPPLIER_STOREFRONT` | 策略模块/页面边界缺失，API 仅返回 `REQUEST_INVALID` | 策略、API、仓库扫描和页面均拒绝店铺入口 |
| NEG-M2-009-02 | `SUPPLIER_DIRECT_PAYMENT` | 检查器缺失，API 仅返回 `REQUEST_INVALID` | 公开 DTO 与请求均拒绝供应商支付账户 |
| NEG-M2-009-03 | `SUPPLIER_STORE_CART` | 检查器缺失，API 仅返回 `REQUEST_INVALID` | 公开 DTO 与请求均拒绝店铺购物车/优惠券归属 |

- focused GREEN：策略单测 4/4、仓库契约 4/4、API 7/7、门户 Playwright 1/1；确定性 OpenAPI 生成/检查和仓库策略扫描通过。
- 当前实现提交已完成 `pnpm verify`，因此证据为 `LOCAL_PASS`；Draft PR 精确 head CI、人工合并和合并后 `main` CI 仍是后续独立门禁。
