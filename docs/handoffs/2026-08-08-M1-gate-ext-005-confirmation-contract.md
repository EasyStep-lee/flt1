# M1-GATE EXT-005 确认契约交接

阶段结论：`BLOCKED_EXTERNAL`。本切片只补齐授权人员提交脱敏回执的可执行契约；`EXT-005` 仍为 `NOT_PROVIDED`，模板不是人工证据，M2继续锁定。

## 目标与非目标

- 目标：让授权人员能够用固定 JSON Schema、打码字段和受控存储引用提交最小确认回执，并在提交前通过无回显校验器。
- 非目标：不代替人工核验公司证照，不保存原件，不自动修改外部依赖台账，不把 M1 写成 PASS，不进入 M2。
- 方案与 P0：保持 M1 人工门槛及 P0-001 单商户主体边界；没有新增 P0，也没有改变经营、资金、法律或数据归属。

## 实际变更

- 新增 `docs/contracts/m1/ext-005-company-confirmation.schema.json`，冻结回执字段、固定公司主体、授权角色、打码客服值和受控引用协议。
- 新增不可直接通过的模板与人工 runbook；占位符和未确认声明会被拒绝。
- 新增 `scripts/verify-ext-005-company-confirmation.mjs` 及 pnpm 命令。CLI 只输出确认编号、时间和法定名称等安全摘要，不回显受控引用或被拒值。
- 新增行为合同，覆盖错误主体、无时区时间、非受控授权人引用、完整手机号、`file://`、未确认声明、统一社会信用代码字段和 Data URL。
- 没有 Prisma Schema、SQL 迁移、领域状态机、OpenAPI、DTO、错误码、权限、页面或外部服务变化。

## 先失败后通过

- 初始 RED：新行为合同 `0/4`、退出码 `1`，失败原因为校验器和契约文件不存在。
- 实现 GREEN：同一合同 `4/4`、退出码 `0`；独立 ESLint 和 `git diff --check` 通过。
- 证据 RED：新增证据约束后 `4/5`、退出码 `1`，失败原因为机器证据和本交接不存在。
- 最终 focused：`5/5`、退出码 `0`；全部 handoff 合同 `20/20`；M1 合同 `37/37`；执行包自检通过。

## 全量验证与环境恢复

- 第一次 `pnpm verify -- --base-ref 4ff02588379b1928448826d9f83b863c8c8b5bd8` 于 `2026-08-09T03:06:47.6220356Z` 至 `2026-08-09T03:16:18.4329962Z` 运行，退出码 `1`，真实失败码为 `DOCKER_ENGINE_UNAVAILABLE`；前序代码、合同、API、P0 E2E 与 Prisma validate 已通过，迁移演练无法连接已停止的 Docker Desktop Linux Engine。
- 启动本机 Docker Desktop 后，服务端版本为 `29.6.2`；未删除 volume。单独迁移演练于 `2026-08-09T03:26:55.7515815Z` 至 `2026-08-09T03:28:24.8839408Z` 通过：`empty=2 / upgrade=2 / restore=2 / product=11 / cleanup=PASS`。
- 从头重跑完整门禁于 `2026-08-09T03:28:49.4222835Z` 至 `2026-08-09T03:37:29.2959056Z` 成功，`17/17`、退出码 `0`；P0 Chromium `24/24`，迁移 `published=11/current=11`，秘密扫描 `515` 个跟踪文件。
- 本交接与机器证据生成在完整门禁之后；现有 Draft PR #34 的下一精确 head CI 将对最终提交树再次运行全量门禁。
- 本交接、机器证据和测试全部暂存后再次执行 `pnpm secrets:scan`，`522` 个跟踪文件通过。

## 安全、外部与环境边界

- 回执禁止完整营业执照图片、统一社会信用代码、税号、银行账号、身份证、完整个人联系方式、密钥、证书、Base64、Data URL、`file://` 或签名 URL。
- `EXT-005` 当前状态仍是 `NOT_PROVIDED`，正式业务验收保持 `BLOCKED_EXTERNAL`。
- 本地技术合同：`LOCAL_PASS`；PR 新 head CI：`NOT_EXECUTED_AT_CAPTURE`；staging/production：`NOT_EXECUTED`；真机：`NOT_REQUIRED_M1_PC_WEB`。
- GitHub main 治理限制、后台 bundle 警告和 Actions Node 20 弃用提示保持原状态，本切片未修改 GitHub 设置。

## GitHub、风险与回滚

- 仓库 `EasyStep-lee/flt1`，基线 `main@4ff0258`，当前分支 `codex/m1-m1-gate`，继续使用 Issue #33 与 Draft PR #34；不新建重复 PR。
- 本记录生成时 PR head 仍为 `0d39fdcdedb892d7d929554ddea4b54817ccc447`，旧 head CI run `31246268293` 成功；本切片提交后必须读取新 head CI。
- 风险：校验器只能证明回执格式和防泄露约束，不能证明授权人真实身份或受控存储中的原件内容。
- 应用回滚：对本切片提交执行受审 `git revert`；禁止改写公共历史。数据库无变化，不需要数据回滚。

## 下一唯一允许动作

授权人员按 runbook 核验原件并提供通过校验的脱敏回执。之后仍需更新 M1-GATE 证据、运行新鲜 focused/全量门禁、等待精确 head CI，并取得用户对该未来 head 的 Ready/合并授权。合并后 main CI 成功前，M1 不得 PASS，M2保持锁定。
