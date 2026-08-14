# M3-P022 个人与企业跨供应商统一主订单契约

## 目标与边界

- 方案章节：§8 企业采购、§9 订单/福利卡/支付；P0-022。
- 个人和企业均可在一次命令中提交至少三个供应商的 SKU，由江苏福礼团供应链科技有限公司生成一个 `BuyerOrder`，再按服务端解析的 `supplierId` 精确生成 `SupplierFulfillmentOrder`。
- 个人按当前零售销售价重算；企业按当前集采销售价重算；所有金额使用整数分。
- 本切片不预扣、确认或释放库存，不创建福利卡账本、支付单、退款、跑腿任务、企业配送单或供应商结算记录；M3-P023 及后续保持锁定。

## 数据与不变量

- `buyer_order`：公司唯一销售主体、个人/企业二选一归属、金额守恒、`idempotency_scope + idempotency_key` 唯一。
- `buyer_order_item`：商品/分类/售后、销售价和供应价均保存下单时快照；`supply_price_snapshot` 为严格内部结算字段。
- `supplier_fulfillment_order`：`buyer_order_id + supplier_id` 唯一，一张主订单每个供应商恰有一个履约单。
- `buyer_order_event`：创建事件追加写入，数据库触发器拒绝更新和删除；事件快照不包含供应价。
- 本迁移不读取或修改 `InventoryBalance`，避免提前宣称 P0-023。

## API 与 DTO 白名单

| 契约 | 路径 | 会话归属 | 价格 | 响应边界 |
|---|---|---|---|---|
| API-036 | `POST /v1/consumer/orders` | `consumerUserId`、`companyId` 从已验证会话派生 | 零售价 | 不返回公司/买家归属、供应价、福利卡或结算字段 |
| API-048 | `POST /v1/enterprise/orders` | `enterpriseCustomerId`、`companyId` 从已验证会话派生；需 `PURCHASE` | 集采价 | 不返回企业成员/客户归属、供应价、福利卡或结算字段 |

请求仅允许 `items[{skuId,quantity}]`。客户端提交 `companyId`、`consumerUserId`、`enterpriseCustomerId`、`supplierId`、价格或结算字段时返回 `FIELD_FORBIDDEN`。服务端只接受 ACTIVE 公司、供应商、商品、SKU、分类和对应渠道启用的商品。

必需错误码：`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`PRODUCT_NOT_SALEABLE`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`。

## 幂等、并发与失败恢复

- 幂等范围为 `orderType + serverDerivedBuyerId`；同范围同键同请求返回原订单，状态码 200；同键异请求返回 409 且不得新增第二张订单。
- 数据库唯一键处理并发双写；命中唯一冲突后回读原快照并重放或返回幂等冲突。
- 小程序在请求失败/超时时保留请求签名和原 `Idempotency-Key`，用户再次点击时复用同一键，不生成第二条客户端命令。
- 订单响应使用显式 DTO 映射，绝不直接序列化 Prisma 实体。

## 页面范围

PAGE-055 本切片只实现已存购物车商品的跨供应商分组、统一提交、提交中/成功/未知结果恢复。购物车增删改、完整确认订单、地址、福利卡选择和支付属于后续 P0-090/P0-091/P0-092/P0-093，不在本切片宣称完成。

## 迁移与回滚

- MIG-012：`20260814003000_m3_cross_supplier_orders`，仅新增四张表、外键/唯一键/金额约束、索引及不可变事件触发器，无数据回填。
- 应用回滚：回退本切片 API、小程序、契约和仓储代码；在确认无新版本写入前保留新增表。
- 已应用迁移不得回改；需要数据库修复时创建向前修复迁移。预发布/生产执行前必须备份并单独授权。

## 验收映射

- 正常：个人/企业各提交 3 个供应商 SKU，分别使用正确销售价，返回一张公司主订单和 3 张履约单。
- NEG-M3-P022-01：跨归属字段输入 → `FIELD_FORBIDDEN`。
- NEG-M3-P022-02：未认证/错误企业权限 → 401/403，不写订单。
- NEG-M3-P022-03：同幂等键异请求 → `IDEMPOTENCY_CONFLICT`，不产生第二次写入。
- 失败恢复：小程序未知结果使用原幂等键重试。
- 敏感字段：对客响应不得包含 `supplyPrice`、`approvedSupplyPrice`、内部归属、毛利、应付或结算字段。
