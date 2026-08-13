# M2-GATE 阶段门禁未完成交接

阶段结论：`BLOCKED_EXTERNAL`。M2 的 18 项主 P0 技术证据已在候选 `main` 收口并通过本轮 focused 验证，但 `EXT-007` 仍为 `NOT_PROVIDED` 且 `BlocksFormalAcceptance=YES`，因此不得把 M2 写成 PASS，M3 继续锁定。

## 基线与候选版本

- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，本轮校验 `PASS`。
- 候选 `main`：`7ea79b9fec8364aecbe5beeb12fc53d43be45690`。
- 最后业务切片：M2-P071，PR #72，head `8b166d3801f6de3809d311ff8947214bb16aab9d`，经用户精确 head 授权后已合并。
- PR #72 精确 head CI：run `31662130194` / job `94328914066`，`CI_PASS`。
- 合并后 main CI：run `31663228561` / job `94332305240`，`CI_PASS`。
- 本门禁记录：Issue #73，分支 `codex/m2-gate`；Draft PR 在门禁证据提交后创建。

## 范围与非范围

本切片仅汇总 M2-000 及 18 个 M2 业务切片的 P0、迁移、OpenAPI、页面、权限和测试证据，并记录正式业务验收阻塞。未实现 M3 用户、企业采购、订单、福利卡或微信支付；未修改 Prisma Schema、SQL 迁移、API、DTO、页面路由或生产配置。

## 技术证据

| 证据 | 结果 | 边界 |
| --- | --- | --- |
| 18 项 M2 主 P0 | `CI_PASS` | 全部业务切片已合并，候选 main CI 成功；不替代 EXT-007 正式业务确认 |
| M2 契约 | `LOCAL_PASS` | 46/46 |
| 策略与库存领域测试 | `LOCAL_PASS` | 13/13 |
| Supertest API | `LOCAL_PASS` | 50/50 |
| M2 P0 E2E | `LOCAL_PASS` | Chromium 27/27；离线状态测试中的代理连接拒绝为预期证据 |
| 迁移契约 | `LOCAL_PASS` | 17/17 |
| MySQL 迁移演练 | `LOCAL_PASS` | `empty=2 / upgrade=2 / restore=2 / product=24 / cleanup=PASS` |
| OpenAPI / DTO | `LOCAL_PASS` | 确定性生成、类型无漂移、相对候选 main 无破坏变更 |
| 根级 `pnpm verify` | `LOCAL_PASS` | 提交 `346ef4a`，17/17，`2026-08-13T04:19:56.415Z` 至 `04:37:04.990Z` |

已复核的关键不变量包括：SupplierProduct 与 Product/Sku 两层模型、分类模板版本化、无供应商店铺、供应价变更必审、零售/集采销售价免审但追加留痕、供应价对买家永久不可见、强监管默认关闭，以及个人/企业共用商品和每 SKU 唯一 InventoryBalance。

## 先红后绿

- RED：`node --test ./tests/handoffs/m2-gate-preflight.contract.test.mjs` 首次因机器证据、门禁台账状态和交接文件不存在而 `0/3`、退出码 `1`。
- GREEN：门禁契约最终 `3/3`；M2 契约 `46/46`；完整合同集合 `83/83`；根级 `pnpm verify` 最终 `17/17`、退出码 `0`。
- 完整门禁前三次重跑均在 regression 步骤失败并被保留：依次发现 3 个 M1 交接契约、6 个 M2 历史切片契约和 12 个 M1 历史切片契约硬编码旧的当前任务。修复没有删除断言，而是把当前态断言升级为 `M2-GATE + EXT-007 + M3锁定`，并继续保留历史切片精确证据。
- 一次组合迁移/OpenAPI 命令在 120 秒编排超时后未得出结论；拆分重跑的各独立命令均真实通过，未把超时虚报为 PASS 或功能失败。

## 真实阻塞

`EXT-007` 要求公司授权业务/合规人员确认首批分类树、每类模板字段、公司与商品资质有效期和售后规则。未确认前只能保留可配置结构、测试对象和强监管默认关闭，不能把测试 fixture 当作正式分类或资质资料。

`EXT-008` 仍为 `NOT_PROVIDED`，但当前登记为 `BlocksFormalAcceptance=NO`。供应价必审、零售/集采售价免审留痕的锁定边界不会因该项未提供而改变。

## 环境边界

- local：`LOCAL_PASS`，完整 `pnpm verify` 17/17。
- candidate main CI：`CI_PASS`，run `31663228561`。
- staging：`NOT_EXECUTED`。
- 真机：`NOT_EXECUTED`，本门禁不以模拟器冒充真机证据。
- 生产：`NOT_EXECUTED`。
- 正式阶段验收：`BLOCKED_EXTERNAL_EXT_007`。

## 风险与回滚

- 最大风险是把技术模型或测试数据误认作已批准的业务分类/合规口径；当前以 EXT-007 阻塞、强监管默认关闭和 M3 锁定控制。
- 本切片无 Schema、迁移、API 或业务运行时变更。回滚只需通过受审 PR `git revert` 门禁证据提交，不改写公共历史，不涉及数据库回滚。
- 用户已有未跟踪 UI 资产、浏览器资料、旧方案和临时目录均未修改、未暂存。

## 继续条件

1. 授权人员以脱敏确认提供 EXT-007；不要在聊天或仓库粘贴营业资质原图、个人敏感信息、密钥或生产数据。
2. 在当前 M2-GATE Draft PR 更新正式确认、重跑 focused 与完整门禁，并验证最新 head CI。
3. 只有用户对最新精确 head 明确授权 Ready/合并，且合并后 main CI 成功，才能将 M2 记为 PASS。
4. 在此之前当前唯一允许任务仍为 `M2-GATE`，M3 保持锁定。
