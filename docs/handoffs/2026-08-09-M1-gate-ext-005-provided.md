# M1-GATE EXT-005 已提供交接

阶段结论：`IN_PROGRESS`。授权人员已确认公司营业执照、正式对客名称、手机客服和开票抬头；脱敏回执 `EXT-005-20260809-A01` 已通过机器校验，外部依赖台账已从 `NOT_PROVIDED` 更新为 `PROVIDED`。这只解除原外部资料阻塞，不等于 M1 已通过。

## 范围和边界

- 当前阶段/任务：`M1 / M1-GATE`。
- 唯一目标：接收脱敏人工确认，并把门禁推进到精确 head PR CI/合并流程。
- 非目标：不存储营业执照、税号、完整联系方式或原始开票资料；不进入 M2；不执行预发布、真机或生产动作。
- 方案哈希：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- P0：`P0-001`、`P0-045`、`P0-046`；M1 其余 14 项主 P0 的既有精确 PR/main CI 证据未被本切片降低。

## 人工确认与隐私

- 法定主体及开票抬头：江苏福礼团供应链科技有限公司。
- 批准的公开展示名称：福礼团。
- 客服渠道：`PHONE`；仓库只保留打码展示值，不保留聊天中出现的完整号码。
- 三类资料状态：`CONTROLLED_STORAGE_CONFIRMED`。
- 三类资料均无内部编号，回执明确记录 `NO_INTERNAL_IDENTIFIER` 和 `reference=null`；没有为通过校验编造引用。
- 原件、统一社会信用代码、税号、银行账号、身份证、密钥和完整联系方式均未进入本切片文件。

## 先失败后通过

- 回执契约 RED：`node --test tests/handoffs/m1-ext-005-company-confirmation.contract.test.mjs`，`1 passed / 4 failed`，退出码 `1`；旧校验器不支持无内部编号的真实情况。
- 门禁状态 RED：`node --test tests/handoffs/m1-gate-ext-005-provided.contract.test.mjs`，`1 passed / 2 failed`，退出码 `1`；台账仍为 `NOT_PROVIDED` 且新证据尚不存在。
- 回执契约 GREEN：`5/5`，退出码 `0`。
- 历史预检与当前状态兼容验证：`8/8`，退出码 `0`。
- 执行包自检：PASS；任务 `149`、P0 `119`、字段 `658`、页面 `80`、权限 `22`。

## 全量验证

- 第一次 `pnpm verify`：`FAIL`，开始 `2026-08-09T00:21:38-04:00`，结束 `00:26:03-04:00`；在 regression 步骤发现 7 个历史 M1 测试仍断言活动任务数为 0 或当前状态为 `BLOCKED_EXTERNAL`。当时结果为 `30 passed / 7 failed`，退出码 `1`。
- 修复范围只更新当前进度断言为“唯一活动任务 `M1-GATE`、状态 `LOCAL_PASS`、Draft PR #34”；历史切片提交、PR、CI、权限和业务断言未降低。
- 修复后相关回归：`19/19`，退出码 `0`。
- 第二次 `pnpm verify`：`PASS_17_OF_17`，开始 `2026-08-09T00:27:41-04:00`，结束 `00:37:38-04:00`，退出码 `0`。
- P0 E2E：`24/24`；迁移：published/current `11/11`；迁移演练 `empty=2 / upgrade=2 / restore=2 / product=11 / cleanup=PASS`；秘密扫描：`522` 个已跟踪文件。

## 工作簿证据

- 使用 `@oai/artifact-tool 2.8.6+` 导入并定点更新正式工作簿，保留原样式和结构。
- 复核区域：外部依赖、阶段门禁、任务台账、总控看板。
- 公式错误扫描：`0`。
- 工作簿 SHA-256：`93F1A47C87005392A1B24206EAAB78C46062F453C98F93C2F1164333C9A02782`，已同步 manifest。

## 当前门禁

- `EXT-005=PROVIDED`。
- `M1-GATE=IN_PROGRESS / LOCAL_PASS`。
- `M2-000=NOT_STARTED / NOT_EXECUTED`，M2 继续锁定。
- 当前阶段结论代码：`PENDING_EXACT_HEAD_CI_AND_MERGE`。
- 全量本地门禁为 `PASS_17_OF_17`；阶段仍因精确 head PR CI、用户授权合并和合并后 main CI 未完成而不能标记 PASS。

## GitHub

- 仓库：`EasyStep-lee/flt1`；基线：`main@4ff02588379b1928448826d9f83b863c8c8b5bd8`。
- Issue：[#33](https://github.com/EasyStep-lee/flt1/issues/33)。
- 分支：`codex/m1-m1-gate`。
- Draft PR：[#34](https://github.com/EasyStep-lee/flt1/pull/34)。
- 新 head：待提交；新 head CI：`NOT_EXECUTED`；评论/审查需推送后重新读取。
- 未经用户对未来精确 head 的明确授权，不得转 Ready、合并或开始 M2。

## 环境、风险与回滚

- 本地：`LOCAL_PASS`；CI：`NOT_EXECUTED_CURRENT_HEAD`；预发布/生产：`NOT_EXECUTED`；M1 PC Web 不要求真机。
- 风险：源资料无内部编号，后续审计依赖授权人员维护受控原件；回执本身不替代法务/财务复核。
- 应用回滚：对本切片受审提交执行 `git revert`，不得改写公共历史。
- 数据库回滚：无 Schema、迁移或数据变更。
- 工作簿回滚：随同一 revert 恢复上一版本及 manifest 哈希。

下一唯一任务仍为 `M1-GATE`：完成全量门禁、推送 Draft PR #34、核验新 head CI，并等待用户对精确 head 的 Ready/合并授权。M1 合并后 main CI 成功前，M2 保持锁定。
