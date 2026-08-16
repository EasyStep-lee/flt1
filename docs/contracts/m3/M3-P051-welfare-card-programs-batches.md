# M3-P051 福利卡计划与批次契约

## 任务边界

- 阶段：M3。
- 唯一目标：公司 `COMPANY_WELFARE_CARD` 固定职能会话创建并查看福利卡计划与发行批次。
- 方案：§3.2、§3.4、§9.1、§9.2、§9.8、§13；P0-051，兼容 P0-060、P0-067、P0-068、P0-072。
- 页面：PAGE-008 `/company-admin/workspaces/welfare-card`。
- 非目标：绑定、账户、卡码生成/导出、余额、账本、发放、支付、退款、个人充值、真实发行和 M4-M6。

## 资金、字段与状态

- `WelfareCardProgram.fundingType` 只允许 `ENTERPRISE_GRANT`、`COMPANY_GIFT`、`PHYSICAL_CARD_OR_CODE`；永久禁止 `PERSONAL_RECHARGE` 和第四类来源。
- 发行主体固定为江苏福礼团供应链科技有限公司，存储为只允许 `COMPANY` 的 `issuerType`；客户端不能提交或覆盖主体。
- 计划字段：名称、资金来源、版本化适用范围、配送费规则、退款规则、合规状态、业务状态和乐观锁版本。
- 批次字段：计划、可选企业客户、公司范围唯一批次号、总额度、单份额度、发放数量、领取方式、协议版本、状态和版本。
- 所有金额为非负安全整数分；`unitAmount × issueCount = totalAmount`，乘积溢出或不守恒拒绝。
- 计划和批次均以 `DRAFT` 创建；EXT-012 未提供时不得激活真实发行。停用/关闭不得删除历史。
- 创建事件写入追加式历史；历史表由数据库阻止更新和删除。

## 权限与 DTO

- `companyId`、`functionalAccountId`、`identityId` 只从已验证的 `COMPANY_WELFARE_CARD` 会话派生。
- 其他公司职能、供应商、企业、个人及未认证请求全部拒绝；未知归属对象不得泄露存在性。
- 请求出现 `companyId`、`issuerType`、`status`、`complianceStatus`、`version` 或自然人/职能覆盖字段时返回 `FIELD_FORBIDDEN`。
- 响应只返回运营页面所需计划/批次白名单；不返回公司归属键、自然人、职能账号、供应价、供应商结算、卡密或个人信息。
- GET 响应 `Cache-Control: private, no-store` 且 `X-Robots-Tag: noindex`。

## API 与错误码

- API-101 `GET /v1/company/welfare-card/programs`：列出当前公司计划及批次摘要。
- API-102 `POST /v1/company/welfare-card/programs`：幂等创建 DRAFT 计划。
- API-103 `POST /v1/company/welfare-card/programs/{programId}/batches`：幂等创建 DRAFT 批次。
- 错误码：`AUTHENTICATION_REQUIRED`、`WORKSPACE_FORBIDDEN`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`PERSONAL_RECHARGE_FORBIDDEN`、`WELFARE_FUNDING_SOURCE_INVALID`、`WELFARE_PROGRAM_NOT_FOUND`、`WELFARE_BATCH_AMOUNT_MISMATCH`、`WELFARE_CLAIM_MODE_INVALID`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`DUPLICATE_OR_STATE_CONFLICT`。

## 验收路径

- NEG-M3-P051-01：非法字段、非法资金来源、金额不守恒、错误领取方式和非法协议版本失败且无副作用。
- NEG-M3-P051-02：非福利卡职能或错误公司归属失败关闭。
- NEG-M3-P051-03：同幂等键同参数返回原结果；不同参数冲突；批次号重复不新增。
- 正常路径：创建三类来源计划的 DRAFT 配置，创建匹配的 DRAFT 批次并在 PAGE-008 查看列表、详情和追加时间线。
- 证据等级：本地/CI 技术证据不替代 EXT-012、staging、真实资金、真机、生产或正式合规验收。
