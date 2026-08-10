# M2-P011 三级分类树与历史引用保护契约

- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 阶段/任务：`M2 / M2-P011`
- P0：`P0-011`
- Issue：[#47](https://github.com/EasyStep-lee/flt1/issues/47)
- 基线：`main@d1c34e7a9d28199ad8e579342300a80c047e7bd3`
- 分支：`codex/m2-category-tree`
- 当前证据：`NOT_EXECUTED`；本文件先冻结契约，再取得 RED

## 唯一目标与完成定义

实现公司商品运营职能管理的三级分类树：一级、二级、末级分类可创建、按 `sortWeight` 稳定排序、移动到同公司且相邻层级的父级、启用/停用并保留版本历史；无子级且从未被 `SupplierProduct`/`Product` 引用的分类才可物理删除。供应商商品在创建、修改分类、提交资料审核和双审后物化上架前，均须重新验证分类属于同一平台公司、状态为 `ENABLED` 且为第三级叶子节点。

完成需要数据库约束/迁移、API-016/API-017 及管理补充接口、公司商品运营页面、确定性 OpenAPI、四项冻结负例、focused 测试和 `pnpm verify` 均取得新鲜证据。

## 非目标

- 不实现 M2-P012 分类模板、模板版本、五类详情区块或强监管品开关。
- 不导入或伪造正式经营分类；生产分类数据仍需授权业务人员提供并审核。
- 不实现 P0-087 的用户端完整分类/搜索页面，也不进入库存、价格变更、购物车、订单、支付或配送。
- 不允许供应商自行创建、移动、启停或删除平台分类。

## 字段、归属与响应白名单

| 字段 | 规则 |
| --- | --- |
| `id` | 服务端 UUID；客户端不可指定 |
| `companyId` | 仅持久层保存，从已验证公司职能会话派生；响应不返回 |
| `parentId` | 一级必须为 `null`；二/三级必须指向同公司且恰低一级的父分类 |
| `name` | 去首尾空白后 1–100 字；同公司同父级唯一 |
| `level` | 只允许 `1|2|3`；禁止跳级、循环和将分类移到自身子树 |
| `sortWeight` | 安全整数；同级先按此字段、再按名称和 `id` 稳定排序 |
| `status` | `ENABLED|DISABLED`；创建默认启用 |
| `version` | 从 0 开始；更新、移动、启停时递增并做乐观锁 |

API/页面只返回上述公开字段和递归 `children`，永不返回 `companyId`、职能账号、自然人身份、数据库实体、供应价、结算价、毛利或审计内部快照。

## 状态、历史、并发与删除

1. `ENABLED --DISABLE--> DISABLED`、`DISABLED --ENABLE--> ENABLED`；重复目标状态返回原结果且不增加版本。
2. 名称、排序或父级变化生成新版本；每次创建/更新/移动/启停/删除均追加 `CategoryHistory`，历史禁止更新或删除。
3. `Idempotency-Key + companyId + operation` 记录请求哈希和响应快照；同键同请求重放原响应，同键异请求返回 `IDEMPOTENCY_CONFLICT`。
4. 更新/删除携带 `version`；旧版本或并发不同修改返回 `VERSION_CONFLICT`，不得部分写入分类、历史、命令或审计。
5. 有直接子级、被供应商商品引用或被平台商品历史/当前记录引用时，物理删除返回 `CATEGORY_REFERENCED`；停用仅阻止新的绑定、提交和上架，不覆盖既有商品快照。
6. 数据库约束/触发器与应用事务共同防止跨公司父级、跳级、循环、引用删除和历史篡改。

## 权限与数据范围

| 能力 | COMPANY_PRODUCT_OPS | 其他公司职能 | 供应商/公开端 |
| --- | --- | --- | --- |
| 查看公司分类树 | 允许 | 拒绝 | 拒绝管理接口 |
| 创建/排序/移动/启停/删除 | 允许 | 拒绝 | 拒绝 |
| 查看 `companyId`、操作者或审计快照 | 拒绝通过分类 DTO 返回 | 拒绝 | 拒绝 |
| 绑定商品分类 | 仅审核/上架链路重新校验 | 价格职能不得修改 | 供应商仅能提交已存在的启用末级分类 ID |

所有公司管理接口使用 `/company-admin/workspaces/product-ops` 的固定单职能会话，返回 `Cache-Control: private, no-store`。

## API、DTO 与错误码

- `GET /v1/company/categories`（API-016）：返回当前公司的递归树和总数，可按 `status` 过滤。
- `POST /v1/company/categories`（API-017）：创建分类；需要 `Idempotency-Key`。
- `PATCH /v1/company/categories/{categoryId}`：名称、排序、父级或状态的最小管理补充接口；需要 `Idempotency-Key` 和 `version`。
- `DELETE /v1/company/categories/{categoryId}?version=`：仅删除无子级且无商品引用的分类；需要 `Idempotency-Key`。
- 错误码：`CATEGORY_PARENT_INVALID`、`CATEGORY_LEVEL_INVALID`、`CATEGORY_NOT_LEAF`、`CATEGORY_DISABLED`、`CATEGORY_REFERENCED`、`CATEGORY_NOT_FOUND`、`CATEGORY_DUPLICATE`、`VERSION_CONFLICT`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`WORKSPACE_FORBIDDEN`、`AUDIT_REQUIRED`、`VALIDATION_FAILED`。

## RED 与完成定义

- `NEG-M2-011-01 / NON_LEAF_BINDING`：商品绑定一级/二级或仍有子级的分类，返回 `CATEGORY_NOT_LEAF`，不创建/提交/上架。
- `NEG-M2-011-02 / DISABLED_CATEGORY`：绑定或重新校验停用分类，返回 `CATEGORY_DISABLED`，无副作用。
- `NEG-M2-011-03 / REFERENCED_CATEGORY_DELETE`：删除有子级或被 `SupplierProduct`/`Product` 引用的分类，返回 `CATEGORY_REFERENCED`，分类和历史不变。
- `NEG-M2-011-04 / CATEGORY_CYCLE`：跨公司父级、跳级、父级为自身/后代或层级不一致，返回 `CATEGORY_PARENT_INVALID` 或 `CATEGORY_LEVEL_INVALID`。
- 还必须覆盖权限直达、同级重名、排序稳定性、旧版本、幂等重放/冲突、审计失败回滚、空树、加载/权限/离线/错误和重试状态。
- 微信真机、正式分类数据和生产迁移均保持 `NOT_EXECUTED`；这些缺口不能被本地 Mock 或构建结果升级。
