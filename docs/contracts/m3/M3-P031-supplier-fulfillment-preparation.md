# M3-P031 / P0-031 供应商备货契约

## 唯一目标与非目标

- 唯一目标：复用 M3-P022 已在公司主订单事务中按 `orderId + supplierId` 唯一生成的履约子单，使已支付个人单和已确认付款企业单可由当前 `SUPPLIER_FULFILLMENT` 职能确认、报缺、开始备货、标记待移交和移交。
- 对应方案：§0.3、§4.3 至 §4.5、§7.11 至 §7.12、§8.9、§10.2、§10.15、§13 与 P0-031。
- 非目标：`DeliveryTask`、跑腿大厅、`EnterpriseDeliveryOrder`、平台汇总收货/配送、用户或企业签收、售后、对账、线下结算和 M4/M5 页面。

## 字段与迁移

- `SupplierFulfillmentSubOrder` 继续映射既有 `supplier_fulfillment_order`，不复制第二套订单或子单表。
- 既有支付门禁独立保存为 `activationStatus=PENDING_PAYMENT|ACTIVE|CANCELLED`；仅 `ACTIVE` 子单可进入供应商列表和备货状态机。
- 冻结字段：`id`、`orderId`、可空 `enterpriseProcurementOrderId`、`supplierId`、`subOrderNo`、整数分 `goodsAmount`、整数分 `supplyAmount`、`channelType`、`preparationStatus`、`handoverStatus`、`settlementStatus`、`version`。
- `supplyAmount` 只由订单项供应价快照汇总，属于严格内部字段；`SUPPLIER_FULFILLMENT` DTO 永不返回它、订单销售金额、结算金额或公司毛利。
- 子单固化下单时已审核的供应商取货点快照；节点和异常只追加到 `SupplierFulfillmentNodeLog`，命令重放只读取原响应快照。
- `SupplierFulfillmentReadinessOutbox` 只发布 M4 可消费的稳定待处理事件；本切片不得创建配送实体。

## 状态机与节点

| 当前状态 | 节点 | 下一状态 | 规则 |
|---|---|---|---|
| `PENDING` | `ACCEPT` | `ACCEPTED` | 主订单已支付、支付门禁为 `ACTIVE`、owner 匹配 |
| `ACCEPTED` | `START_PREPARING` | `PREPARING` | 订单预留库存已由支付确认转为已售 |
| `PREPARING` | `MARK_READY` | `READY_FOR_HANDOVER` | 商品、数量和固化取货点完整；追加 readiness outbox |
| `READY_FOR_HANDOVER` | `HANDOVER` | `HANDED_OVER` | 个人只允许交给 `RUNNER`，企业只允许交给 `COMPANY_LOGISTICS`；追加交接凭证摘要 |

- `REPORT_SHORTAGE` 是追加异常节点，不覆盖订单项或库存，可在 `PENDING`、`ACCEPTED` 或 `PREPARING` 上报；必须指出本子单订单项、正整数缺货数量和原因，状态保持不变但版本递增。
- `COMPLETE` 由 M4 配送/签收系统驱动，M3-P031 不开放给供应商。
- 所有节点使用 `expectedVersion` 乐观锁与 `Idempotency-Key`；同键同请求返回原响应，同键异请求返回 `IDEMPOTENCY_CONFLICT`，旧版本返回 `VERSION_CONFLICT`，非法节点返回 `STATE_TRANSITION_INVALID`。

## 权限、DTO、API 与错误码

- PAGE-020 固定路由 `/supplier/workspaces/fulfillment`；只有当前单一职能会话 `SUPPLIER_FULFILLMENT` 可进入。
- `supplierId`、`functionalAccountId` 和自然人标识只从已验证会话派生。请求体/query 出现 owner 字段必须返回 `FIELD_FORBIDDEN`。
- API-052：`GET /v1/supplier/fulfillment-sub-orders`，仅返回本供应商 `ACTIVE` 子单的白名单分页数据、订单项数量快照、取货点摘要和节点时间线。
- API-053：`POST /v1/supplier/fulfillment-sub-orders/{subOrderId}/nodes`，要求 `Idempotency-Key`，原子校验 owner、支付门禁、版本、状态、节点参数并写节点/outbox。
- 稳定错误码：`AUTHENTICATION_REQUIRED`、`WORKSPACE_FORBIDDEN`、`SUPPLIER_SCOPE_FORBIDDEN`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`VERSION_CONFLICT`、`STATE_TRANSITION_INVALID`、`FULFILLMENT_HANDOVER_PARTY_INVALID`。
- 响应不返回 `supplierId`、`enterpriseCustomerId`、`consumerUserId`、完整地址/电话、支付方式、福利卡结构、`goodsAmount`、`supplyAmount`、供应价、结算状态、其他供应商商品或 M4 配送数据。

## P0 与负例映射

- P0-031：个人/企业主订单均复用按 `supplierId` 唯一拆分的子单；供应商只能操作本方。
- NEG-M3-P031-01：`MARK_READY` 只追加 readiness outbox，断言数据库不存在本切片新增的 `DeliveryTask`/`EnterpriseDeliveryOrder`。
- NEG-M3-P031-02：错误 owner 列表为空、节点写入返回 `SUPPLIER_SCOPE_FORBIDDEN`，且请求中的 owner 字段被拒绝。
- NEG-M3-P031-03：重复命令安全重放；并发/旧版本、非法状态和同键异载荷拒绝且不追加第二条节点。
