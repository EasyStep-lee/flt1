# M1-P045 敏感操作审计交接

## 已完成的单一切片

- 任务 `M1-P045` / `P0-045`，实现提交序列止于本地验证 head `8fef06e90c2266c80dc7d50f019501c1b7cfefe2`。
- `AuditLog` 为追加式存储；MySQL 触发器实际拒绝 UPDATE/DELETE。
- 已有供应商职能账号邀请在同一事务内追加 `functional_account.invited`；审计失败返回 `AUDIT_REQUIRED` 且账号不落库。
- API-015 `GET /v1/audit/events` 只允许 `COMPANY_AUDIT` 固定工作区，响应显式白名单并二次脱敏。
- PAGE-012 `/company-admin/workspaces/audit` 覆盖加载、空、错误、权限、离线和成功展示状态。
- 退款批准、强制下架、银行账户变更和付款标记仅冻结动作码，未实现后续业务域。

## 新鲜测试证据

- RED：审计策略模块缺失；迁移合同 `0/3`。
- GREEN：策略及既有策略 `8/8`；focused API `9/9`；合同与迁移合同 `6/6`；OpenAPI 聚焦 `4/4`。
- P0 Chromium `6/6`，含新增 P0-045。
- 真实 MySQL：产品迁移 `5`，审计表 `1`、不可变触发器 `2`、UPDATE/DELETE 均拒绝、drift NONE、cleanup PASS。
- 完整 `pnpm verify` 在 `8fef06e` 为 `17/17 PASS`；前两轮分别暴露并修复 OpenAPI 固定清单遗漏和测试夹具秘密扫描误报。

## GitHub 与门禁

- Issue [#15](https://github.com/EasyStep-lee/flt1/issues/15) OPEN。
- Draft PR [#16](https://github.com/EasyStep-lee/flt1/pull/16) OPEN；创建时 head `8fef06e` 的 Actions run `31066180380` 为 IN_PROGRESS。
- 本交接/证据提交推送后必须以 PR 最新 head 重新读取 CI、Draft/Ready、未解决评论与合并状态。
- 未经用户对精确 head 的人工授权不得合并；合并与合并后 main CI 完成前，不得进入 `M1-P046`。

## 环境边界、风险与回滚

- 本地：Windows、Node 22.23.1、pnpm 10.12.1、Docker 29.6.2、MySQL 8.4.11、Playwright Chromium。
- 生产公司审计会话适配仍默认拒绝；预发布、生产迁移和正式验收未执行。
- binlog 环境创建触发器前须确认 `log_bin_trust_function_creators=1`；演练会临时设置并恢复，本地 compose 已固化。
- 合并前可回退本切片提交；迁移部署后只能走审批后的向前修复，不删除审计行、不编辑已发布迁移。

## 下一恢复点

只核验 PR #16 最新 head 的 Actions、评论、审查和合并状态。外部门禁未闭环时继续同阶段安全工作，不启动 `M1-P046` 或其他后续切片。
