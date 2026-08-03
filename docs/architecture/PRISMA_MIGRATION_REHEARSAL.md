# M0-010 Prisma迁移与恢复演练

## 1. 任务边界

本任务只建立Prisma校验、迁移完整性、空库/升级路径dry-run、逻辑备份恢复和向前修复规则。产品`schema.prisma`仍只有MySQL datasource与client generator；产品迁移目录仍没有业务或占位SQL。首个业务模型和真实迁移必须由所属纵向切片先写失败测试后创建。

本地演练通过`packages/db`锁定的Prisma 6.19.2和`compose.yaml`锁定的MySQL 8.4.11执行。脚本不读取外部`DATABASE_URL`作为目标，只连接本仓库Compose暴露在`127.0.0.1`的MySQL，并自行生成下列隔离资源：

- 三个名称以`fulishe_m0_010_`开头的临时数据库，分别用于全链空库、已有版本升级和备份恢复；
- 一个名称以`flt_m0_`开头的临时数据库用户；
- 位于操作系统临时目录的两条纯演练迁移，第二条是新增的向前修复迁移。

脚本在`finally`中只删除自己成功创建且通过固定前缀校验的数据库、用户和临时文件，并恢复MySQL服务运行前的状态。配置中的开发数据库`fulishe`不作为目标，生产数据库更不在该命令的可配置范围内。

## 2. 固定命令

```powershell
pnpm prisma:validate
pnpm prisma:migrations:check
pnpm test:migrations
pnpm prisma:migrate:dry-run
pnpm test:migrations:clean-install
```

需要保存本次机器证据时，报告路径只能位于M0-010证据目录：

```powershell
node ./scripts/prisma-migration-rehearsal.mjs `
  --report artifacts/verification/M0-010/prisma-migration-rehearsal.json
```

`prisma:migrate:dry-run`依次验证：

1. 产品schema与演练schema均能`prisma validate`；
2. 全新空库一次应用完整迁移链；
3. 升级库先应用基线、写入探针数据，再追加并应用向前修复迁移，原数据保持不变；
4. 升级前用`mysqldump --single-transaction`形成逻辑备份，在另一个空库恢复后验证迁移历史与数据；
5. 恢复库继续应用同一条向前修复迁移；
6. 三个数据库的`migrate status`均为最新，数据库到最终datamodel的`migrate diff --exit-code`均无差异；
7. 重复`migrate deploy`无新增变化，最后清理全部临时资源。

`test:migrations:clean-install`使用仓库环境门禁已确认的PowerShell 7，把受控源码复制到系统临时目录，执行冻结且忽略依赖生命周期脚本的全新安装，再运行迁移契约、lint、typecheck、build和真实三库演练；结束后删除该临时副本，并断言原仓库工作树没有被改变。

这证明本地空库、升级和逻辑恢复路径可重复演练，不等同于预发布、生产灾备、时间点恢复、RTO/RPO或真实数据量验收。

## 3. 已发布迁移不可修改

“已发布迁移”是目标Git基线中已经存在的`packages/db/prisma/migrations/*/migration.sql`。不得编辑、删除、重命名或覆盖已发布迁移。`scripts/check-prisma-migrations.mjs`比较当前工作区与指定Git基线：

- 修改、删除或重命名基线已有SQL时返回`PUBLISHED_MIGRATION_IMMUTABLE`并失败；
- 只允许新增按`YYYYMMDDHHMMSS_snake_case/migration.sql`命名的向前迁移；
- 每个迁移目录只能包含一个非空`migration.sql`；
- 本地默认基线为`HEAD`；M0-011接入PR CI时必须显式传入真实目标分支提交，不能以当前提交冒充目标分支。

新增迁移进入目标分支后即成为只读历史。评审新迁移时必须同时检查schema、SQL、数据兼容性、锁表风险、空库和已有数据升级路径、备份恢复及回滚/向前修复说明。

## 4. 向前修复与恢复规则

迁移失败或上线后发现结构错误时，先停止继续发布并保存日志、`_prisma_migrations`状态和数据库备份证据，再由授权人员选择安全路径：

- 能安全追加修复时，新建时间戳更大的迁移，修复结构或数据，不改历史SQL；
- 需要恢复数据时，把迁移前已验证备份恢复到隔离环境先验证，再按授权发布方案执行；
- `prisma migrate resolve`只用于人工确认的失败迁移处置或既有库基线登记，必须记录原因、实际数据库状态和复核人；
- 禁止在共享、预发布或生产环境运行`prisma migrate dev`、`migrate reset`或`db push`；
- 应用版本回退不能自动倒退数据库。数据库是否恢复备份或继续向前修复，必须依据兼容矩阵和现场证据单独决定。

生产迁移、生产备份和恢复始终由授权人工在发布门禁内执行；Codex与CI只能生成、校验和演练候选命令，不得自行连接或更改生产数据库。

## 5. 证据分级

| 证据 | M0-010可得结论 | 不能声称 |
|---|---|---|
| `prisma:validate` | schema语法和Prisma配置本地通过 | 真实业务模型正确 |
| 迁移完整性测试 | Git基线已有SQL被修改时能阻断 | GitHub CI已执行（归M0-011） |
| 本地三库演练 | MySQL 8.4空库、升级、逻辑备份恢复与向前修复可运行 | 预发布/生产迁移或灾备通过 |
| 机器报告 | 本次命令、版本、迁移计数、备份哈希与清理结果可追溯 | 人工生产授权已取得 |

## 6. 官方依据

- Prisma Migrate生产工作流使用`migrate deploy`应用待执行迁移，并以迁移历史为真源：<https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production>
- Prisma说明迁移历史冲突会由修改或删除已应用迁移引起，并明确不应故意编辑或删除迁移：<https://www.prisma.io/docs/orm/prisma-migrate/workflows/troubleshooting>
- Prisma的失败迁移和hotfix流程使用`migrate resolve`、`migrate diff`等受控处置；本仓库在此基础上锁定为“历史只读、优先新增向前修复”：<https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing>
- MySQL 8.4官方说明使用`mysqldump`生成逻辑备份并通过`mysql`客户端恢复；本任务只演练隔离小数据集：<https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html>
