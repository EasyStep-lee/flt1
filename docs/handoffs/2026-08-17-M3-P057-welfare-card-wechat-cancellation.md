# M3-P057 福利卡＋微信混合支付取消与未知恢复交接

## 结论

- 阶段：`M3_IN_PROGRESS`；本切片：`M3-P057`；阶段不因本切片自动 PASS。
- 当前证据：`LOCAL_PASS`；RequiredEvidenceLevel 仍为 `STAGING_PASS`。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，基线校验通过。
- 基线：`origin/main@0aec3095150ff713d5805fc51b7f1d7e0e6920e6`，即 M3-P056 PR #110 合并提交；post-merge main CI run `32009415143` / job `95325570638` 成功。
- 分支：`codex/m3-mixed-payment-cancel-release`；Issue：[#111](https://github.com/EasyStep-lee/flt1/issues/111)。
- 实现及首个完整 17/17 本地验证提交：`f87e6b7340ab2e1e0424c45c2dfdf3fba38b954c`。
- Draft PR：[#112](https://github.com/EasyStep-lee/flt1/pull/112)，保持 Draft；创建时 head 为 `e0f42578dc2f095b7db7b2f66e441bd08f7c7045`，本 GitHub 元数据提交推送后必须以新的精确 head 重新读取 Actions。审查评论与合并：`NOT_EXECUTED`。

## 唯一目标与非目标

对应综合方案 §8、§9、§13 及 P0-057（同时只形成 P0-024、P0-059、P0-093 的局部证据）：用户取消或支付结果未知时，由服务端主动查询公司微信支付交易；只有微信明确未支付且已关单，才在一个事务内释放福利卡冻结额与全部 SKU 库存预留。微信已支付走既有确认链；查询、关单或状态未知时零释放。

明确不实现：P058 原支付结构退款、优惠券新领域、个人现金充值、支付宝、真实微信商户接入、M4 配送。客户端不能提交买家/公司/账户/金额/商户配置，也不能直接解冻资金或库存。

## 实际变更

- 新增 `POST /v1/consumer/orders/{orderId}/welfare-card-wechat-payment/cancel`（API-106）；请求只允许取消原因，会话、订单、归属、支付交易与金额均由服务端派生。
- 支付服务先查询微信：`SUCCESS` 复用支付确认事务；`USERPAYING/UNKNOWN`、查询失败或关单失败进入 `UNKNOWN` 并保持冻结；`CLOSED/PAYERROR` 或 `NOTPAY` 后关单成功才进入取消释放事务。
- 取消事务只减少福利卡 `frozenAmount`，不改变 `balanceAmount`；追加唯一 `RELEASE/CREDIT` 账本，不覆盖旧记录。
- 库存按 `skuId` 聚合后一次释放，支持同一订单重复 SKU 行；任一供应商归属、数量、版本、账本、审计或状态写入失败，整个事务回滚。
- 原子取消主订单、支付交易和供应商履约，并追加 `PAYMENT_UNKNOWN` / `PAYMENT_CANCELLED` 事件及命令快照；重复请求与终态重放不重复释放。
- 已支付乱序查询继续走既有确认链；支付确认接受先前 `UNKNOWN` 状态，避免未知恢复后错过合法成功通知。
- 用户小程序未知结果只调用 API-106，不创建第二笔预支付且不再次调用 `wx.requestPayment`；未知状态明确提示福利卡与库存仍冻结。
- 新增 MIG-012C：只向前扩展 `BuyerOrderEventType` 与生命周期 CHECK，不回填、不修改已发布迁移。
- 同步确定性 OpenAPI、生成类型、原生小程序契约、DTO/错误码、状态机、权限、页面、API/P0/测试/任务/阶段台账、项目状态、M3 冻结证据及 12 表执行总控工作簿。

## 先失败后通过证据

| 证据 | 结果 |
|---|---|
| RED API | 5/5 因 API-106 路由不存在返回 404 |
| RED 小程序 | 未触发取消恢复请求，按预期失败 |
| RED 仓储补充 | 重复 SKU 行因逐行释放产生状态冲突，按预期失败 |
| API focused | 5/5 PASS |
| repository focused | 3/3 PASS：正常、重复 SKU 聚合、晚期失败全回滚 |
| 小程序 focused | 8/8 PASS |
| OpenAPI focused | 3/3 PASS（含 API-106 执行包“任务内契约细化”回归断言） |
| P0-057 Chromium focused | 1/1 PASS |
| OpenAPI 全集 | 25/25 PASS；生成产物字节一致 |
| 迁移契约 | 52/52 PASS；已发布迁移 `35/35` 完整 |
| API 全集 | 48 files / 243 tests PASS |
| P0 E2E 全集 | Chromium 79/79 PASS |
| 基础 E2E | 3/3 PASS |
| Prisma validate | PASS |
| 迁移演练 | `empty=2 / upgrade=2 / restore=2 / product=35 / cleanup=PASS` |
| `pnpm verify` | 17/17 PASS，`base=HEAD`，`2026-08-17T09:44:01Z` 至 `2026-08-17T09:58:16Z` |
| secrets | 1042 tracked files PASS |
| 工作簿 | 12 表同步并渲染、逐页目检；公式错误 0；SHA-256 `3A93CC962C1C967019743779C093B098420F054173305E383BEAE06BA30D8E95` |

全量门禁的失败与恢复如实保留：

1. 首次因生成契约尚未提交，在 `openapi-diff` 退出 1；提交后重跑。
2. 第二次因 API-106 未登记到小程序生成契约映射，在 typecheck 退出 1；补齐唯一映射后重跑。
3. 第三次因 OpenAPI 全集仍断言旧路由清单而失败；更新为 API-106 的真实契约后重跑。
4. 第四次因历史交接动态断言仍停留在 P055/P056 状态而失败；只推进动态当前状态后，29/29 通过。
5. 第五次因历史契约动态断言及 P057 冻结证据仍停留旧状态而失败；同步真实状态后，91/91 通过。
6. 首次完整跑到迁移演练时 Docker Desktop 引擎已停止；前 14 步及 P0 79/79 均通过，但该次 `pnpm verify` 如实为 FAIL。恢复 Docker 后单独迁移演练通过，再从同一提交完整重跑，最终 17/17 PASS。没有删除测试、降低断言或跳过门禁。

## P0 与环境边界

- P0-057：`LOCAL_PASS`，覆盖查询后决策、明确未支付先关单、UNKNOWN 零释放、已支付乱序恢复、福利卡/库存原子释放、重复/并发、重复 SKU、晚期失败回滚、DTO/归属隔离及小程序不重复支付。当前没有 PR head CI，不能写成 `CI_PASS`。
- P0-024/P0-059/P0-093：仅形成支付幂等、追加账本和未知结果页面恢复的局部证据，不替代完整阶段验收。
- 本地环境：Windows，Node `22.23.1`，pnpm `10.12.1`，Prisma `6.19.2`，MySQL 8 迁移演练，Playwright Chromium，确定性微信适配器。
- 真实福利资金、真实微信查询/关单、staging、device、production：`NOT_EXECUTED`；本地 Mock、浏览器和迁移容器不能提升证据等级。

## 风险与回滚

- 真实微信在超时、网络分区和晚到通知下仍需 staging/真商户证据；当前实现选择失败关闭，未知时保持冻结。
- P058 原支付结构退款尚未实现，不能从取消释放推断退款完成。
- 公司/供应商 Vite bundle 保留既有大 chunk 警告；不影响本切片门禁，但不代表性能优化完成。
- 未发布时可回退本切片应用提交并重建本地开发库；若共享环境已应用 MIG-012C，只能回退应用并使用新的向前修复迁移，禁止修改已发布 SQL、删除账本或覆盖审计历史。

## 下一门禁

`M3-P058` 保持 `LOCKED`。只有本切片 Draft PR 最新精确 head 的必需 Actions 全部成功、用户对该 head 明确授权 Ready/合并、人工合并完成，且合并后 `main` 最新 CI 成功，才允许进入 P058。M4 及以后继续锁定。

## 2026-08-19 合并前基线自检补充

- 新鲜执行 `scripts/verify-product-baseline.ps1` 时，方案与提示词基线仍正确，但执行包自检因 API-106 Notes 缺少固定的“任务内契约细化”标识而失败。
- API-106 的 P0 映射、确定性 OpenAPI、DTO、错误码和运行测试均已存在；本补充只修复执行包可机读说明及工作簿镜像，并新增回归断言，不改变支付、资金、库存或权限行为。
- 修复后执行包自检、产品基线校验、OpenAPI focused `3/3`、交接测试 `29/29`、契约测试 `91/91` 均新鲜通过；产品方案 SHA-256 仍为锁定值，执行包目录变化仅来自允许追加的任务状态与证据。
- PR #112 的旧 head `778381fd5465dae3ab983ef6465b41ebe2298d53` CI 已成功；本补充提交推送后必须以新的精确 head CI 为准，旧 head 不再作为最终合并证据。
