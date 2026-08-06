# M1-P005 供应商职能账号交接

## 结论

- 任务：`M1-P005`，P0：`P0-005`。
- 本地结论：`DONE / LOCAL_PASS`；实现提交 `f62db171bfd792a60b46b96d6cf04b28d3898399`。
- 对比基线：`431576064fb9838d44615d036c5439f2937e3786`（M1-P004 合并后的 `origin/main`）。
- GitHub：Issue #13；分支 `codex/m1-m1-p005`；Draft PR、精确 head CI、审查、合并和 main CI 尚未执行。
- 下一顺序任务是 `M1-P045`，但本 PR 完成精确 head CI、授权审查、合并及合并后 main CI 前只能保持 `READY`，不得启动。

## 实际实现

- 新增八类供应商职能账号类型，代码和 `workspaceRoute` 均由服务端固定且唯一；业务职能菜单保持空白，不伪造后续页面。
- 新增 `SupplierUser / FunctionalAccount / FunctionalAccountStatusHistory / FunctionalAccountCommand` 及向前迁移。
- 实现 API-013/API-014：主体管理员可查询和邀请本供应商职能账号；请求不能选择 `supplierId / identityId / ownerType / workspaceRoute`。
- 创建邀请要求二次验证和 `Idempotency-Key`；跨 workspace、自我提权、最后一个主体管理员停用均由冻结策略拒绝。
- 响应只返回账号显示名、类型、固定路由和状态，不返回联系方式或内部归属字段。
- 实现 PAGE-016 主体管理入口与 PAGE-024 账号管理页面，覆盖 loading、empty、error、permission、offline 和 success 展示路径。

## 先红后绿与验证

- RED：新增策略单测先因目标模块不存在而报 `ERR_MODULE_NOT_FOUND`。
- GREEN：策略 `5/5`；M1-P005 focused API `6/6`；全部 API Supertest `26/26`；合同 `3/3`；迁移合同 `3/3`；OpenAPI `9/9`；P0 Chromium `5/5`（含 P0-005）。
- Prisma：schema 有效；Docker MySQL 演练 `empty=2 / upgrade=2 / restore=2 / product=4 / cleanup=PASS`，8 类账号与 8 条唯一工作区、5 张表、5 个归属外键实测，schema drift 为 NONE。
- 根门禁 `pnpm verify` `17/17 PASS`，机器报告绑定实现提交 `f62db171...`（2026-08-05T12:38:37.185Z 至 12:48:30.200Z）；Draft PR 精确 head CI 仍须另行执行。

## 边界、风险与回退

- M1-P069 的登录、激活令牌、职能选择和会话签发未实现；生产 resolver 默认拒绝。
- M1-P070 的八套独立业务页面未实现；商品、价格、库存、履约、售后和财务业务未进入。
- 真实二次验证适配器未接入，生产默认拒绝；安全事件当前经审计 sink 输出，M1-P045/M1-P072 再完成统一不可变审计查询。
- EXT-006、预发布、生产迁移、生产灾备和正式验收均未执行；既有 Vite 大 chunk 警告保留。
- 应用、契约和页面可反向回退本切片提交；迁移一旦发布不得修改或逆向删除，只能向前修复或按备份恢复。

## 恢复顺序

- 读取根与提示词包 `AGENTS.md`、基线锁、本交接、项目状态和 M1-P045 任务行。
- 实时核验 M1-P005 Draft PR 的精确 head CI、未解决评论、授权审查、合并和合并后 main CI。
- 外部闭环完成前不得把 M1-P045 置为 `IN_PROGRESS`，不得进入 M1-P046 或 M2。
