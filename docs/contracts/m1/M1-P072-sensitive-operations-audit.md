# M1-P072 后台敏感操作与审计契约

## 任务卡

- 阶段/任务/P0：`M1` / `M1-P072` / `P0-072`。
- 方案章节：第 3 章职能权限与自然人职责分离、第 4 章供应商独立页面、第 13 章 `ApprovalTask`/`AuditLog`、第 14 章安全审计、第 16 章验收。
- 用户故事：公司或供应商审计职能发起受控敏感导出申请，由另一公司审计自然人认领并复核；申请、认领、决定和读取审计均有不可覆盖证据。
- 成功输出：审批任务、追加历史、审计事件、API 白名单和 PAGE-012/PAGE-023 独立页面状态。
- 失败输出：错误码且不推进任务、不生成导出、不写不完整审计。
- 非目标：实际导出文件、供应价审批、退款、福利卡调整、线下付款、银行变更以及任何 M2/M3/M5 业务副作用。

## 独立权限点

以下权限码彼此独立、默认拒绝，禁止合并为“财务管理”或超级管理员旁路：

1. `supply_price.reveal`
2. `supply_price.approve`
3. `refund.review`
4. `welfare_card.adjust`
5. `offline_payment.record`
6. `bank_account.review`
7. `sensitive_export.request`
8. `sensitive_export.review`
9. `audit_event.read`

本切片只执行 `sensitive_export.request/review` 和 `audit_event.read`；其余权限只冻结到固定职能，等待所属业务阶段使用，不创建假数据或空业务 API。

## 自然人、数据域与 DTO

- 申请人和复核人从已验证会话派生，比较键为 `identityType + identityId`；客户端不得提交 `applicantId`、`reviewedBy`、`functionalAccountId`、`supplierId` 或 `companyId`。
- 供应商审计职能只能创建、查看本 `supplierId` 的申请与审计；公司审计职能可处理公司范围待办。超级管理员不能认领、复核或绕过第二自然人。
- 对外审批 DTO 只返回任务 id、类型、资源摘要、状态、版本、意见和时间；不得返回自然人主键、职能账号主键、供应商归属键、IP、token、供应价、银行资料或内部快照。
- 审计 DTO 继续使用 API-015 白名单；供应商数据域在查询前加入服务端过滤，不能靠返回后过滤。

## 状态机、幂等与历史

| 当前状态 | 命令 | 下一状态 | 守卫 |
| --- | --- | --- | --- |
| 无 | `CREATE` | `PENDING` | 固定审计职能、独立请求权限、理由非空、幂等键唯一 |
| `PENDING` | `CLAIM` | `IN_REVIEW` | 公司审计职能、不同自然人、版本匹配 |
| `IN_REVIEW` | `APPROVE` | `APPROVED` | 已认领复核人、不同自然人、二次验证、意见非空、版本匹配 |
| `IN_REVIEW` | `REJECT` | `REJECTED` | 同上且拒绝意见非空 |

- 每次转换使用 `version` 乐观锁，受影响行数必须为 1；同版本并发只能成功一次。
- 每个命令使用服务端 scope + `Idempotency-Key` + 请求哈希；同键同载荷重放原响应，同键异载荷返回 `IDEMPOTENCY_KEY_CONFLICT`。
- 同一作用域、同一幂等键和同一请求摘要的并发命令必须合并为同一结果，不能形成重复任务。
- `ApprovalTaskHistory` 只追加；任务当前态可更新，但历史转换不得更新或删除。
- 审批状态和审计事件在同一数据库事务提交；审计失败返回 `AUDIT_REQUIRED` 并回滚状态。

## API 与错误码

- API-086 `POST /v1/audit/sensitive-export-approvals`
- API-087 `GET /v1/audit/sensitive-export-approvals`
- API-088 `POST /v1/audit/sensitive-export-approvals/{taskId}/claim`
- API-089 `POST /v1/audit/sensitive-export-approvals/{taskId}/decision`
- API-015 `GET /v1/audit/events` 扩展为公司审计全局只读、供应商审计本方只读，响应白名单不变。

错误码至少覆盖 `SAME_NATURAL_PERSON_REVIEW`、`SECOND_REVIEW_REQUIRED`、`APPROVAL_VERSION_CONFLICT`、`APPROVAL_STATE_INVALID`、`APPROVAL_NOT_FOUND`、`AUDIT_REQUIRED`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_KEY_CONFLICT`、`WORKSPACE_FORBIDDEN` 和 `DATA_SCOPE_FORBIDDEN`。

## 负例与完成定义

- NEG-M1-072-01：同一自然人跨两个职能账号认领或复核，拒绝且状态不变。
- NEG-M1-072-02：超级管理员试图跳过第二人或二次验证，拒绝且不写成功审计。
- NEG-M1-072-03：同一版本并发决定，恰好一个成功，另一个版本冲突。
- NEG-M1-072-04：申请、认领、决定、登录、账号选择、敏感查看、导出申请或会话撤销缺审计时，操作失败或合同测试失败。
- NEG-M1-072-05：同一幂等键并发创建只形成一个审批任务，第二个响应标记为重放。

完成要求：行为测试先红后绿；Prisma 真 MySQL 演练覆盖空库/升级/恢复/产品链和追加历史约束；API/OpenAPI/Chromium、执行包校验和 `pnpm verify` 全部有新鲜证据。PR 精确 head CI 与人工合并、合并后 main CI 仍是后续门禁。
