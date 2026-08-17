# M3-P055 福利卡全额支付交接

## 结论

- 阶段：`M3_IN_PROGRESS`；本切片：`M3-P055`。
- 当前证据：`LOCAL_PASS`；阶段不因本切片自动 PASS。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，基线校验通过。
- 基线：`origin/main@b7cfd38383bedab10f6b4c894278d2cfc9b37715`（M3-P054 PR #106 合并后 main CI run `31987603994` / job `95265195156` 成功）。
- 分支：`codex/m3-welfare-card-full-payment`；Issue：[#107](https://github.com/EasyStep-lee/flt1/issues/107)。
- 本地提交链：`02f4d31`（最小实现）、`5d45263`（契约登记）、`0fc4080`（交接期望推进）、`c3585dece3e0ef2ae89e7d2294a090853e2be9ad`（契约/证据收敛，首个 17/17 全量通过 head）。
- Draft PR / PR CI / 审查评论 / 合并：`NOT_EXECUTED`。

## 唯一目标与非目标

对应综合方案§8、§9、§13及 P0-055（同时只形成 P0-059/P0-092 局部证据）：当一个当前消费者所有、合规且余额足够的福利卡账户能全额覆盖订单时，在一个 Serializable 事务中完成 `FREEZE → CAPTURE`、追加账本、按行分摊、确认库存、订单置 `PAID`、激活供应商履约、追加事件/outbox 并保存不可变幂等命令。

明确不实现：微信预支付或回调、福利卡＋微信混合支付、取消/解冻、退款、个人现金充值、M4 配送任务。`cashAmount` 固定为 0，不创建 `PaymentTransaction`，不调用外部支付适配器。

## 实际变更

- Prisma 模型新增不可变 `WelfareCardPaymentCommand`；迁移 `20260817030000_m3_welfare_card_full_payment` 扩展 `WelfareCardLedger` 为严格 `CLAIM/FREEZE/CAPTURE` 约束与余额守卫。
- 新增 `POST /v1/consumer/orders/{orderId}/welfare-card-full-payment`（台账 `API-104`）；归属和金额均从服务端会话/订单派生，请求仅允许 `accountId`，响应为显式 DTO 白名单并设置 `private, no-store` / `noindex`。
- 补充错误码 `WELFARE_CARD_INSUFFICIENT_BALANCE` 与 `WELFARE_CARD_NOT_ELIGIBLE`，确定性生成 OpenAPI 及共享类型；原 `API-092` M2 企业商品详情记录保持不变。
- 用户小程序 PAGE-056 只在全额可覆盖时提交；未知结果重用同一幂等键，仅以服务端 `PAID` 响应作为成功。
- 支付前验证每个订单商品供应商与待激活履约子单一一对应；缺失、多余、预先激活或并发改变均在扣款前关闭失败。
- 同步字段字典、状态机、权限矩阵、页面映射、P0/测试/迁移/API/任务/阶段台账、项目状态、M3 冻结证据及执行总控工作簿。

## 先失败后通过证据

| 证据 | 结果 |
|---|---|
| RED API | 4/4 因路由不存在返回 404，符合缺失行为 |
| RED 小程序 | 2/2 因支付动作不存在失败 |
| Prisma 事务 focused | 5/5 PASS：正常、同 key 并发重放、晚期失败全回滚、归属/范围/余额、履约拓扑失败 |
| API focused | 4/4 PASS |
| 小程序 focused | 6/6 PASS |
| 迁移契约 | 1/1 PASS |
| OpenAPI 契约 | 1/1 PASS |
| P0 Chromium | 1/1 PASS |
| API 回归 | 4 文件 / 18 tests PASS |
| 支付领域回归 | 8/8 PASS（履约拓扑加固后本仓储组单独 5/5 再通过） |
| Prisma validate | PASS |
| 迁移演练 | `empty=2 / upgrade=2 / restore=2 / product=34 / cleanup=PASS` |
| `pnpm typecheck` | PASS |
| 契约回归 | `test:m1-contract` 90/90 PASS |
| 全量门禁 | `pnpm verify` 17/17 PASS；报告提交 `c3585dece3e0ef2ae89e7d2294a090853e2be9ad`，2026-08-17T03:45:30Z–04:03:20Z |
| 独立 API 全集 | 46 files / 235 tests PASS |
| P0 E2E 全集 | Chromium 77/77 PASS |
| secrets | 1024 tracked files PASS |
| 工作簿 | 12 表导入/更新/全表渲染通过，公式错误 0 |

全量门禁的失败/恢复序列如实保留：

1. 首次在 `openapi-diff` 退出 1：新增生成契约尚未提交，记为 `FAIL_OPENAPI_DIFF_UNCOMMITTED`。
2. 提交实现后，OpenAPI 路径登记仍缺 API-104，回归退出 1，记为 `FAIL_OPENAPI_REGISTRY_EXPECTATION`。
3. 登记 API-104 后，历史交接断言与工作簿 manifest 哈希仍停在 P054/P053，回归退出 1，记为 `FAIL_HANDOFF_MANIFEST_EXPECTATIONS`。
4. 推进交接后，合同组仍有旧任务/Issue/外部门禁断言，且 M3 冻结生成器发现新增 10 字段后的精确计数变化；修复并重新生成后 `test:m1-contract` 90/90 PASS。
5. 提交 `c3585de` 后从头重跑，`pnpm verify` 17/17 PASS；没有删除测试、降低断言或跳过门禁。

## P0 与环境边界

- P0-055：当前 `LOCAL_PASS`，覆盖零外部应付、原子性、幂等/并发、失败回滚、归属/范围/余额、DTO 隔离和永久无个人充值边界；当前尚无 PR head CI，因此不是 `CI_PASS`。
- P0-059：仅形成 `FREEZE/CAPTURE` 追加账本局部证据，完整账本任务未完成。
- P0-092：仅形成确认订单页全额福利卡操作局部证据，完整页面与真机未验收。
- 本地环境：Windows，Node `22.23.1`，pnpm `10.12.1`，Prisma `6.19.2`，MySQL 8 迁移演练，Playwright Chromium。
- 真实福利计划/账户/资金、微信真机、staging、device、production：`NOT_EXECUTED`；不会被 mock 或本地测试提升。

## 风险与回滚

- 财务迁移一旦在共享环境应用，禁止修改旧迁移或删除账本/命令；需以向前修复迁移恢复。
- 尚未实现混合支付的微信未知结果、取消解冻和原结构退款；这些不得由 P055 证据推断。
- Vite 对公司/供应商后台报告现有大 chunk 警告；不影响本切片通过，但属于后续性能治理风险，不能视为已优化。
- 未发布时：回退本切片应用提交并重建本地开发库。已应用迁移时：回退应用版本并新建向前修复迁移，不执行破坏性 down migration。

## 下一门禁

`M3-P056` 保持 `LOCKED`。只有当本切片 Draft PR 最新精确 head 的必需 Actions 全部成功、获得用户对该 head 的明确 Ready/合并授权、由人工合并，且合并后 `main` 最新 CI 成功后，才允许进入 P056。
