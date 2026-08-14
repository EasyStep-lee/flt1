# M3-P024 微信支付回调幂等冻结契约

## 范围与完成定义

- 阶段：M3；任务：M3-P024；P0：P0-024。
- 唯一目标：为已创建且处于 `PENDING_PAYMENT` 的买家主订单建立微信预支付与已验证通知的幂等闭环。
- 完成定义：相同预支付命令只创建一次外部预支付；首个合法成功通知在一个数据库事务内确认订单、供应商履约、共享库存和稳定 outbox；重复、并发、乱序或冲突通知不得重复产生任何状态或金额副作用。
- 本切片只覆盖纯微信订单（`welfareCardAmount = 0`、`cashAmount = totalAmount`）。福利卡冻结/扣减/释放及混合支付由后续 M3-P051 至 M3-P058 建立，不能用测试桩冒充账本完成。

## 不可变业务边界

- 对客收款主体固定为江苏福礼团供应链科技有限公司。
- 个人线上现金通道仅允许 `WECHAT_PAY`；不得出现支付宝或个人现金充值。
- 金额全部使用整数分；客户端金额、公司、买家、供应商和支付状态均不可信。
- 通知只有在适配器验证签名、商户、应用、订单号、微信交易号、金额和 `SUCCESS` 状态后才能改变订单。
- M3 只追加供 M4 消费的稳定 outbox，不创建 `DeliveryTask` 或 `EnterpriseDeliveryOrder`。
- 真实微信配置、密钥、证书、商户调用和真机支付属于 `BLOCKED_EXTERNAL`，本地只使用可替换的确定性适配器。

## 字段字典

### PaymentTransaction

| 字段 | 约束 |
| --- | --- |
| id | UUID，服务端生成 |
| orderId | 归属买家主订单，唯一有效微信交易 |
| channel | 固定 `WECHAT_PAY` |
| amount | 服务端读取 `cashAmount`，整数分且大于 0 |
| outTradeNo | 全局唯一，预支付重放不变 |
| wechatTransactionId | 合法成功通知后写入，全局唯一 |
| status | `CREATED / PREPAY_CREATED / PAID / CLOSED / UNKNOWN / FAILED` |
| notifyVerifiedAt / paidAt / closedAt | 状态对应的服务器时间 |
| idempotencyKey | 同一订单预支付业务键唯一 |

### OrderPaymentAllocation

逐订单项固化 `welfareCardAmount`、`cashAmount` 和 `allocationRuleVersion`。本切片福利卡分摊固定为 0，现金分摊之和必须等于订单 `cashAmount`。

### PaymentNotification 与 outbox

- 通知保存 `notificationId`、原文哈希、验证结果和处理结果；只追加，不覆盖。
- `notificationId` 和合法 `wechatTransactionId` 都是幂等键。
- 首次支付成功只追加一个 `BUYER_ORDER_PAID_V1` outbox，载荷只含交付必要的订单、履约和版本标识，不含供应价、利润、密钥、签名或个人敏感数据。

## 状态机与原子副作用

1. `CREATED -> PREPAY_CREATED`：`CREATE_PREPAY`，以订单和 `Idempotency-Key` 幂等。
2. `PREPAY_CREATED -> PAID`：`VERIFIED_NOTIFY_SUCCESS`；验证外部身份和金额后执行。
3. 同一事务内：`BuyerOrder PENDING_PAYMENT -> PAID`；履约单 `PENDING_PAYMENT -> PENDING_PREPARATION`；每个订单项库存 `reserved -> sold`；追加库存确认日志、订单事件和一个稳定 outbox。
4. `PAID` 后同通知、不同通知但同微信交易号、或并发通知均返回已处理结果，不增加版本、金额、库存日志或 outbox。
5. 金额、订单号、商户/应用身份、交易号冲突或非成功状态均失败关闭且无业务副作用。

## 权限和数据范围

- `POST /v1/orders/{orderId}/wechat-prepay`：必须有当前个人/企业买家会话且服务端确认订单归属；响应 `private, no-store` 与 `noindex`。
- `POST /v1/payment-notifications/wechat`：不接受买家会话作为信任来源，只信任微信适配器验证结果。
- DTO 采用白名单，禁止返回供应价、公司/买家内部归属、适配器密钥、签名明文或回调原文。

## API 与错误码

- API-041：`POST /v1/orders/{orderId}/wechat-prepay`。
- API-042：`POST /v1/payment-notifications/wechat`。
- 主要错误：`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`ORDER_NOT_FOUND`、`PAYMENT_STATE_INVALID`、`PAYMENT_IDEMPOTENCY_CONFLICT`、`PAYMENT_NOTIFICATION_INVALID`、`PAYMENT_IDENTITY_MISMATCH`、`PAYMENT_AMOUNT_MISMATCH`、`PAYMENT_TRANSACTION_CONFLICT`、`EXTERNAL_SERVICE_UNAVAILABLE`。

## 行为证据

- `NEG-M3-P024-01 DUPLICATE_CALLBACK`：重复和并发通知只产生一次原子副作用。
- `NEG-M3-P024-02 UNAUTHORIZED_OR_WRONG_OWNER`：未登录或错误买家不能创建预支付。
- `NEG-M3-P024-03 DUPLICATE_OR_STATE_CONFLICT`：复用业务键但改变订单，或交易号跨订单复用时冲突且无写入。
- P0-024 中福利卡账本维度在相应账本实体完成前保持 `NOT_EXECUTED`；不得据此宣称整个 P0 已完成。

## 明确非目标

- 福利卡计划、账户、冻结、扣减、账本、混合支付和退款。
- 微信主动查询、关单、退款和真实商户接入。
- 小程序支付结果页、个人跑腿、企业统一配送或任何生产发布。
