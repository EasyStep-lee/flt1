# M3-P056 福利卡＋微信混合支付成功冻结契约

## 范围与完成定义

- 阶段：M3；任务：M3-P056；P0：P0-056，关联 P0-024、P0-092、P0-093 的本切片子行为。
- 唯一目标：个人订单由服务端按所选福利卡适用范围和可用余额自动取最大抵扣额，先冻结福利卡，再只为剩余差额创建一笔公司微信支付交易；首个合法微信成功通知在同一事务内把冻结额转实扣并确认订单、库存、履约与 outbox。
- 完成定义：`totalAmount = welfareCardAmount + cashAmount` 且两者均为正整数分；相同业务命令、重复/并发通知均不重复冻结、实扣、建支付单、确认库存或发布 outbox。
- RequiredEvidenceLevel 为 `STAGING_PASS`；本地和 CI 仅能证明确定性适配器下的技术行为，真实微信、staging 与真机保持 `NOT_EXECUTED/BLOCKED_EXTERNAL`。

## 字段、状态和分摊

- 请求只允许 `accountId`；公司、个人、订单、金额、范围、抵扣额和支付通道全部从已验证会话及服务端快照派生，拒绝手填抵扣金额或归属字段。
- 福利卡可抵扣额为适用订单项金额、账户可用余额和订单总额的最小值；P056 仅接受 `0 < welfareCardAmount < totalAmount`，全额福利卡继续使用 API-104，零抵扣继续使用纯微信 API-041。
- 每个订单项按 `lineNo` 稳定分摊：适用行先分配福利卡，剩余金额分配微信；逐行及全单金额都必须守恒。
- 开始事务：账户 `frozenAmount += welfareCardAmount`，追加唯一 `FREEZE` 账本；订单固化账户、福利卡额、微信差额与 `WECHAT_PAY`；创建唯一 `PaymentTransaction`、一次尝试和分摊。
- 成功通知事务：账户 `balanceAmount -= welfareCardAmount` 且 `frozenAmount -= welfareCardAmount`，追加唯一 `CAPTURE` 账本；随后支付单、订单、库存、供应商履约和 outbox 原子成功。
- 本切片不实现取消、失败、超时释放或主动查询；未知结果不得客户端解冻或重复创建交易。

## API、权限与错误

- API-105：`POST /v1/consumer/orders/{orderId}/welfare-card-wechat-payment`，`Idempotency-Key` 必填，body 为 `{ accountId }`。
- 返回白名单：订单/支付单标识、`WELFARE_CARD_WECHAT`、福利卡额、微信差额、总额、公司统一收款标识和小程序支付参数；不得返回账户余额、供应价、内部归属、商户配置或签名原文。
- 仅 ACTIVE 的当前个人买家可操作本人的 PENDING 订单和本人 ACTIVE/合规/适用账户；企业订单禁止使用福利卡。
- 主要错误：`AUTHENTICATION_REQUIRED`、`ACCOUNT_SUSPENDED`、`ACCESS_DENIED`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`、`PAYMENT_IDEMPOTENCY_CONFLICT`、`PAYMENT_STATE_INVALID`、`WELFARE_CARD_NOT_ELIGIBLE`、`WELFARE_CARD_MIXED_PAYMENT_NOT_APPLICABLE`、`PAYMENT_CONCURRENT_CONFLICT`、`EXTERNAL_SERVICE_UNAVAILABLE`。

## 非目标与回滚

- 非目标：P057 取消/超时/失败释放、P058 原结构退款、真实微信商户接入、真机支付、M4 配送。
- 失败回滚：开始事务任一步失败时不得留下冻结、账本、分摊、支付单或订单金额；成功通知任一步失败时不得留下部分实扣、库存或订单状态。
- 无新增表或字段；复用订单、支付单、分摊和只追加账本现有约束。若实现发现约束不足，必须先补迁移及回滚演练，不能以应用约定代替数据库保护。
