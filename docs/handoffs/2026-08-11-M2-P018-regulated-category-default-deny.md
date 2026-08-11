# M2-P018 强监管默认关闭交接

## 结论与边界

- 当前结论：`CI_PASS / IN_PROGRESS`。P018 已完成真实 RED、最小实现、focused API/契约/P0 E2E、OpenAPI、MySQL 迁移演练、干净 head `b026a720e74df968c0ccf1e7a38975fe2bd2c281` 的完整 `pnpm verify` 17/17，以及 Draft PR #62 首轮精确 head `a341c9164c7462457aa31ed509fe574ea77ed4f9` 的 Actions；本次证据同步会产生新 head，仍须复核其 CI 和自评，且未经人工精确 head 授权不得转 Ready 或合并。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@56bd581dc4ccd88ab2620445a417beec87c5c1ad`；分支 `codex/m2-regulated-default-deny`；Issue [#61](https://github.com/EasyStep-lee/flt1/issues/61)；Draft PR [#62](https://github.com/EasyStep-lee/flt1/pull/62)。
- 唯一范围：`P0-018` 强监管模板、公司显式开关、资质有效期、商品提交/审批/公开目录默认拒绝、审计和公司商品运营独立区块。
- 明确未进入：`P0-019`、订单、支付、退款、库存预扣、配送、正式资质录入、staging、真机和生产。

## 前序 GitHub 门禁

- PR [#60](https://github.com/EasyStep-lee/flt1/pull/60) 最终 head `59b020e38d38dc2a8d5d1e1009a2fdc8c5558d30` 的 Actions run [31479644045](https://github.com/EasyStep-lee/flt1/actions/runs/31479644045) 成功。
- 已按用户对该精确 head 的授权转 Ready 并合并为 `main@56bd581dc4ccd88ab2620445a417beec87c5c1ad`；合并后 main run [31480997963](https://github.com/EasyStep-lee/flt1/actions/runs/31480997963) 成功，Issue #59 关闭，因此 P018 起点有效。

## 实际变更

- `CategoryTemplate.regulatoryMode` 增加 `STANDARD | HIGH_RISK`；发布后与 profile/JSON 定义一并不可改写。
- HIGH_RISK 模板要求至少一项 `required + expiryRequired` 资质规则和固定 `NOTICE`、`QUALIFICATIONS` 模块。
- 无 `RegulatedCategoryControl` 记录等价于关闭；启停以版本、追加历史、幂等命令和审计留痕。
- 公司资质仅接受 `object://company-qualification/...` 受控引用；响应和审计只返回引用数、有效期与状态摘要。
- `SupplierProduct` 与 `Product` 固化 `qualificationValidUntil`；提交、公司资料审批和公开目录分别重校验。
- 公开目录对 HIGH_RISK 以数据库查询条件默认拒绝，不返回供应价、资质引用、公司/身份/职能字段。
- 公司商品运营页新增 `data-page-id="PAGE-M2-018"` 独立强监管控制区，覆盖加载、空态、权限、离线、未知结果、启用和停用。

## 权限、错误码与不变量

- 固定职能：`COMPANY_PRODUCT_OPS`；固定路由：`/company-admin/workspaces/product-ops`；归属字段均由已验证会话派生。
- 启停须敏感操作二次验证；这不替代方案中对明确 maker-checker 动作按不同自然人 identityId 隔离的规则。
- 主要错误码：`REGULATED_CATEGORY_DISABLED`、`QUALIFICATION_REQUIRED`、`CATEGORY_TEMPLATE_INVALID`、`SECOND_VERIFICATION_REQUIRED`、`VERSION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`AUDIT_REQUIRED`。
- 相同幂等键同请求返回原响应；相同键不同请求冲突；陈旧版本、验证失败和审计失败不产生成功历史。

## 新鲜测试证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED focused API | HIGH_RISK 模板尚不受支持，3/3 失败，退出码 1 | 已确认 |
| GREEN focused API | 3/3；含默认关闭、资质过期、模板不合规、二次验证、重放/冲突/陈旧版本、历史和审计脱敏 | PASS |
| P018 契约与迁移契约 | 3/3 | PASS |
| P018 Playwright | 2/2 | PASS |
| 相关 API 回归 | 27/27 | PASS |
| API unit | 56/56 | PASS |
| company-admin node | 2/2 | PASS |
| 历史契约回归 | 8/8 | PASS |
| API/company-admin build | PASS；公司模板预置首跑缺 STANDARD 后修复 | PASS |
| Prisma validate | PASS | PASS |
| 迁移演练首跑 | 两个外键名和 updated_at 默认与 Prisma 漂移 | FAIL_CONFIRMED |
| 迁移演练修复后 | empty=2、upgrade=2、restore=2、product=21、cleanup=PASS | PASS |
| OpenAPI generate | 确定性生成 OpenAPI 与统一类型 | PASS |
| `pnpm verify` 提交前运行 | workspace/lint/OpenAPI 生成通过；openapi-diff 因本切片尚未提交而按设计失败 | EXPECTED_FAIL_PRE_COMMIT |
| 干净 head 第一次 | OpenAPI 冻结清单缺 3 条路径及 4 个 DTO schema | FAIL_CONFIRMED |
| 干净 head 第二次 | P018 台账 CI 空值、项目 CI 使用非冻结状态词 | FAIL_CONFIRMED |
| 干净 head 第三次 | 14 个历史契约仍将 P017 硬编码为当前任务 | FAIL_CONFIRMED |
| 干净 head 第四次 | 供应商商品响应白名单缺少 `qualificationValidUntil: null` | FAIL_CONFIRMED |
| 对应 focused 修复 | OpenAPI 17/17；交接 23/23；契约 74/74；供应商商品 API 5/5 | PASS |
| 完整 `pnpm verify` 第五次 | `b026a72`，17/17，退出码 0，11:59:11Z—12:14:04Z | PASS |
| P0 E2E 全量 | 44/44 | PASS |
| 迁移完整性/演练 | published=21；empty=2、upgrade=2、restore=2、product=21、cleanup=PASS | PASS |
| secrets scan | 706 个 tracked 文件 | PASS |

## 数据、迁移与回滚

- 迁移：`packages/db/prisma/migrations/20260811110000_m2_regulated_category_controls/migration.sql`。
- 既有模板默认 `STANDARD`；不回填任何正式强监管分类或资质数据。
- 应用回退前先停用所有强监管控制。若共享环境已应用迁移，不改写已发布 SQL；保留控制历史、命令和审计，以后续前向迁移修复。

## 环境、外部缺口与风险

- 本地证据来自 Windows、Node 22、Docker Desktop/MySQL 8 和 Chromium。
- `EXT-007` 首批分类、公司/商品资质有效期、售后和法务口径仍为 `NOT_PROVIDED`；代码和测试桩不是正式业务验收。
- staging、微信真机和 production 均为 `NOT_EXECUTED`。

## GitHub 门禁与唯一下一步

- Draft PR #62 首轮 head `a341c9164c7462457aa31ed509fe574ea77ed4f9` 对应 Actions run [31490934927](https://github.com/EasyStep-lee/flt1/actions/runs/31490934927)、job `93777025266`，于 `2026-08-11T12:30:31Z` 成功；当时 PR 可合并且无评论、review 或 unresolved thread。
- 本次证据同步提交会产生不同于 `a341c91` 的新 head；唯一下一步是让该新 head 重新通过 Actions，并以自评评论绑定最终 head 后停在人工合并门禁。
- 未获用户对最终精确 head 的明确授权前，不转 Ready、不合并；合并后 main CI 成功前不得开始 M2-P019。
