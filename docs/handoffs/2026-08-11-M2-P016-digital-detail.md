# M2-P016 数码详情交接

## 合并后门禁补记（2026-08-11）

- 用户授权的 PR #58 精确最终 head `6ec6e8f3193c0cfdb19ebc481bbbd77f7201df4f` 与 GitHub 实际 head 一致；该 head 的 Actions run 31471253414 / job 93714854651 成功。
- PR #58 已按授权转为 Ready 并合并为 `main@371d99dc668cf021583fb43f86750cb4630573b7`；Issue #57 已关闭。
- 合并后 main Actions run 31472192291 / job 93717760889 成功，P016 已在 main 闭环并解锁唯一下一切片 M2-P017。
- 以下内容保留合并前交接时点的历史证据；其中“未合并/P017锁定”不再代表当前状态。

## 结论与边界

- 当前结论：`CI_PASS / BLOCKED_EXTERNAL_HUMAN_MERGE_GATE`；RED、数码领域策略、focused API/小程序/P0、完整 `pnpm test`、独立 API、41 项 P0 E2E、Prisma 校验、真实 MySQL 迁移演练、OpenAPI 兼容性、全构建和秘密扫描已有新鲜本地证据。干净实现提交 `f76b2c0708bba03c3ce52d72b23b12d8206ed08d` 的 `pnpm verify` 17/17 通过，Draft PR #58 的同一精确 head Actions run 31468592265 / job 93706680485 成功。人工 Ready/合并与合并后 main CI 尚未完成，因此不得进入 P017。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@dfd03e1b0ba554c56231e5c6b4c5515d15d772a6`；分支 `codex/m2-digital-detail`；实现提交 `f76b2c0708bba03c3ce52d72b23b12d8206ed08d`；Issue [#57](https://github.com/EasyStep-lee/flt1/issues/57)；Draft PR [#58](https://github.com/EasyStep-lee/flt1/pull/58)。
- 唯一范围：`P0-016` DIGITAL 模板、数码字段与型号 SKU 校验、公开详情 DTO 白名单、公司模板预置及用户小程序数码详情区块。
- 明确未进入：`P0-017` 至 `P0-018`、`P0-021`/`P0-088` 完整商品详情、正式数据、价格审批、交易、支付、库存扣减和配送。

## 前序 GitHub 门禁

