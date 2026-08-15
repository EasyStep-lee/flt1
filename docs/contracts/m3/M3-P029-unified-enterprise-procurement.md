# M3-P029 统一企业采购契约

## 任务边界

- 阶段/任务：M3 / M3-P029；主验收：P0-029。
- 目标：已认证且有采购权限的企业成员，使用本企业收货地址和开票资料，跨供应商提交一个由江苏福礼团供应链科技有限公司统一承接的企业主订单。
- 复用：API-047 企业货架、API-048 企业订单、API-050 对公转账凭证、API-051 公司财务复核、共用 `Product/Sku/InventoryBalance`、既有微信支付适配器。
- 非目标：企业登录 UI、采购车/结算页、工作台、社区集采活动边界、供应商备货、配送、收货、售后、发票执行和真实外部资金。

## 字段与快照

`POST /v1/enterprise/orders` 请求白名单：

- `items[]`: `skuId`、`quantity`；1 至 100 行，SKU 不重复，数量为 1 至 9999 的整数。
- `enterpriseAddressId`: 可选 UUID；只能选择当前企业地址。
- `invoiceProfileId`: 可选 UUID；只能选择当前企业开票资料。
- `paymentMethod`: 可选 `WECHAT_PAY | BANK_TRANSFER`；企业不得使用个人福利卡。

兼容已发布的 items-only 请求：三个结算字段要么全部显式提供，要么全部省略；全部省略时服务端选择当前 ACTIVE 采购档案的默认地址、默认开票资料和 `WECHAT_PAY`。部分提供返回 `VALIDATION_FAILED`，不会形成不完整快照。

客户端不得传入 `companyId`、`enterpriseCustomerId`、`purchaserUserId`、`supplierId`、价格、金额、状态或任何付款确认字段。归属和采购人从服务端 actor 派生。

`EnterpriseProcurementOrder` 保存：

- `buyerOrderId` 一对一关联公司主订单；`enterpriseCustomerId` 和 `purchaserUserId` 为服务端归属。
- `enterpriseAddressSnapshot`、`invoiceProfileSnapshot` 使用带 `schemaVersion` 的 JSON 快照，创建后不可修改。
- `paymentMethod`、`remittanceReviewStatus`、`status`、`version` 使用显式枚举与乐观锁。
- 企业响应只返回本方所需字段：手机号、税号、开户地址电话和银行账号脱敏；绝不返回供应价、供应商应付、内部毛利或内部归属 ID。

## 状态机与事务

| 当前状态 | 事件 | 下一状态 | 事务副作用 |
|---|---|---|---|
| 无 | `SUBMIT` | `PENDING_PAYMENT` | 同一事务校验企业/成员/地址/开票/商品，预扣共用库存，创建一个 `BuyerOrder`、按 supplierId 拆分子单并创建企业采购聚合 |
| `PENDING_PAYMENT` | `WECHAT_PAYMENT_CONFIRMED` | `PAID` | 验证公司微信回调后确认库存、激活供应商子单、同步企业采购聚合并发布既有付款 outbox |
| `PENDING_PAYMENT` | `REMITTANCE_SUBMITTED` | `PAYMENT_CONFIRMING` | 仅 BANK_TRANSFER；追加凭证并同步 `PENDING_REVIEW` |
| `PAYMENT_CONFIRMING` | `REMITTANCE_CONFIRMED` | `PAID` | 公司财务按自然人/职能复核到账，确认库存并同步企业聚合 |
| `PAYMENT_CONFIRMING` | `REMITTANCE_REJECTED` | `PENDING_PAYMENT` | 保留拒绝历史，允许提交新版本凭证，不确认库存 |

同一 `enterpriseCustomerId + Idempotency-Key` 的相同请求重放同一结果；请求内容变化返回 `IDEMPOTENCY_CONFLICT`。库存、主订单、供应商子单和企业采购聚合必须同事务提交或整体回滚。

## 权限与数据范围

- actor 必须为 `ENTERPRISE`、企业状态 `ACTIVE`、成员状态有效且含 `PURCHASE` 权限。
- 订单、地址、开票资料和采购档案必须同属 actor 的 `enterpriseCustomerId` 和唯一公司；客户端 owner 字段一律拒绝。
- 暂停企业、跨企业地址/开票资料、无采购权限成员返回稳定错误且不预扣库存。
- 企业订单不得创建 `DeliveryTask`；M4 之前仅保留既有付款 outbox 契约。

## OpenAPI、错误码与 P0

- API-048 请求扩展为 `CreateEnterpriseOrderRequestDto`，响应扩展为带 `enterpriseProcurement` 的企业订单白名单；个人订单 API 保持原 DTO。
- 稳定错误码：`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`ENTERPRISE_NOT_ACTIVE`、`ENTERPRISE_SCOPE_FORBIDDEN`、`ENTERPRISE_PROFILE_INCOMPLETE`、`PRODUCT_NOT_SALEABLE`、`INVENTORY_INSUFFICIENT`、`INVENTORY_RESERVATION_CONFLICT`。
- NEG-M3-P029-01：非法/缺失地址、开票或付款方式无写入。
- NEG-M3-P029-02：暂停企业、无权限成员或跨企业资料无写入。
- NEG-M3-P029-03：相同幂等键异体请求和并发冲突不产生第二个订单或第二次库存预扣。
- P0-029 本切片只建立统一企业采购技术聚合与付款连接；配送、收货、售后、发票执行分别保持后续阶段 `NOT_EXECUTED`，不得据此宣称 P0-029 全环境完成。

## 回滚

- 未发布：回退本切片应用、迁移、生成契约、测试和台账提交。
- MIG-015 已应用：只允许向前修复；保留主订单、地址/开票快照、付款事件和审计历史，不编辑已发布迁移或直接删除交易数据。
