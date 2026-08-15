# 2026-08-15 M3-P028 企业注册认证交接

阶段结论：`IN_PROGRESS / CI_PASS`。M3-P027 已由 PR #90 按精确 head `e17e25f58c8bda46e80dfc6175a2f60b4a3a9fbb` 合并到 `main@0691ae492771df9fa39422460501a41ad174c605`，合并后 Actions run `31867042679` / job `94969678834` 成功。本切片的失败测试、focused 行为测试、迁移演练和本地 `pnpm verify` 17/17 已通过；Draft PR #92 的 head `542b50e565133ea2afcfc463b27fd15b0edbfc5f` 已由 Actions run `31872929851` / job `94984210698` 验证成功。证据追加 head、人工合并及 post-merge main CI 尚未完成，因此 M3-P029 保持锁定。

## 基线、范围与 Git

- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`；产品基线与执行包自检通过。
- 当前阶段/任务：M3 / M3-P028；主验收 P0-028，PAGE-031 只提供 P0-077 的初始页面证据，P0-077 仍为 `NOT_EXECUTED`。
- 分支：`codex/m3-enterprise-registration`；基线：`main@0691ae492771df9fa39422460501a41ad174c605`；本地与 CI 已验证 head：`542b50e565133ea2afcfc463b27fd15b0edbfc5f`。
- GitHub：仓库 `EasyStep-lee/flt1`；Issue #91；Draft PR #92；代码/证据 head CI 为 `CI_PASS`（run `31872929851` / job `94984210698`）；评论、人工合并和 post-merge main CI 尚未执行。
- 用户既有未跟踪文件、`outputs/` 和 `.codex-*` 临时证据均保留且不会暂存。

## 完成范围

- 新增 `EnterpriseCustomer`、`EnterpriseUser`、`EnterpriseAddress`、`EnterpriseInvoiceProfile`、`EnterpriseCertificationSnapshot`、`EnterpriseCustomerStatusHistory`、`EnterpriseProcurementProfile` 和 `EnterpriseOnboardingCommand`，并以 MIG-011 添加唯一键、外键、版本检查与不可变触发器。
- 状态链实现 `DRAFT -> PENDING_REVIEW -> CORRECTION_REQUIRED -> PENDING_REVIEW -> ACTIVE -> SUSPENDED`；非法转换、并发旧版本和异体幂等键均无部分写入。
- 创建、读取/修改草稿、提交审核、公司队列、补正/批准/拒绝和暂停 API 已由 NestJS 真实入口提供；OpenAPI 和生成类型已确定性更新。
- 注册访问使用短期签名凭据；服务端不持久化明文。默认手机号验证器失败关闭并返回 503，避免在缺真实外部服务时创建企业。
- 公司审核只允许固定 `COMPANY_SUPPLIER_OPS` 职能；自然人 `identityId` 隔离阻止提交者切换账号自审。
- 对客 DTO 脱敏手机号、信用代码、税号和银行账号，且明确 `NEVER_RETURN_SUPPLY_PRICE`；不返回公司归属、身份、验证码或内部快照。
- PAGE-031 `/enterprise/register` 支持主体、证照对象引用、联系人、开票、收货和首次提交；使用生成契约与 `openapi-fetch`，页面动态渲染、`noindex`、`private/no-store`，注册凭据仅放在 `sessionStorage`。
- 公司供应商运营独立工作区新增企业认证审核面板；CSV/JSON 台账、字段、状态机、权限、页面、OpenAPI 和迁移登记均已同步。

## 明确非目标

- 不完成 P0-077 的完整预览、持久化进度、字段级补正和暂停影响体验；这些留给 M3-P077。
- 不实现企业正式登录、采购货架完善、采购车、下单、付款、企业配送或 OA/预算/多级审批。
- 不连接真实短信、对象存储、银行或发票服务；不执行 EXT-013 法务/财务确认。
- 不进入 M3-P029、M4、M5、M6，不执行 staging、真机或生产部署。

## 数据、权限、OpenAPI 与错误码

- MIG-011：`20260815020000_m3_enterprise_identity_profile`；空库、升级、恢复和产品 schema 演练均通过，结果为 `empty=2; upgrade=2; restore=2; product=29; cleanup=PASS`。
- API-044：公开创建企业注册草稿；API-046：公司供应商运营审核。实际还包含本企业草稿维护/提交、公司列表和暂停路由。
- 所有归属从签名注册凭据或固定公司会话派生，拒绝客户端 `companyId`、`enterpriseCustomerId`、`status`、`reviewedBy`。
- 稳定错误码包括 `AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`CREDIT_CODE_DUPLICATE`、`ENTERPRISE_NOT_FOUND`、`STATE_TRANSITION_INVALID`、`APPROVAL_VERSION_CONFLICT`、`SELF_APPROVAL_FORBIDDEN` 和 `SERVICE_UNAVAILABLE`。

