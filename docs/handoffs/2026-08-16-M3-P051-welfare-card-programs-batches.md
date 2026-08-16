# M3-P051 福利卡计划与批次切片交接

## 结论与边界

- 切片结论：`CI_PASS_PENDING_HUMAN_MERGE`。这不是 M3 阶段 PASS，也不是 P0-051 的真实业务/合规验收通过。
- 唯一目标：`COMPANY_WELFARE_CARD` 固定职能在 PAGE-008 创建并查看福利卡计划与 DRAFT 发行批次。
- 方案基线 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，校验通过。
- 方案章节：§3.2、§3.4、§9.1、§9.2、§9.8、§13；主验收项 `P0-051`。
- 非目标：账户、绑定、卡码、余额、账本、发放、支付、退款、个人现金充值、真实发行，以及 M4-M6。
- EXT-012 福利卡真实计划、协议、法务/财务口径及发行批准仍为 `BLOCKED_EXTERNAL`；staging、真机、生产均为 `NOT_EXECUTED`。

## Git 与 GitHub

| 项目 | 证据 |
| --- | --- |
| 仓库 | `EasyStep-lee/flt1` |
| 基线 | `main` / `5c0f09b37c1ddff91dd01816b09fed35464d9bb4` |
| 分支 | `codex/m3-welfare-plan-batches` |
| Issue | [#99](https://github.com/EasyStep-lee/flt1/issues/99) |
| 本地完整验证提交 | `03fec7c3599602321a1bbc98f3f49f033097f601` |
| Draft PR | [#100](https://github.com/EasyStep-lee/flt1/pull/100)，仍为 Draft |
| PR CI | head `03fec7c3599602321a1bbc98f3f49f033097f601`，Actions run `31931396880` / job `95126676999`，`CI_PASS` |
| 评论 / 合并 | 无评论、无评审；`NOT_MERGED`，等待精确最终 head 人工授权 |
| 上一切片 | PR #98 head `dd508240b42e815e6acbda3510d0e40a44a7b353`，merge `5c0f09b37c1ddff91dd01816b09fed35464d9bb4`，main Actions `31924136232` 成功 |

## 实际实现

- 新增 `welfare_card_program`、`welfare_card_batch`、两类只追加历史和 `welfare_card_command`；金额、资金来源、状态、唯一键和归属在数据库边界受约束。
- 资金来源严格为 `ENTERPRISE_GRANT`、`COMPANY_GIFT`、`PHYSICAL_CARD_OR_CODE`；没有 `PERSONAL_RECHARGE` 表、API、路由、按钮或占位能力。
- 计划/批次只能创建为 `DRAFT`；`unitAmount × issueCount = totalAmount`，全部为安全整数分。
- API-101/102/103 使用 `COMPANY_WELFARE_CARD` 会话派生公司、职能账号与自然人；请求归属覆盖字段被拒绝，响应 DTO 不含公司归属、企业客户、供应商、供应价、自然人或秘密字段。
- PAGE-008 保留固定职能一级标题和唯一菜单契约，提供计划/批次列表、创建入口、加载、空态、错误和恢复状态。
- OpenAPI 和统一 TypeScript 类型由确定性脚本生成；Web 继续使用 `openapi-fetch`。

## 状态机、权限与错误码

- 状态机：`NONE -> DRAFT`，分别追加 `PROGRAM_CREATED` / `BATCH_CREATED`；历史更新和删除由数据库触发器拒绝。
- 权限：仅 `COMPANY_WELFARE_CARD`；其他公司职能、供应商、企业、个人和未登录请求关闭失败。
- 主要错误码：`AUTHENTICATION_REQUIRED`、`WORKSPACE_FORBIDDEN`、`FIELD_FORBIDDEN`、`PERSONAL_RECHARGE_FORBIDDEN`、`WELFARE_FUNDING_SOURCE_INVALID`、`WELFARE_BATCH_AMOUNT_MISMATCH`、`WELFARE_CLAIM_MODE_INVALID`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`DUPLICATE_OR_STATE_CONFLICT`。

## 测试证据

| 证据 | 命令/结果 | 状态 |
| --- | --- | --- |
| RED API | Supertest 3/3 因三个路由均返回 HTTP 404 失败 | `EXPECTED_FAIL` |
| RED 迁移 | M3-P051 迁移契约因文件 `ENOENT` 失败 | `EXPECTED_FAIL` |
| RED 页面 | PAGE-008 因缺少 `data-m3-slice="M3-P051"` 行为面板失败 | `EXPECTED_FAIL` |
| GREEN API | `apps/api/test/supertest/welfare-card-programs-api.test.mjs`，3/3 | `LOCAL_PASS` |
| GREEN 迁移 | `tests/migrations/m3-p051-welfare-card-programs-migration.contract.test.mjs`，1/1 | `LOCAL_PASS` |
| GREEN 页面与壳层 | P0-051 + P0-067 focused Chromium，3/3 | `LOCAL_PASS` |
| 合同回归 | `node --test tests/contracts/*.test.mjs`，90/90 | `LOCAL_PASS` |
| 全量门禁 | `pnpm verify`，`PNPM_VERIFY_OK:steps=17` | `LOCAL_PASS` |
| API 全量 | 43 个文件、223/223 | `LOCAL_PASS` |
| P0 E2E | Chromium 74/74 | `LOCAL_PASS` |
| 迁移演练 | `empty=2; upgrade=2; restore=2; product=32; cleanup=PASS` | `LOCAL_PASS` |
| 秘密扫描 | 971 个跟踪文件，无命中 | `LOCAL_PASS` |
| GitHub Actions | run `31931396880` / job `95126676999`，精确 head `03fec7c3599602321a1bbc98f3f49f033097f601` | `CI_PASS` |

## P0、环境与未执行项

- `P0-051` 自动化技术子行为为 `LOCAL_PASS`，但 EXT-012 与真实发行未提供，因此不得宣称正式 P0 验收 PASS。
- 本地环境：Windows、Node `22.23.1`、pnpm `10.12.1`、Docker MySQL `8.4.11`、Playwright Chromium。
- CI：实现与可访问性修复 head `03fec7c3599602321a1bbc98f3f49f033097f601` 的 Actions run `31931396880` / job `95126676999` 已通过；证据同步提交仍须再次通过精确 head CI。
- staging / DEVICE / PRODUCTION：全部 `NOT_EXECUTED`。

## 风险与回滚

- 主要风险：EXT-012 未确认时不能激活真实计划或发行批次；后续 M3-P052 不得把个人现金充值带入模型。
- 回滚：原子 revert 本切片提交；对未部署环境不执行数据库动作。若迁移已在非生产环境应用，先停止写入并按演练的恢复路径还原数据库，再回退应用；历史表不得通过手工更新伪造回滚。
- API 为新增路径；回滚会移除 API-101/102/103 和 PAGE-008 业务面板，不影响既有 M3-P031 订单备货契约。

## CI 修复记录与工作簿

- 首次 PR head `9768c8d5373ad88795b2daffc5df78115683f1fa` 的 Actions run `31929587401` 在 Linux Chromium 失败：弹窗内容已显示，但实际 `role="dialog"` 节点缺少稳定可访问名称。
- 修复使用 `panelRef` 给两个实际 dialog 节点设置明确 `aria-label`，并加强 P0-051 用例同时验证计划与批次弹窗；没有改用 CSS 定位、删除重试或降低业务断言。
- 总控工作簿已从同步后的 CSV/JSON 真源更新，公式错误扫描 0 项；SHA-256 为 `52A924B0F6DB195BBC3A3FD87E816C4DBBC228DB3F0A47BDD7CAA4FF683B88C5`，manifest 已同步。

## 下一门禁

M3-P052 保持 `LOCKED`。只有本 Draft PR 精确 head CI 成功、人工明确授权合并且合并后的 `main` CI 成功，才允许进入 M3-P052；M4-M6 继续禁止进入。
