# M3-P062 多供应商企业主订单契约

## 任务边界

- 阶段/任务：`M3 / M3-P062`；主验收：`P0-062`。
- 目标：已认证且具备采购权限的企业成员，可把至少三个供应商的集采商品放入同一采购车，向江苏福礼团供应链科技有限公司提交一个企业主订单；服务端按 `supplierId` 生成一张且仅一张对应供应商子单。
- 用户只向公司统一结账；供应商不是店铺、不是收款方，不能读取其他供应商商品或企业付款资料。
- 非目标：支付结果、对公到账复核、福利卡、企业配送、跑腿、售后、发票执行、对账和 M4。

## 复用的数据与迁移

- 复用 MIG-012 `20260814003000_m3_cross_supplier_orders`：`BuyerOrder`、`BuyerOrderItem`、`SupplierFulfillmentOrder`、`BuyerOrderEvent`。
- 复用 MIG-015 `20260815030000_m3_enterprise_procurement_order`：与 `BuyerOrder` 一对一的 `EnterpriseProcurementOrder` 及不可变地址、开票、付款路线快照。
- 不新增第二套企业商品、库存、订单或供应商子单表；本切片没有新 schema 字段，因此不创建空迁移。
- 数据库继续保证订单所有者二选一、金额非负、`goods + delivery - discount = total`、`welfare + cash = total`、订单行金额算术、`buyerOrderId + supplierId` 唯一和事件不可覆盖。

## 聚合与金额不变量

- 客户端采购车只保存显示快照；提交 API 仅发送 `items[{skuId, quantity}]`，价格、供应商、公司和买方归属全部由服务端重新解析。
- 企业主订单 `goodsAmount` 等于全部订单行 `quantity * enterpriseSalePrice` 之和。
- 每张供应商子单 `goodsAmount` 等于本供应商订单行金额之和；所有子单金额之和等于主订单 `goodsAmount`。
- 同一供应商多个 SKU 仍只生成一张子单；至少三个不同供应商的验收场景必须得到三张子单。
- 金额使用整数分；重复提交复用同一 `Idempotency-Key`，相同请求返回原订单，异体请求返回 `IDEMPOTENCY_CONFLICT`。

## 页面与请求边界

- PAGE-036 `/enterprise/procurement/cart`：私有、动态、`noindex`、`private/no-store`；按供应来源分组，展示集采价显示快照、数量、分组小计与统一合计。
- PAGE-037 `/enterprise/procurement/checkout`：私有、动态、`noindex`、`private/no-store`；提交前明确服务端会重验商品、集采标识、价格、库存和企业默认资料。
- 商品详情可把当前企业 SKU 加入采购车；采购车持久化不得包含供应价、内部毛利、供应商应付、公司/企业内部归属或个人福利卡字段。
- 页面通过 Next.js Server Action 调用生成契约客户端 `openapi-fetch`；只转发当前企业会话 Cookie 与本次幂等键。
- 网络未知结果保留采购车和原幂等键；仅确认 API 返回成功后清空采购车。

## API、权限和 DTO

- 复用 API-048 `POST /v1/enterprise/orders`，请求白名单为 `items`；本切片使用已认证企业默认收货地址、默认开票资料和默认 `WECHAT_PAY` 路线。
- actor 必须为 `ENTERPRISE`、企业状态 `ACTIVE`、成员状态有效且含 `PURCHASE` 权限；`companyId`、`enterpriseCustomerId`、`purchaserUserId` 从会话派生。
- 响应允许订单项和供应商子单的对客分组信息，但不得出现 `supplyPrice`、`approvedSupplyPrice`、`supplyPriceSnapshot`、供应商应付、内部毛利、完整敏感资料或其他企业归属。
- 稳定错误码：`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`PRODUCT_NOT_SALEABLE`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`INVENTORY_INSUFFICIENT`、`INVENTORY_RESERVATION_CONFLICT`、`ENTERPRISE_NOT_ACTIVE`、`ENTERPRISE_SCOPE_FORBIDDEN`、`ENTERPRISE_PROFILE_INCOMPLETE`。

## 验收映射

- 正常路径：三个不同供应商商品提交一次，返回一个 `ENTERPRISE` 主订单、三张供应商子单；主订单、订单行和子单金额严格相等。
- `NEG-M3-P062-01`：无效/重复 SKU、非法数量、伪造价格/供应商/归属字段被拒绝且无订单或库存副作用。
- `NEG-M3-P062-02`：未登录、暂停企业、无采购权限成员或跨企业资料被拒绝且不写订单。
- `NEG-M3-P062-03`：重复命令重放原订单；同键异体请求或并发唯一键冲突不产生第二张订单或重复预扣。
- 页面行为：三个供应商商品可形成统一采购车、统一结算、一次提交和一个公司订单结果；响应及页面源码无供应价泄露。

## 回滚与环境边界

- 未合并时可回退本切片页面、测试、契约与台账提交；既有 MIG-012/MIG-015 不属于本切片，不回滚。
- 真实微信、真实企业资料、staging、device、production 均为 `NOT_EXECUTED`；本地浏览器和确定性 API fixture 不升级为外部证据。
