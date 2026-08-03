# Prisma迁移目录

M0-005只建立MySQL datasource、Prisma Client、校验和seed框架；M0-010建立迁移演练，不提前创建业务表或占位模型，因此当前产品迁移链仍没有SQL迁移。

- 首个业务模型及其迁移必须由所属纵向切片创建。
- 目录固定为`YYYYMMDDHHMMSS_snake_case/migration.sql`，每个目录只允许一个非空SQL文件。
- 已发布迁移只读；`pnpm prisma:migrations:check --base-ref <目标分支>`会拒绝修改、删除或重命名目标分支已经存在的迁移SQL。
- 错误必须使用新的向前修复迁移处理，不回写历史SQL，也不以`db push`绕过迁移链。
- `pnpm prisma:migrate:dry-run`在本地MySQL的隔离临时数据库中演练空库、升级、备份恢复和向前修复；测试夹具只写入系统临时目录，不进入本产品迁移链。
- 生产迁移必须由授权人工在发布门禁内执行。

完整规则与演练边界见`docs/architecture/PRISMA_MIGRATION_REHEARSAL.md`。
