# M2-P011 三级分类树交接

## 结论与边界

- 结论：`LOCAL_PASS`；Draft PR、精确 head CI、人工合并、合并后 `main` CI、staging 和 production 均为 `NOT_EXECUTED`。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@d1c34e7a9d28199ad8e579342300a80c047e7bd3`；分支 `codex/m2-category-tree`；实现与本地验证提交 `0883c1c28b3445f9ed12c6178c23b88247fd3a58`；Issue [#47](https://github.com/EasyStep-lee/flt1/issues/47)。
- 唯一范围：`P0-011`，公司范围严格三级分类树、排序/移动/启停/删除保护、追加历史，以及供应商商品到公司物化全链路的启用末级分类复核。
- 明确未进入：`CategoryTemplate`/`P0-012`、正式生产分类数据、用户小程序分类搜索/`P0-087`、价格、库存、交易和配送。

## 前序 GitHub 门禁

- PR [#46](https://github.com/EasyStep-lee/flt1/pull/46) 的精确 head `08745d1d1f2ecb41acbfc4d21104c13daa570146` 与授权一致，Actions run [31358378754](https://github.com/EasyStep-lee/flt1/actions/runs/31358378754) 成功，无评论、review 或未解决线程。
- 已按人工授权转为 Ready 并合并为 `main@d1c34e7a9d28199ad8e579342300a80c047e7bd3`；合并后 main Actions run [31359557525](https://github.com/EasyStep-lee/flt1/actions/runs/31359557525) 成功，Issue #45 已关闭，因此 P011 起点有效。

## 实际变更

- 新增 `Category`、`CategoryHistory`、`CategoryCommand` Prisma 模型及 `20260810062000_m2_category_tree` 迁移；数据库触发器约束父级/层级、阻止有子节点或商品引用的分类删除，并拒绝更新/删除历史。
- 新增公司分类仓库、策略、服务、DTO、控制器和 Prisma/内存实现；`companyId`、操作者和固定职能都从验证会话派生，不接受客户端归属字段。
- 新增 `GET/POST /v1/company/categories` 与 `PATCH/DELETE /v1/company/categories/{categoryId}`；创建、修改、移动、启停和删除均记录追加历史，写操作使用幂等键和乐观版本。
- 供应商商品创建、分类修改、提交和公司双审物化均复用同公司启用末级分类校验；已成功命令即使分类后来停用仍能幂等重放，不重复产生副作用。
- 公司后台 PAGE-005 增加三级分类树，覆盖创建子分类、排序、启停、删除确认及 loading/empty/error/permission/offline/retry；仅 `COMPANY_PRODUCT_OPS` 可访问。
- OpenAPI 与统一类型已确定性生成；对客和页面 DTO 不含供应价、公司归属或职能账号字段。
- 总控工作簿已按 CSV 台账同步，并把总任务/完成任务/P0 证据、阶段统计与证据分布改为可追溯公式；重新打开后关键值为任务 149、完成 36、已验证 P0 20、M2 完成任务 7、M2 已验证 P0 6，公式错误扫描为 0，12 个工作表均完成渲染复核。

## 状态机、权限、错误码与数据范围

- 分类状态为 `ENABLED`/`DISABLED`；商品只能绑定同公司、启用、无子节点的第三级分类。
- 父级必须属于同一公司且恰好高一级；一级父级为空，三级不可新增子节点；移动不能制造循环。
- 删除有子节点、`SupplierProduct` 或 `Product` 引用的分类返回 `CATEGORY_REFERENCED`；版本落后返回冲突，幂等键复用不同请求返回 `IDEMPOTENCY_CONFLICT`。
- 分类管理权限固定为 `COMPANY_PRODUCT_OPS` 和 `/company-admin/workspaces/product-ops`；其他公司、其他职能及直达路由均不得越权。
- 主要错误码：`CATEGORY_NOT_FOUND`、`CATEGORY_DISABLED`、`CATEGORY_NOT_LEAF`、`CATEGORY_PARENT_INVALID`、`CATEGORY_LEVEL_INVALID`、`CATEGORY_DUPLICATE`、`CATEGORY_REFERENCED`、`VERSION_CONFLICT`、`IDEMPOTENCY_CONFLICT`。

## 先失败后通过的测试证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED API | 5/5 因分类运行时模块缺失失败 | 已确认 |
| 分类 API focused | 5/5 | PASS |
| 商品与双审核相关 API | 24/24 | PASS |
| 契约与迁移 focused | 3/3 | PASS |
| PAGE-005 P0 Playwright | 2/2 | PASS |
| OpenAPI 精确路径/schema 清单 | 4/4 | PASS |
| 第一次全量门禁 | 因新分类路径与 DTO 未加入精确 OpenAPI 清单失败 | FAIL，已修复根因 |
| 第二次全量门禁 | `pnpm verify` 17/17，提交 `0883c1c…` | PASS |
| 迁移演练 | empty=2、upgrade=2、restore=2、product=14、cleanup=PASS | PASS |

第二次全量报告为 `artifacts/test-results/verification/pnpm-verify.json`，开始 `2026-08-10T06:56:26.970Z`，结束 `2026-08-10T07:09:52.213Z`。切片证据为 `artifacts/verification/M2-P011/category-tree.json`。

## 环境、风险与回滚

- 本地证据环境：Windows、Node 22.23.1、Prisma/MySQL 8 迁移演练、Chromium；证据等级只为 `LOCAL_PASS`。
- 正式分类名称、层级和启停策略仍需授权商品运营在受控环境确认；自动化测试分类不等于正式业务分类。
- `CategoryTemplate` 未实现，不能宣称 P0-012、食品/生鲜/服饰/数码/礼盒模板或用户分类浏览完成。
- 回滚应用提交会移除分类 API/页面与商品分类复核；若迁移已进入共享环境，不回改已发布迁移，保留兼容 schema 并用后续向前修复迁移处理。

## GitHub 门禁与下一步

- 当前 Issue #47；Draft PR 尚未创建，P011 精确 head CI、评论、review、merge 与合并后 main CI 均为 `NOT_EXECUTED`。
- 下一动作仅为提交证据收尾、推送 `codex/m2-category-tree`、创建 Draft PR，并读取精确 head Actions 与未解决评论。
- 未经用户对届时精确 head 的明确授权，不得转 Ready 或合并；合并后 `main` CI 成功前不得开始 M2-P012。
