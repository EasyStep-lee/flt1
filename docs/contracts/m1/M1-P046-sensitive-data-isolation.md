# M1-P046 敏感数据隔离实现合同

## 范围

- 实现 MIG-003 的 `Permission`、`FunctionalAccountPermission`、`DataScopePolicy`、`FieldAccessPolicy`，字段访问默认 `HIDDEN`。
- 供应价只允许公司价格审核/财务职能，或绑定同一 `supplierId` 的供应商价格/财务职能读取；供应商结算只允许公司财务或本供应商财务读取。
- 跑腿员地址规则仅授权服务端绑定的本人、个人订单、活动履约阶段，并只返回必要的脱敏地址；企业统一配送不进入跑腿大厅。
- P046 不新增业务 API 或页面。现有公司审计 API/PAGE-012 作为非授权职能回归入口，必须省略供应价、供应商应付与毛利字段，并拒绝字段扩展和直接导出参数。

## 安全与失败合同

- `NEG-M1-046-01` / `FIELD_SCOPE`：没有显式字段授权时返回 `FIELD_FORBIDDEN`，数据库字段策略默认 `HIDDEN`。
- `NEG-M1-046-02` / `CROSS_ROLE`：职能账号与固定 `workspaceRoute` 不匹配时返回 `WORKSPACE_FORBIDDEN`；供应商 scope 不能指向其他 `supplierId`。
- `NEG-M1-046-03` / `PUBLIC_DTO`：公开或非授权 DTO 递归省略 `supplyPrice`、`approvedSupplyPrice`、`supplyPriceSnapshot`、供应商应付及毛利字段。
- `NEG-M1-046-04` / `EXPORT_APPROVAL`：高敏导出没有已批准记录和服务端 UUID 凭据时返回 `EXPORT_APPROVAL_REQUIRED`，不得生成下载响应。

## 证据与后续边界

- 自动化证据包括策略单测、Supertest、迁移合同、真实 MySQL 临时库演练、PAGE-012 Chromium 回归和完整 `pnpm verify`。
- M4 的真实个人配送订单、跑腿认领与地址 DTO 尚未实现；本切片只交付可复用的 fail-closed 策略，后续 M4 接入时必须再次进行对象级和真机验收。
- M2 商品/供应价、M5 结算业务、预发布、生产迁移和正式验收不在本切片内。
- Draft PR 的精确 head CI、审查、人工合并和合并后 main CI 完成前，不得进入 `M1-P047`。
