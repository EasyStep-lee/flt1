# M3-P056 福利卡＋微信混合支付成功交接

## 结论

- 阶段：`M3_IN_PROGRESS`；本切片：`M3-P056`；阶段不因本切片自动 PASS。
- 当前证据：`LOCAL_PASS`；RequiredEvidenceLevel 仍为 `STAGING_PASS`。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，基线校验通过。
- 基线：`origin/main@3dcd998d07d9a2af7675baaac02fa0ae413dd538`，即 M3-P055 PR #108 合并提交；main CI run `31997253059` / job `95290991988` 成功。
- 分支：`codex/m3-welfare-card-mixed-payment`；Issue：[#109](https://github.com/EasyStep-lee/flt1/issues/109)。
- 实现及首个完整 17/17 本地验证提交：`904bb529e765dc0bfc83d8a8ec33f733182ee9a0`。
- Draft PR / PR CI / 审查评论 / 合并：`NOT_EXECUTED`。

## 唯一目标与非目标

对应综合方案 §8、§9、§13 及 P0-056（同时只形成 P0-024、P0-092、P0-093 的局部证据）：个人订单选择一个合规福利卡账户后，服务端按范围和余额自动采用最大抵扣额，先冻结福利卡，再仅为差额创建一笔公司微信支付交易；首个合法微信成功通知在一个事务内完成福利卡实扣、订单支付、库存确认、供应商履约激活、事件和 outbox。

明确不实现：P057 的取消/失败/超时释放与主动查询、P058 原支付结构退款、个人现金充值、支付宝、真实微信商户接入、M4 配送。客户端不能提交抵扣金额、买家或公司归属。

## 实际变更

- 新增 `POST /v1/consumer/orders/{orderId}/welfare-card-wechat-payment`（API-105）；请求仅允许 `accountId`，会话、订单、金额、适用范围和支付通道全部服务端派生。
- 复用现有订单、`PaymentTransaction`、支付尝试、订单分摊、福利卡命令与只追加账本；本切片没有新增表、字段或迁移。
- 开始事务执行自动最大抵扣、金额守恒和逐行稳定分摊，追加唯一 `FREEZE`，创建唯一公司 `WECHAT_PAY` 交易及一次预支付；事务失败不留下冻结或支付单。
- 合法微信成功回调在同一事务中追加唯一 `CAPTURE`，扣减余额及冻结额，确认订单/库存/供应商履约并发布一个 outbox；重复、并发和晚期写失败均不产生部分副作用。
- 响应 DTO 仅返回支付流程所需订单/支付标识、福利卡额、微信差额、总额、公司统一收款标识和小程序支付参数；不返回账户余额、供应价、内部归属或微信商户配置。
- 用户小程序从一次用户手势发起 API-105 后恰好调用一次 `wx.requestPayment`；客户端不在回调前宣称支付成功，未知结果保持待恢复状态。
- 同步 OpenAPI、生成类型、`miniapp-kit` 契约、错误码、状态机、权限、页面、API/P0/测试/任务/阶段台账、项目状态、M3 冻结证据及 12 表执行总控工作簿。

## 先失败后通过证据

| 证据 | 结果 |
|---|---|
| RED API | 3/3 因路由不存在返回 404 |
| RED 小程序 | 混合支付动作不存在，按预期失败 |
| 开始事务 repository focused | 1/1 PASS |
| 成功回调 repository focused | 6/6 PASS：正常、重复/并发、金额/状态冲突、晚期失败全回滚 |
| API focused | 3/3 PASS |
| 小程序 focused | 7/7 PASS |
| OpenAPI focused | 1/1 PASS |
| P0-056 Chromium focused | 1/1 PASS |
| 契约回归 | 91/91 PASS |
| `pnpm verify` | 17/17 PASS，`base=HEAD`；完成时间 `2026-08-17T06:45:19Z` 前后 |
| OpenAPI 全集 | 23/23 PASS；生成产物字节一致 |
| 迁移契约 | 51/51 PASS；已发布迁移 `34/34` 完整 |
| API 全集 | 47 files / 238 tests PASS |
| P0 E2E 全集 | Chromium 78/78 PASS |
| 基础 E2E | 3/3 PASS |
| Prisma validate | PASS |
| 迁移演练 | `empty=2 / upgrade=2 / restore=2 / product=34 / cleanup=PASS` |
| secrets | 1032 tracked files PASS |
| 工作簿 | 12 表 CSV 同步、全表渲染检查通过；公式错误 0；SHA-256 `F012ECE32CEC5F8B8EF6A1DC28E8F1ED3ED16D7B3FEADF63179D085289E51EA9` |

全量门禁的失败与恢复如实保留：

1. 第一次因新增生成契约尚未提交，在 `openapi-diff` 退出 1；提交后重跑。
2. 第二次因新增 P0 测试与 `exactOptionalPropertyTypes` 不兼容，在 typecheck 退出 1；修正测试对象构造后重跑。
3. 第三次因四个历史交接契约仍断言旧 P054/P055 项目状态而失败；只推进动态状态断言后重跑。
4. 第四次进入全契约组后，18 个历史契约仍断言旧 currentTask/Issue/上一 PR，随后 focused 契约还发现 API 数量由 104 增至 105；统一到真实 P056 状态后，91/91 通过。
5. 最终从提交 `904bb529e765dc0bfc83d8a8ec33f733182ee9a0` 的 HEAD 重新执行，17/17 通过；没有删除测试、降低断言或跳过门禁。

另有一次把 Vitest 文件误交给 `node --test` 的命令使用错误，以及一次遗漏 OpenAPI breaking base 参数；均已用正确命令重新执行并通过，不计为产品行为通过证据。

## P0 与环境边界

- P0-056：`LOCAL_PASS`，覆盖自动最大抵扣、金额守恒、单一公司微信交易、先冻结后预支付、回调后实扣、幂等/并发、晚期失败回滚、DTO 隔离及小程序一次 `wx.requestPayment`。当前没有 PR head CI，不能写成 `CI_PASS`。
- P0-024：形成微信支付幂等和成功回调局部证据；真实微信通知签名及未知结果主动查询仍未在所需环境执行。
- P0-092/P0-093：形成确认订单页账户选择与混合支付动作局部证据；完整页面及真机支付未验收。
- 本地环境：Windows，Node `22.23.1`，pnpm `10.12.1`，Prisma `6.19.2`，MySQL 8 迁移演练，Playwright Chromium。
- 真实福利计划/账户/资金、真实微信、staging、device、production：`NOT_EXECUTED`；本地适配器和浏览器模拟不能提升证据等级。

## 风险与回滚

- P057 尚未实现取消、失败、超时和未知结果后的福利卡解冻；本切片必须保持失败关闭，不能由客户端自行解冻或创建第二笔交易。
- P058 尚未实现福利卡＋微信原结构退款，不能从 P056 成功链推断退款已完成。
- 财务记录为只追加/冲正语义；如果共享环境需要修复，只能新建向前修复迁移或补偿记录，不能覆盖或删除既有账本/支付记录。
- 公司/供应商 Vite bundle 仍有既有大 chunk 警告；不影响本切片结果，但不代表性能优化完成。
- 未发布时回滚应用提交并重建本地开发库；若后续共享环境已产生 P056 记录，回退应用版本并采用向前补偿，禁止破坏性 down migration。

## 下一门禁

`M3-P057` 保持 `LOCKED`。只有本切片 Draft PR 最新精确 head 的必需 Actions 全部成功、用户对该 head 明确授权 Ready/合并、人工合并完成，且合并后 `main` 最新 CI 成功，才允许进入 P057。
