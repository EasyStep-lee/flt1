# M3-P025 公司统一对客结账冻结契约

## 切片边界

- 阶段/任务：M3 / M3-P025；P0：P0-025；迁移：MIG-012B；接口：API-050、API-051，并收紧 API-041 的公司微信商户配置派生。
- 方案依据：综合方案 §7.9–§7.16、§8.9、§9.1–§9.10、P0-025。
- 唯一目标：证明个人/企业订单的外部资金只进入平台公司；个人与企业在线现金通道只使用公司的 `WECHAT_PAY`，企业对公转账走“企业提交凭证、公司财务确认”的线下结算流程，供应商不得直接收取客户资金。
- 非目标：福利卡账户/账本、福利卡混合支付、退款、企业认证页面、个人充值、配送对象、真实微信或银行连接、staging/真机/生产验收。
- P0-025 整项仍为 `NOT_EXECUTED`：本切片只完成公司收款归属和企业转账确认子行为，福利卡由公司统一发行记账的运行时能力尚未实现。

## 数据与历史

- `EnterpriseRemittanceSubmission` 按 `buyerOrderId + submissionVersion` 版本化，保存整数分金额、受控对象存储键、企业提交人、幂等键、请求哈希和状态。
- `EnterpriseRemittanceReview` 每个提交版本只能追加一条公司财务决定；更新和删除由数据库触发器拒绝。
- `BuyerOrderEvent.actorType` 扩展 `COMPANY`，公司确认/驳回必须使用公司财务自然人身份；不得伪装成企业操作者。
- 转账确认在 `Serializable` 事务内完成：凭证确认、订单 `PAID`、预扣库存转已售、供应商履约进入备货、追加事件和 `BUYER_ORDER_PAID_V1` outbox。事务失败不得留下部分副作用。
- 本切片不得创建 `DeliveryTask` 或 `EnterpriseDeliveryOrder`。

## 状态机

| 当前状态 | 事件 | 下一状态 | 操作者 | 核心守卫 |
|---|---|---|---|---|
| 无 | `SUBMIT_REMITTANCE` | `PENDING_REVIEW` | 本企业采购员 | 企业订单、本企业归属、订单待支付、金额等于公司应收、无微信交易、幂等 |
| `PENDING_REVIEW` | `CONFIRM` | `CONFIRMED` | 公司财务职能 | 公司归属、精确金额、精确版本、库存预扣存在、无在线支付交易 |
| `PENDING_REVIEW` | `REJECT` | `REJECTED` | 公司财务职能 | 公司归属、精确金额、精确版本、理由必填 |
| `REJECTED` | 新版本提交 | `PENDING_REVIEW` | 本企业采购员 | 新幂等键、新提交版本；旧提交与旧审核不可覆盖 |

## 权限与数据范围

- API-050 只能由 `ENTERPRISE` 活跃采购成员调用；`companyId`、`enterpriseCustomerId`、`enterpriseUserId` 均从已验证会话派生。
- API-051 只能由 `/company-admin/workspaces/finance` 的 `COMPANY_FINANCE` 职能调用；公司归属、职能账号、自然人身份均从公司会话派生。
- 供应商没有提交、确认或收款接口；供应商账户、供应价、供应商应付和银行账户均不得出现在对客响应。
- 响应必须 `private, no-store` 且 `noindex, nofollow`。

## OpenAPI 与 DTO 白名单

- `POST /v1/enterprise/orders/{orderId}/remittance-proof`
  - 请求：`amount`、`proofObjectKey`；拒绝 `channel`、公司/企业归属、银行账户和其他未知字段。
  - 响应：汇款 ID、订单 ID/号、固定公司销售主体、`COMPANY_UNIFIED`、`BANK_TRANSFER`、整数分总额、支付/订单/汇款状态、版本和时间。
- `POST /v1/company/enterprise-orders/{orderId}/remittance-review`
  - 请求：`decision`、`amount`、`version`、`reason`；拒绝客户端归属或职能字段。
  - 响应使用相同白名单，不返回凭证对象键和内部审核身份。
- 微信预支付适配器必须接收由订单所属公司派生的 `merchantConfigRef` 和固定公司法定名称；API 响应只返回收款主体名称与 `COMPANY_UNIFIED`，不得返回商户配置引用或秘密。

## 错误码与失败行为

- 通用：`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`、`ORDER_NOT_FOUND`。
- 转账：`AMOUNT_MISMATCH`、`PAYMENT_METHOD_INVALID`、`REMITTANCE_ALREADY_SUBMITTED`、`PAYMENT_STATE_INVALID`、`IDEMPOTENCY_CONFLICT`、`APPROVAL_VERSION_CONFLICT`。
- `NEG-M3-P025-01 INVALID_INPUT`：`ALIPAY` 或客户端归属/通道字段被拒绝，且无写入。
- `NEG-M3-P025-02 UNAUTHORIZED_OR_WRONG_OWNER`：未登录、跨企业或跨公司财务范围均失败关闭。
- `NEG-M3-P025-03 DUPLICATE_OR_STATE_CONFLICT`：重复/并发、金额不一致、过期版本或已审核状态不得重复确认资金、库存、履约或 outbox。

## 新鲜验证要求

- RED：API 构建成功，API-050/API-051 因路由尚不存在返回 404（3/3 失败）。
- GREEN focused：Supertest 同时覆盖 API-041、API-050、API-051；迁移契约覆盖版本/不可变/禁止通道；P0 E2E 覆盖公司确认唯一副作用和不创建配送对象。
- 完整门禁：`pnpm verify`；Prisma 空库/升级/恢复演练；确定性 OpenAPI 与 breaking 检查。
- 真实银行流水、微信商户配置、staging、真机和 production 均不得由 Mock 升级证据等级。
