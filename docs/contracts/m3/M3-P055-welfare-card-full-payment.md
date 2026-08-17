# M3-P055 福利卡全额支付契约

## 目标与非目标

- 阶段：M3；任务：M3-P055；主验收：P0-055，关联 P0-023、P0-024、P0-025、P0-059、P0-092。
- 唯一目标：消费者为本人待支付订单选择一个本人福利卡账户；当该账户对订单全部商品适用且可用余额覆盖订单总额时，在一个可重放事务内完成福利卡冻结、实扣、订单支付确认、分摊、共享库存确认、供应商履约激活和稳定支付 outbox。
- API：API-104 `POST /v1/consumer/orders/{orderId}/welfare-card-full-payment`；页面：PAGE-056 确认订单。
- 非目标：微信预支付、福利卡加微信混合支付、支付取消或超时解冻、退款、个人充值、企业福利卡支付、配送任务和 M4。

## 请求、身份与金额

- 路径只接受 `orderId`，请求体只接受 `accountId`，并要求 `Idempotency-Key`；`companyId`、`consumerUserId`、价格、抵扣金额、现金金额和范围规则均不得由客户端提交。
- 公司与消费者归属从已验证会话派生；只允许 `CONSUMER`、`PENDING/PENDING_PAYMENT` 且没有既存支付单或分摊的本人订单。
- 服务端读取订单价格快照、总额与商品资源；本切片要求订单没有配送费或优惠，且订单项金额之和等于总额。金额均为安全整数分。
- 账户必须属于当前消费者，计划为 `ACTIVE/APPROVED`，批次为 `ISSUED`，卡码已由当前消费者领取，账户为 `ACTIVE`。
- 适用范围复用 M3-P054 的同一版本化解析与黑名单优先规则；订单每一项都必须适用，可用余额 `balanceAmount-frozenAmount` 必须不少于订单总额。

## 原子事务与幂等

- Serializable 事务先以账户版本乐观锁增加 `frozenAmount`，追加 `FREEZE` 账本；再扣减 `balanceAmount` 并撤销本次冻结，追加 `CAPTURE` 账本。
- 同一事务为每个订单项追加 `OrderPaymentAllocation(welfareCardAmount=lineAmount,cashAmount=0)`，确认已预扣库存为售出，激活供应商履约，订单更新为 `paymentStatus=PAID/orderStatus=PAID`，追加订单事件、库存命令、`BUYER_ORDER_PAID_V1` outbox 和不可变 `WelfareCardPaymentCommand` 响应快照。
- 事务中不读取或写入 `PaymentTransaction`，不调用微信适配器。任何晚期失败回滚账户、账本、分摊、库存、订单、履约、事件、outbox 与命令。
- 幂等域为 `companyId+consumerUserId+Idempotency-Key`；同 key 同请求精确重放，同 key 不同 `orderId/accountId` 返回冲突；每个订单最多一个成功命令。并发重复不得二次扣款或重复写账。

## 响应与失败行为

- 响应仅含订单标识/订单号、`PAID` 状态、`WELFARE_CARD` 模式、福利卡实扣额、固定为 0 的外部应付额、支付时间、订单项数和供应商履约数。
- 不返回福利卡账户标识、余额、完整卡号、消费者归属、供应价、供应商应付、内部配置或秘密。
- NEG-M3-P055-01：非法 UUID、缺失/未知字段或非法幂等键返回稳定校验错误且零写。
- NEG-M3-P055-02：未登录、停用、跨用户订单或账户拒绝，且不泄露财务字段。
- NEG-M3-P055-03：同 key 改参、已支付状态、重复或并发请求稳定冲突/重放，不重复扣款、分摊、库存确认或 outbox。

## 页面与环境边界

- PAGE-056 只在已创建待支付订单、所选账户最大抵扣额等于服务端订单总额时显示可执行的福利卡全额支付；部分覆盖时不发请求，也不偷偷进入微信或混合支付。
- 小程序经 `miniapp-kit` 使用生成的 OpenAPI 类型；未知结果保留原幂等键，用户再次点击执行查询式重放，只有 API 明确返回 `PAID` 才显示成功。
- 自动化只能形成本地/CI 技术证据。真实福利计划、真实资金、微信真机、staging 和 production 均保持 `NOT_EXECUTED`。