- PR [#56](https://github.com/EasyStep-lee/flt1/pull/56) 最终 head `7319f6f2fa13e490e46f262ba9aae7f0746016ad` 的 Actions run [31460861833](https://github.com/EasyStep-lee/flt1/actions/runs/31460861833) 成功。
- 已按用户对该精确 head 的授权转 Ready 并合并为 `main@dfd03e1b0ba554c56231e5c6b4c5515d15d772a6`；合并后 main run [31462310044](https://github.com/EasyStep-lee/flt1/actions/runs/31462310044) 成功，Issue #55 已关闭，因此 P016 起点有效。

## 实际变更

- `CategoryTemplate.profile` 以前向迁移从 `GENERIC|FOOD|FRESH|APPAREL` 扩展为 `GENERIC|FOOD|FRESH|APPAREL|DIGITAL`，已发布 profile 与 JSON 定义继续不可覆盖。
- DIGITAL 模板固定尺寸、功率、电压、接口、能效、执行标准、包装清单、安装说明和保修期九项商品字段，颜色、容量、型号三个 SKU 维度，以及规格参数、能效、包装安装、保修、型号规格、公司售后六个详情模块。
- 型号经 Unicode NFKC、首尾空白和大小写归一后必须唯一，重复请求在持久化前返回 `DIGITAL_MODEL_DUPLICATE`。
- 安装与保修信息只从已发布模板字段和 `afterSaleRules` 生成，必须包含江苏福礼团供应链科技有限公司；供应商商品内容不能替换或嵌套覆盖公司售后规则。
- 供应商创建、修改和提交数码商品时按精确已发布版本校验；公开详情只返回在售零售 SKU、整数分零售价、数码白名单字段及公司售后提示。
- 公司商品运营页增加数码模板草稿预置；用户原生小程序按 `templateProfile` 渲染数码标签、型号规格、参数、能效、包装、安装和保修模块，唯一网络入口仍为 `miniapp-kit`。

## 权限、错误码与不变量

- 模板管理仍固定为公司 `COMPANY_PRODUCT_OPS` 独立页面和会话；供应商只按本方商品写入模板允许字段，`supplierId` 从已验证会话派生。
- 对客 DTO `NEVER_RETURN` 供应价、资质私有对象引用、`companyId`、`functionalAccountId`、`identityId`、结算字段和审核快照。
- 主要错误码：`DIGITAL_REQUIRED_FIELD_MISSING`、`DIGITAL_MODEL_DUPLICATE`、`DIGITAL_HISTORY_REWRITE`、`TEMPLATE_SCHEMA_INVALID`、`TEMPLATE_DATA_INVALID`、`PRODUCT_NOT_SALEABLE`。

## 新鲜测试证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED 单元测试 | 缺少 `dist/category-templates/digital-template.policy.js`，`ERR_MODULE_NOT_FOUND`，退出码 1 | 已确认 |
| 数码策略单元测试 | 2/2 | PASS |
| 模板与公开数码详情 focused API | 2 文件，17/17 | PASS |
| 全量 API | unit 53/53；Supertest 27 文件，157/157 | PASS |
| 用户小程序 | 10/10 | PASS |
| 数码迁移契约 | 2/2 | PASS |
| 全量迁移契约 | 36/36 | PASS |
| P016 Playwright | 1/1 | PASS |
| 全局契约 | 69/69；交接 focused 6/6 | PASS |
| 完整回归 | `pnpm test`，退出 0，446.2 秒 | PASS |
| 独立 API | contract 3/3；Supertest 27 文件、157/157 | PASS |
| 基础 Playwright | 3/3 | PASS |
| P0 Playwright | 41/41 | PASS |
| lint | 历史测试修复后重跑，13/13 workspace packages | PASS |
| typecheck | 13/13 workspace packages | PASS |
| Prisma schema | `pnpm prisma:validate` | PASS |
| 迁移演练 | empty=2、upgrade=2、restore=2、product=19、cleanup=PASS | PASS |
| OpenAPI 生成/一致性 | 字节一致 | PASS |
| OpenAPI breaking | 0 error；404 个新增错误码枚举兼容性 warning | PASS_WITH_WARNINGS |
| 全构建 | 13/13 workspace packages | PASS |
| secrets scan | 668 个 tracked 文件 | PASS |
| 完整 `pnpm verify` 初跑 | 在 openapi-diff 发现尚未提交的合法生成差异后退出 1 | EXPECTED_PRE_COMMIT_FAIL |
| 完整 `pnpm verify` 干净 OpenAPI HEAD 重跑 | `f76b2c0`，17/17，退出 0，07:05:43Z—07:18:52Z | PASS |
| Draft PR 精确 head CI | run 31468592265 / job 93706680485，`f76b2c0`，完整门禁成功 | CI_PASS |

## 环境、风险与回滚

- 本地环境：Windows、Node 22.23.1、Docker Desktop/MySQL 8、Chromium；上述 focused 与迁移证据均为本轮实际执行。
- 本轮 Windows 上 Turborepo 正常执行；没有关闭或绕过任何企业安全策略。首次完整门禁的唯一停止点是尚未提交的 OpenAPI 与旧 HEAD 存在合法差异。
- 两轮完整回归先后暴露 3 个交接指针和 20 个历史契约的陈旧快照断言；已将它们改为保留历史不变量并容纳 P016 合法扩展，最终全局契约 69/69 与 `pnpm test` 均通过。
- EXT-007 正式数码模板字段、能效、安装和保修口径仍需授权商品运营/合规确认；自动化模板预置不是生产业务数据验收。
- PAGE-053 只完成 P016 数码区块，不能扩展为 P0-021/P0-088 完整商品详情或真机通过。
- 回退应用提交会移除 DIGITAL profile、公开数码详情和页面增量；若共享环境已经应用迁移，不回改已发布 SQL，保留兼容枚举并用后续向前迁移修复。

## GitHub 门禁与下一步

- Draft PR #58 当前 head `f76b2c0708bba03c3ce52d72b23b12d8206ed08d` 的 Actions run 31468592265 成功；同步证据会生成新的 PR head，必须再核对新 head 的 CI 后才可向人工交付精确授权文本。
- 自审、人工 Ready/合并和合并后 main CI 尚未执行；未经用户对最终精确 head 的明确授权，不转 Ready、不合并。合并后 `main` CI 成功前不得开始 M2-P017。
