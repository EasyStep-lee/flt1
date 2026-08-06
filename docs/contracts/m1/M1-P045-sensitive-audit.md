# M1-P045 敏感操作审计实现合同

## 范围

- 新增追加式 `AuditLog`，字段固定为操作人类型/自然人标识、动作、对象、脱敏前后快照、请求号、IP 与发生时间。
- 当前可执行敏感入口仅接入 `functional_account.invited`：供应商职能账号与审计事件在同一事务内成功或回滚。
- 冻结后续动作码 `refund.approved`、`product.force_unpublished`、`supplier.bank_account.changed`、`supplier.payment.marked`；本切片不实现退款、商品、银行账户或付款业务。
- 新增 API-015 `GET /v1/audit/events` 与 PAGE-012 `/company-admin/workspaces/audit`，只允许 `COMPANY_AUDIT` 固定工作区只读访问。

## 安全与失败合同

- `NEG-M1-045-01`：审计追加失败返回 `AUDIT_REQUIRED`，敏感业务写入不得留存。
- `NEG-M1-045-02`：数据库触发器阻止 `audit_log` 更新与删除，错误标识 `AUDIT_IMMUTABLE`。
- `NEG-M1-045-03`：客户端 `actorId` / `applicantId` 返回 `ACTOR_SPOOFED`；操作人只取认证会话。
- `NEG-M1-045-04`：审计写入必须绑定服务端 UUID 请求号，否则 `REQUEST_ID_REQUIRED`。
- 快照持久化和读取时均脱敏；API 响应不返回 IP、联系方式、银行明文、秘密、供应价、内部毛利或供应商应付。

## 证据边界

- 自动化：策略单测、Supertest、OpenAPI/DTO 合同、迁移合同、真实 MySQL 更新/删除拒绝、PAGE-012 Chromium、完整 `pnpm verify`。
- 生产认证会话仍为默认拒绝；生产迁移、预发布、正式验收与后续四类业务动作执行均不在本切片内。
- 本任务的 Draft PR 精确 head CI、审查、合并及合并后 main CI 完成前，`M1-P046` 保持禁止进入。
