# M3-P059 福利卡账本契约

状态：`IN_PROGRESS / RED_PENDING`。对应综合方案 §8、§9.7、§9.8、§13 与 P0-059；仅复用 P0-072 已冻结的自然人双人复核边界。

## 唯一目标

福利卡发行/领取、冻结、解冻、实扣、退款、冲正与人工调整全部形成按账户连续编号的 `WelfareCardLedger` 记录。每条记录保存变动前后余额与冻结额，记录只能追加，账户余额、冻结额与最后一条记录必须一致且均不为负。

## 资金来源与业务类型

- `ENTERPRISE_GRANT` 对应首笔 `GRANT/CREDIT`。
- `COMPANY_GIFT` 对应首笔 `GIFT/CREDIT`。
- `PHYSICAL_CARD_OR_CODE` 对应首笔 `CLAIM/CREDIT`。
- 订单资金事件只允许 `FREEZE/DEBIT`、`RELEASE/CREDIT`、`CAPTURE/DEBIT`；退款只允许 `REFUND/CREDIT` 且指向原福利卡账户。
- 人工 `ADJUSTMENT` 可增可减；`REVERSAL` 必须指向同账户已批准的人工调整，金额相等、方向相反，不能二次冲正。
- 永久拒绝 `PERSONAL_RECHARGE` 和任何第四类资金来源，拒绝时账户、账本、审批和审计均不得产生部分写入。

## 权限与归属

- 消费者 `API-040` 仅可查询会话中 `companyId + consumerUserId` 所有的账户；响应为账本白名单，不返回公司/用户归属、功能账号、申请人/复核人、卡号、卡密或外部支付秘密。
- `COMPANY_WELFARE_CARD` 在 PAGE-008 只读公司域内脱敏账户和账本，不得直接改余额。
- 人工调整只允许 PAGE-009 的 `COMPANY_FINANCE` 申请与复核。申请先保持 `PENDING` 且不改余额；批准后在一个串行事务中更新账户、追加账本/审批历史/审计。申请人与复核人的自然人 `identityId` 必须不同；超级管理员没有旁路。
- 客户端不能提交 `companyId`、`consumerUserId`、`functionalAccountId`、申请人、复核人或最终余额。

## 状态、幂等与失败

- 调整申请：`NONE -> PENDING`；复核：`PENDING -> APPROVED|REJECTED`。状态和版本冲突返回稳定 409，历史只追加。
- 创建和复核都要求 `Idempotency-Key`；同键同请求重放，同键异体冲突，并发只允许一个终态和至多一条资金流水。
- 扣减后余额不得小于冻结额；溢出、负数、断裂流水或数据库不可变守卫失败时整个事务回滚。
- 所有交易接口与页面使用 `private, no-store`、`noindex`；供应价永不进入响应。

## 非目标

不实现真实福利资金发行、个人充值、提现、转账、供应商钱包、M5 财务对账、M4 配送、真实微信/staging/真机/production 验收。

