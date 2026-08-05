# M1-P004 供应商对象与数据范围隔离契约

## 目标与边界

本切片只实现 `P0-004` 的 M1 隔离底座：供应商私有请求的 `supplierId` 只能来自服务端固定职能会话，
本方资料通过 `GET /v1/supplier/me` 返回白名单 DTO；任何资源记录或导出行的 `supplierId` 与会话不一致
时，在生成响应或导出前拒绝。商品、订单、库存、对账和职能账号业务仍由后续切片实现，本切片不伪造这些
资源的 CRUD、页面或闭环。

## 服务端归属与资源范围

- 可信输入只有 `SupplierAccountAdminActor.supplierId`；请求头、查询、路径和请求体中的
  `supplierId`、`companyId`、`functionalAccountId` 不得覆盖它。
- `SUPPLIER_SCOPED_RESOURCES` 冻结为供应商主体、商品、订单、库存、对账单和账号六类资源族；后续仓储
  查询必须先按会话 supplierId 收窄，并在序列化前再次校验记录归属。
- `assertSupplierResourceScope` 对已存在的其他供应商记录和任意不存在标识返回相同的
  `403 SUPPLIER_SCOPE_FORBIDDEN`，避免对象存在性枚举。
- `assertSupplierExportScope` 在创建导出任务或文件前校验全部行；任一跨供应商行统一返回
  `403 DATA_SCOPE_FORBIDDEN`，不允许部分导出或先落盘再过滤。

## API 与 DTO 白名单

- `GET /v1/supplier/me`：仅 `SUPPLIER_ACCOUNT_ADMIN` 固定会话可用；无请求体、无 supplierId 查询参数；
  返回 `SupplierProfileResponseDto`。
- 响应只包含 `id`、`legalName`、脱敏信用代码、状态、资质摘要、版本、取货点和已脱敏结算账户；不返回
  `companyId`、`supplierId`、`functionalAccountId`、完整联系方式、完整资质快照、供应价或内部毛利。
- 私有 PATCH/submit 请求显式携带归属字段时返回 `SUPPLIER_SCOPE_FORBIDDEN`；正常请求继续只使用 actor 绑定值。
- 生产职能会话解析器仍由 M1-P069/M1-P070 接入；当前默认解析器继续安全返回
  `401 AUTHENTICATION_REQUIRED`，测试身份只能通过依赖注入提供。

## 负面测试与证据边界

- `NEG-M1-004-01 OBJECT_SCOPE`：六类资源族的 A→B 访问统一拒绝。
- `NEG-M1-004-02 SERVER_BOUND_SUPPLIER`：GET/写入中的客户端归属值不能改变会话 A 的归属。
- `NEG-M1-004-03 CROSS_SUPPLIER_EXPORT`：混入 B 行时在导出创建前整体拒绝。
- `NEG-M1-004-04 NOT_FOUND_ORACLE`：B 的已存在对象和随机不存在标识得到相同安全错误。

本切片没有新增持久化实体、字段或状态机，因此不发布 Prisma 迁移；迁移演练必须证明现有三条发布迁移无漂移。
商品、订单、库存、对账和账号真实接口尚不存在，当前证据只证明统一策略、现有供应商私有接口和生成契约；
后续资源切片仍须逐接口复用该策略并补充对象级越权回归，不能把本地策略测试解释为这些业务已实现。
