# M2-P014 生鲜详情交接

## 结论与边界

- 结论：`LOCAL_PASS`；行为 RED、最小实现、focused API/小程序/P0、全量 Supertest、Prisma 校验、真实 MySQL 迁移演练和 OpenAPI 确定性检查已通过。最终证据树上的完整 `pnpm verify`、Draft PR、PR CI、人工合并、合并后 `main` CI、staging、真机和 production 尚未执行。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@81e3808c7a40824999d1ea70dd9706024e979370`；分支 `codex/m2-fresh-detail`；实现提交 `6653da31537e8daa76c4d15d07dcaeb9ed634680`；Issue [#53](https://github.com/EasyStep-lee/flt1/issues/53)。
- 唯一范围：`P0-014` 生鲜模板、供应商生鲜字段校验、公开生鲜详情 DTO 白名单、公司模板预置及用户小程序生鲜详情区块。
- 明确未进入：`P0-015` 至 `P0-018`、`P0-021`/`P0-088` 完整商品详情、正式数据、价格审批、交易、支付、库存扣减和配送。

## 前序 GitHub 门禁

- PR [#52](https://github.com/EasyStep-lee/flt1/pull/52) 精确 head `22d42359eb6e5ecfaf978efea0c2964c84267d27` 的 Actions run [31413574540](https://github.com/EasyStep-lee/flt1/actions/runs/31413574540) 成功。
- 已按人工授权转 Ready 并合并为 `main@81e3808c7a40824999d1ea70dd9706024e979370`；合并后 main run [31448561555](https://github.com/EasyStep-lee/flt1/actions/runs/31448561555) 成功，Issue #51 已关闭，因此 P014 起点有效。

## 实际变更

- `CategoryTemplate` profile 以前向迁移从 `GENERIC|FOOD` 扩展为 `GENERIC|FOOD|FRESH`；已发布 profile 与 JSON 定义继续不可覆盖。
- FRESH 模板固定品种、等级、产地、采收/屠宰日期、保鲜期、温区、称重规则七项商品字段，重量档、规格、加工方式三项 SKU 维度，以及产地溯源、保鲜储存、称重差异、规格、售后五个详情模块。
- 温区只接受 `AMBIENT|CHILLED|FROZEN`；称重规则只接受 `FIXED_WEIGHT|ACTUAL_WEIGHT`；日期使用严格 `YYYY-MM-DD` 日历值。
- 生鲜售后只从已发布模板 `afterSaleRules` 生成，必须包含江苏福礼团供应链科技有限公司，供应商商品内容不能替换、嵌套覆盖或注入危险标记。
- 供应商创建、修改和提交生鲜时，服务端按精确已发布版本校验必填、字段白名单和 SKU；公开详情只返回在售零售 SKU、整数分零售价、生鲜字段、规格及公司售后提示。
- 公司商品运营页增加生鲜模板草稿预置；用户原生小程序按 `templateProfile` 渲染食品/生鲜标签和售后模块，唯一网络入口仍为 `miniapp-kit`。
- OpenAPI、共享类型和小程序契约确定性生成；P014 仅细化既有 API-030 的生鲜子集，P0-021/P0-088 保持未完成。

## 权限、字段、错误码与不变量

- 模板管理仍固定为公司 `COMPANY_PRODUCT_OPS` 独立页面和会话；供应商只按本方商品写入模板允许字段，`supplierId` 从已验证会话派生。
- profile 和模板内容在发布后不可修改；历史商品继续引用原 `categoryId + templateVersion`，后续模板版本不改写旧快照。
- 对客 DTO `NEVER_RETURN` 供应价、资质私有对象引用、`companyId`、`functionalAccountId`、`identityId`、结算字段和审核快照。
- 主要错误码：`FRESH_REQUIRED_FIELD_MISSING`、`FRESH_WEIGHT_RULE_INVALID`、`FRESH_HISTORY_REWRITE`、`TEMPLATE_SCHEMA_INVALID`、`TEMPLATE_DATA_INVALID`、`PRODUCT_NOT_SALEABLE`。

## 先失败后通过证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED 单元测试 | 缺少 `dist/category-templates/fresh-template.policy.js`，`ERR_MODULE_NOT_FOUND` | 已确认 |
| FOOD + FRESH 策略单元测试 | 6/6 | PASS |
| 模板与公开生鲜详情 focused API | 16/16 | PASS |
| 全量 Supertest | 25 文件，147/147 | PASS |
| 用户小程序 | 8/8 | PASS |
| 契约与迁移 focused | 8/8 | PASS |
| P013 + P014 Playwright | 2/2 | PASS |
| Prisma schema | `pnpm prisma:validate` | PASS |
| 迁移演练 | empty=2、upgrade=2、restore=2、product=17、cleanup=PASS | PASS |
| OpenAPI 生成/一致性 | 字节一致 | PASS |
| oasdiff breaking | 0 errors、405 warnings，退出码 0 | PASS_WITH_WARNINGS |
| 完整门禁 | 最终证据提交后执行 `pnpm verify` | NOT_EXECUTED |

切片机器证据为 `artifacts/verification/M2-P014/fresh-detail.json`；聚合报告位置为 `artifacts/test-results/verification/pnpm-verify.json`，但必须以本切片最终证据提交的新鲜运行覆盖后才可登记通过。

## 环境、风险与回滚

- 本地环境：Windows、Node 22.23.1、Prisma/MySQL 8、Chromium；当前最高等级仅为 `LOCAL_PASS`。
- EXT-007 正式生鲜模板字段、售后口径和商品数据仍需授权商品运营/合规确认；自动化模板预置不是生产业务数据验收。
- PAGE-053 只完成 P014 生鲜区块，不能扩展为 P0-021/P0-088 完整商品详情或真机通过。
- 兼容响应类型名仍为 `PublicFoodProductDetailResponseDto`，其 profile 已确定性扩展为 `FOOD|FRESH`；后续命名通用化必须保持 OpenAPI 兼容。
- 回退应用提交会移除 FRESH profile、公开生鲜详情和页面增量；若共享环境已经应用迁移，不回改已发布 SQL，保留兼容枚举并用后续向前迁移修复。

## GitHub 门禁与下一步

- 当前尚未创建 PR；下一动作仅为提交最终证据、运行完整门禁、推送分支并创建 Draft PR。
- Draft PR 创建后读取精确 head 的 Actions、评论、review 和 merge 状态。
- 未经用户对届时精确 head 的明确授权，不转 Ready、不合并；合并后 `main` CI 成功前不得开始 M2-P015。
