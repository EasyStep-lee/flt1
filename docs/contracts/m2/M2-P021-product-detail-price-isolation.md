# M2-P021 商品详情与价格隔离契约

## 唯一目标

落实 P0-021：个人商品详情只返回平台零售价，企业商品详情只返回集采销售价；两条对客链路的页面、HTML/源码、接口响应、缓存投影和埋点投影均不得包含供应价、供应价快照或内部毛利。

本切片不实现 M2-P061 集采货架、M2-P063 共用库存、M2-P071 价格审批页面，也不提前实现 M3 企业认证、采购车或下单。企业认证会话由后续 M3 接入；在此之前生产默认解析器拒绝访问，不以测试身份替代真实认证。

## 字段和通道

| 通道 | 路由 | 允许的销售价 | 明确禁止 |
| --- | --- | --- | --- |
| 个人/公开零售 | `GET /v1/catalog/products/{productId}` | `retailSalePrice`（整数分） | `enterpriseSalePrice`、供应价、供应价快照、供应商应付、毛利 |
| 已认证企业采购 | `GET /v1/enterprise/catalog/products/{productId}` | `enterpriseSalePrice`（整数分） | `retailSalePrice`、供应价、供应价快照、供应商应付、毛利 |

客户端不得提交 `channel`、`companyId`、`enterpriseId` 或价格字段选择通道。路由与已验证会话共同决定企业通道；企业会话只从 `__Host-fulishe-enterprise-portal` Cookie 解析。企业接口和页面必须 `private, no-store` 且 `noindex`。

## 数据范围与白名单

- 商品详情读取现有 `Product/Sku` 当前销售价字段，不新增迁移。
- 仓储内部可同时读取两个销售价以构造不同通道的 DTO，但不得读取或序列化供应价。
- 零售 DTO 只声明 `retailSalePrice`；企业 DTO 只声明 `enterpriseSalePrice`。
- 响应、缓存和埋点投影必须在出口执行递归字段策略；发现敏感价格键返回 `SENSITIVE_FIELD_LEAK`，发现另一通道销售价返回 `FIELD_FORBIDDEN`。
- 企业未认证返回 `AUTHENTICATION_REQUIRED`，不回退到公开零售价，不泄露商品是否存在。

## 负向用例

| 编号 | 行为 | 错误码/断言 |
| --- | --- | --- |
| NEG-M2-021-01 | 任一对客响应/投影包含供应价、供应价快照、应付或毛利 | `SENSITIVE_FIELD_LEAK` |
| NEG-M2-021-02 | 缓存或埋点投影混入敏感价格字段 | `SENSITIVE_FIELD_LEAK` |
| NEG-M2-021-03 | 个人返回集采价或企业返回零售价 | `FIELD_FORBIDDEN` |
| NEG-M2-021-04 | 无企业会话访问企业详情 | HTTP 401 `AUTHENTICATION_REQUIRED`，`private, no-store` |
| NEG-M2-021-05 | 非集采商品访问企业详情 | HTTP 409 `PRODUCT_NOT_SALEABLE` |

## 完成定义

先失败测试证明企业私有详情契约不存在；最小实现后，API、门户私有页面、用户小程序、OpenAPI 和 P0 E2E 均证明通道字段白名单与缓存/源码隔离。真实企业认证、staging、真机和生产证据仍为 `NOT_EXECUTED`。
