# M3-P057 福利卡＋微信混合支付取消与未知恢复契约

## 范围与完成定义

- 阶段：M3；任务：M3-P057；P0：P0-057，关联 P0-024、P0-059、P0-093 的本切片子行为。
- 唯一目标：用户取消、超时或失败后，由服务端主动查询公司微信支付交易；只有明确未支付并完成关单后，才在一个事务内释放福利卡冻结额、全部 SKU 库存预留并取消待激活履约。状态未知时绝不误释放。
- 完成定义：`UNKNOWN/USERPAYING/查询超时/关单未知` 均保持福利卡和库存冻结；查询为 `SUCCESS` 复用原支付确认事务；`NOTPAY` 必须关单成功，或微信已明确 `CLOSED/PAYERROR`，才执行一次释放。
- RequiredEvidenceLevel 为 `STAGING_PASS`；本地和 CI 仅证明确定性适配器下的技术行为，真实微信查询/关单、staging 与真机保持 `NOT_EXECUTED/BLOCKED_EXTERNAL`。

## 状态、不变量与原子释放

- `PREPAY_CREATED + QUERY_UNKNOWN -> UNKNOWN`：支付单和订单支付状态标记未知，追加 `PAYMENT_UNKNOWN` 订单事件；账户冻结额、库存预留、订单状态和履约激活状态不释放。
- `UNKNOWN + QUERY_PAID -> PAID`：主动查询证据转换为受信支付通知，复用金额、交易号、库存、福利卡实扣、履约和 outbox 的既有确认事务。
- `PREPAY_CREATED/UNKNOWN + QUERY_CLOSED -> CLOSED/CANCELLED`：只减账户 `frozenAmount`，`balanceAmount` 不变；追加唯一 `RELEASE/CREDIT` 账本；逐 SKU 追加 `ORDER_RELEASE` 库存日志；订单、支付单和供应商履约一起取消。
- `PaymentAttempt(paymentTransactionId, idempotencyKey)` 保存取消查询快照；相同命令可重复查询未知状态，终态重放不重复释放；同订单改变幂等命令拒绝。
- 库存释放前按 `skuId` 聚合订单行；同一 SKU 多行只产生一次总量释放，且供应商归属冲突时失败关闭。
- 外部查询/关单必须先于数据库释放；事务内任一账本、库存、订单、履约、审计或命令写入失败均整体回滚。

## API、权限与小程序恢复

- API-106：`POST /v1/consumer/orders/{orderId}/welfare-card-wechat-payment/cancel`，`Idempotency-Key` 必填，body 仅为 `{ reason }`；reason 允许 `USER_CANCELLED | PAYMENT_TIMEOUT | PAYMENT_FAILED`。
- 返回白名单仅含 `resolution`、`orderId`、`paymentStatus`、`orderStatus`、`retriable`；不得返回账户、余额、归属、供应价、商户配置或秘密。
- 仅 ACTIVE 当前个人买家可处理本人混合支付订单；公司、个人和订单归属全部从会话及服务端关系派生。
- 小程序未知状态再次点击时只调用 API-106，不创建第二个预支付且不再次调用 `wx.requestPayment`；未知响应明确提示福利卡和库存尚未释放、禁止重复支付。
- 主要错误：`AUTHENTICATION_REQUIRED`、`ACCOUNT_SUSPENDED`、`ACCESS_DENIED`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`、`PAYMENT_IDEMPOTENCY_CONFLICT`、`PAYMENT_STATE_INVALID`、`PAYMENT_CONCURRENT_CONFLICT`、`PAYMENT_AMOUNT_MISMATCH`。

## 迁移、非目标与回滚

- MIG-012C 只扩展 `BuyerOrderEventType` 为 `PAYMENT_UNKNOWN/PAYMENT_CANCELLED` 并收紧生命周期 CHECK；事件保持追加，不回填、不覆盖历史。
- 非目标：P058 原支付结构退款、优惠券新领域、真实微信商户配置、真机支付、M4 配送。
- 代码回滚：回退本切片提交；未发布开发库可重建。已发布迁移禁止回改，应用版本回退时保留兼容枚举并用后续向前迁移修正。
