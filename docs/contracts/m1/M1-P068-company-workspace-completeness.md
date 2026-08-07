# M1-P068 公司独立页面完整性契约

## 任务边界

- 阶段：M1。
- 唯一目标：完成 P0-068，令 PAGE-003 至 PAGE-012 的十个公司职能页面都具备职能工作台、内部模块列表、筛选、详情、交付时间线和完整页面状态。
- 方案：§3.4 至 §3.7、§14.1、P0-068。
- 前置：M1-P067 已合并为 `main@aa7b9a7a7f8a8b763c1e17c5f471996cc0af9a2e`，合并后 CI run 31139537997 成功。
- Issue：<https://github.com/EasyStep-lee/flt1/issues/25>。

## 明确不做

- 不实现 M2 至 M5 的商品、价格、订单、福利卡、配送、财务结算或 CMS 业务数据和动作。
- 不创建虚假待办、交易金额、供应价、审批、订单或配送记录。
- 不实现 P0-069 供应商登录与职能选择，不进入 M1-P069。
- 不新增数据库实体或迁移；本切片的模块目录是服务端冻结的页面能力策略，不是业务记录。

## API-083 与 DTO 白名单

`GET /v1/company-auth/workspace/page` 只接受以下查询字段：

| 字段 | 来源与约束 |
|---|---|
| `route` | 当前浏览器路由，必须等于服务端会话中的固定 `workspaceRoute`，长度不超过 255 |
| `keyword` | 可选，trim 后不超过 64，只筛选当前职能模块目录 |
| `availability` | 可选，`ALL`、`AVAILABLE` 或 `DEFERRED` |
| `moduleKey` | 可选，当前职能模块键；用于读取详情和交付时间线 |

`companyId`、`functionalAccountId`、`identityId`、`accountTypeCode`、`pageId`、`workspaceRoute` 等上下文字段不得由客户端覆盖。服务端先解析 Secure/HttpOnly 单职能 Cookie，再校验账号状态、会话、职能类型和固定路由。

成功 DTO 只返回：当前职能 code/name、PAGE 编号、固定路由、目录汇总、已应用筛选、当前职能模块列表和可选的当前职能模块详情。模块详情只含模块键、名称、说明、交付阶段、可用状态、数据边界、内部区块名称和不带伪造时间戳的交付时间线。

响应禁止包含数据库实体、主体/自然人/职能账号 ID、会话令牌、供应价、供应商应付、内部毛利、银行账号或业务秘密。

错误码：

- `AUTHENTICATION_REQUIRED`
- `AUTH_SESSION_REVOKED`
- `WORKSPACE_FORBIDDEN`
- `DATA_SCOPE_FORBIDDEN`
- `WORKSPACE_MODULE_NOT_FOUND`
- `VALIDATION_FAILED`

所有响应设置 `Cache-Control: private, no-store, max-age=0`。

## 页面状态机

```text
IDLE -> LOADING -> SUCCESS
                  -> EMPTY（筛选结果为空）
        LOADING -> PERMISSION_DENIED（401/403）
        LOADING -> ERROR（其他服务端失败）
        LOADING -> OFFLINE_OR_TIMEOUT（网络异常）
PERMISSION_DENIED | ERROR | OFFLINE_OR_TIMEOUT -> LOADING（重试）
SUCCESS -> LOADING（筛选、刷新或打开详情）
```

切换路由时必须清空关键词、筛选、列表和已选详情，随后使用新路由重新请求 API-082 与 API-083；不得短暂渲染上一职能的数据。

## 权限和共用组件边界

- 十个页面共用同一个展示组件，但每个组件实例只使用 API-082 返回的当前职能上下文。
- API-083 的目录来源只能是服务端根据当前会话解析出的 `accountTypeCode`；不能按客户端参数选择目录。
- 筛选、空态、详情抽屉和时间线只作用于当前职能目录。
- 价格审核和财务页面在 M1 仍只展示页面模块边界，不返回任何供应价或财务业务数据。
- 供应商运营和审计页面保留已完成的真实 M1 业务内容，并在同一固定职能页面增加本切片模块工作台；不降低 P0-003/P0-045 既有能力。

## 固定负例与完成定义

- `NEG-M1-068-01 MISSING_UI_STATE`：loading、empty、error、permission-denied、offline-or-timeout 任一状态缺失即失败。
- `NEG-M1-068-02 SHARED_CONTEXT`：跨职能目录、筛选结果、已选详情、菜单或路由上下文泄漏即失败。
- `NEG-M1-068-03 ERROR_SECRET_LEAK`：成功或错误响应出现内部 ID、令牌、供应价、供应商应付或毛利字段即失败。

完成需要 API 行为测试、OpenAPI 白名单测试、十页面 P0 E2E、受影响 P003/P045/P067 回归、`pnpm verify` 和不适用迁移说明全部有新鲜证据。人工合并和合并后 main CI 前任务保持 `IN_PROGRESS`。
