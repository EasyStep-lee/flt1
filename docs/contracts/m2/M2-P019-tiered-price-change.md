# M2-P019 上架商品分级调价契约

## 唯一目标与完成定义

- 当前阶段：M2；任务：M2-P019；P0：P0-019、P0-071 相关价格页面部分。
- 供应商 `SUPPLIER_PRICING` 只能对当前会话 `supplierId` 的已上架 SKU 操作。
- 供应价变更创建不可覆盖的 `SupplyPriceChangeRequest`；公司 `COMPANY_PRICE_REVIEW` 只能通过或驳回，审核前 `Sku.approvedSupplyPrice` 保持原值。
- 个人零售价与企业集采价不创建审批任务；保存后形成版本和日志，并按明确 UTC 生效时间立即或定时生效。
- 三类价格均使用非负安全整数分；历史订单/快照不回改；供应价只进入公司价格审核及本供应商价格职能 DTO。

## 非目标

- 不实现活动价、库存、订单、支付、配送、对账、批量导入或 P020 及以后任务。
- 不允许公司代供应商提交或编辑三类新价格；异常幅度只记录风险提示，不转化为销售价审批。

## 字段与状态

- `SupplyPriceChangeRequest`：`companyId/supplierId/skuId` 均由服务端资源与会话派生；冻结原供应价、申请供应价、原因、申请生效时间、申请人自然人、申请职能、审核人自然人、审核意见、版本与时间。
- 状态：`SUBMITTED -> APPROVED -> EFFECTIVE`，或 `SUBMITTED -> REJECTED`；同一 SKU 同时最多一个 `SUBMITTED/APPROVED` 供应价请求。
- `PriceChangeLog`：按价格类型追加原价、新价、生效时间、操作者、原因、审核状态与风险提示；禁止更新和删除。
- `PriceEffectOutbox`：定时生效使用稳定业务键；处理成功后原子更新对应 SKU 价格及版本，重复投递只返回既有结果。

## 权限、接口与白名单

- API-023 `POST /v1/supplier/pricing/skus/{skuId}/supply-price-change`：本供应商价格职能、二次验证、幂等键；返回本申请及当前供应价，不接受任何归属字段。
- API-024 `PATCH /v1/supplier/pricing/skus/{skuId}/sale-prices`：本供应商价格职能、二次验证、幂等键；至少变更一种销售价，不创建审批任务。
- `GET /v1/supplier/pricing/skus`：仅本供应商三价、版本、待审申请、定时项和历史摘要。
- `GET /v1/company/price-reviews/supply-price-changes` 与 API-026 决定接口：仅公司价格审核职能；返回原值、新值、比例、原因、生效时间、提交人/审核人摘要和历史意见。
- 公开、个人、企业采购、跑腿、普通日志与非价格职能 DTO 不得含 `approvedSupplyPrice`、申请供应价、供应价快照或毛利。

## 错误码与失败不变量

- `SUPPLY_PRICE_REVIEW_REQUIRED`、`PRICE_CHANGE_PENDING`、`PRICE_INVALID`、`VERSION_CONFLICT`、`SELF_APPROVAL_FORBIDDEN`、`SECOND_VERIFICATION_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`AUDIT_REQUIRED`、`PRICE_EFFECT_SCHEDULE_FAILED`。
- 越权查找统一返回 `SUPPLIER_SCOPE_FORBIDDEN`；重复/并发决定只有一个成功；审计或事务失败不得改变当前价格、版本或历史。
- NEG-M2-019-01：未审批供应价不得生效；NEG-M2-019-02：销售价变更不得创建审批；NEG-M2-019-03：历史不得覆盖；NEG-M2-019-04：并发不能产生多个生效结果。
