# M3-P020 用户首页契约

## 唯一目标

实现个人用户小程序首页与公开零售货架 `GET /v1/catalog/products`。访客可浏览首页，不强制登录或定位；首页包含搜索、分类、活动、福利卡、配送区域、个人订单六个入口，并固定首页、分类、购物车、我的四个 TabBar。

## 非目标

- 不实现分类/搜索详情、活动、福利卡账户、登录、购物车、订单、支付、库存预扣或配送。
- 不实现企业采购入口，不创建企业或供应商店铺货架。
- 不接真实微信、定位、对象存储或生产数据；本切片无数据库迁移。

## API 与字段白名单

- API：`GET /v1/catalog/products?page=1&pageSize=20`
- 请求：仅 `page`、`pageSize`、`regionCode`；当前没有已验证配送区会话，客户端提交 `regionCode` 返回 `REGION_UNAVAILABLE`。
- 响应：公司销售主体、统一结账模式、未选配送区状态、分页信息和 `productId/supplierId/categoryId/name/retailSalePrice/activeSkuCount/media`。
- 永不返回企业销售价、供应价、供应价快照、库存余额、应付、毛利、买家或企业作用域字段。

## 领域与失败行为

- 只查询公司与供应商 ACTIVE、分类 ENABLED、商品 ACTIVE、零售启用且至少一个 ACTIVE SKU 的统一货架商品。
- 强监管分类沿用 M2 已冻结的启用和资质有效期规则。
- 非在售候选失败关闭为 `PRODUCT_NOT_SALEABLE`；未知查询字段返回 `VALIDATION_FAILED`。
- 小程序只经 `miniapp-kit` 的唯一 `wx.request` 适配器调用生成契约。

## P0 映射

- 主验收：P0-020。
- 兼容边界：PAGE-049、API-029；不提前完成 P0-086/P0-087 等后续页面验收。
