# M2-P012 分类模板版本化契约

- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 阶段/任务：`M2 / M2-P012`
- P0：`P0-012`
- Issue：[#49](https://github.com/EasyStep-lee/flt1/issues/49)
- 基线：`main@49b59ea102b653bfb979877539b9fb8f1e8b5afc`
- 分支：`codex/m2-category-template`
- 当前证据：`NOT_EXECUTED`；本文件先冻结契约，再取得行为 RED

## 唯一目标与完成定义

末级分类可维护一个模板草稿并发布为当前唯一活动版本。模板定义动态字段、必填项、SKU 维度、资质规则、详情模块顺序和售后提示；发布新版本时旧活动版本原子退役，已发布/退役版本及历史快照不可原地覆盖。供应商商品在新建、修改分类或模板、提交资料审核和公司物化前，必须重新校验同公司启用末级分类以及当前已发布模板版本。

完成需要 Prisma 模型与向前迁移、模板仓储/策略/服务/API、公司商品运营页面、供应商商品写链路校验、确定性 OpenAPI、focused/API/P0 E2E、迁移演练和 `pnpm verify` 均取得新鲜证据。

## 非目标

- 不预置或声称完成食品、生鲜、服饰、数码、礼盒五类正式模板内容；这些分别属于 P0-013 至 P0-017。
- 不实现强监管品类开关 P0-018、正式生产模板导入或业务/合规确认。
- 不实现价格、库存、货架查询、购物车、订单、支付、配送或历史订单模板快照。
- 不允许供应商创建、编辑、发布或退役公司分类模板。

## 字段与结构

| 对象/字段 | 规则 |
| --- | --- |
| `CategoryTemplate.id` | 服务端 UUID；客户端不可指定 |
| `companyId` | 从公司职能会话派生，只持久化，不进入 DTO |
| `categoryId` | 同公司、启用、第三级且无子级；模板版本始终归属于该分类 |
| `version` | 每分类从 1 开始严格递增；创建草稿时服务端分配，不因编辑而变化 |
| `revision` | 草稿编辑和发布的乐观锁，从 0 开始，每次成功写入递增一次 |
| `status` | `DRAFT -> PUBLISHED -> RETIRED`；发布新版本原子退役旧活动版本 |
| `fieldSchema` | `{schemaVersion:'1.0', fields:[...]}`；字段键唯一，类型/必填/单位/枚举/校验/搜索/规格/详情模块引用均校验 |
| `skuDimensions` | `{dimensions:[...]}`；最多 3 个，维度键和字段引用唯一且必须引用模板字段 |
| `qualificationRules` | `{rules:[...]}`；资质键唯一，定义必填、有效期和允许的受控对象类型 |
| `detailModules` | `{modules:[...]}`；模块键唯一且稳定排序，字段引用的模块必须存在 |
| `afterSaleRules` | 公司统一售后口径的分类提示、退换规则代码和证据要求；不能改变公司统一售后主体 |
| 时间字段 | `createdAt/publishedAt/retiredAt` 由服务端生成；响应不返回操作者身份 |

模板 JSON 使用严格白名单和规范化结构；任何 `companyId`、`supplierId`、职能身份、供应价、结算价、毛利、脚本/事件属性或危险链接均拒绝。响应只返回模板公开管理字段，不直接序列化数据库实体。

## 状态、版本、幂等与历史

1. 每个分类最多一个 `DRAFT` 和一个 `PUBLISHED` 版本；多个 `RETIRED` 历史版本允许保留。
2. 创建草稿分配 `max(version)+1`；同一分类并发创建通过分类行锁/串行化确保不重复版本。
3. 仅 `DRAFT` 可编辑；发布/退役版本的 schema、分类和版本不可修改或物理删除。
4. 发布草稿时先锁定分类和所有相关版本，重新校验启用末级分类，退役旧活动版本，再发布新版本；任一步失败整笔回滚。
5. `Idempotency-Key + companyId + operation/object` 保存请求哈希与响应快照；同键同请求重放，同键异请求返回 `IDEMPOTENCY_CONFLICT`。
6. 每次创建、编辑、发布和旧版退役都追加 `CategoryTemplateHistory` 与 `AuditLog`；历史禁止更新/删除。
7. 模板升级不修改既有 `SupplierProduct`、`Product` 或订单快照；尚未提交/上架且使用旧版本的商品必须补录后再继续。

## 权限与数据范围

| 能力 | COMPANY_PRODUCT_OPS | 其他公司职能 | 供应商商品职能 |
| --- | --- | --- | --- |
| 查看本公司分类模板版本 | 允许 | 拒绝 | 仅消费当前已发布模板契约，不可管理 |
| 创建/编辑草稿、发布新版本 | 允许 | 拒绝 | 拒绝 |
| 查看 `companyId`、操作者和内部审计快照 | DTO 不返回 | 拒绝 | 拒绝 |
| 商品绑定模板 | 审核/物化时重新校验 | 价格职能不得修改 | 只能提交当前已发布版本 |

公司接口固定使用 `/company-admin/workspaces/product-ops` 单职能会话并返回 `Cache-Control: private, no-store`；供应商商品写链路继续从已验证会话派生 `supplierId`。

## API、DTO 与错误码

- `GET /v1/company/categories/{categoryId}/template-versions`：列出版本与当前活动版本。
- `POST /v1/company/categories/{categoryId}/template-versions`（API-018）：创建下一模板草稿；需要 `Idempotency-Key`。
- `PATCH /v1/company/category-template-versions/{templateId}`：仅编辑草稿；需要 `revision` 和 `Idempotency-Key`。
- `POST /v1/company/category-template-versions/{templateId}/publish`：发布草稿并原子退役旧版；需要 `revision` 和 `Idempotency-Key`。
- 主要错误码：`TEMPLATE_SCHEMA_INVALID`、`TEMPLATE_NOT_FOUND`、`TEMPLATE_DRAFT_EXISTS`、`TEMPLATE_IMMUTABLE`、`TEMPLATE_VERSION_INACTIVE`、`CATEGORY_NOT_FOUND`、`CATEGORY_DISABLED`、`CATEGORY_NOT_LEAF`、`VERSION_CONFLICT`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`WORKSPACE_FORBIDDEN`、`AUDIT_REQUIRED`。

## RED 与完成定义

- `NEG-M2-012-01 / INVALID_SCHEMA`：重复字段/模块键、非法枚举、断开的模块/字段引用或危险内容返回 `TEMPLATE_SCHEMA_INVALID`，无副作用。
- `NEG-M2-012-02 / NON_LEAF_OR_DISABLED`：非末级、停用或跨公司分类不能创建/发布模板。
- `NEG-M2-012-03 / IMMUTABLE_VERSION`：发布/退役版本不能编辑或删除；发布新版本后旧版内容和历史快照字节等价。
- `NEG-M2-012-04 / INACTIVE_ASSIGNMENT`：SupplierProduct 新建、改类/模板、提交和物化拒绝不存在、草稿、退役或非当前版本。
- `NEG-M2-012-05 / CONCURRENCY_AUDIT`：并发草稿/发布、旧 revision、幂等冲突或审计失败不得产生两个活动版本、版本重复或部分历史。
- 页面覆盖 loading、empty、permission、validation、conflict、offline、unknown-result 和 retry；DTO/前端 bundle 不含供应价。
- staging、真机、正式模板业务数据和 production 均保持 `NOT_EXECUTED`。
