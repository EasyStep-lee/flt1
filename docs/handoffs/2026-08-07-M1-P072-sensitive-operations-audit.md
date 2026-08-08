# M1-P072 后台敏感操作与审计交接

## 结论与基线

- 阶段/任务/P0：`M1` / `M1-P072` / `P0-072`；当前结论 `LOCAL_PASS`，M1 阶段仍未完成。
- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，与锁定基线一致。
- 基线：`main@a721d56f1cf6568da35c65db66fdde28d95eddea`；分支：`codex/m1-m1-p072`。
- 实现与加固提交：`b4ba786`（纵向实现）、`7b3315b`（OpenAPI 回归冻结）、`3234a00`（供应商审计独立页面壳层）、`4aac6c0`（并发重放证据绑定）。
- 用户已有未跟踪图片、浏览器目录、输出目录、旧方案和 UI 资产未暂存、未修改。P0-071 属于 M2；PR 精确 head CI、人工审查、用户授权合并及合并后 main CI 完成前禁止进入 M2。

## 实际范围与非范围

- 公司 PAGE-012 和供应商 PAGE-023 分别使用独立审计职能会话。公司审计可读取全局脱敏审计事件并申请、认领、决定敏感导出审批；供应商审计只读取当前会话 `supplierId` 范围并只能提交本方申请。
- API-086～089 实现敏感导出审批的创建、列表、认领和决定；API-015 扩展供应商会话数据范围过滤。响应 DTO 不返回申请/复核自然人、职能账号、supplierId、companyId、供应价、银行资料或内部归属字段。
- 本切片只产生审批任务、追加状态历史和审计事件，不生成实际导出文件、不提供下载授权。供应价、退款、福利卡、线下付款和银行账户的后续业务操作未提前实现。
- 九个风险权限码独立冻结：`supply_price.reveal`、`supply_price.approve`、`refund.review`、`welfare_card.adjust`、`offline_payment.record`、`bank_account.review`、`sensitive_export.request`、`sensitive_export.review`、`audit_event.read`；本切片只执行后三项相关能力。

## 数据、状态机、权限与审计

- 新前向迁移 `20260808013000_sensitive_approval_audit_scope` 扩展 `ApprovalTask`，新增 `ApprovalTaskHistory` 和 `ApprovalTaskCommand`，并为 `AuditLog` 增加 `supplierId`、`functionalAccountId` 查询范围字段。
- 状态机为 `PENDING -> IN_REVIEW -> APPROVED|REJECTED`。每次转换使用 `version` CAS；同版本不同命令恰好一个成功。
- maker-checker 使用 `identityType + identityId`，同一自然人跨职能账号不能认领；超级管理员不能绕过独立复核；决定操作还要求二次验证。
- 同一作用域、同一 `Idempotency-Key` 和同一请求摘要的并发命令合并为一个结果；同键异参返回冲突。Prisma 仓储在唯一键竞争后读取已提交命令并重放。
- `ApprovalTaskHistory` 由数据库触发器拒绝 UPDATE/DELETE；业务状态、历史、命令结果和强制审计位于同一事务，审计失败回滚。供应商列表和审计查询在数据库查询前加入会话派生 `supplierId`。

## 先红后绿与完整验证

| 证据 | 实际结果 |
| --- | --- |
| API RED | API-086～089 缺失时 `5/5` 按预期返回 404 失败 |
| OpenAPI RED | operation 与 DTO 白名单缺失时 `1/1` 按预期失败 |
| 迁移 RED | 审批历史、幂等命令和审计范围迁移缺失时 `1/1` 按预期失败 |
| 并发重放 RED | 延迟审计写入下，同一幂等键并发创建返回两个不同 taskId，`1/7` 按预期失败 |
| API focused GREEN | 敏感审批、审计与隔离 `14/14` |
| OpenAPI focused GREEN | P072 确定性契约 `1/1`；全 OpenAPI 回归 `17/17` |
| Chromium focused GREEN | P070/P072 联合 `5/5`；P072 独立 `2/2` |
| M1 历史契约 | P072 证据计数修正后 `37/37` |
| 真实 MySQL 演练 | `empty=2/upgrade=2/restore=2/product=11/cleanup=PASS`；历史 UPDATE/DELETE 均拒绝，九个权限码存在 |
| 完整 `pnpm verify` | `4aac6c0` 上 `17/17`、全部退出码 `0`；P0 E2E `24/24`；开始 `2026-08-08T02:38:29.745Z`，结束 `2026-08-08T02:53:34.623Z` |

全量验证先后发现并修复三类真实回归：旧 OpenAPI 路径/Schema 白名单未包含 P072；PAGE-023 从占位模块升级后漏保留 P070 的单职能菜单壳层；新增 `NEG-M1-072-05` 后证据契约仍断言四条负例。修复均保留或加强原断言，没有删除测试、降低门禁或放宽权限。

## P0、环境、风险与回滚

- P0-072 当前仅 `LOCAL_PASS`。NEG-M1-072-01～05 覆盖同自然人跨账号、超级管理员旁路、同版本并发决定、强制审计失败回滚和同幂等键并发合并。
- 本地环境：Windows、Node 22.23.1、pnpm 10.12.1、Docker MySQL 8.4.11、Playwright Chromium。staging/production 均 `NOT_EXECUTED`；PC Web 切片无微信真机要求。
- 真实公司/供应商身份源、正式凭证和二次验证 Adapter 仍默认拒绝；实际导出、短期下载授权、水印和下载审计属于 M5。公司后台和供应商后台仍有大于 500 kB 的非阻断拆包告警。
- 应用回滚：按逆序 `git revert` 本切片四个实现/加固提交及后续证据提交。已发布迁移不得回改；旧应用可忽略可空新增列，数据库恢复只能使用备份或新增前向修复迁移。

## GitHub 与下一门禁

- 仓库：`EasyStep-lee/flt1`。前序 PR [#30](https://github.com/EasyStep-lee/flt1/pull/30) 已按授权精确 head `acadd8b838c4061c8184b12db077a030d0a8e277` 合并为 `a721d56`；合并后 main Actions run `31232556011` 成功。
- 当前 Issue [#31](https://github.com/EasyStep-lee/flt1/issues/31)；分支 `codex/m1-m1-p072`；Draft PR、精确 head CI、评论/审查、Ready、合并和合并后 main CI 尚未执行。
- 下一步只允许提交本交接、推送当前分支、创建/更新 Draft PR，并读取精确 head Actions 与未解决评论。没有用户对最终精确 SHA 的 Ready/合并授权且合并后 main CI 未通过前，不得启动 M2。
