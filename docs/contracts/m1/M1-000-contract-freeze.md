# M1-000 字段、状态机、权限与接口契约冻结

## 结论

M1 的 14 项主 P0 已冻结为可编码契约，唯一机器真源为
`artifacts/verification/M1-000/m1-contract-freeze.json`。本任务只完成字段、状态机、权限、页面、DTO、错误码、迁移计划、负面测试和追踪关系冻结，未实现任何M1业务切片，未创建 Prisma 业务模型或迁移，未实现业务 API、登录、注册或后台页面。

V1.1 方案 SHA-256 仍为
`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。解释优先级保持为：V1.1 唯一口径 → 核心红线 → 状态机/数据约束 → P0 → UI 参考图。

## 冻结范围

- 14 个 M1 主 P0：`P0-001`、`P0-002`、`P0-003`、`P0-004`、`P0-005`、`P0-045`、`P0-046`、`P0-047`、`P0-066`、`P0-067`、`P0-068`、`P0-069`、`P0-070`、`P0-072`。
- 109 个 M1 字段，覆盖 Company、CompanyUser、FunctionalAccountType、FunctionalAccount、Permission、FunctionalAccountPermission、DataScopePolicy、FieldAccessPolicy、AuthSession、LoginAudit、Supplier、SupplierUser、ApprovalTask、AuditLog。
- 15 条 M1 状态迁移：Supplier 7 条、FunctionalAccount 4 条、ApprovalTask 4 条。
- 公司 10 类、供应商 8 类固定职能账号及其单职能会话边界。
- 公司/供应商 24 个入口或固定工作区页面壳；业务内容仍按页面台账的 M2—M5 阶段实现。
- 13 个既有 M1 API 契约及其 DTO 白名单、错误码、幂等和敏感字段策略。
- 3 个计划迁移 `MIG-002`—`MIG-004`；本任务不生成或应用迁移。
- 53 个可直接落成自动化用例的负面测试，当前均为 `NOT_EXECUTED`，由对应业务切片先红后绿。

## 不可变业务与安全边界

1. 江苏福礼团供应链科技有限公司是唯一对客交易、收款、开票、退款和售后主体；供应商不是店铺，不直接向客户收款。
2. 系统禁止加盟商注册、区域分账、加盟合同后台和第二个对客经营主体。
3. `companyId` 和 `supplierId` 均由服务端从已认证主体绑定；登录、路由参数和请求体不能改变数据归属。
4. 每个会话只能激活一个 `functionalAccountId`，其 `workspaceRoute` 必须来自账号类型白名单；切换职能必须重建会话上下文。
5. 默认拒绝。菜单隐藏不是授权，路由、API、对象范围和字段范围均须在服务端校验，且对象归属校验先于返回“存在/不存在”。
6. 供应价默认 `NEVER_RETURN`，只允许公司价格审核/财务与对应供应商价格/财务职能在审计下读取；对客 DTO、其他职能页面、日志、错误和普通导出不得包含供应价、供应价快照、供应商应付或毛利。
7. 双人复核以 `identityType + identityId` 区分自然人。同一自然人切换职能账号仍不得自审，超级管理员没有绕过权；并发复核必须恰好一个版本成功。
8. 审计记录追加写入，敏感快照先脱敏，客户端不得提供 `actorId`、`applicantId` 或 `reviewedBy`。

## 已消除的台账歧义

- 公司职能账号选择路由统一为 `/company-admin/account-select`。
- 供应商职能账号选择路由统一为 `/supplier/account-select`，归属 `P0-069`，不再错误归到公司登录 `P0-066`。
- 登录/注册入口采用 `PUBLIC_NOINDEX_NO_STORE`；账号选择页采用已认证自然人、尚未签发业务职能会话的私有上下文；固定工作区才使用 `REQUIRED_FIXED_FUNCTIONAL_SESSION`。
- 公司价格、财务、物流、门户内容页面补齐 `P0-067/P0-068` 页面壳追踪；供应商价格、财务页面补齐 `P0-070` 页面壳追踪。页面壳在 M1 隔离，具体业务内容仍由原阶段实现。
- 字段冻结层修正三个初始字典推断类型：`Supplier.pickupLat` 为 `Decimal(10,7)`、`Supplier.settlementAccountMasked` 为受掩码字符串、`LoginAudit.loginAccountHash` 为 64 位 SHA-256 十六进制字符串。

## 任务追踪

| 任务 | P0 | 冻结重点 | 当前实现状态 |
|---|---|---|---|
| M1-P001 | P0-001 | 唯一公司主体和对客卖方 | NOT_STARTED |
| M1-P002 | P0-002 | 无加盟商能力的禁止清单 | NOT_STARTED |
| M1-P003 | P0-003 | 供应商注册、补正、审核和状态机 | NOT_STARTED |
| M1-P004 | P0-004 | supplierId 服务端绑定和对象级隔离 | NOT_STARTED |
| M1-P005 | P0-005 | 供应商职能账号、邀请、固定页面和敏感变更 | NOT_STARTED |
| M1-P045 | P0-045 | 敏感操作追加审计和前后快照 | NOT_STARTED |
| M1-P046 | P0-046 | 数据域、字段域、供应价与导出隔离 | NOT_STARTED |
| M1-P047 | P0-047 | OpenAPI、DTO 白名单、错误码和小程序传输边界 | NOT_STARTED |
| M1-P066 | P0-066 | 公司独立登录、账号选择和单职能会话 | NOT_STARTED |
| M1-P067 | P0-067 | 公司 10 类固定工作区及越权阻断 | NOT_STARTED |
| M1-P068 | P0-068 | 公司工作区内部页面和六类 UI 状态 | NOT_STARTED |
| M1-P069 | P0-069 | 供应商注册、登录、账号选择和主体绑定 | NOT_STARTED |
| M1-P070 | P0-070 | 供应商 8 类固定工作区及越权阻断 | NOT_STARTED |
| M1-P072 | P0-072 | 自然人职责分离、并发复核和审计完整性 | NOT_STARTED |

每一行的字段、状态机、角色、页面、API、策略引用及至少 3 个负面测试 ID 均在机器契约 `slices` 中登记；没有 API 的禁止性 P0 使用明确策略契约和仓库扫描，不伪造业务端点。

## 人工事项

- `EXT-005`：营业执照、正式对客名称、客服和开票资料仍为 `NOT_PROVIDED`，阻塞 `M1-P001` 的正式验收。开发只能使用受控配置和测试数据，不能伪造法律资料。
- `EXT-006`：供应商准入资质清单及补正、停用、退出责任人仍为 `NOT_PROVIDED`。未确认前使用可配置规则，不能在代码中写死合规结论。

## 下一步门禁

本冻结进入 `main` 且对应精确 head CI 通过前，不开始 M1 业务任务。满足合并与主线验证后，下一唯一任务为 `M1-P001`；`M1-P002` 及其后任务继续保持 `NOT_STARTED`，不得并行越过 `nextAllowedTask`。
