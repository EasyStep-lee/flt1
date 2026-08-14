# 2026-08-14 M3-P025 公司统一对客结账交接

阶段结论：`IN_PROGRESS / LOCAL_PASS`。M3-P024 已由 PR #84 按精确 head `04ba1bf61ed2e4537ae449e6373f6482b55e28e5` 合并到 `main@1b15d5c4a019fe2868726284761c315454af2d5f`，合并后 Actions run `31786009896` / job `94721950214` 成功。本切片已在本地实现公司统一收款边界并完成 `pnpm verify` 17/17；Draft PR、精确 head CI、人工合并与 post-merge main CI 尚未执行。福利卡由公司统一发行记账及真实微信、银行、staging 证据不在本切片内，故 P0-025 整项保持 `NOT_EXECUTED`，不得宣称完整通过。

## 基线、范围与 Git

- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`；基线脚本通过。
- 当前阶段/任务：M3 / M3-P025；P0-025 的公司统一微信配置和企业线下转账确认子行为；MIG-012B；API-050/API-051；无页面切片。
- 分支：`codex/m3-company-unified-checkout`；基线：`main@1b15d5c4a019fe2868726284761c315454af2d5f`。
- 实现提交：`e0423d5062f871d31314f8bdcf0c4283f341a226`；合同与测试提交：`e1407aad12d2739722ba52fe4f9e195f5b78cc88`。
- GitHub：Issue #85；Draft PR 尚未创建；精确 head CI、review、合并与 post-merge main CI 均为 `NOT_EXECUTED`。
- 用户既有未跟踪文件和 `.codex-*` 临时证据均保留且未暂存。

## 完成范围

- 新增 `EnterpriseRemittanceSubmission`、`EnterpriseRemittanceReview` 及汇款状态/决定、订单事件 actor 枚举；提交和审核记录版本化，审核记录禁止 UPDATE/DELETE。
- API-050 仅允许已认证的本企业采购职能为本企业 `PENDING_PAYMENT` 且付款方式为 `BANK_TRANSFER` 的主订单提交转账凭证引用；金额、企业归属和订单状态由服务端校验。
- API-051 仅允许公司财务固定 workspace 审核；确认时在 Serializable 事务内原子完成主订单 `PAID`、各供应商履约进入 `PENDING_PREPARATION`、共享库存 reserved 转 sold、订单事件、库存命令和 `BUYER_ORDER_PAID_V1` outbox。
- 企业转账是企业提交凭证、公司财务线下核验的企业结算流程，不是个人支付按钮或新增在线现金通道；确认和驳回均支持业务幂等，审核记录只追加。
- 个人和企业微信预支付只使用服务端从 `Company.wechatPayConfigRef` 派生的公司商户配置；适配器同时取得公司法定收款主体名称，客户端不能提交或读取商户配置引用。
- 对客预支付响应明确返回公司收款主体和 `COMPANY_UNIFIED` 模式；供应商不接触客户资金，`ALIPAY` 等非微信个人在线现金方式被 DTO/领域校验拒绝。
- OpenAPI 确定生成 API-050 `/v1/enterprise/orders/{orderId}/remittance-proof` 与 API-051 `/v1/company/enterprise-orders/{orderId}/remittance-review`；DTO 白名单不返回供应价、公司商户配置、凭证对象存储密钥或内部归属字段。
- 汇款确认只发布稳定支付 outbox，不创建 `DeliveryTask` 或 `EnterpriseDeliveryOrder`，不提前进入 M4。

## 明确非目标

- 不实现福利卡计划、发行、账户、冻结、扣减或账本，不实现福利卡全额/混合支付。
- 不实现按原支付结构退款、微信退款、查单、关单或个人现金充值。
- 不提供企业转账在线支付网关，不调用真实银行，不执行真实微信或真实资金操作。
- 不实现企业结算页面、个人小程序支付页面、配送、售后或对账。
- 不开始 M3-P026；需等待本切片 Draft PR 精确 head CI、人工合并及 post-merge main CI。

## 状态、权限、错误与不变量

- 汇款主线：`NONE -> PENDING_REVIEW -> CONFIRMED | REJECTED`。驳回不改变订单资金或库存；确认只允许一次且不可覆盖审核历史。
- API-050 数据范围为 `enterpriseCustomerId=当前企业`；API-051 固定 `COMPANY_FINANCE` workspace 和唯一公司范围；供应商职能无入口、无 API 权限、无客户资金字段。
- 主要错误：`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`ORDER_NOT_FOUND`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`、`AMOUNT_MISMATCH`、`PAYMENT_METHOD_INVALID`、`REMITTANCE_ALREADY_SUBMITTED`、`PAYMENT_STATE_INVALID`、`DUPLICATE_OR_STATE_CONFLICT`、`INVENTORY_CONFLICT`。
- 金额均为整数分；汇款金额和审核金额必须等于订单应付金额；确认时订单、履约、库存、事件和 outbox 在同一事务内守恒。
- tenant、company、enterprise、buyer 和 functional account 均从已验证会话或持久化订单派生，不信任客户端归属字段。
- 汇款提交按版本追加；审核记录、订单事件、库存命令和 outbox 只追加，不原地覆盖历史；数据库实体不直接序列化。

## 测试证据

| 证据 | 结果 |
|---|---|
| RED：API 构建后运行 API-050/API-051 行为测试 | 构建退出码 0；3/3 因端点缺失返回 404，确认是预期失败原因 |
| Prisma enterprise remittance repository focused | 3/3 通过 |
| Supertest unified checkout + payment focused | 7/7 通过 |
| MIG-012B contract | 1/1 通过 |
| P0-024/P0-025 Playwright 子行为 | 2/2 通过 |
| `pnpm prisma:validate` | 退出码 0 |
| `pnpm prisma:migrate:dry-run` | 退出码 0；empty=2、upgrade=2、restore=2、product=27、cleanup=PASS |
| OpenAPI generate/check/oasdiff | 退出码 0；字节稳定、0 breaking errors |
| `pnpm typecheck` | 退出码 0 |
| `pnpm test` | 退出码 0；API workspace 38 文件/199 测试通过 |
| `pnpm verify` | `e1407aa` 退出码 0；17/17 PASS；报告 `artifacts/test-results/verification/pnpm-verify.json` |
| 工作簿 | 12 个工作表逐页目视检查；公式错误扫描 0；M3-P025 为 `IN_PROGRESS/LOCAL_PASS`，P0-025 为 `NOT_EXECUTED` |
| PR CI | `NOT_EXECUTED`；Draft PR 尚未创建 |

首次 `pnpm verify` 在 OpenAPI 生成物尚未提交时被确定性 diff 门禁拒绝；提交生成物后，第二次在 OpenAPI 路径/DTO 精确名单回归中失败，补齐合同后 focused 4/4 通过。一次 360 秒执行器超时终止了仍在正常运行的回归，不计作通过；随后延长时限的 `pnpm test` 和 `pnpm verify` 均自然退出 0。

## P0 与环境边界

- P0-025 自动化子行为：`LOCAL_PASS`。公司微信商户配置仅服务端派生；企业转账仅企业提交、公司财务确认；供应商不收款；非微信个人在线现金方式及客户端归属字段被拒绝；确认幂等且不创建配送。
- P0-025 整项：`NOT_EXECUTED`。福利卡由公司统一发行记账尚未实现；真实公司微信商户、银行凭证、staging 及财务人工核验未执行。
- LOCAL：`LOCAL_PASS`；CI/STAGING/DEVICE/PRODUCTION：`NOT_EXECUTED`。
- 外部边界：真实微信商户配置、证书/APIv3 密钥、回调域名、银行流水/凭证、staging 和财务核验必须由授权人工配置/执行；任何秘密、银行账号、真实凭证或敏感个人数据不得进入仓库或聊天。

## 风险与回滚

- 风险：默认微信适配器仍故意失败关闭，当前候选不能处理真实支付；福利卡、退款、企业页面和真实财务核验缺失，因此不是完整可上线交易闭环。
- 风险：企业转账确认依赖财务对真实外部凭证的人工核验；本地适配器桩和对象引用不能提升为真实资金证据。
- 风险：MIG-012B 为向前迁移；发布后不得改写历史迁移。部署前需备份并在等价 staging 重演。
- 未发布回滚：回退本分支提交并重建开发库；不触碰用户未跟踪文件。
- 已发布回滚：先回退应用流量/版本，保留新增汇款和审核历史，再用新的向前修复迁移处理；不得删除或改写财务审计记录。

## 下一步门禁

下一动作仅限创建/更新 M3-P025 Draft PR、修复其精确 head CI 和处理同一 PR 评论。只有人工按最新精确 head 授权转 Ready/合并且合并后 main CI 成功，才能开始 M3-P026。当前明确禁止福利卡后续、退款、门户后续切片、M4、M5、M6 和任何真实资金/生产操作。
