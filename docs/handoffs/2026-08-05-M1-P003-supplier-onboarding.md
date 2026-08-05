# M1-P003 供应商入驻交接

## 结论

- 任务：`M1-P003`，P0：`P0-003`。
- 本地结论：`DONE / LOCAL_PASS`。
- 已验证实现 head：`b34c427304131e856148db132b5fbecdf4da2e0f`。
- 对比基线：`6f0adf8f69ceff30ff5834d6d5377cd2d2d9fd46`。
- 下一顺序任务：`M1-P004`，只处于 `READY`；本任务完成 Draft PR 精确 head CI、自审授权、合并和合并后 main CI 前不得启动。

## 本切片实现

- 公开注册只接收 DTO 白名单字段，拒绝客户端提交 `companyId`、`supplierId`、状态和申请/审核人；统一社会信用代码标准化后唯一。
- 注册可保存不完整 `DRAFT`，通过服务端绑定的供应商身份补资料并提交审核；公司 `COMPANY_SUPPLIER_OPS` 职能可筛选申请、要求补正或批准启用。
- 状态闭环为 `DRAFT → PENDING_REVIEW → CORRECTION_REQUIRED → PENDING_REVIEW → ACTIVE`；所有写操作带幂等键和乐观版本。
- 新增 `Supplier`、`ApprovalTask`、`SupplierStatusHistory`、`SupplierOnboardingCommand` 及向前迁移；状态历史和命令证据追加留痕。
- 确定性 OpenAPI 增加注册、本人补正、提交审核、公司列表和公司审核 5 个操作；Web 页面使用生成类型和 `openapi-fetch`。
- `/supplier/register` 与 `/company-admin/workspaces/supplier-ops` 采用蓝绿供应链＋暖红福利视觉，覆盖成功、空、加载、错误、无权和离线边界；页面及 DTO 不显示供应价。

## 先红后绿证据

- RED：领域/API/迁移/OpenAPI/P0 契约先因供应商入驻模块、迁移、路由和页面不存在而按预期失败；证据收口契约也先因 `supplier-onboarding.json` 不存在而失败。
- GREEN：领域策略 `3/3`，供应商 API `8/8`，M1 契约 `15/15`，迁移 `9/9`，OpenAPI `9/9`。
- P0：Chromium 双页面 `2/2`；基础门户 E2E `3/3`；CI 验证契约 `8/8`。
- Prisma：Schema 有效；发布迁移 `3/3`；本地 Docker MySQL 演练 `empty=2 / upgrade=2 / restore=2 / product=3 / cleanup=PASS`，最终漂移 `NONE`。
- 根门禁：`pnpm verify` `17/17 PASS`，机器报告绑定 `b34c427...`。

## 安全默认值与明确未实现

- 真实短信/手机号核验适配器未接入，生产默认安全返回 `503 SERVICE_UNAVAILABLE`；测试只能显式注入受信替身。
- M1-P069/M1-P070 前不接入生产供应商/公司职能会话解析器，私有接口默认安全返回 `401 AUTHENTICATION_REQUIRED`；不存在客户端可伪造身份头。
- `EXT-006` 供应商正式准入资质清单和责任人仍为 `NOT_PROVIDED`；当前只执行可配置最低完整性，不声称真实资质合规。
- 不实现供应商登录、职能账号邀请、商品、价格、库存、交易、支付、配送、对账或结算；供应商不是店铺或对客收款主体。

## 证据边界与风险

- 当前仅为 `LOCAL_PASS`；Draft PR、GitHub Actions 精确 head CI、自审授权、合并和合并后 main CI 均为 `NOT_EXECUTED`。
- 预发布、生产、生产迁移和正式验收未执行；本浏览器切片无真机要求。
- Vite 产物仍有大 chunk 警告，GitHub Actions Node.js 20 和 Dependabot 既有警告继续保留，不冒充本任务已修复。

## 回退与恢复

- 应用、契约和页面按原子提交反向回退；已发布 `20260805090000_supplier_onboarding` 不回改、不删除，数据库问题通过备份恢复或新的向前修复迁移处理。
- 恢复时读取根与提示词包 `AGENTS.md`、基线锁、项目状态、本交接和 `M1-P004` 任务行，并实时核验本任务 PR/CI；外部闭环前不得把 M1-P004 置为 `IN_PROGRESS`。
