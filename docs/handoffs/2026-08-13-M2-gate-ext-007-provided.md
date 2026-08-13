# M2-GATE EXT-007 已提供交接

阶段结论：`IN_PROGRESS`。`EXT-007` 已由公司授权业务/合规审核人员确认，状态由 `NOT_PROVIDED` 更新为 `PROVIDED`；M2 的外部业务确认阻塞已解除，但本次变更尚未取得当前精确 head CI、人工合并和合并后 main CI，因此门禁结论仍为 `PENDING_EXACT_HEAD_CI_AND_MERGE`，M3 继续锁定。

## 基线、来源与优先级

- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，本轮校验 `PASS`。
- 候选 main：`7ea79b9fec8364aecbe5beeb12fc53d43be45690`；合并后 main CI run `31663228561` / job `94332305240` 为 `CI_PASS`。
- M2-GATE：Issue #73、分支 `codex/m2-gate`、Draft PR #74。
- PR #74 先前 head `c7b33c36537f74ea346e08e3789247f95733f0eb` 的 CI run `31667793351` / job `94345997436` 已成功；它不覆盖本次尚未提交的 EXT-007 变更。
- 授权来源文件：`# EXT-007 福利商城首期商品分类与合规授权确认.md`，SHA-256 `5F6E2E51CDE12E7ED004064E6CD1DAA137359611C9C9AA4C6D192B8AA4B454CF`，12883 字节。原文件未复制入仓库，只登记脱敏回执与归一化业务政策。
- 优先级：综合方案和已冻结开发契约优先；EXT-007 只补齐开发文档尚未定义的正式分类、模板业务字段、资质有效期、临期及售后口径，不得重新定义既有产品边界。

## 本切片范围与非范围

本切片只记录 EXT-007 授权回执、首期分类与合规政策快照，并同步 M2-GATE 状态、外部依赖、测试证据和验收工作簿。没有修改 Prisma Schema、迁移、OpenAPI、DTO、页面或运行时业务逻辑。

明确不进入 M3 用户、企业采购、订单、福利卡、微信支付或配送；不导入生产分类数据，不创建真实资质对象，不把源文件中的通用名称直接变成新字段或新枚举。

## 开发文档优先映射

| EXT-007 表述 | 现有开发契约中的执行方式 |
| --- | --- |
| `sale_price` / `market_price` | 不增加通用价格字段；继续使用整数分的供应价、个人零售价、企业集采价版本，供应价对客永不返回 |
| `stock` | 不进入模板；继续使用每 SKU 唯一 `InventoryBalance` |
| `supplier_id` | 不信任客户端；继续从已验证供应商会话派生 `supplierId` |
| `REGULATED_DISABLED` | 不增加运行时枚举；使用 `Category.status=DISABLED`，并由 `HIGH_RISK` 模板和显式 `RegulatedCategoryControl` 审批共同守门 |
| `AFTER_SALES_POLICY` | M2 记录在不可覆盖的 `CategoryTemplate.afterSaleRules`；完整售后流程仍属于 M5 |
| `SHELF_LIFE_RULE` | 本轮只冻结可配置业务输入；批次库存与临期执行不倒灌已完成 M2 切片 |

## 已确认业务输入

- 首期启用 6 个一级分类、15 个二级分类、91 个三级叶子分类：食品、家居日用、个护、纸品、家庭清洁、文体办公。
- 生鲜、冷链、活体、电子产品、家电、药品、医疗器械、保健食品、特医食品、婴幼儿配方食品、烟草/电子烟、酒类、成人用品、危险化学品、易燃易爆及其他需专项批准的强监管品类保持关闭。
- 食品使用食品模板，其他首期低监管标准商品使用通用模板并按分类增加字段；正式字段映射服从现有模板白名单和版本化规则。
- 资质支持 `LONG_TERM` / `DATE_RANGE`，到期前 30 天和 7 天提醒；依法必须持续有效的资质过期时阻止销售，重新提交并审核后才恢复。
- 食品批次支持 `NORMAL` / `NEAR_EXPIRY` / `EXPIRED` 业务口径，临期阈值必须可配置；过期批次不得销售。
- 售后按分类绑定，运营人员不得任意选择；质量问题始终进入售后，食品安全风险可暂停 SKU、批次或供应商商品等待人工复核。

## 先红后绿与验证

- RED：`node --test tests/handoffs/m2-gate-ext-007-provided.contract.test.mjs`，3 个测试均因回执、归一化政策和新交接不存在而失败，退出码 `1`。
- GREEN：`node --test tests/handoffs/m2-gate-ext-007-provided.contract.test.mjs` 为 3/3；M2 门禁 focused 契约组最终为 57/57。历史状态断言在推进到 `M2-GATE/IN_PROGRESS` 后曾依次出现 34/57、51/57、55/57，均按当前真实状态修正后复跑通过，没有删除测试或降低业务断言。
- 工作树完整验证：`pnpm verify` 于 `2026-08-13T07:24:55.405Z` 至 `07:38:35.192Z` 通过 17/17。首次完整运行在 `migration-rehearsal` 因 Docker Desktop Linux Engine 未运行而失败；启动本机 Docker Desktop 后，迁移 focused 演练为 `empty=2/upgrade=2/restore=2/product=24/cleanup=PASS`，随后完整复跑退出码 `0`。该结果基于 `c7b33c3` 加本切片未提交工作树，只记为工作树证据，不冒充提交级证据。
- 提交级完整验证：实现提交 `f93bcc1e1bc370c4d23a825f226fdcf938007657` 上的 `pnpm verify` 于 `2026-08-13T07:44:35.816Z` 至 `07:58:33.209Z` 再次通过 17/17，退出码 `0`；迁移演练、OpenAPI 确定性/breaking、P0 E2E、构建和秘密扫描均包含在内。离线/失败恢复用例出现的本机代理 `ECONNREFUSED` 属预期测试输入，未形成失败步骤。

## P0、环境与边界

- M2 18 项主 P0 的既有技术证据保持 `CI_PASS`；EXT-007 仅补齐正式业务/合规输入，不把自动化证据升级为 staging、真机或生产证据。
- local：focused、工作树完整验证及实现提交 `f93bcc1` 的完整验证均为 `LOCAL_PASS`。
- PR 当前变更 CI：`NOT_EXECUTED`。
- staging：`NOT_EXECUTED`。
- 真机：`NOT_EXECUTED`。
- production：`NOT_EXECUTED`。

## 风险与回滚

- 主要风险是把 EXT-007 的通用术语误当成新开发字段，或把首期关闭类目误启用。通过开发文档优先映射、强监管默认拒绝和归一化政策契约控制。
- 原始授权文件不进入仓库；回执不含姓名、联系方式、证照、税号、银行资料、密码或绝对路径。
- 本切片没有数据库或外部系统状态变更。回滚只需经受审 PR `git revert` 本门禁证据提交，不改写公共历史。

## 继续条件

1. 提交本次提交级验证登记并推送 Draft PR #74，读取最新 Actions，确认 CI 对应当前精确 head 且成功。
2. 对当前精确 head 完成自审并由用户明确授权 Ready/合并。
3. 合并后 main CI 成功，才可把 M2-GATE 写成 PASS 并解锁 M3。

在以上条件全部满足前，`nextAllowedTask=M2-GATE`，M3 保持锁定。
