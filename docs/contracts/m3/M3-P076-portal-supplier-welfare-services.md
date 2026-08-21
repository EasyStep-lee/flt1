# M3-P076 供应商合作与福利卡服务公开页及最小业务咨询契约

## 阶段、唯一目标与完成定义

- 阶段：M3；任务：M3-P076；P0：P0-076；Issue：#124。
- 方案章节：§8.6、§8.12、§8.14、§15.6。
- 唯一目标：完成 `/supplier-cooperation`、`/welfare-card-service` 与企业福利业务咨询提交的最小纵向闭环。
- 完成定义：公开页可由 SSG/ISR 生成并具有 metadata/canonical/sitemap；咨询只收集最少必要字段，经过来源校验、验证码、限流和幂等保护后追加保存；响应只返回成功所需白名单。

## 明确非目标

- 咨询不得创建 EnterpriseCustomer、WelfareCardProgram、WelfareCardBatch、WelfareCardAccount 或任何资金账本。
- 不实现 CMS、业务线索后台工作台、自动分配、短信通知、固定联系 SLA 或供应商准入承诺。
- 不把供应商塑造成店铺，不嵌入供应商后台，不公开完整客服手机、供应价、内部主键或企业存在性。
- 真实验证码供应商、真实域名和生产限流集群属于外部环境配置；测试桩成功不升级为生产证据。

## 字段字典与 DTO 白名单

### `POST /v1/public/business-inquiries`

请求业务字段严格为：

| 字段 | 类型 | 约束 | 用途 |
| --- | --- | --- | --- |
| `contactName` | string | 2–64 字符 | 后续联系称呼 |
| `enterpriseName` | string | 2–191 字符 | 识别咨询主体，不执行企业认证 |
| `mobile` | string | 8–15 位国际/中国大陆手机号格式 | 唯一允许的联系号码 |
| `demandSummary` | string | 10–500 字符 | 企业福利需求摘要 |
| `consentToUse` | boolean | 必须为 `true` | 明确同意按隐私说明使用资料 |

安全上下文来自请求而非业务 DTO：`Idempotency-Key`、`Origin`、`Sec-Fetch-Site`、`X-Captcha-Token`、服务端 requestId 和来源指纹。客户端不得提交 `companyId`、`enterpriseCustomerId`、`buyerId`、`status`、`ownerId`、资金或审批字段。

响应严格为：`leadNumber`、`status=SUBMITTED`、`submittedAt`、`useNotice`、`contactExpectation`、`modificationOrWithdrawalChannel`。不得返回内部 UUID、完整手机号、来源 IP/指纹、企业是否已存在、验证码、供应价或内部表名。

## 状态机与历史

本切片只允许公开入口创建 `SUBMITTED`。后续处理状态不在本切片公开 API 中；创建动作与幂等命令在同一事务追加，禁止覆盖历史。咨询成功不代表企业认证、福利卡开户、资金发放或供应商审核通过。

## 权限、数据范围与安全策略

- 入口允许匿名公众调用，但公司归属只能由服务端解析唯一 ACTIVE 商户，不能信任客户端归属字段。
- `Origin` 必须匹配批准的门户源，`Sec-Fetch-Site` 只允许 `same-origin`/`same-site`；验证码由可替换适配器校验，默认适配器失败关闭。
- 联系手机号经可替换数据保护适配器转换为 `contactMobileEncrypted` 后才可入库；默认适配器失败关闭。来源页固定为 `/welfare-card-service`，同意版本固定为 `1`；来源指纹固定窗口限流，原始 IP 不写入咨询、响应或普通日志。
- 相同公司与 `Idempotency-Key`、相同规范化请求返回同一结果；同键不同请求返回 409 且不新增。
- 错误码映射：非法/未知字段 `VALIDATION_FAILED`/`FIELD_FORBIDDEN`；来源或验证码失败 `ACCESS_DENIED`；验证码服务不可用 `SERVICE_UNAVAILABLE`；限流 `RATE_LIMITED`；幂等载荷冲突 `IDEMPOTENCY_CONFLICT`。

## 页面与缓存

- `/supplier-cooperation`：定位→开放分类→条件→材料→流程→FAQ→支持；主动作 `/supplier/register`，次动作 `/supplier/login`。
- `/welfare-card-service`：使用场景→企业申请→员工领取/绑定/使用→适用范围→退款客服→合规→最小咨询。
- 两页均 `force-static`、ISR、可抓取正文、metadata、canonical、结构化数据并进入 sitemap；不得返回 `private/no-store` 或 `noindex`。
- 咨询提交结果是浏览器私有状态，不写入 URL；失败可重试并复用未确认请求的幂等键，成功后清除该键。

## P0 与负向证据

- `NEG-M3-P076-01`：未知/归属/资金字段、非法手机号或未同意被拒绝且零写入。
- `NEG-M3-P076-02`：错误 Origin、跨站 Fetch Metadata、无效验证码或默认不可用适配器失败关闭。
- `NEG-M3-P076-03`：同键异载荷和超限请求被拒绝；并发/重复同载荷至多一个线索。
