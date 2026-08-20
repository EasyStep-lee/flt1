# M3-P058 福利卡＋微信原支付结构拆分退款交接

## 结论

- 阶段：`M3_IN_PROGRESS`；本切片：`M3-P058`；阶段不因本切片自动 PASS。
- 当前证据：`LOCAL_PASS`；P0-058 RequiredEvidenceLevel 仍为 `STAGING_PASS`。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`；产品基线与执行包自检均通过。
- 基线：`origin/main@11fcfb372e9f84bf2151bf1a52043658a6bb3b48`，即 M3-P057 PR #112 合并提交；post-merge main CI run `32331544944` / job `96313023603` 成功。
- 分支：`codex/m3-mixed-payment-split-refund`；本任务未重复创建 Issue；提交与 Draft PR 尚待本交接后的原子交付。
- 工作区中用户已有 `artifacts/verification/M3-P031/supplier-fulfillment-page.png` 与 `artifacts/verification/M3-P051/welfare-card-programs-batches-page.png` 改动未纳入本切片。

## 唯一目标与非目标

对应综合方案 §8、§9、§13 及 P0-058，同时只形成 P0-026、P0-059、P0-096 的局部证据：公司审核后的混合支付退款按原支付结构累计拆分，福利卡退回原账户，微信退回原支付交易；连续部分退款使用确定性累计分摊，最后一笔尾差精确闭合，任一渠道不得超过原实付。

明确不实现：M5 售后申请/责任审批、退货库存恢复、P059 全量福利卡账本验收、个人现金充值、支付宝、真实微信商户退款、staging、真机、production、M4 配送。

## 实际变更

- 将默认福利卡退款适配器由失败关闭桩替换为 Prisma 原账户退款实现；OpenAPI 生成环境仍使用无外部副作用的不可用桩。
- 在一个 `Serializable` 事务中校验退款交易、订单与原福利卡账户，增加原账户余额，保留账户暂停/冻结状态，追加唯一 `REFUND/CREDIT` 账本并推进退款渠道状态与不可变事件。
- 客户端不能提交福利卡账户、微信交易、渠道金额或公司/买家归属；服务端只使用原订单快照和既有退款分配结果。
- 重放相同退款返回既有结果，不重复入账；目标不一致、并发冲突、账本或审计晚期失败均关闭失败并整体回滚。
- 继续复用既有微信退款适配器与 API-043；顺序部分退款示例 `1801/3999`、累计退款 `2900` 被确定性拆为 `900/2000` 与 `901/1999`。
- Prisma 增加 `WelfareCardLedger.refundId -> RefundTransaction` 限制外键、`refundId + businessType` 唯一索引及 `REFUND/CREDIT` 语义 CHECK；不回填、不修改历史迁移。
- 同步 DTO/错误码、字段、状态机、权限、页面、API/P0/测试/迁移/任务/阶段台账、项目状态、M3 冻结证据及 12 表总控工作簿。

## 先失败后通过证据

| 证据 | 结果 |
|---|---|
| RED 仓储行为 | 4/4 因生产 Prisma 福利卡退款适配器模块不存在而失败 |
| 仓储与分配 focused | 6/6 PASS：原账户退款、暂停账户、重复、目标错配、晚期失败回滚、累计尾差 |
| API focused | 6/6 PASS |
| 迁移/OpenAPI focused | 3/3 PASS |
| P0-058 Chromium focused | 1/1 PASS |
| API 单元全集 | 103/103 PASS |
| API 契约全集 | 48 files / 243 tests PASS |
| OpenAPI 全集 | 28/28 PASS；生成产物字节一致；oasdiff 无破坏性变化 |
| 迁移契约 | 53/53 PASS；已发布迁移 35 份完整，当前链 36 份 |
| 阶段契约 | 91/91 PASS |
| 历史交接契约 | 29/29 PASS |
| 基础 E2E | 3/3 PASS |
| P0 E2E 全集 | Chromium 80/80 PASS |
| Prisma validate | PASS |
| 迁移演练 | `empty=2 / upgrade=2 / restore=2 / product=36 / cleanup=PASS` |
| `pnpm verify` | 17/17 PASS，`base=HEAD`，`2026-08-20T05:25:23.042Z` 至 `2026-08-20T05:40:13.746Z` |
| secrets | 1043 tracked files PASS |
| 工作簿 | 12 表同步并渲染、重点页目检；公式错误 0；SHA-256 `6A7D34D79E233D2961128C70E1BCBAA01989236DE170A919C5FE46C932199721` |

失败与恢复如实保留：

1. 首次迁移演练因 Docker Desktop 未运行而未执行；启动本地 Docker 后继续。
2. 首次真实 MySQL 应用 MIG-013A 因 CHECK 列不能同时使用外键 `ON UPDATE CASCADE` 失败；改为更严格的 `ON UPDATE RESTRICT` 后完整演练通过。
3. 第一次全量验证在历史交接动态断言仍停留 P056/P057 时失败；只推进当前状态快照后，29/29 通过。
4. 第二次全量验证在 19 条历史阶段契约仍停留 P056/P057 时失败；保留历史 PR 证据、只推进当前 P058/上一完成 P057/下一 P059 后，91/91 通过。
5. 同一工作树第三次完整 `pnpm verify` 17/17 通过；没有删除测试、降低断言或跳过门禁。

## P0、环境与外部边界

- P0-058：`LOCAL_PASS`，覆盖原渠道与原目标、整数分、顺序部分退款与尾差闭合、重复/并发、暂停账户、错配拒绝、晚期失败回滚、DTO 归属隔离及页面失败状态。尚无本任务 PR head CI，不能写成 `CI_PASS`。
- P0-026/P0-059/P0-096：仅形成退款分配、追加账本与退款页面的局部证据，不替代完整验收。
- 本地环境：Windows，Node `22.23.1`，pnpm `10.12.1`，Prisma `6.19.2`，Docker MySQL 真实迁移演练，Playwright Chromium，确定性微信/福利卡测试适配器。
- 真实微信商户退款、真实福利资金、staging、device、production：`NOT_EXECUTED`；本地 Mock、容器和浏览器结果不得升级为外部证据。

## 风险与回滚

- 真实微信退款的签名、证书、网络超时、未知结果查询与回调乱序仍需 staging/真商户证据；当前外部适配器只提供确定性测试桩。
- 福利卡退款已回原账户且保留暂停状态，但 P059 的全账本查询、核对与人工验收尚未完成。
- 公司/供应商 Vite bundle 保留既有大 chunk 警告；不影响本切片门禁，也不代表性能优化完成。
- 未发布时可回退本切片应用提交并重建本地开发库；若共享环境已应用 MIG-013A，只能回退应用并新增向前修复迁移，禁止修改已发布 SQL、删除账本或覆盖退款/审计历史。

## GitHub 与下一门禁

- 仓库：`EasyStep-lee/flt1`；基线分支：`main`；开发分支：`codex/m3-mixed-payment-split-refund`。
- 当前本地 head 仍为基线 `11fcfb372e9f84bf2151bf1a52043658a6bb3b48`；本任务提交、push、Draft PR、精确 head Actions、评论与合并均待执行。
- `M3-P059` 保持 `LOCKED`。只有 P058 Draft PR 最新精确 head 必需 Actions 全部成功、用户对该 head 明确授权 Ready/合并、人工合并完成，且合并后 `main` 最新 CI 成功，才允许进入 P059。M4 及以后继续锁定。
