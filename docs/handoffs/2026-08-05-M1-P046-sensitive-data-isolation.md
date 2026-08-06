# M1-P046 敏感数据隔离交接

## 已完成的单一切片

- 任务 `M1-P046` / `P0-046`，本地验证实现 head `1825d38a4fc81c00e1a71b89fb9f2f8e15df828a`。
- 新增默认拒绝敏感字段策略：公司价格审核/财务与本供应商价格/财务按冻结字段组授权，其他职能和跨供应商请求拒绝。
- 跑腿地址只允许服务端绑定的本人、个人订单和活动履约阶段，返回 `MASKED`；企业配送始终拒绝。
- 现有审计 API 在仓储查询前拒绝字段扩展/直接导出，并递归省略供应价、供应商应付和毛利键。
- MIG-003 新增四张策略表；字段访问默认 `HIDDEN`，supplier scope 插入/更新由数据库触发器阻止跨供应商值。
- 未实现 M2 商品定价、M4 跑腿业务、M5 结算或 M1-P047。

## 新鲜测试证据

- RED：策略模块缺失；API 仅 1/3（敏感键泄露且字段扩展返回 200）；迁移合同 0/3。
- GREEN：策略 7/7；focused API 与审计回归 6/6；迁移合同 3/3；P0 Chromium 7/7。
- 真实 MySQL：产品迁移 6 条，策略表 4、外键 4、scope 触发器 2、默认 `HIDDEN`，重复字段策略与跨供应商 scope 均拒绝，drift NONE、cleanup PASS。
- 完整 `pnpm verify` 为 17/17 PASS，报告位于 `artifacts/test-results/verification/pnpm-verify.json`。

## GitHub 与门禁

- Issue [#17](https://github.com/EasyStep-lee/flt1/issues/17) OPEN。
- Draft PR [#18](https://github.com/EasyStep-lee/flt1/pull/18) OPEN；创建时 head `3e3d53d2ca17c30a0984fa01a76a3ba9006d85ce` 的 Actions run `31069525789` 为 IN_PROGRESS，评论与审查为空。
- 本次 GitHub 状态元数据提交会形成更新 head；推送后必须重新读取 PR 最新 head、Actions、Draft/Ready、未解决评论和合并状态。
- 未经用户对精确 head 的人工授权不得合并；外部门禁闭环前 `M1-P047` 仅保持 READY，不得进入实现。

## 环境边界、风险与回滚

- 本地：Windows、Node 22.23.1、pnpm 10.12.1、Docker 29.6.2、MySQL 8.4.11、Playwright Chromium。
- M4 的真实个人订单、跑腿认领和地址 DTO 尚未存在；当前仅验证 fail-closed 策略，M4 必须再做对象级与真机验收。
- M2 供应价和 M5 结算资源尚未存在，未来 DTO 接入时必须复验字段白名单。
- 生产迁移、预发布和正式验收未执行。合并前可回退本切片提交；迁移部署后不得回改已发布 SQL，只能审批后向前修复。

## 下一恢复点

只核验 Draft PR #18 最新精确 head CI、评论、审查和合并状态。外部门禁未闭环时不启动 `M1-P047`。