## 先失败后通过与验证证据

| 证据 | 结果 |
|---|---|
| RED：企业注册 Supertest | 按预期失败：要求默认验证器安全返回 503，实际路由尚不存在并返回 404 |
| 领域策略单测 | 2/2 PASS |
| 企业注册 Supertest | 7/7 PASS |
| MIG-011 迁移契约 | 1/1 PASS |
| 公司后台构建契约 | 3/3 PASS |
| 门户缓存/索引边界 | 1/1 PASS |
| P0-028 focused Playwright | 1/1 PASS |
| 迁移 dry-run | PASS：空库/升级/恢复/产品 schema/清理全部成功 |
| 产品基线与执行包自检 | PASS；方案 SHA-256 与锁定值一致 |
| 最终 `pnpm verify` | 退出码 0；17/17 PASS；开始 `2026-08-15T07:33:42Z`，结束 `2026-08-15T07:48:04Z` |
| 聚合报告 | `artifacts/test-results/verification/pnpm-verify.json`，提交 `542b50e565133ea2afcfc463b27fd15b0edbfc5f` |
| Draft PR head CI | `542b50e`；Actions run `31872929851` / job `94984210698`；SUCCESS |

历史失败证据如实保留：OpenAPI 冻结列表遗漏新路由；历史门禁契约仍指向 P027/PR #88；秘密扫描将依赖注入 Symbol 名称误判为凭据赋值。均已在不删除测试、不降低业务断言的前提下修复，最终完整门禁通过。

## P0 与环境边界

- P0-028 自动化技术行为：`LOCAL_PASS`；默认失败关闭、归属隔离、信用代码唯一、幂等、补正/复审/激活、同自然人自审拒绝、并发审核、历史追加和敏感字段脱敏均有新鲜证据。
- P0-077：`NOT_EXECUTED`；本切片只有首次注册、响应式和缓存/索引边界的部分证据，不升级为整项完成。
- LOCAL：`LOCAL_PASS`；PR head CI：`CI_PASS`；STAGING/DEVICE/PRODUCTION：`NOT_EXECUTED`。
- 实际环境：Windows、Node 22.23.1、pnpm 10.12.1、Prisma 6.19.2、MySQL 8 Docker、Next.js 16.2.12、Playwright Chromium。
- EXT-013 企业合同/协议、对公转账和开票法务财务口径，以及真实短信/对象存储账号均为 `BLOCKED_EXTERNAL`；本地替身不能冒充外部验收。
- Spreadsheet skill 要求的 artifact-operation marker 在当前 runtime 不可用，因此只同步 CSV/JSON 源台账，工作簿字节未修改，保持 `NOT_EXECUTED_TOOL_MARKER_UNAVAILABLE`。

## 风险与回滚

- 风险：默认外部验证器故意失败关闭；未配置真实适配器时企业无法在真实环境完成手机号验证，这是安全边界而非线上可用证据。
- 风险：证照只保存受控对象引用；真实对象存储权限、保留期和合规流程仍需 staging/人工验证。
- 未发布回滚：回退 M3-P028 应用、迁移、生成契约、测试、文档和台账提交。
- 已应用迁移后的回滚：使用向前修复迁移，保留认证快照、状态历史和审计证据；禁止编辑已发布迁移 SQL 或直接删除历史。

## 下一步门禁

下一动作仅限验证 M3-P028 Draft PR 的证据追加 head、读取未解决评论并修复当前切片。PR 最新 head CI 成功后，仍须用户按精确 head 授权转 Ready/合并；合并后 `main` 最新 CI 成功前不得开始 M3-P029。当前明确禁止 M3-P029、M4、M5、M6、真实外部服务启用和任何生产发布。
