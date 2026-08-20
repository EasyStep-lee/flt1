# M3-P059 福利卡账本交接

## 结论

- 阶段：`M3_IN_PROGRESS`；本切片：`M3-P059`；阶段不因本切片自动 PASS。
- 当前证据：`LOCAL_PASS`；实现与契约提交 `16919727b6f5a3bd79eb6e53721a1aac917adc18` 已通过本地完整 `pnpm verify` 17/17。P0-059 RequiredEvidenceLevel 为 `CI_PASS`，只有 Draft PR 最新精确 head Actions 成功后才能升级。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`；产品基线与执行包自检通过，执行包目录仅因允许追加的任务证据发生快照变化。
- 基线：`origin/main@a0fc8a6e785395f78362966c398a8fa1f1e37d98`，即 M3-P058 PR #113 合并提交；post-merge main CI run `32339750495` / job `96336282159` 成功。
- 分支：`codex/m3-welfare-card-ledger`；Issue、Draft PR、精确 head CI、评论和合并状态在推送后补录。
- 工作区中用户已有 `artifacts/verification/M3-P031/supplier-fulfillment-page.png` 与 `artifacts/verification/M3-P051/welfare-card-programs-batches-page.png` 改动不纳入本切片。

## 唯一目标与非目标

对应综合方案福利卡、财务职责隔离、追加账本和 P0-059：建立福利卡账户可核对的连续追加账本；个人只能查看本人的脱敏账本；公司福利卡职能可查账户与账本；公司财务职能通过自然人隔离的 maker-checker 流程执行人工调整或冲正。

明确不实现：P062 企业多供应商主订单、M4 配送、个人现金充值、支付宝、供应商钱包/提现、真实福利资金、真实微信、staging、真机或 production。

## 实际变更

- Prisma 为福利卡账户增加连续序号，为账本增加序号与调整关联，新增 `WelfareCardAdjustment`、历史和幂等命令；新迁移包含非负、连续、类型/方向、冲正引用、唯一性和历史不可覆盖约束。
- 既有福利卡支付、混合支付与退款仓储在同一事务内追加 `FREEZE/RELEASE/CAPTURE/REFUND` 流水并推进账户序号；开户按三种合法资金来源追加 `CLAIM/GRANT/GIFT`。
- 账本读取校验序号连续、前后余额/冻结连续、期末值与账户一致；断链时关闭失败，不返回可能误导的余额历史。
- 新增消费者 API-040，以及公司福利卡/财务 API-107 至 API-111；归属、公司、职能账号与自然人都从会话派生，DTO 永不返回供应价、完整卡号、归属自然人或复核验证码。
- 人工调整申请不立即改余额；独立财务自然人二次验证后批准，才在 Serializable 事务中 CAS 更新申请与账户并追加 `ADJUSTMENT` 或 `REVERSAL`；同人自审、重复冲正、版本冲突、余额不足和晚期失败均关闭失败或整体回滚。
- 用户小程序新增 PAGE-063 福利卡详情/流水；公司 PAGE-008 增加脱敏账户与账本，新增 PAGE-009 财务调整复核独立页面。
- 同步字段、状态机、权限、页面、API/P0/测试/迁移/任务/阶段台账、项目状态、M3 冻结证据及 12 表总控工作簿；P062 保持锁定。

## 先失败后通过证据

| 证据 | 结果 |
|---|---|
| RED 领域策略 | 因 `welfare-card-ledger.policy` 不存在失败 |
| RED API | 3/3 因账本/调整路由 404 失败 |
| RED 用户小程序 | 3/3 因构建产物不存在失败 |
| 领域与绑定 focused | 9/9 PASS |
| 调整事务回滚 focused | PASS：申请 CAS 成功而账户 CAS 失败时事务回滚，申请仍为 PENDING、账户与账本不变 |
| API focused | 8/8 PASS；P059 专项 4/4 PASS |
| 用户小程序 focused | 3/3 PASS |
| 迁移与小程序契约 | 6/6 PASS |
| OpenAPI 契约 | 3/3 PASS；生成产物字节一致 |
| P0-059 + workspace Chromium | 4/4 PASS |
| Prisma validate | PASS |
| 迁移演练 | `empty=2 / upgrade=2 / restore=2 / product=37 / cleanup=PASS` |
| 首次 `pnpm verify` | FAIL：lint 发现测试直接调用未声明的 `structuredClone`；改为 `globalThis.structuredClone` |
| 第二次 `pnpm verify` | lint PASS，按设计停在 `openapi-diff`：实现尚未提交，生成契约相对 HEAD 有预期差异 |
| 提交后 `pnpm verify` | `PASS 17/17`；报告 `artifacts/test-results/verification/pnpm-verify.json`，开始于 `2026-08-20T08:25:07.938Z`，退出码 0 |
| 全量 API | 49 files / 247 tests PASS |
| 全量 P0 Chromium | 82/82 PASS；基础 E2E 3/3 PASS |
| 秘密扫描 | 1073 个已跟踪文件 PASS |
| 执行包/工作簿 | 执行包自检 PASS；12 sheets 同步；公式错误扫描 0 |

失败证据未通过删测试、降断言或跳过门禁处理。公司 PAGE-009 首次全量 P0 E2E 因独立页面缺少固定 `财务结算` 一级标题而 81/82；补齐独立 workspace 标题后 focused 4/4 通过。后续完整门禁还依次发现并修复：小程序生成契约缺 API-040、E2E 复核意见 fixture 被推断为仅 `null`、应用壳未登记 PAGE-063、OpenAPI 精确路径/Schema 快照未推进、交接与阶段契约仍指向 P058/P057、冻结生成器不识别 P059 的 UUID 可空字段/枚举且字段总数仍为 302。每一处均先保留真实失败，再以最小契约同步修到通过；最终 M3 契约 91/91。

## P0、环境与外部边界

- P0-059：当前 `LOCAL_PASS`，覆盖只追加、连续链、来源映射、三类合法入账、永久无个人充值、越权、同人自审、二次验证、重复/并发、冲正、CAS 回滚、页面和 DTO 白名单；本地完整门禁 17/17。尚无本任务 PR head CI，不能写成 `CI_PASS`。
- P0-045/P0-067/P0-068/P0-072/P0-097：只形成审计、独立职能页面、maker-checker 和用户个人中心的局部证据，不替代各自完整验收。
- 本地环境：Windows，Node `22.23.1`，pnpm `10.12.1`，Prisma `6.19.2`，Docker MySQL 真实迁移演练，Playwright Chromium，确定性测试适配器。
- 真实福利资金、真实财务复核、staging、device、production：`NOT_EXECUTED`；本地容器、浏览器或 Mock 不升级为外部证据。

## 风险与回滚

- 迁移对既有福利卡账户回填开户流水；共享环境应用前必须备份并核对账户余额、冻结额、账本序号与来源映射。若来源不合法，迁移应失败而不是猜测第四类来源。
- 公司财务调整仍需真实授权人员在 staging 验证职责配置、二次验证提供方和审计导出；本地仅验证确定性适配器和权限契约。
- Prisma schema 包含格式化产生的机械差异，不改变本切片之外的领域语义；迁移 SQL 是唯一数据库变更入口。
- 未发布时可回退本切片应用提交并重建本地开发库；若共享环境已应用新迁移，只能回退应用并新增向前修复迁移，禁止修改已发布 SQL、删除账本或覆盖调整/审计历史。

## GitHub 与下一门禁

- 仓库：`EasyStep-lee/flt1`；基线分支：`main`；开发分支：`codex/m3-welfare-card-ledger`。
- 实现、契约与门禁修复提交链为 `df1f31b`、`6763954`、`d301f3b`、`938b7be`、`9efc569`、`4ac1964`、`1691972`；其中 `16919727b6f5a3bd79eb6e53721a1aac917adc18` 已取得本地完整 `pnpm verify` 17/17。最终证据提交还需再次运行完整门禁，再同步 Issue、Draft PR、Actions、评论和证据状态。
- `M3-P062` 保持 `LOCKED`。只有 P059 Draft PR 最新精确 head 必需 Actions 全部成功、用户对该 head 明确授权 Ready/合并、合并完成且合并后 `main` 最新 CI 成功，才允许进入 P062。M4 及以后继续锁定。
