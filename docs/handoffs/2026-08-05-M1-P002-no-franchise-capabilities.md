# M1-P002 无加盟商能力交接

## 结论

- 任务：`M1-P002`，P0：`P0-002`。
- 本地结论：`DONE / LOCAL_PASS`。
- 实现 head：`c7ea23b6f67cce69224a5f7a8ea76408df1fc44c`。
- 对比基线：`c2b4bf420d0629b795cdfbdf2c1c4378224d76f7`。
- 下一顺序任务：`M1-P003`，只处于 `READY`；本任务完成 Draft PR 精确 head CI、自审授权、合并和合并后 main CI 前不得启动。

## 本切片实现

- 新增 `NO_FRANCHISEE_CAPABILITIES` 领域禁止策略，明确拒绝加盟商注册/后台、区域收益分账和加盟商实体，策略错误码为 `FORBIDDEN_CAPABILITY`、`FORBIDDEN_ENTITY`。
- 新增仓库守卫，扫描 Prisma Schema、全部已发布迁移、确定性 OpenAPI 路径/Schema 和应用路由来源；扫描失败直接返回非零退出码。
- 禁止性 P0 不伪造业务端点或页面：加盟商、区域分账和加盟合同 API 保持 404，门户不存在加盟商入口或对应路径。
- 根脚本增加 `pnpm policy:no-franchise`；守卫同时进入 M1 契约回归和完整 `pnpm verify` 的 regression 步骤。

## 先红后绿证据

- RED：API 构建成功后，领域策略模块和仓库守卫脚本均不存在，两个 focused 测试分别以 `ERR_MODULE_NOT_FOUND` 正确失败。
- GREEN：领域策略 `4/4`，仓库守卫 `4/4`，禁止 API `4/4`，P0-002 Chromium `1/1`。
- 仓库扫描：1 个 Prisma Schema、2 条既有迁移、3 个 OpenAPI 路径、79 个应用路由文件，违规数 `0`。
- Prisma：Schema 有效；发布迁移保持 `2/2` 未改变；真实 MySQL 演练 `empty=2 / upgrade=2 / restore=2 / product=2 / cleanup=PASS`。
- OpenAPI：生成物字节一致，相对基线无变化、无破坏性变更。
- 根门禁：`pnpm verify` `17/17 PASS`，报告绑定实现 head 与精确基线。

## 明确未实现

- 不新增加盟商、区域代理、加盟合同、区域分账、加盟商后台或第二经营主体。
- 不新增 Prisma 模型、迁移、OpenAPI 路径、DTO 或对客页面；这些缺失是本任务的正确业务结果。
- 不实现 M1-P003 供应商注册及后续账号、权限、商品、支付、配送或结算能力。

## 证据边界与风险

- 当前仅为 `LOCAL_PASS`；Draft PR、GitHub Actions 精确 head CI、自审授权、合并和合并后 main CI 均为 `NOT_EXECUTED`。
- 预发布、生产和正式验收均未执行；本禁止性切片无真机要求。
- `EXT-005` 及既有 GitHub Actions Node.js 20、Dependabot 警告继续保留，不冒充本任务已修复。
- 仓库守卫只把结构化 Schema、迁移、OpenAPI 与应用路由视为能力证据；历史产品文档和负面测试中的禁止词不会被误判为运行时能力。

## 回退与恢复

- 应用与测试可按原子提交反向回退；本任务没有新增迁移，不涉及数据库回滚。
- 恢复时读取根与提示词包 `AGENTS.md`、基线锁、项目状态、本交接和 `M1-P003` 任务行，并实时核验本任务 PR/CI。
