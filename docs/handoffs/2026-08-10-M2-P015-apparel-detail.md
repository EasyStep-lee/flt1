# M2-P015 服饰详情交接

## 结论与边界

- 当前结论：`CI_PASS`；实现提交 `d87fd3409978f79f9490752e0ce1ce44d25154eb` 的行为 RED、服饰领域策略、focused API/小程序/P0、全量 Supertest、Prisma 校验、真实 MySQL 迁移演练、OpenAPI 确定性和不依赖 Turbo 的逐包测试/构建均通过；本机完整 `pnpm verify` 仍受 Windows 企业应用控制阻止，但 Draft PR #56 的 Ubuntu Actions 已对精确 head `204a559ab7fa8808f37e90280445f950d06b0e3e` 完成全量门禁。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@f2d6c1c665774bc57149e6125da829d7b1fb9dd1`；分支 `codex/m2-apparel-detail`；Issue [#55](https://github.com/EasyStep-lee/flt1/issues/55)。
- 唯一范围：`P0-015` APPAREL 模板、服饰字段与颜色/尺码 SKU 校验、公开详情 DTO 白名单、公司模板预置及用户小程序服饰详情区块。
- 明确未进入：`P0-016` 至 `P0-018`、`P0-021`/`P0-088` 完整商品详情、正式数据、价格审批、交易、支付、库存扣减和配送。

## 前序 GitHub 门禁

- PR [#54](https://github.com/EasyStep-lee/flt1/pull/54) 精确 head `9bbaa92e22d2c7055ffefbe089f92eaaf69cdabe` 的 Actions run [31452009986](https://github.com/EasyStep-lee/flt1/actions/runs/31452009986) 成功。
- 已按人工授权转 Ready 并合并为 `main@f2d6c1c665774bc57149e6125da829d7b1fb9dd1`；合并后 main run [31453656294](https://github.com/EasyStep-lee/flt1/actions/runs/31453656294) 成功，Issue #53 已关闭，因此 P015 起点有效。

## 实际变更

- `CategoryTemplate.profile` 以前向迁移从 `GENERIC|FOOD|FRESH` 扩展为 `GENERIC|FOOD|FRESH|APPAREL`，已发布 profile 与 JSON 定义继续不可覆盖。
- APPAREL 模板固定面料、里料、版型、执行标准、洗护方式和尺码表六项商品字段，颜色、尺码两个 SKU 维度，以及尺码助手、材质、洗护、规格、试穿退换五个详情模块。
- 颜色/尺码组合经 Unicode NFKC、首尾空白和大小写归一后必须唯一，重复请求在持久化前返回 `SKU_DIMENSION_DUPLICATE`。
- 试穿退换说明只从已发布模板 `afterSaleRules` 生成，必须包含江苏福礼团供应链科技有限公司；供应商商品内容不能替换或嵌套覆盖。
- 供应商创建、修改和提交服饰商品时按精确已发布版本校验；公开详情只返回在售零售 SKU、整数分零售价、服饰白名单字段及公司售后提示。
- 公司商品运营页增加服饰模板草稿预置；用户原生小程序按 `templateProfile` 渲染服饰标签、尺码表、材质、洗护和售后模块，唯一网络入口仍为 `miniapp-kit`。

## 权限、错误码与不变量

- 模板管理仍固定为公司 `COMPANY_PRODUCT_OPS` 独立页面和会话；供应商只按本方商品写入模板允许字段，`supplierId` 从已验证会话派生。
- 对客 DTO `NEVER_RETURN` 供应价、资质私有对象引用、`companyId`、`functionalAccountId`、`identityId`、结算字段和审核快照。
- 主要错误码：`APPAREL_REQUIRED_FIELD_MISSING`、`SKU_DIMENSION_DUPLICATE`、`APPAREL_HISTORY_REWRITE`、`TEMPLATE_SCHEMA_INVALID`、`TEMPLATE_DATA_INVALID`、`PRODUCT_NOT_SALEABLE`。

## 新鲜测试证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED 单元测试 | 缺少 `dist/category-templates/apparel-template.policy.js`，`ERR_MODULE_NOT_FOUND` | 已确认 |
| 服饰策略单元测试 | 3/3 | PASS |
| 模板与公开服饰详情 focused API | 15/15 | PASS |
| 全量 Supertest | 26 文件，152/152 | PASS |
| 用户小程序 | 首次因旧 dist 失败；显式 build 后 9/9 | PASS |
| 服饰迁移契约 | 2/2 | PASS |
| P015 Playwright | 1/1 | PASS |
| lint + typecheck | 全 workspace | PASS |
| Prisma schema | `pnpm prisma:validate` | PASS |
| 迁移演练 | 首次 Docker engine 未运行；恢复后 empty=2、upgrade=2、restore=2、product=18、cleanup=PASS | PASS |
| OpenAPI 生成/一致性 | 字节一致 | PASS |
| 完整门禁 | 前 8/17 项通过；`regression` 内所有断言通过后，Turbo 启动被 Windows Code Integrity 拒绝 | BLOCKED_EXTERNAL |
| 回归断言 | shells 6/6、miniapp transport 4/4、OpenAPI 17/17、迁移 34/34、CI 8/8、handoff 23/23、contracts 66/66、foundation 4/4 | PASS |
| 逐包测试/构建 | `pnpm -r --workspace-concurrency=1 --if-present test/build`，13/14 workspace 项目，均退出 0 | PASS |
| P0 全量报告 | 40/40 | PASS |
| 秘密扫描 | 665 个 Git 跟踪文件 | PASS |
| Draft PR 精确 head CI | run 31458022233 / job 93675740350，完整 `pnpm verify` | CI_PASS |

## 环境、风险与回滚

- 本地环境：Windows、Node 22.23.1、Docker Desktop/MySQL 8、Chromium；focused 与等价分项达到本地通过，但完整聚合器仍被外部终端策略阻塞。GitHub Ubuntu Actions 已对 `204a559...` 运行完整门禁并通过，因此当前切片达到 `CI_PASS`，但不等于 staging、device、production 或已合并。
- Windows Code Integrity Operational 事件 `3033/3077` 明确记录策略 `{0283ac0f-fff1-49ae-ada1-8a933130cad6}` 拒绝未签名 `node_modules/.../turbo.exe`；未修改、关闭或绕过企业安全策略。
- EXT-007 正式服饰模板字段、尺码表、洗护和退换口径仍需授权商品运营/合规确认；自动化模板预置不是生产业务数据验收。
- PAGE-053 只完成 P015 服饰区块，不能扩展为 P0-021/P0-088 完整商品详情或真机通过。
- 回退应用提交会移除 APPAREL profile、公开服饰详情和页面增量；若共享环境已经应用迁移，不回改已发布 SQL，保留兼容枚举并用后续向前迁移修复。

## GitHub 门禁与下一步

- Draft PR [#56](https://github.com/EasyStep-lee/flt1/pull/56) 当前保持 Draft；精确 head `204a559ab7fa8808f37e90280445f950d06b0e3e` 的 Actions run [31458022233](https://github.com/EasyStep-lee/flt1/actions/runs/31458022233)、job `93675740350` 于 `2026-08-11T04:26:26Z` 成功。
- 当前尚无评论或 review；证据更新提交推送后必须对新的最终 head 再运行 Actions，并复查未解决线程和 merge 状态。
- 未经用户对届时精确 head 的明确授权，不转 Ready、不合并；合并后 `main` CI 成功前不得开始 M2-P016。
