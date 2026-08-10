# M2-P010 “看他还卖什么”同供应来源筛选契约

- 方案哈希：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 阶段/任务：`M2 / M2-P010`
- P0：`P0-010`
- Issue：[#45](https://github.com/EasyStep-lee/flt1/issues/45)
- 基线：`main@fb242c025673e937f63850f0677d7b0ffa61cdf4`
- 分支：`codex/m2-more-from-supplier`

## 唯一目标与完成定义

实现“看他还卖什么”的最小纵向切片：用户小程序携带当前商品的 `supplierId`，服务端校验该供应来源有效，只从公司统一货架返回同 `supplierId`、`Product.saleStatus=ACTIVE`、零售启用且至少有一个 ACTIVE SKU 的商品。响应明确销售主体仍为江苏福礼团供应链科技有限公司、结账方式仍为公司统一结账。

完成需要 API-031、PAGE-054 的 P0-010 最小状态、确定性 OpenAPI/统一契约类型、三项冻结负例、focused 测试和 `pnpm verify` 均有新鲜通过证据。

## 非目标

- 不创建供应商店铺、装修、粉丝、评分、店铺券、供应商购物车、独立客服、独立收款或结算。
- 不实现 P0-089 的完整商品详情体验，不宣称 PAGE-054 全页面、真机或正式视觉验收完成。
- 不实现库存余额、购物车、订单、支付、配送、分类筛选或数据库迁移。
- 不用另一供应来源的商品替代空结果。

## API/DTO 白名单

- `GET /v1/catalog/suppliers/{supplierId}/products`
- 请求：`excludeProductId?`、`page?`、`pageSize?`；禁止额外字段和任何店铺选择器。
- 响应：`supplierId`、`sourceLabel`、`sellerName`、`checkoutMode`、分页字段，以及商品卡片的 `productId`、`name`、整数分 `retailSalePrice`、`activeSkuCount`。
- 永不返回：供应价、供应商资质/电话/结算资料、内部评分、合同、毛利、数据库实体或任何店铺能力字段。

## 冻结失败行为

- `NEG-M2-010-01 / SUPPLIER_FILTER_ESCAPE`：仓储返回不同 `supplierId` 的候选时，接口返回 `SUPPLIER_SCOPE_FORBIDDEN`，不得混入结果。
- `NEG-M2-010-02 / INACTIVE_PRODUCT_EXPOSURE`：仓储返回非 ACTIVE、零售未启用或无 ACTIVE SKU 的候选时，接口返回 `PRODUCT_NOT_SALEABLE`，不得暴露候选。
- `NEG-M2-010-03 / STORE_SEMANTICS`：请求或响应包含店铺能力/字段时返回或触发 `FORBIDDEN_CAPABILITY`。
- 供应来源非 ACTIVE 或所属公司非 ACTIVE 时返回 `SUPPLIER_NOT_ACTIVE`。
- 空结果返回 `items=[]`，PAGE-054 显示“暂无更多商品”，不得替换供应来源。

## 页面与环境边界

PAGE-054 固定路径 `/pages/supplier-products/index`，本切片覆盖 loading、success、empty、error/offline-or-timeout 和重试。页面唯一通过 `miniapp-kit` 的 `wx.request` 适配器访问生成契约类型。CI 使用构建后小程序包和受控 `wx` 桩验证行为；微信真机、合法 request 域名和生产 API 地址均保持 `NOT_EXECUTED`。
