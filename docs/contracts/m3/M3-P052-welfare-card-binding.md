# M3-P052 福利卡绑定契约

## 任务边界

- 阶段：M3；唯一目标：个人用户把公司已发行的福利卡码绑定到本人账户。
- 方案：§8.2、§9.1、§9.2、§9.8、§13；P0-052。
- API：API-038 `POST /v1/consumer/welfare-card-accounts/bind`。
- 页面：PAGE-062 `/pages/welfare-card/index`、PAGE-064 `/pages/welfare-card-bind/index`。
- 非目标：P0-053 账户选择、适用范围计算、订单抵扣、微信支付、退款、真实计划发行、短信实发和任何个人现金充值能力。

## 字段、状态与资金不变量

- 请求只接受 `method`、`cardNo`、`secret`、`agreementAccepted`、`agreementVersion`；`companyId`、`consumerUserId`、`buyerId` 等归属字段一律拒绝。
- `method` 只允许 `CARD_PASSWORD`、`REDEMPTION_CODE`、`SCAN_CODE`；三种入口归一到同一服务端卡码校验与幂等命令。
- 卡密传输后只参与 scrypt 摘要校验；数据库只保存 `scrypt$salt$digest`，明文不进入卡码、命令、流水、响应或普通日志。
- 卡码合法状态为 `UNCLAIMED|CLAIMED|DISABLED|EXPIRED`；只有 `APPROVED+ACTIVE` 计划下 `ISSUED` 批次的 `UNCLAIMED` 卡码可领取。批次 `SUSPENDED` 对应冻结卡并拒绝绑定。
- 绑定事务以卡码 `status+version` 条件更新，随后创建唯一 `WelfareCardAccount`、追加一次不可变 `CLAIM/CREDIT` 流水，并保存消费者范围幂等命令；任一步失败则全部回滚。
- 初始账户满足 `balanceAmount=card.amount`、`frozenAmount=0`、`availableAmount=balance-frozen`，金额只使用整数分。
- `WelfareCardLedger` 本切片只允许 `CLAIM` 初始入账；冻结、扣减、释放、退款和调整由后续 P0-055/P0-059 切片扩展，不能借本切片提前实现。

## 权限、幂等与 DTO

- `companyId`、`consumerUserId` 只来自已验证的 ACTIVE 个人会话；未登录返回 `AUTHENTICATION_REQUIRED`，停用会话返回 `ACCOUNT_SUSPENDED`。
- 幂等范围为 `companyId+consumerUserId+Idempotency-Key`。同键同请求返回首次安全响应并标记 replay；同键不同请求返回 `IDEMPOTENCY_CONFLICT`。
- 同一卡码不同命令并发时只能一个事务创建账户和 `CLAIM` 流水；同用户再次领取返回 `CARD_ALREADY_CLAIMED`，其他用户领取已归属卡返回 `CARD_RECIPIENT_MISMATCH`。
- 对客响应只返回账户结果白名单：`id`、计划名、批次号、掩码卡号、余额/冻结/可用金额、状态、版本和领取时间；不返回卡密、归属键、供应价或内部主键关系。
- 响应固定 `Cache-Control: private, no-store` 与 `X-Robots-Tag: noindex, nofollow`。

## 错误码与失败行为

- `VALIDATION_FAILED`、`FIELD_FORBIDDEN`、`AUTHENTICATION_REQUIRED`、`ACCOUNT_SUSPENDED`。
- `CARD_CODE_INVALID`：卡密错误、作废/过期卡、计划或批次不可领取、协议版本过期；错误不泄露卡码是否存在。
- `CARD_ALREADY_CLAIMED`、`CARD_RECIPIENT_MISMATCH`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`。
- NEG-M3-P052-01：非法输入、协议未确认或错误卡密失败且无写入。
- NEG-M3-P052-02：未认证、归属字段注入或领取他人已归属卡失败且无写入。
- NEG-M3-P052-03：作废/冻结/重复/并发和幂等冲突均保持一个账户、一次入账或零副作用。

## 环境与人工边界

- 本地/CI 测试卡码只能使用测试数据和测试摘要，不代表真实福利计划已获批准或已发行。
- EXT-012、真实企业名单/卡码生成、协议/财务口径、staging、真机扫码和生产均保持 `NOT_EXECUTED` 或 `BLOCKED_EXTERNAL`。
- 微信开发者工具或 Node VM 的扫码桩不升级为 `DEVICE_PASS`。
