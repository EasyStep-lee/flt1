# M2-P017 礼盒组合交接

## 结论与边界

- 当前结论：`LOCAL_PASS_FOCUSED / IN_PROGRESS`。真实 RED、礼盒领域策略、focused API、小程序、契约、迁移契约与 P017 Playwright 已通过；完整 `pnpm verify`、Draft PR 和 CI 尚未执行，因此本切片未完成，也不得进入 P018。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@371d99dc668cf021583fb43f86750cb4630573b7`；分支 `codex/m2-gift-box-detail`；实现提交尚未创建；Issue [#59](https://github.com/EasyStep-lee/flt1/issues/59)；PR 尚未创建。
- 唯一范围：`P0-017` GIFT_BOX 模板、结构化组合子项与归属校验、公开详情 DTO 白名单、公司模板预置及用户小程序组合清单区块。
- 明确未进入：`P0-018`、`P0-021`/`P0-088` 完整商品详情、正式数据、价格审批、交易、支付、库存扣减和配送。

## 前序 GitHub 门禁

- PR [#58](https://github.com/EasyStep-lee/flt1/pull/58) 最终 head `6ec6e8f3193c0cfdb19ebc481bbbd77f7201df4f` 的 Actions run [31471253414](https://github.com/EasyStep-lee/flt1/actions/runs/31471253414) 成功。
- 已按用户对该精确 head 的授权转 Ready 并合并为 `main@371d99dc668cf021583fb43f86750cb4630573b7`；合并后 main run [31472192291](https://github.com/EasyStep-lee/flt1/actions/runs/31472192291) 成功，Issue #57 已关闭，因此 P017 起点有效。

## 实际变更

- `CategoryTemplate.profile` 以前向迁移扩展 `GIFT_BOX`，字段类型新增 `BUNDLE_ITEMS`；已发布 profile 与 JSON 定义继续不可覆盖。
- GIFT_BOX 模板固定组合清单、包装、定制、交付周期、福利场景，以及套餐、档位、定制版本三个 SKU 维度。
- 每个子项必须包含名称、正整数数量、规格和正整数最低有效期天数；非法结构返回 `BUNDLE_SCHEMA_INVALID`。
- 可选 `supplierProductId` 仅供供应商草稿域内部关联；服务端逐项用会话派生的 `supplierId` 校验归属，跨供应商和不存在目标统一返回 `SUPPLIER_SCOPE_FORBIDDEN`。
- 公开详情只从已审核快照返回子项名称、数量、规格、最低有效期、在售零售价和公司统一结账标识，内部子商品引用及供应价等敏感字段不对客。
- 公司商品运营页增加礼盒模板草稿预置；用户原生小程序渲染组合清单与最低有效期，唯一网络入口仍为 `miniapp-kit`。

## 权限、错误码与不变量

- 模板管理固定为公司 `COMPANY_PRODUCT_OPS` 独立页面和会话；供应商只可编辑本方商品，`supplierId` 从已验证会话派生。
- 对客 DTO `NEVER_RETURN`：`supplierProductId`、供应价、资质私有引用、`companyId`、`functionalAccountId`、`identityId`、审批、结算和毛利字段。
- 已审核 `detailSnapshot` 是公开组合清单事实源；子商品草稿后续变化不得回写历史响应。
- 主要错误码：`BUNDLE_SCHEMA_INVALID`、`SUPPLIER_SCOPE_FORBIDDEN`、`TEMPLATE_VERSION_IMMUTABLE`、`TEMPLATE_SCHEMA_INVALID`、`TEMPLATE_DATA_INVALID`、`PRODUCT_NOT_SALEABLE`。

## 新鲜测试证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED 单元测试 | 缺少 `dist/category-templates/gift-box-template.policy.js`，`ERR_MODULE_NOT_FOUND`，退出码 1 | 已确认 |
| 礼盒策略单元测试 | 3/3 | PASS |
| 分类模板 focused API | 1/1 | PASS |
| 公开礼盒详情 API | 2/2 | PASS |
| 全量 API | unit 56/56；Supertest 28 文件，160/160 | PASS |
| 用户小程序 | 11/11 | PASS |
| P017 契约 | 3/3 | PASS |
| P017 迁移契约 | 2/2 | PASS |
| typecheck | 13/13 workspace packages | PASS |
| OpenAPI 生成 | `pnpm openapi:generate` | PASS |
| P017 Playwright 首跑 | 预览使用旧 company-admin 构建，等待礼盒模板按钮超时 | FAIL_CONFIRMED |
| P017 Playwright 修复后 | 重建 company-admin 后原断言 1/1 | PASS |
| 完整 `pnpm verify` | 尚未在干净实现提交上执行 | NOT_EXECUTED |

## 数据、迁移与回滚

- 迁移：`packages/db/prisma/migrations/20260811090000_m2_gift_box_template_profile/migration.sql`；仅向 `CategoryTemplate.profile` 检查约束扩展 `GIFT_BOX`，不回填正式数据，不改写历史。
- 应用回退会移除 GIFT_BOX 策略、公开详情和页面增量。若共享环境已应用迁移，不改写已发布 SQL；保留兼容枚举并用后续向前迁移修复。
- 若要真正收窄数据库枚举，必须先证明不存在 GIFT_BOX 模板和历史绑定，否则停止回滚并人工迁移数据。

## 环境、外部缺口与风险

- 本地 focused 证据来自 Windows、Node 22、Docker Desktop/MySQL 8 和 Chromium；完整门禁尚未执行。
- EXT-007 正式礼盒字段、组合子项、最低有效期和售后口径仍需授权商品运营/合规确认；自动化模板和示例不是正式数据验收。
- PAGE-053 只完成 P017 礼盒区块，不能扩展为 P0-021/P0-088 完整商品详情或真机通过。
- staging、微信真机和 production 均为 `NOT_EXECUTED`。

## GitHub 门禁与唯一下一步

- Issue #59 已创建；PR、CI、评论与人工合并均未执行。
- 唯一下一步是同步执行包工作簿，在实现提交上运行完整 `pnpm verify`，修复本切片真实回归，然后创建/更新 Draft PR 并等待精确 head CI。
- 未获用户对最终精确 head 的明确授权前，不转 Ready、不合并；合并后 `main` CI 成功前不得开始 M2-P018。
