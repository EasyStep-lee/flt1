# M2-P071 独立价格与审批页面契约

## 目标与非目标

- 阶段：M2；P0：P0-071。
- 供应商价格职能固定路由 `/supplier/workspaces/pricing` 清楚分开初始三价、上架后供应价申请、个人零售/企业集采销售价直接调价。
- 公司价格审核职能固定路由 `/company-admin/workspaces/price-review` 清楚分开初始三价审核与上架后供应价变更审核。
- 复用 M2-P008/P019 已有 `SupplyPriceChangeRequest`、不可变历史、版本、幂等、二次验证和自然人隔离；无新迁移。
- 不实现批量审批、订单、支付、福利卡、库存、配送、对账或 M3。

## 状态与不变量

- 供应价申请：`SUBMITTED -> APPROVED -> EFFECTIVE`，或 `SUBMITTED -> REJECTED`；批准且到生效时间前旧供应价继续有效。
- 两类销售价不创建审批任务，按明确生效时间版本化并追加审计。
- 同一供应价申请仅允许一个有效决定；相同幂等键同载荷重放，异载荷冲突；并发版本决定仅一个成功。
- 申请人与审核人按自然人 `identityId` 隔离；公司价格审核不能代供应商发起调价。
- 不提供批量通过接口或页面按钮；单笔审核意见至少 2 字并要求二次验证。

## 权限、数据范围与白名单

| 路径 | 职能 | 数据范围 | 响应白名单 |
|---|---|---|---|
| `GET /v1/supplier/pricing/supply-price-changes` | `SUPPLIER_PRICING` | 会话派生本方 `supplierId` | 申请、SKU、旧/申请/当前供应价、时间、状态、原因、意见、版本；不返回主体或自然人标识 |
| `GET /v1/company/price-reviews/supply-price-changes/{taskId}/history` | `COMPANY_PRICE_REVIEW` | 会话派生 `companyId` 且任务归属该公司 | 事件、前后状态、版本、意见、发生时间；不返回申请人/审核人/职能账号标识 |

现有写接口继续使用：

- `POST /v1/supplier/pricing/skus/{skuId}/supply-price-change`
- `PATCH /v1/supplier/pricing/skus/{skuId}/sale-prices`
- `POST /v1/company/price-reviews/supply-price-changes/{taskId}/decision`

错误码：`AUTHENTICATION_REQUIRED`、`WORKSPACE_FORBIDDEN`、`APPROVAL_NOT_FOUND`、`APPROVAL_STATE_INVALID`、`SELF_APPROVAL_FORBIDDEN`、`VERSION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`SECOND_VERIFICATION_REQUIRED`、`VALIDATION_FAILED`。

## 页面状态与证据

- 两端覆盖 loading、empty、permission、error/offline、validation/conflict、unknown-result 和原幂等键重试。
- 行为测试必须证明页面分区、旧/新值与比例、生效时间、历史意见、无批量通过，以及接口递归不泄露归属和自然人字段。
- 回归：P0-008、P0-019、P0-046、P0-067、P0-070、P0-072。
