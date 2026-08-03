# M0-010 Prisma迁移与回滚演练交接

## 1. 身份

- 阶段/任务：`M0 / M0-010 建立Prisma迁移与回滚演练`
- 日期/时区：2026-08-02，UTC-04:00
- 本地仓库：`C:\Users\lichuanjun\Documents\flt1`
- 开发分支：`codex/m0-prisma`
- 实现提交：`62ead13dfb9c6680a4c173fa09377ce6cf8e23b9`
- P0映射：无；本任务为M0工程基础任务
- 远程/PR/CI：`BLOCKED_EXTERNAL / NOT_EXECUTED`，本地没有origin

## 2. 结果与范围

M0-010已建立Prisma迁移历史完整性检查、仅限本机回环MySQL的三数据库迁移演练、逻辑备份/恢复、向前修复约束和冻结干净安装复现。已发布迁移SQL的修改、删除和重命名均会被拒绝；只允许新增按时间递增的向前迁移。

本次没有新增业务Prisma模型或产品SQL迁移，没有修改产品schema，没有实现业务API、DTO、页面、支付、退款或GitHub Actions。演练使用临时两步夹具，不能写成MIG-001已经创建、应用或生产灾备通过。

## 3. 迁移完整性约束

- `pnpm prisma:migrations:check`以Git基线比对已发布迁移目录。
- 已发布`migration.sql`被修改、删除或重命名时以`PUBLISHED_MIGRATION_IMMUTABLE`失败。
- 新迁移目录必须采用`YYYYMMDDHHMMSS_snake_case/migration.sql`，每个目录仅一个非空SQL文件。
- 已发布问题只允许新增向前修复迁移；生产执行仍由授权人工完成。
- 当前产品迁移SQL数量为0，因此MIG-001继续保持`PLANNED`，没有本地、预发布或生产应用时间。

## 4. 三数据库本地演练

`pnpm prisma:migrate:dry-run`只接受本机回环、仓库`compose.yaml`中的MySQL，并为每次执行生成固定前缀的随机临时数据库与临时用户。配置的`fulishe`数据库从未成为目标。

| 路径 | 最终结果 |
|---|---|
| 空库完整链 | 2个临时夹具迁移均应用，PASS |
| 升级路径 | 1→2，探针数据保留，PASS |
| 逻辑备份 | `mysqldump --single-transaction`，2947字节，SHA-256 `673599012de75df87aa4bf4c2aed4420ca03f361e0f4ed61248cddd608f8ad7c` |
| 恢复后升级 | 恢复到新库再1→2，探针数据保留，PASS |
| 最终漂移 | `NONE` |
| 重复部署 | 幂等，PASS |
| 清理 | 临时库、用户、文件全部清理，并恢复MySQL执行前状态，PASS |

产品schema执行前后SHA-256均为`c7e2d106a1afce02d598f02e8b89e9c17127110070ccf50d56b13c5c4a435ed2`，产品迁移SQL执行前后均为0。

## 5. 先红后绿与问题收敛

| 阶段 | 证据 |
|---|---|
| 预期RED | 1通过、2失败：迁移文档、命令入口和完整性检查器不存在 |
| 干净安装入口RED | 在实现前因脚本未定义而按预期失败 |
| GREEN | 迁移契约3/3；覆盖修改、删除、重命名拒绝以及新增向前迁移允许 |
| 首次实库演练 | Windows直接`spawnSync pnpm.cmd`返回`EINVAL`；改为受控shell调用后通过，失败路径也完成清理 |
| 首次干净安装 | Windows PowerShell 5.1没有`Path.GetRelativePath`；改为已验证前缀截取 |
| 第二次干净安装 | PowerShell 5.1无法删除深层依赖路径；入口固定为PowerShell 7后完整通过 |
| 最终干净复现 | 冻结且忽略生命周期脚本的安装、契约、lint/typecheck/build、三数据库演练全部通过，269.4秒 |

## 6. 最终验证

| 验证 | 结果 |
|---|---|
| M0-010迁移契约 | RED 1/3、GREEN 3/3 |
| `pnpm prisma:validate` | PASS |
| `pnpm prisma:migrations:check` | PASS：published=0，current=0 |
| `pnpm prisma:migrate:dry-run` | PASS：empty=2，upgrade=2，restore=2，drift NONE，cleanup PASS |
| M0-010冻结干净安装 | PASS：包含三数据库实库演练 |
| 根级`pnpm test` | PASS；Turbo 24/24任务 |
| `pnpm test:api` | PASS：Node 3/3 + Supertest 3/3 |
| 工作区lint/typecheck/build | PASS：13/13、13/13、13/13 |
| OpenAPI逐字节漂移检查 | PASS |
| 工作区结构检查 | PASS |
| Git已跟踪文件秘密扫描 | PASS：278个文件，0命中 |
| `pnpm audit --prod` | PASS：0项已知漏洞 |
| 产品基线 | PASS；只有执行状态追加导致的预期目录快照告警 |
| 执行包与12页工作簿 | PASS；公式错误0，逐页视觉检查通过 |

低层实库证据：`artifacts/verification/M0-010/prisma-migration-rehearsal.json`。

汇总机器证据：`artifacts/verification/M0-010/prisma-migration-foundation.json`。

## 7. 明确未执行

- 根级`pnpm verify`、GitHub Actions、PR与CI：`NOT_EXECUTED/BLOCKED_EXTERNAL`，归属M0-011。
- 产品MIG-001创建或应用：`NOT_EXECUTED`；继续保持`PLANNED`。
- 真实预发布迁移、生产迁移、PITR、RTO/RPO和生产灾备恢复：`NOT_EXECUTED`，必须由授权人工完成。
- 业务P0自动化、真实支付/退款、真机和上线：`NOT_EXECUTED`。

## 8. 主要文件与回滚

- 迁移完整性：`scripts/check-prisma-migrations.mjs`
- 三数据库演练：`scripts/prisma-migration-rehearsal.mjs`
- 契约与干净安装：`tests/migrations/**`
- 架构规则：`docs/architecture/PRISMA_MIGRATION_REHEARSAL.md`
- 迁移目录说明：`packages/db/prisma/migrations/README.md`

代码回滚使用`git revert 62ead13dfb9c6680a4c173fa09377ce6cf8e23b9`。没有产品迁移、数据回写或真实外部状态需要撤销；不得删除用户未跟踪的UI资产和预览文件。

## 9. 下一任务

- 唯一允许开始：`M0-011 建立pnpm verify与GitHub CI门禁`。
- M0-011建立根级聚合验证与固定提交SHA的GitHub Actions/PR门禁，并把迁移完整性基线接到真实目标分支。
- 未确认`owner/repo`或可验证origin前，只能完成本地门禁准备；push、PR和CI持续为`BLOCKED_EXTERNAL/NOT_EXECUTED`。
