# M3-P058 混合支付拆分退款契约

## 切片边界

- 阶段/任务：M3 / M3-P058；P0：P0-058；复用 API-043；新增 MIG-013A。
- 方案依据：综合方案 9.6“拆分退款与资金回退”、P0-058，以及 M3 阶段提示词。
- 唯一目标：全额和部分退款均严格按订单项保存的 `OrderPaymentAllocation` 原支付结构，福利卡回原账户、微信回原交易；累计整数分算法确定尾差且最终精确闭合。
- 非目标：M5 售后申请/责任归因/授权生成、库存重新入库、P059 全量账本验收、微信真商户/回调/查单、staging、真机和生产。

## 权威数据与金额不变量

- API-043 请求继续只接受 `authorizationVersion` 和 `reason`；退款金额、账户、微信交易、company、buyer 与职能归属全部由服务端会话和不可变快照派生。
- 每次退款只读取被退款订单项的 `OrderPaymentAllocation.welfareCardAmount/cashAmount`，不得按当前价格、当前余额或客户端金额重新分摊。
- 退款分配采用累计整数分算法：中间部分使用向下取整，最后一次退款强制闭合原福利卡/微信分配；每通道累计及总累计均不得超过原实付。
- 福利卡只回 `BuyerOrder.welfareCardAccountId`；微信只使用原 `PaymentTransaction` 的交易标识、商户订单号和原现金实付金额。

## 福利卡退款事务

- 默认运行时把福利卡退款作为公司内部账本事务执行，不再用“未配置福利卡退款适配器”冒充资金处理。
- 同一 Serializable 事务内：锁定原账户版本、增加 `balanceAmount`、保持 `frozenAmount` 不变、追加一条 `REFUND/CREDIT` 的 `WelfareCardLedger`、推进福利卡通道/聚合退款状态并追加 `RefundTransactionEvent`。
- 流水业务键固定为 `refund:{refundId}:welfare`；数据库以账户业务键及 `refundId + businessType` 双重约束防重复。
- 原账户不是 ACTIVE 时仍只入原账户且不改变其状态；增加后的余额受原账户状态限制，不能改退其他账户或丢弃。
- 任一余额、流水、退款状态或事件写入失败必须整事务回滚；不得出现已加余额但无 REFUND 流水，或流水成功但退款状态未推进。

## 微信通道与失败恢复

- 微信退款继续经 `WechatRefundAdapter`，使用稳定 `refundNo` 和原交易信息；默认未配置适配器失败关闭。
- 福利卡事务成功后才允许发起微信退款；微信 UNKNOWN/异常持久化 UNKNOWN，相同退款不得创建第二个退款意图或改用其他现金通道。
- 测试适配器成功只证明自动化契约，不代表真实微信退款或 `STAGING_PASS`。

## 权限、DTO 与错误码

- 仅 `COMPANY_ORDER_SERVICE` 固定职能会话可消费另一自然人已批准的授权；同一 `identityType + identityId` 禁止自审。
- 响应仅返回退款号、订单/订单项、福利卡/微信整数分分配和通道状态；不返回原账户、微信内部交易、供应价、商户配置或审核人身份。
- 沿用：`REFUND_AUTHORIZATION_NOT_FOUND`、`REFUND_ALLOCATION_INVALID`、`REFUND_DUPLICATE`、`REFUND_OVERPAID`、`REFUND_STATE_CONFLICT`、`REFUND_CHANNEL_REJECTED`、`SAME_NATURAL_PERSON_REVIEW_FORBIDDEN`，以及通用鉴权/字段/幂等错误。

## 新鲜验证要求

- RED：默认运行时的混合退款必须因福利卡通道 503 且没有 REFUND 流水而失败；原子账本仓储测试必须因实现缺失失败。
- GREEN：覆盖全额/两次部分尾差、原账户 REFUND 流水、微信原交易、停用账户仍回原账户、重复/并发、超退、晚期失败整事务回滚、UNKNOWN 不重复外呼、DTO/权限隔离。
- 完整门禁：focused、API/P0 E2E、Prisma validate、空库/升级/恢复迁移演练、确定性 OpenAPI、`pnpm verify`。
- P0-058 RequiredEvidenceLevel 为 `STAGING_PASS`；本地与 CI 不能替代真实微信、真实资金、staging、device 或 production。
