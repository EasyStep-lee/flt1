# M1-P070 供应商职能账号独立页面契约

## 唯一目标

在 P069 已签发的单职能供应商会话上，交付八类固定工作台页面壳和服务端白名单目录，使每次会话只能加载当前 `accountTypeCode` 对应的一个 `workspaceRoute`、一个内部菜单及本职能模块目录。

## 方案与 P0

- 综合方案：§3.3、§3.6、§4.3 至 §4.5。
- P0：P0-070。
- 页面：PAGE-016 至 PAGE-023。
- 负例：NEG-M1-070-01 至 NEG-M1-070-04。

## 固定映射

| accountTypeCode | pageId | workspaceRoute | 页面 |
| --- | --- | --- | --- |
| `SUPPLIER_ACCOUNT_ADMIN` | `PAGE-016` | `/supplier/workspaces/account-admin` | 主体管理 |
| `SUPPLIER_PRODUCT` | `PAGE-017` | `/supplier/workspaces/products` | 商品管理 |
| `SUPPLIER_PRICING` | `PAGE-018` | `/supplier/workspaces/pricing` | 价格管理 |
| `SUPPLIER_INVENTORY` | `PAGE-019` | `/supplier/workspaces/inventory` | 库存管理 |
| `SUPPLIER_FULFILLMENT` | `PAGE-020` | `/supplier/workspaces/fulfillment` | 履约管理 |
| `SUPPLIER_AFTERSALES` | `PAGE-021` | `/supplier/workspaces/aftersales` | 售后协同 |
| `SUPPLIER_FINANCE` | `PAGE-022` | `/supplier/workspaces/finance` | 财务对账 |
| `SUPPLIER_AUDIT` | `PAGE-023` | `/supplier/workspaces/audit` | 审计记录 |

## API 与 DTO 白名单

- `GET /v1/supplier-auth/workspace/current`：仅返回当前职能的 code、name、pageId、固定 route 和一个内部菜单。
- `GET /v1/supplier-auth/workspace/page`：仅返回当前职能页面的筛选、模块目录、选中模块详情和交付时间线。
- `supplierId`、`functionalAccountId`、`identityId`、原始 Cookie/令牌、供应价、供应商应付、银行资料和其他职能模块键均不得进入响应。
- `supplierId`、`accountTypeCode`、`functionalAccountId` 或 `workspaceRoute` 客户端覆盖字段必须在返回目录前拒绝；route 必须精确等于会话固定 route。
- 响应必须为 `Cache-Control: private, no-store, max-age=0`。

## 页面状态

八个页面共享代码组件，但不共享会话上下文或菜单。每页覆盖 loading、empty、error、permission-denied、offline-or-timeout 和 success；页面只请求当前职能的白名单目录。后续阶段业务模块以 `DEFERRED` 明示，不生成虚假商品、价格、库存、订单、售后或账单记录。

## 非目标与禁止进入

- 不实现 M2 商品、价格、库存业务；不实现 M3 履约；不实现 M5 售后、财务和对账。
- 不实现 P0-071 价格与审批页面业务，也不实现 P0-072 审计业务闭环。
- 不新增数据库模型或迁移；现有账号类型、固定 route 与 P069 会话足够承载本切片。
- 不接真实身份源、真实二次验证、staging 或 production。

## 完成定义

先运行行为测试证明两个工作区 API 和七个尚缺页面真实失败；最小实现后，focused API/OpenAPI/Chromium、全量 `pnpm verify` 和执行包校验全部通过，并生成本地 P0-070 证据。只有精确 PR head CI 成功且人工授权合并、合并后 main CI 成功，P070 才能关闭 GitHub 门禁。
