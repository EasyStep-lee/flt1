# M2-P063 跨渠道共用库存契约

## 目标与边界

- 每个已上架平台 `Sku` 只有一个 `InventoryBalance`，个人零售和企业集采后续均以同一 `skuId` 访问它。
- 当前供应商库存职能只能读取、调整本供应商 ACTIVE SKU，归属从验证会话和 SKU 关系派生。
- 本切片提供追加流水、盘点/报损/预警和内部 `reserve/release/confirmSale` 领域契约；不提供订单、支付、福利卡、超时释放或对客库存写 API。
- M2-P071、M3 及以后阶段保持锁定；不创建第二套渠道库存。

## 数据与不变量

- `inventory_balance.sku_id` 唯一；available/reserved/sold/damaged/safety stock 均非负，version 单调递增。
- 所有成功变更在同一事务追加 `InventoryChangeLog`，before + delta = after；数据库触发器拒绝修改或删除历史。
- `InventoryCommand(scope,idempotencyKey)` 唯一；同键同请求返回已提交响应快照，同键异请求返回幂等冲突。
- Prisma 仓储使用 serializable 事务和 `version` 条件更新；并发同版本命令只有一个成功。

## 权限、DTO 与缓存

- 页面：`PAGE-019 /supplier/workspaces/inventory`，固定 `SUPPLIER_INVENTORY` 职能会话。
- API：GET `/v1/supplier/inventory`、POST `/v1/supplier/inventory/{skuId}/adjustments`、GET `/v1/supplier/inventory/{skuId}/history`。
- 响应为显式 DTO 白名单，禁止 `supplierId/companyId/identityId/functionalAccountId`、供应价、销售价、毛利和结算字段。
- 接口返回 `private, no-store`；未知调整结果使用同一 Idempotency-Key 和同一请求恢复。

## 错误与恢复

- 非法职能/会话：`AUTHENTICATION_REQUIRED` 或 `FUNCTIONAL_ACCOUNT_FORBIDDEN`。
- 跨供应商或不存在 SKU：`INVENTORY_NOT_FOUND`，不泄露归属。
- 负库存：`INVENTORY_NEGATIVE`；过期版本：`INVENTORY_VERSION_CONFLICT`；同键异参：`IDEMPOTENCY_CONFLICT`。
- 应用回滚可 revert 当前切片提交；已应用数据库保留新增表和追加历史，以向前迁移修复，不回改已发布迁移。
