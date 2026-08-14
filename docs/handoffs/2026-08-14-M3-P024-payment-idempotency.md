# 2026-08-14 M3-P024 支付幂等交接

阶段结论：`IN_PROGRESS / LOCAL_PASS`。M3-P023 已由 PR #82 合并到 `main@fa8439fe9926f4bd8ee690f922e2531aa2eff57b`，合并后 Actions run `31772198473` 成功。本切片纯微信支付幂等子行为已在 `28718604e5f36b77845856f3cbb354af34b9971e` 完成 focused 测试和本地 `pnpm verify` 17/17；Draft PR、精确 head CI、人工合并和合并后 main CI 尚未执行。P0-024 还要求福利卡扣减维度及真实微信/staging 证据，因此 P0-024 整项保持 `NOT_EXECUTED`，不得宣称完整通过。

## 基线、范围与 Git

- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`；基线脚本通过。
- 当前阶段/任务：M3 / M3-P024；P0-024 的纯微信支付子行为；MIG-012A；API-041/API-042；无页面切片。
- 分支：`codex/m3-payment-idempotency`；基线：`main@fa8439fe9926f4bd8ee690f922e2531aa2eff57b`。
- 实现提交：`de2fc200998956b7dd6f8e9800fa8bef67c6cccc`；OpenAPI/交接/合同回归提交：`9af9e1c`、`d1d281b`、`2871860`。
- GitHub：Issue #83；PR 尚未创建；最新远程证据仍是 M3-P023 的 main CI run `31772198473`。
- 用户既有未跟踪文件和 `.codex-*` 临时证据均保留且未暂存。

## 完成范围

- 新增 `PaymentTransaction`、`PaymentAttempt`、`OrderPaymentAllocation`、`PaymentNotification`、`PaymentOutbox` 及支付枚举/唯一键/不可变通知约束。
- 预支付由已验证会话和服务端订单快照派生买家、金额及归属；只允许 `WECHAT_PAY`；业务幂等键同请求重放、异请求冲突。
- 微信通知先经适配器验证，再在 Serializable 事务内校验订单、金额、支付状态和微信交易身份。
- 首次有效成功通知只执行一次：支付单成功、订单 `PAID`、供应商履约进入 `PENDING_PREPARATION`、共享库存 reserved 转 sold、追加订单事件及 `BUYER_ORDER_PAID_V1` outbox。
- 重复通知、不同通知 ID 的同一微信交易号和并发通知不重复改变订单、库存、履约或 outbox。
- 无真实微信适配器配置时 503 失败关闭；测试仅使用确定性适配器桩。
- OpenAPI 确定生成 API-041 `/v1/orders/{orderId}/wechat-prepay` 与 API-042 `/v1/payment-notifications/wechat`，DTO 白名单不返回供应价、内部归属或支付密钥。

## 明确非目标

- 不实现福利卡账户、冻结、扣减或账本；不实现混合支付、退款、关单或主动查单。
- 不调用真实微信、不保存商户私钥/APIv3 密钥、不执行真实资金操作。
- 不创建 `DeliveryTask` 或 `EnterpriseDeliveryOrder`，不进入 M4 配送。
- 不开始 M3-P025；需等待本切片 Draft PR 精确 head CI、人工合并及 post-merge main CI。

## 状态、权限、错误与不变量

- 状态主线：`CREATED -> PREPAY_CREATED -> SUCCEEDED`；失败通知不越级改变订单；已成功交易不可被重复成功通知再次确认。
- API-041 仅订单归属买家可用；API-042 不信任客户端 tenant/买家字段，所有归属从持久化支付单和订单派生。
- 主要错误：`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`ORDER_NOT_FOUND`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`、`PAYMENT_IDEMPOTENCY_CONFLICT`、`PAYMENT_NOTIFICATION_INVALID`、`PAYMENT_IDENTITY_MISMATCH`、`PAYMENT_AMOUNT_MISMATCH`、`PAYMENT_STATE_INVALID`、`PAYMENT_TRANSACTION_CONFLICT`、`PAYMENT_CONCURRENT_CONFLICT`、`EXTERNAL_SERVICE_UNAVAILABLE`。
- 金额均为整数分；支付金额必须等于订单应付金额；库存、订单、履约和 outbox 在同一事务内守恒。
- 通知记录、订单事件和 outbox 追加写；不原地覆盖历史；数据库实体不直接序列化。

## 测试证据

| 证据 | 结果 |
|---|---|
| RED：API 构建后运行预支付行为测试 | 构建退出码 0；预期 201、实际 404，确认因端点缺失而失败 |
| Prisma payment repository focused | 3/3 通过 |
| Supertest payment API focused | 4/4 通过 |
| MIG-012A contract | 1/1 通过 |
| P0-024 Playwright 子行为 | 1/1 通过 |
| `pnpm prisma:validate` | 退出码 0 |
| `pnpm prisma:migrate:dry-run` | 退出码 0；empty=2、upgrade=2、restore=2、product=26、cleanup=PASS |
| OpenAPI generate/check/oasdiff | 退出码 0；字节稳定、0 breaking errors |
| OpenAPI 回归 | 首轮发现路径/DTO 快照遗漏；修复后 4/4 通过 |
| 交接回归 | 首轮发现工作簿哈希和动态游标过期；修复后 29/29 通过 |
| 合同回归 | 首轮发现 18 个动态游标过期；修复后 88/88 通过 |
| `pnpm test` | 退出码 0；根级回归链通过，API workspace 37 文件/196 测试通过 |
| `pnpm verify` | `2871860` 上退出码 0；17/17 PASS；报告 `artifacts/test-results/verification/pnpm-verify.json` |

一次 `pnpm verify` 在回归失败后如实记录 FAIL；另一次在 20 分钟执行器上限被终止，未作为通过证据。最终成功执行使用更长时限，耗时约 950 秒。

## P0 与环境边界

- P0-024 自动化子行为：`LOCAL_PASS`。纯微信订单重复/并发回调不会重复确认订单、共享库存、履约或 outbox，也不会提前创建配送对象。
- P0-024 整项：`NOT_EXECUTED`。福利卡账本尚未实现，无法证明“不重复扣福利卡”；RequiredEvidenceLevel 所需 staging/真实微信也未执行。
- LOCAL：`LOCAL_PASS`；CI：当前切片 `NOT_EXECUTED`；STAGING/DEVICE/PRODUCTION：`NOT_EXECUTED`。
- 外部边界：真实微信商户配置、证书/APIv3 密钥、回调域名、staging 和真机支付必须由授权人工配置/执行；任何秘密不得进入仓库或聊天。

## 风险与回滚

- 风险：默认微信适配器故意失败关闭，当前候选不能处理真实支付；福利卡、查单、关单和退款缺失，因此不是完整可上线交易闭环。
- 风险：MIG-012A 为向前迁移；发布后不得改写历史迁移。部署前需备份并在等价 staging 重演。
- 未发布回滚：回退本分支提交并重建开发库；不触碰用户未跟踪文件。
- 已发布回滚：先回退应用流量/版本，保留新增支付表和历史写入，再用新的向前修复迁移处理，不直接删除支付记录。

## 下一步门禁

推送当前分支并创建 Draft PR，读取精确 head Actions 和未解决评论。只有人工按精确 head 授权转 Ready/合并且合并后 main CI 成功，才能开始 M3-P025。当前明确禁止福利卡后续、退款、门户后续切片、M4、M5、M6 和任何真实资金/生产操作。
