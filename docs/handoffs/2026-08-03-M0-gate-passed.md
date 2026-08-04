# M0-GATE 门禁通过交接

## 1. 身份与严格范围

- 阶段/任务：`M0 / M0-GATE M0阶段门禁验收`
- 仓库/基线分支：`EasyStep-lee/flt1 / main`
- 门禁记录基准提交：`88b7a051300af763941c3e0ad0428111869f0182`
- 门禁记录开发分支：`codex/m0-gate-close`
- 产品基线：`福礼社 V1.1`
- 综合方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 目标：把已经发生且可验证的单人自审、授权合并、实际合并和合并后 main CI 固化为 M0 门禁记录。
- 非目标：不实现 M1 业务，不修改 Schema/Migration/OpenAPI/DTO/错误码/页面，不修复 Dependabot，不配置 Secrets、分支保护、Rulesets、Environment 审批或生产部署。
- M0 主业务 P0：`0 / NOT_APPLICABLE`；不冒充业务 E2E 通过。

## 2. 精确审核与合并证据

| 检查 | 结果 | 精确证据 |
|---|---|---|
| 唯一审核责任人 | `@EasyStep-lee` | 单人开发，不新增 GitHub 账号 |
| 审核模式 | `DOCUMENTED_SELF_REVIEW` | GitHub 不允许 PR 作者原生自批，不伪造 `APPROVED` |
| 审核 head | `cb3203c50a99e0a6b5fb27d92b3b9c3dadb90de6` | PR 评论 `5173933866` |
| 审核结论 | `APPROVED_FOR_MERGE` | 用户原文包含精确 SHA 和“自审通过，允许合并” |
| PR CI | `CI_PASS` | run `30871743642` / job `91874978928` / head `cb3203c...` |
| PR #2 | `MERGED` | `https://github.com/EasyStep-lee/flt1/pull/2` |
| merge commit | `88b7a051300af763941c3e0ad0428111869f0182` | merged at `2026-08-04T02:33:12Z` |
| main CI | `CI_PASS` | run `30872133076` / job `91876116003` / event `push` / head `88b7a051...` |
| Issue #1 | `CLOSED` | closed at `2026-08-04T02:33:13Z` |
| 本闭环树完整验证 | `LOCAL_PASS` | 17/17；base `88b7a051...`；实测 `2026-08-03T23:04:15.3035715-04:00` 至 `2026-08-03T23:08:07.7829512-04:00`；证据定稿后第二轮完整复验再次通过 |

## 3. M0退出条件复核

- `pnpm verify` 17 项质量链、固定完整 SHA 的 GitHub Actions、环境清单、确定性 OpenAPI、统一类型和 Web/原生小程序传输适配器均已进入 main。
- M0-001 至 M0-012 已完成并保留逐任务提交、文件哈希、迁移演练、风险、回滚和恢复入口。
- PR 最新 head CI 与合并后 main CI 均为真实 GitHub Actions 成功证据；两者未互相替代。
- 迁移演练为 `empty=2:upgrade=2:restore=2:cleanup=PASS`；M0 未新增产品 Schema 或 SQL 迁移。
- `.github/CODEOWNERS` 已进入 main，唯一责任账号为 `@EasyStep-lee`；三层 Actions Secrets 均有意为空，M0 CI 不引用秘密。
- 未发现未解决的 P0/P1 审查评论；M0 无业务 P0。

## 4. 已知限制与人工控制

| ID | 状态 | 说明 | 控制 |
|---|---|---|---|
| `MAIN_BRANCH_PROTECTION_NOT_CONFIGURED` | `KNOWN_LIMITATION` | public 仓库的 main 仍返回 HTTP 404，Rulesets 为空 | 只用 `codex/` 分支、精确 head CI、显式授权、禁止强推/删分支、合并后 main CI |
| `PRODUCTION_ENVIRONMENT_REVIEWER_NOT_CONFIGURED` | `KNOWN_LIMITATION` | production 仅有 main 分支策略，无 required reviewer | 生产继续独立人工授权，本阶段不执行生产 |
| `ACTIONS_REPOSITORY_POLICY_NOT_HARDENED` | `KNOWN_LIMITATION` | 仓库级允许全部 Actions 且未强制 SHA | 已提交工作流自身固定完整 SHA；设置变更仍需明确授权 |

## 5. 非阻塞警告

- `WARN / ACTIONS_NODE20_RUNTIME_DEPRECATED`：部分固定 SHA 的第三方 Action 声明 Node.js 20，被 GitHub 强制使用 Node.js 24；PR 与 main 必需 CI 均成功。
- `WARN / DEPENDABOT_NPM_NODE_ENGINE_MISMATCH`：Dependabot run `30872136302` 使用 Node `24.18.1`，仓库精确锁定 `22.23.1`，pnpm 返回 `ERR_PNPM_UNSUPPORTED_ENGINE`。
- `WARN / DEPENDABOT_DOCKER_MANIFEST_NOT_FOUND`：Dependabot run `30872136309` 的 docker updater 在 `/` 未找到 Dockerfile/Kubernetes YAML；仓库当前只有 `compose.yaml`。
- 上述 Dependabot 问题不属于本次 `ci/verify` 必需门禁，但必须单独修复，不能写成后台依赖检查全部通过。

## 6. 未执行与证据边界

- 真机：`NOT_EXECUTED`。
- 预发布：`NOT_EXECUTED`。
- 生产：`NOT_EXECUTED`。
- 真实支付、退款、银行转账、法务、生产迁移和上线：`NOT_EXECUTED`，仍由授权人工执行。
- 本门禁通过只说明 M0 工程底座和协作证据达到退出条件，不代表业务功能、真机、预发布或生产已经完成。

## 7. 风险与回滚

- 回滚提交：如需撤回 PR #2，对 `88b7a051300af763941c3e0ad0428111869f0182` 执行 `git revert` 并通过新 PR 合入，禁止改写公共历史。
- 本闭环记录回滚：对其独立提交执行 `git revert <closure-record-sha>`。
- 无产品数据库迁移、数据回写或外部业务状态需要恢复。
- 本文件所在闭环提交必须通过 PR 合入 main 并再次通过 main CI；在此之前不得从开发分支直接开始 M1。

## 8. 下一任务

- 下一唯一允许任务：`M1-000`。
- 目标仅为冻结 M1 字段、状态机、权限、OpenAPI/DTO/错误码、14 项 P0 映射和失败测试计划。
- 不允许跳过 M1-000 直接开始供应商注册、权限、页面或其他业务纵向切片。
- Dependabot npm/docker 修复属于独立依赖治理切片，不混入 M1 产品契约。

## 9. 门禁结论

- 门禁结论：`PASS`。
- 批准人：`@EasyStep-lee`。
- 生效证据时刻：`2026-08-04T02:36:19Z`（合并后 main CI 完成）。
- `lastPassedGate=M0-GATE`。
- `nextAllowedTask=M1-000`。
- M1尚未开始；本闭环记录进入 main 并通过 CI 后，才按 `M1-000` 单任务规则继续。
