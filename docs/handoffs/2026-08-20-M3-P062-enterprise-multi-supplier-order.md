# M3-P062 多供应商企业主订单交接

## 结论

- 阶段：`M3_IN_PROGRESS`；本切片：`M3-P062`；阶段不因本切片自动 PASS。
- 当前证据：`LOCAL_PASS`。原交付 head `d8ea3ffc1935c2b040fe4d936d9a2635bc97b9b7` 的完整 `pnpm verify` 17/17 与 PR Actions run `32366839438` / job `96418071297` 已成功；后续只读复核发现并修复了购物车变更仍复用旧幂等键的问题，因此修复后的新精确 head 必须重新通过 Actions 才能恢复 `CI_PASS`。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`；执行包自检通过，任务 149、P0 119、字段 788、页面 80、权限 22。
- 基线：`origin/main@ed1b37061761a057556a80b659e8317dc59b9164`，即 M3-P059 PR #115 合并提交；post-merge main CI run `32357516455` / job `96389796027` 成功。
- 分支：`codex/m3-enterprise-multi-supplier-order`；Issue #116；Draft PR #117。精确 head CI、评论和合并状态在最终证据提交推送后补录。
- 用户已有的 M3-P031、M3-P051、M3-P059 截图改动及其他无关未跟踪文件未覆盖、未纳入本切片。

## 唯一目标与非目标

对应综合方案企业跨供应商统一采购与 P0-062：企业在同一采购车中选择至少三个供应商的商品，只向平台公司提交一次主订单；服务端按供应商拆出履约子单，并保持金额、库存、归属、幂等和敏感字段不变量。

明确不实现：P0-079 完整企业结算资料界面、P0-080 企业工作台与订单、P0-073 门户全站导航、M4 配送、供应商直接收款、供应商店铺、真实付款、staging、真机或 production。

## 实际变更

- 企业商品详情增加“加入企业采购车”，新增私有动态采购车与结算页面；页面继承 `noindex`，强制动态渲染并禁止公共缓存。
- 浏览器采购车只保存公开预览字段：`productId`、`skuId`、`supplierId`、商品名、企业销售价和数量；供应价、成本、归属账号与结算字段不进入客户端状态。
- 结算服务端动作只向既有 API-048 提交 `items[{skuId, quantity}]`；企业、采购人、供应商、销售价、金额和拆单均由已验证会话与服务端真源派生。
- 未知/网络结果保留原幂等键和采购车，确认成功后才清空；成功页只显示一个公司主订单号、总额及按供应商拆分的白名单履约摘要。
- 企业订单命令键现在与排序后的 `skuId + quantity` 签名绑定：相同购物车在两次未知结果后复用同一键，加入新商品或改变数量后自动生成新键，避免新请求体被旧键锁死为 `IDEMPOTENCY_CONFLICT`。
- 复用 MIG-012 跨供应商订单拆分和 MIG-015 企业采购快照，无新 Prisma model、SQL 或 OpenAPI breaking change。证据台账中恢复 MIG-015 为企业采购迁移，并将既有福利卡全额支付证据编号纠正为 `MIG-015B`，未修改已发布迁移。
- 扩展确定性三供应商 fixture、P0-062 Playwright 行为测试、合同说明、任务/P0/页面/API/迁移/证据/阶段台账、项目状态、M3 冻结证据和 12 表总控工作簿。
- 更新随项目推进而过期的历史交接/合同状态断言，使其保留历史证据同时验证当前 `M3-P062`、上一完成项 `M3-P059` 与下一门禁 `M3-P073`。

## 先失败后通过证据

| 证据 | 结果 |
|---|---|
| RED P0-062 | `FAIL 2/2`：商品详情不存在“加入企业采购车”按钮，两条行为测试等待超时 |
| API focused | 1 file / 5 tests PASS；覆盖三供应商、一次主订单、服务端重定价/归属、幂等重放与冲突、越权和字段隔离 |
| Portal focused | typecheck、lint、build 全部 PASS；采购车/结算路由均为动态页面 |
| P0-062 Chromium | 2/2 PASS；覆盖桌面完整流程与 390px 窄屏无横向溢出/无供应价泄露 |
| review RED 幂等恢复 | 1/3 FAIL：同一购物车两次未知结果正确复用同键，但加入新商品后第三次仍错误复用旧键 |
| review GREEN 幂等恢复 | 3/3 PASS：同体未知结果复用原键，购物车签名变化后生成新键并成功提交 |
| review 工作树 `pnpm verify` | `PASS 17/17`，`2026-08-20T12:26:24.854Z` 至 `2026-08-20T12:41:17.222Z`；API 247/247、基础 E2E 3/3、P0 Chromium 85/85 |
| 迁移契约 | MIG-015 1/1 PASS |
| Prisma validate | PASS |
| 迁移演练 | `empty=2 / upgrade=2 / restore=2 / product=37 / cleanup=PASS` |
| OpenAPI | 生成字节一致；breaking check 无变化 |
| 首次 `pnpm verify` | FAIL：E2E 测试直接引用 `document/window`，测试 tsconfig 不含 DOM 类型；改用 Playwright 字符串表达式 |
| 第二次 `pnpm verify` | FAIL：4 个历史交接契约仍硬编码 P059/P058；统一推进当前状态断言后 focused 29/29 与合同 91/91 PASS |
| 最终 `pnpm verify` | `PASS 17/17`，开始于 `2026-08-20T11:09:46.505Z`，退出码 0 |
| 全量 API | 49 files / 247 tests PASS |
| 全量 P0 Chromium | 84/84 PASS；基础 E2E 3/3 PASS |
| 秘密扫描 | 1087 个已跟踪文件 PASS |
| 执行包/工作簿 | 执行包自检 PASS；12 sheets 同步；公式错误扫描 0；SHA-256 `E6E0FDB07304B2162ABD0C3EC119E8008D1E537AC9D2811570FF7D8C9C49F667` |

失败证据未通过删测试、降断言或跳过门禁处理。

## P0、环境与外部边界

- P0-062：当前 `LOCAL_PASS`，覆盖至少三个供应来源、公司单一主订单、每供应商一个履约组、整数分守恒、服务端定价/归属、请求白名单、同体未知结果复用原键/异体换键、窄屏与供应价隔离。
- P0-022、P0-025、P0-029、P0-063、P0-079：本切片只复用或形成局部证据，不替代各自完整验收；尤其不宣称 P0-079 完成。
- 本地环境：Windows，Node `22.23.1`，pnpm `10.12.1`，Prisma `6.19.2`，Docker MySQL 真实迁移演练，Playwright Chromium，确定性测试适配器。
- staging、真实企业资料、真实微信/对公转账、device 和 production：`NOT_EXECUTED`；本地浏览器或 fixture 不升级为外部证据。

## 风险与回滚

- 采购车是客户端预览，最终金额和可售性以 API-048 服务端结果为准；上线前需在 staging 验证真实商品失效、价格变化、会话过期和未知结果恢复。
- 企业结算资料、付款路由选择和工作台订单属于后续切片，不应把本切片页面当作 P0-079/P0-080 完整交付。
- Vite 现有大 chunk 和 Ant Design 弃用提示仍为非阻塞警告；未在本切片扩大范围处理。
- 无新迁移和 OpenAPI breaking change。未合并时可回退本切片提交并清除本地采购车；合并后应用回滚不会删除既有订单、库存或审计数据，若 API-048 已生成真实订单只能走业务取消/冲正流程。

## GitHub 与下一门禁

- 仓库：`EasyStep-lee/flt1`；基线分支：`main`；开发分支：`codex/m3-enterprise-multi-supplier-order`；Issue #116；Draft PR #117。
- PR #115 已按授权精确 head `1a04f48fab630e78800b57596c5c4aa43b897e01` 合并为 `ed1b37061761a057556a80b659e8317dc59b9164`；合并后 main CI 成功。
- 实现提交 `4da752fb583cf66e08547f5194087fa568a07341` 与证据提交 `d8ea3ffc1935c2b040fe4d936d9a2635bc97b9b7` 曾完成本地 `pnpm verify` 17/17，且 `d8ea3ffc` 的 PR Actions 成功；复核修复会形成新的精确 head，只有该新 head 的本地完整门禁及 Actions 再次成功后才能声明当前 `CI_PASS`。
- `M3-P073` 保持锁定。只有 P062 Draft PR 最新精确 head 必需 Actions 全部成功、用户对该 head 明确授权 Ready/合并、合并完成且合并后 `main` 最新 CI 成功，才允许进入 P073。M4 及以后继续锁定。
