# M2-P012 分类模板版本交接

## 结论与边界

- 结论：`LOCAL_PASS`；Draft PR #50 的 head `aed91d7…` CI 已证明并发 Supertest 自动绑定未监听 server 的跨平台竞态，显式监听修复 head CI 待执行；人工合并、合并后 `main` CI、staging 和 production 均为 `NOT_EXECUTED`。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@49b59ea102b653bfb979877539b9fb8f1e8b5afc`；分支 `codex/m2-category-template`；实现与本地验证提交 `dcc4c133ede9f1e28880fc70394c2e55715a10d8`；Issue [#49](https://github.com/EasyStep-lee/flt1/issues/49)；Draft PR [#50](https://github.com/EasyStep-lee/flt1/pull/50)。
- 唯一范围：`P0-012`，末级分类的通用模板版本、字段/SKU/资质/详情/售后规则结构、发布与历史，以及供应商商品到公司物化全链路的当前发布版本复核。
- 明确未进入：`P0-013` 至 `P0-017` 五类正式模板内容、`P0-018` 强监管开关、正式生产模板数据、价格、库存扣减、交易和配送。

## 前序 GitHub 门禁

- PR [#48](https://github.com/EasyStep-lee/flt1/pull/48) 的精确 head `abb82b1be670ab145f719d8682b59ba23ffcfe7d` 与授权一致，Actions run [31372338118](https://github.com/EasyStep-lee/flt1/actions/runs/31372338118) 成功，无评论、review 或未解决线程。
- 已按人工授权转为 Ready 并合并为 `main@49b59ea102b653bfb979877539b9fb8f1e8b5afc`；合并后 main Actions run [31375326708](https://github.com/EasyStep-lee/flt1/actions/runs/31375326708) 成功，Issue #47 已关闭，因此 P012 起点有效。

## 实际变更

- 新增 `CategoryTemplate`、`CategoryTemplateHistory`、`CategoryTemplateCommand` Prisma 模型及 `20260810094000_m2_category_templates` 前向迁移；复合外键让 `SupplierProduct`/`Product` 的 `categoryId + templateVersion` 必须引用真实版本。
- 模板状态机固定为 `DRAFT → PUBLISHED → RETIRED`；同一末级分类最多一个草稿和一个当前发布版本，新发布原子退役旧版本，发布/退役定义不可修改。
- 新增模板仓库、策略、服务、DTO、控制器和 Prisma/内存实现；`companyId`、操作者与固定职能从验证会话派生，不接受客户端归属字段。
- 新增查询、创建草稿、修改草稿与发布四个操作；写操作使用幂等键、乐观 revision 和追加历史，审计失败必须回滚业务写入。
- 模板结构严格白名单并规范化：字段与验证规则、SKU 维度、资质规则、详情模块及售后提示；拒绝重复键、危险内容和断开的引用。
- 供应商商品创建、分类/模板修改、提交与公司双审物化统一复核当前发布模板；草稿、退役、旧版、跨分类或跨公司版本均拒绝。
- 公司后台 PAGE-005 增加分类模板面板，覆盖选择末级分类、创建/编辑/发布及 loading/empty/permission/offline/unknown-result/retry；仅 `COMPANY_PRODUCT_OPS` 可访问。
- OpenAPI 与统一类型已确定性生成；模板和商品 DTO 不含供应价、`companyId` 或 `functionalAccountId`。

## 状态机、权限、错误码与数据范围

- 模板状态：`DRAFT` 可编辑；`PUBLISHED` 当前有效且定义不可变；发布下一版时旧版进入 `RETIRED`，内容和历史快照保持不变。
- 仅同公司、启用、无子节点的末级分类可创建/发布模板；同一分类最多一个草稿和一个当前发布槽位。
- 模板管理权限固定为 `COMPANY_PRODUCT_OPS` 和 `/company-admin/workspaces/product-ops`；其他公司、其他职能及直达路由不得越权。
- 主要错误码：`TEMPLATE_SCHEMA_INVALID`、`TEMPLATE_NOT_FOUND`、`TEMPLATE_DRAFT_EXISTS`、`TEMPLATE_IMMUTABLE`、`TEMPLATE_VERSION_INACTIVE`、`CATEGORY_DISABLED`、`CATEGORY_NOT_LEAF`、`VERSION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`AUDIT_REQUIRED`。

## 先失败后通过的测试证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED API | 因 `dist/category-templates/in-memory-category-template.repository.js` 不存在而在导入时失败 | 已确认 |
| 模板 API focused | 6/6 | PASS |
| 分类、商品、价格与双审核相关 API | 29/29 | PASS |
| 全量 Supertest | 23 文件，137/137 | PASS |
| 契约与迁移 focused | 4/4 | PASS |
| PAGE-005 P0 Playwright | 2/2 | PASS |
| 第一次 P0 E2E | 1/2；状态文本断言误匹配说明段落 | FAIL，改为精确状态文本后重跑 |
| 第一次全量门禁 | 未提交的生成 OpenAPI 不等于 `HEAD`，`openapi-diff` 按设计失败 | FAIL，创建原子实现提交后完整重跑 |
| 实现提交全量门禁 | `pnpm verify` 17/17，提交 `dcc4c133…` | PASS |
| 证据提交全量门禁 | 历史交接契约仍把当前任务固定为 P011，且工作簿 manifest 为旧哈希 | FAIL，仅迁移当前状态断言并同步制品哈希 |
| 交接 focused 重测 | 23/23；相关 ESLint 通过 | PASS |
| 第二次证据 head 全量门禁 | 15 个旧切片契约仍把全局当前任务/前序交付固定为 P011/P010 | FAIL，仅迁移全局状态断言 |
| 全契约 focused 重测 | 58/58；相关 ESLint 通过 | PASS |
| 迁移演练 | empty=2、upgrade=2、restore=2、product=15、cleanup=PASS；模板约束探针通过 | PASS |
| 最终本地全量门禁 | `pnpm verify` 17/17，基于 `888b92c…` 的 CI 修复工作树，API 137/137，P0 E2E 37/37，秘密扫描 630 个跟踪文件 | PASS |
| Draft PR pre-fix CI | Actions run [31386519633](https://github.com/EasyStep-lee/flt1/actions/runs/31386519633)；API 135/136，通过项外仅组合测试第二个临时服务请求出现 `read ECONNRESET` | FAIL |
| CI 隔离修复 focused 压测 | `CI=true/NODE_ENV=test/TZ=Asia/Shanghai`；拆分后单文件连续 20 次，120/120 | PASS |
| CI 隔离修复全量 Supertest | 23 文件，137/137；仍严格断言 `503/AUDIT_REQUIRED` 和模板/历史零写入 | PASS |
| Draft PR 隔离修复 CI | Actions run [31389213740](https://github.com/EasyStep-lee/flt1/actions/runs/31389213740)；审计失败用例通过，并发发布用例仍出现 `read ECONNRESET` | FAIL，根因收敛到未监听 server 的并发自动绑定 |
| 显式监听修复 focused 压测 | `CI=true/NODE_ENV=test/TZ=Asia/Shanghai`；单文件连续 20 次，120/120；完整 Supertest 23 文件、137/137 | PASS |

显式监听修复后的最终全量报告为 `artifacts/test-results/verification/pnpm-verify.json`，开始 `2026-08-10T12:50:40.292Z`，结束 `2026-08-10T13:01:17.526Z`，17/17 通过。切片证据为 `artifacts/verification/M2-P012/category-template.json`。

## 环境、风险与回滚

- 本地证据环境：Windows、Node 22.23.1、Prisma/MySQL 8 迁移演练、Chromium；证据等级只为 `LOCAL_PASS`。
- EXT-007 正式分类模板字段、资质和售后规则仍需授权商品运营/合规在受控环境确认；自动化模板不等于正式业务模板。
- 通用引擎不能证明食品、生鲜、服饰、数码和礼盒的正式内容完成；`P0-013` 至 `P0-018` 仍为 `NOT_EXECUTED`。
- 回滚应用提交会移除模板 API/页面与商品版本复核；若迁移已进入共享环境，不回改已发布迁移，保留兼容 schema 并用后续向前修复迁移处理。

## GitHub 门禁与下一步

- Draft PR #50 的 head `aed91d77e2c8655bf7ff30e697edf37f6d7b2e75` 对应 Actions run 31389213740 为 `FAIL`；拆分后 `NEG-M2-012-05` 已通过，而 `NEG-M2-012-03` 的四个并发请求在 Linux runner 上仍有一个连接重置，证明问题不是审计业务异常，而是 Supertest 对未监听 server 的并发自动绑定竞态。
- 修复让 fixture 在请求前通过 `app.listen(0, '127.0.0.1')` 完成一次随机本地端口监听，所有并发请求复用该 server；继续拆分审计回滚生命周期，不降低断言，不把连接重置视为可接受，不修改模板状态机/API/数据模型。
- 下一动作仅为提交、推送修复 head，读取其 Actions、评论、review 和 merge 状态。
- 未经用户对届时精确 head 的明确授权，不得转 Ready 或合并；合并后 `main` CI 成功前不得开始 M2-P013。
