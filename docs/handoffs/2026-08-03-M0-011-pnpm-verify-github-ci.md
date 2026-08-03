# M0-011 pnpm verify与GitHub CI门禁交接

## 1. 身份

- 阶段/任务：`M0 / M0-011 建立pnpm verify与GitHub CI门禁`
- 日期/时区：2026-08-03，UTC-04:00
- 本地仓库：`C:\Users\lichuanjun\Documents\flt1`
- 开发分支：`codex/m0-pnpm-verify-github-ci`
- 实现提交：`6033fa14d52ab8ef847bfcb275747ec94d0c904a`
- 验证基线：`d6710d56c6375367f11f802bb77c187b06359a8a`，即实现提交父提交
- P0映射：无；本任务为M0工程基础任务
- 远程/PR/CI：`BLOCKED_EXTERNAL / NOT_EXECUTED`；本地没有可验证origin，owner/repo、默认分支和写权限未确认

## 2. 结果与范围

M0-011已建立根级`pnpm verify`、可追溯机器报告、不可变目标分支基线解析、固定提交SHA的GitHub Actions模板、PR/Issue模板和Dependabot配置。验证器按固定顺序失败即停，拒绝跳过变量、未知参数和CI中的可变或缺失基线。

本次没有实现业务功能，没有修改Prisma产品schema、产品SQL迁移、OpenAPI契约、DTO、错误码或五端业务页面。GitHub工作流只是本地模板；没有真实push、PR或Actions运行，不能写成`CI_PASS`。

## 3. 根级验证门禁

`pnpm verify`顺序执行17项检查：

1. workspace结构
2. lint
3. OpenAPI确定性生成
4. OpenAPI生成物相对`HEAD`无暂存或未暂存漂移
5. OpenAPI契约检查
6. 相对不可变基线的oasdiff breaking检查
7. typecheck
8. unit
9. regression
10. API
11. Playwright基础E2E
12. 当前阶段P0 E2E门禁
13. Prisma validate
14. 相对同一基线的迁移完整性检查
15. 三数据库迁移演练
16. build
17. Git已跟踪文件秘密扫描

每次执行写入`artifacts/test-results/verification/pnpm-verify.json`，记录当前提交、基线SHA及来源、逐项命令、状态和耗时。失败后的未执行项会标为`NOT_EXECUTED_AFTER_FAILURE`，不允许静默跳过。

## 4. GitHub CI约束

- `.github/workflows/ci.yml`使用完整历史`fetch-depth: 0`且不持久化checkout凭据。
- PR以`pull_request.base.sha`、普通push以`before`、手工触发以`HEAD^`解析基线；初始push零SHA直接失败。
- CI中的`VERIFY_BASE_REF`必须是40位不可变提交SHA；缺失、`HEAD`或其他可变引用均失败。
- 安装使用冻结lockfile且忽略生命周期脚本；安装Chromium后只调用根级`pnpm verify`。
- 不允许`continue-on-error`、`|| true`、浮动Action版本或失败检查的替代成功路径。
- 固定Action提交：
  - `actions/checkout@11d5960a326750d5838078e36cf38b85af677262`
  - `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020`
  - `pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1`
  - `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02`

## 5. M0的P0 E2E口径

M0任务台账没有映射业务P0，因此当前门禁输出：

`P0_E2E_NOT_APPLICABLE:stage=M0:p0Count=0:reason=M0_HAS_NO_MAPPED_P0`

这只表示M0没有可运行的业务P0用例，不是业务E2E通过。Playwright基础E2E仍真实执行并通过；后续阶段只要映射P0数量大于0而缺少对应spec，门禁就会失败。

## 6. 先红后绿与问题收敛

| 阶段 | 证据 |
|---|---|
| 初始契约RED | 0通过、6失败：根verify、验证计划、CI、基线解析、P0 E2E策略和GitHub模板均不存在 |
| 初始GREEN | 6/6通过 |
| 干净安装入口RED/GREEN | 5通过、2失败后补齐入口，最终7/7 |
| 暂存OpenAPI漂移RED/GREEN | 发现普通`git diff`漏掉仅暂存漂移；先使契约6/7失败，再改为`git diff --exit-code HEAD`后7/7 |
| CI缺基线负向验证 | `CI=true`且缺少`VERIFY_BASE_REF`时以`VERIFY_BASE_REF_REQUIRED_IN_CI`按预期失败 |
| 首次全量verify | 被M0-004历史守卫“根verify必须不存在”阻断；把当前工作区守卫精确更新为M0-011入口后通过 |
| 冻结干净复现 | 临时目录冻结安装、创建临时Git提交、完整17/17 verify通过；411.3秒，残留0且原工作区未改变 |

## 7. 最终验证

| 验证 | 结果 |
|---|---|
| M0-011契约 | GREEN 7/7 |
| `pnpm verify -- --base-ref d6710d56c6375367f11f802bb77c187b06359a8a` | PASS 17/17；当前提交`6033fa1`；210.193秒 |
| 机器报告 | SHA-256 `5E9F78A357A72DA764CE1AFF3CAD99C98D4B63252ABB256DB86D60354FD7CDB5` |
| `pnpm test:ci:clean-install` | PASS；冻结安装后完整17/17；411.3秒 |
| M0 P0 E2E门禁 | 明确`NOT_APPLICABLE`；没有冒充业务E2E通过 |
| 工作区结构与冻结安装契约 | PASS |
| OpenAPI暂存/未暂存漂移 | 0 |
| 临时目录与Compose残留 | 0 / 0 |
| Git已跟踪文件秘密扫描 | PASS：实现验证时291个文件、收尾文件暂存后293个文件，均为0命中 |
| `pnpm audit --prod` | PASS：309个生产依赖，0项已知漏洞 |
| 产品基线 | PASS；只有执行状态追加导致的预期目录快照告警 |
| 执行包与12页工作簿 | PASS；公式错误0，逐页视觉检查通过 |

汇总机器证据：`artifacts/verification/M0-011/pnpm-verify-ci-gate.json`。

## 8. 明确未执行

- GitHub push、Pull Request和Actions：`NOT_EXECUTED/BLOCKED_EXTERNAL`。
- Branch protection、required checks、CODEOWNERS正式人员映射、Actions Secrets和Environment审批：`NOT_EXECUTED/HUMAN_REQUIRED`。
- 真实预发布/生产验证、真实支付/退款、真机和上线：`NOT_EXECUTED`。
- M0业务P0：不存在映射，不能登记为`CI_PASS`、`DEVICE_PASS`或正式验收通过。

## 9. 主要文件与回滚

- 根验证器：`scripts/run-verification.mjs`
- 固定验证计划：`scripts/verification-plan.mjs`
- CI基线解析：`scripts/resolve-ci-base.mjs`
- P0 E2E门禁：`scripts/run-p0-e2e-gate.mjs`
- CI工作流：`.github/workflows/ci.yml`
- 契约与干净安装：`tests/ci/**`
- 门禁说明：`docs/architecture/GITHUB_CI_GATE.md`

代码回滚使用`git revert 6033fa14d52ab8ef847bfcb275747ec94d0c904a`。本任务没有数据库迁移、数据回写或远程状态需要撤销；不得删除用户未跟踪的UI资产和预览文件。

## 10. 下一任务

- 唯一允许开始：`M0-012 形成M0交接证据包`。
- M0-012汇总M0-001至M0-011的提交、命令、CI外部阻塞、风险、回滚和人工缺口，使下一Codex任务可从project-status直接恢复。
- `M0-GATE`仍为`NOT_STARTED/NOT_EXECUTED`；不得提前进入M1。
