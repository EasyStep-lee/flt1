# M3-P026 按原支付结构退款冻结契约

## 切片边界

- 阶段/任务：M3 / M3-P026；P0：P0-026，并为 P0-058、P0-096 提供稳定退款契约；迁移：MIG-013；接口：API-043。
- 方案依据：综合方案 §9 订单、福利卡、支付与退款，以及 P0-026。
- 唯一目标：消费已由独立自然人批准的退款授权快照，根据订单项原始 `OrderPaymentAllocation` 计算福利卡和微信退款金额，分别退回原福利卡账户和原微信交易，并追加资金、库存、对账影响记录。
- 非目标：M5 售后申请、责任归因和审批工作流；福利卡真实账本；微信真实退款/回调/查单；库存退回可售判断；staging、真机或生产验收。
- P0-026 整项保持 `NOT_EXECUTED`：本切片只形成自动化可验证的退款发起和资金守恒契约，要求的真实资金与 `STAGING_PASS` 尚未执行。

## 服务端权威数据

- API 请求只接受 `authorizationVersion` 和 `reason`；客户端不得提交退款金额、福利卡账户、微信支付交易、companyId、orderId、buyerId 或 functionalAccountId。
- `RefundAuthorization` 是已批准、版本化的退款权限快照。本切片不创建批准权限，只消费 `APPROVED` 快照；同一 `identityType + identityId` 的批准人与发起人不得为同一自然人。
- `OrderPaymentAllocation` 是原支付结构的唯一来源。退款分配采用整数分和累计已退金额计算，保证多次部分退款最终余数准确且福利卡/微信累计不超过原始分配。
- 福利卡退款目标从订单原账户快照读取；微信退款目标从订单原 `PaymentTransaction` 读取。任何缺失、归属不一致或金额不守恒都失败关闭。

## 数据与历史

- `RefundTransaction` 按 `afterSaleId` 唯一，并以 `orderId + Idempotency-Key` 防业务重复；保存原分配计算结果、原支付交易、通道状态、请求哈希和乐观锁版本。
- `RefundTransactionEvent` 按退款交易和版本追加，数据库触发器拒绝更新或删除。
- `RefundImpactRecord` 在退款意图创建时一次性追加 `FINANCIAL`、`INVENTORY`、`RECONCILIATION` 三类记录；库存影响固定为 `quantityDelta=0`、`PENDING_AFTERSALE_DECISION`，不得在 M3 擅自决定退回可售库存。
- 退款授权消费、退款交易、初始事件和三类影响在 Serializable 事务内原子创建；事务失败不得留下部分记录。

## 状态机与外部调用

| 当前状态 | 事件 | 下一状态 | 核心守卫 |
|---|---|---|---|
| `CREATED` | `SUBMIT` | `PROCESSING` | 授权有效、非同自然人、原分配守恒、累计不超额、幂等 |
| `PROCESSING` | `WELFARE_REFUND_APPLIED` | `PARTIAL_CHANNEL_DONE` 或 `SUCCEEDED` | 原福利卡账户退款成功 |
| `PROCESSING` / `PARTIAL_CHANNEL_DONE` | `ALL_CHANNELS_SUCCESS` | `SUCCEEDED` | 所有必需通道成功 |
| `PROCESSING` | `CHANNEL_UNKNOWN` | `UNKNOWN` | 外部结果未知，禁止重复发起 |

- 每个外部通道先以版本条件将 `PENDING` 认领为 `PROCESSING`，只有一个并发调用者能执行适配器。
- 福利卡通道优先；其状态为 `PROCESSING` 或 `UNKNOWN` 时不得继续发起微信退款。
- 适配器返回未知结果时持久化 `UNKNOWN`；相同或不同幂等键重放均不得再次调用该通道，只能由后续查询补偿切片处理。
- 默认福利卡和微信退款适配器故意返回服务不可用，防止本地/未配置环境伪造真实资金成功。

## 权限、页面与隐私

- API-043 只允许 `/company-admin/workspaces/order-service` 的 `COMPANY_ORDER_SERVICE` 固定职能会话调用；company、functional account 和自然人身份从已验证会话派生。
- 公司订单客服页面只输入授权 ID、授权版本和退款原因；没有退款金额、福利卡账户或微信交易输入框。
- 供应商、企业/个人买家、其他公司职能及跨公司数据范围均无退款发起权限。
- 响应使用 DTO 白名单，仅返回退款号、订单/订单项、整数分分配和通道状态；不返回供应价、福利卡账户、微信商户配置、原交易内部详情或审核人身份。
- 登录交易响应必须 `private, no-store` 且 `noindex, nofollow`。

## 错误码与失败行为

- 通用：`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`。
- 退款：`REFUND_AUTHORIZATION_NOT_FOUND`、`REFUND_ALLOCATION_INVALID`、`REFUND_DUPLICATE`、`REFUND_OVERPAID`、`REFUND_STATE_CONFLICT`、`REFUND_CHANNEL_REJECTED`、`SAME_NATURAL_PERSON_REVIEW_FORBIDDEN`。
- 非法客户端金额/归属/目标字段在 DTO 白名单处拒绝且无写入。
- 授权版本错误、已消费/撤销、同自然人、自身或跨公司访问均失败关闭。
- 重复、并发、累计超退或外部未知不得重复退款，不得产生重复事件或影响记录。

## 新鲜验证要求

- RED：API-043 行为测试必须因端点缺失返回 404，而非语法或测试夹具错误。
- GREEN focused：覆盖整数分部分退款余数、原目标、授权/自审、DTO 白名单、幂等、并发认领、超退、未配置适配器失败关闭、未知结果不重复发起、迁移不可变约束和公司页面实际交互。
- 完整门禁：`pnpm verify`、Prisma 空库/升级/恢复演练、确定性 OpenAPI、breaking 检查和全 P0 E2E。
- Mock 成功只能证明自动化契约，不能升级为真实福利卡账本、真实微信退款、`STAGING_PASS`、`DEVICE_PASS` 或 `PRODUCTION_PASS`。
