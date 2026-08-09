# M2-P007 公司双页面审核上架契约

- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 基线：`main@ae7abc827f1759cd2dc00201ce23fab4710fe6ce`
- Issue：[#39](https://github.com/EasyStep-lee/flt1/issues/39)
- 分支：`codex/m2-product-approval`
- P0：`P0-007`
- 当前证据：`NOT_EXECUTED`；先建立契约，再取得 RED

## 唯一目标与非目标

公司商品运营职能只在 `/company-admin/workspaces/product-ops` 审核商品资料，公司价格审核职能只在 `/company-admin/workspaces/price-review` 审核三类初始价格。两个审批任务、页面、会话角色、DTO 和历史记录独立；两项均通过后，系统才可幂等创建一组公司 `Product/Sku`。

本切片不实现供应商价格页面/API、上架后供应价变更、销售价免审调价、分类模板、库存、公开货架、购物车、订单、支付、配送或 M3 以后能力。

## 字段与快照

- 资料审核白名单：审批任务编号、供应商编号、商品编号、名称、品牌、分类、模板版本、图文/属性、资质引用数量、渠道标识、备货时长、SKU 编号/编码/属性、状态、版本和时间；永不返回三类价格。
- 初始价格审核白名单：审批任务编号、供应商编号、商品编号/名称、SKU 编号/编码、供应价、个人零售价、企业集采价、状态、版本和时间；只允许 `COMPANY_PRICE_REVIEW`。
- 决定请求：`decision=APPROVE|REJECT`、非空 `opinion`、`version`；归属、审核人、职能账号、公司和供应商均从会话/任务派生。
- 资料提交时冻结服务器生成的发布引用与材料快照；价格提交冻结每个 SKU 的整数分申请值。审批和发布不得信任客户端提供的公司、供应商、审核人、Product/Sku 或价格快照。
- 审批决定、状态历史、审计日志和幂等响应只追加；不得覆盖旧历史。

## 状态机与并发

1. `PENDING_MATERIAL_REVIEW --APPROVE_MATERIAL--> MATERIAL_APPROVED`；驳回进入 `CORRECTION_REQUIRED`。
2. 初始价格任务 `PENDING --APPROVE|REJECT--> APPROVED|REJECTED`，商品资料状态不由价格职能直接改写。
3. 仅资料通过或仅价格通过时返回 `publicationStatus=WAITING_OTHER_APPROVAL`，且 `Product/Sku` 数量保持 0。
4. 两项均通过后，系统以 `supplierProductId+materialVersion+priceVersion` 幂等物化；唯一映射和事务保证并发只能形成一组 `Product/Sku`。
5. 同一审批的重放使用同一幂等键返回原响应；键复用但请求不同返回 `IDEMPOTENCY_CONFLICT`；旧版本或并发不同决定返回 `APPROVAL_VERSION_CONFLICT`。
6. 审核人与申请人的自然人身份冲突返回 `SELF_APPROVAL_FORBIDDEN`，不改变任务、商品或审计历史。

## 权限与数据范围

| 能力 | COMPANY_PRODUCT_OPS | COMPANY_PRICE_REVIEW | 其他公司职能/供应商 |
| --- | --- | --- | --- |
| 资料队列/详情/决定 | 允许；不含价格 | 拒绝 | 拒绝 |
| 初始价格队列/详情/决定 | 拒绝且不返回任务存在性 | 允许；可见三类价格 | 拒绝 |
| 直接创建/修改 Product/Sku | 拒绝 | 拒绝 | 拒绝 |
| 绕过双审上架 | 拒绝 | 拒绝 | 拒绝 |

## OpenAPI、DTO 与错误码

- `GET /v1/company/product-material-reviews`：资料职能私有队列，`private, no-store`。
- `POST /v1/company/product-material-reviews/{taskId}/decision`：冻结契约 `API-025`。
- `GET /v1/company/price-reviews`：价格职能私有队列，含三类初始价格白名单。
- `POST /v1/company/price-reviews/{taskId}/decision`：冻结契约 `API-026`。
- 错误码：`WORKSPACE_FORBIDDEN`、`APPROVAL_NOT_FOUND`、`APPROVAL_VERSION_CONFLICT`、`APPROVAL_STATE_INVALID`、`SELF_APPROVAL_FORBIDDEN`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`PRODUCT_APPROVAL_INCOMPLETE`、`AUDIT_REQUIRED`。
- 所有响应使用专用 DTO；资料 API、页面、日志、缓存和错误响应不得含 `requestedSupplyPrice`、`approvedSupplyPrice`、`supplyPrice` 或内部毛利。

## RED 与完成定义

- `NEG-M2-007-01`：只通过一项时不可售；两项通过后只生成一组公司资源。
- `NEG-M2-007-02`：两个职能交叉调用时均返回 `WORKSPACE_FORBIDDEN` 且无副作用。
- `NEG-M2-007-03`：重复/并发决定只生效一次，冲突可恢复。
- 同人自审、审计写入失败、供应价向资料端泄露也必须失败。
- focused API、页面 P0 E2E、迁移、OpenAPI、`pnpm verify` 和精确 head CI 均通过后，本切片才可从本地 `NOT_EXECUTED` 升级；人工合并且合并后 `main` CI 成功前不得进入 M2-P008。
