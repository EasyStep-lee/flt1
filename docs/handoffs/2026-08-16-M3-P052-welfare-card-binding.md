# M3-P052 福利卡绑定切片交接

## 结论与边界

- 切片结论：`LOCAL_PASS_DRAFT_PR_CI_FIX_IN_PROGRESS`。这不是 M3 阶段 PASS，也不是 P0-052 的真实发行、真机或正式业务验收通过。
- 唯一目标：个人用户通过卡号密码、完整兑换码或扫码结果，把一张有效福利卡幂等绑定到当前会话自然人对应的账户，并追加一笔 `CLAIM/CREDIT` 账本。
- 方案基线 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，2026-08-16 重新校验通过。
- 方案章节：§7、§9.1、§9.2、§9.8、§13、§16；主验收项 `P0-052`。
- 非目标：P0-053 账户选择、适用范围、发放、支付、退款、真实卡码发行、个人现金充值、短信、staging、真机、生产及 M4-M6。
- `EXT-012` 真实发行批准仍为 `BLOCKED_EXTERNAL`；真机扫码、staging 和 production 均为 `NOT_EXECUTED`。

## Git 与 GitHub

| 项目 | 证据 |
| --- | --- |
| 仓库 | `EasyStep-lee/flt1`，origin `https://github.com/EasyStep-lee/flt1.git` |
| 基线 | `main` / `31839f8fd2daa8efb0910e7c7405cbc80fa9a752` |
| 分支 | `codex/m3-welfare-card-binding` |
| Issue | [#101](https://github.com/EasyStep-lee/flt1/issues/101) |
| 实现提交 | `98334b981e37aefc0a8e957d1b945689250dfe5f` |
| Draft PR | [#102](https://github.com/EasyStep-lee/flt1/pull/102)，保持 Draft |
| PR CI | 首轮 Actions `31940900582` / job `95149828722` 在 head `5c850db4a070e3b3955bfa121b006ca0689ae5c8` 失败；唯一根因为工作簿已更新但 `manifest.json` 仍保留旧 SHA-256，当前分支已修复并等待新 head 复验 |
| 评论 / 合并 | `NOT_REVIEWED` / `NOT_MERGED`；未经精确最终 head 人工授权不得转 Ready 或合并 |
| 上一切片 | PR #100 head `823672611b8ed291cf29ce02f99d6fd60ab44b9c`，merge `31839f8fd2daa8efb0910e7c7405cbc80fa9a752`，main Actions `31935845317` / job `95137513626` 成功 |

## 实际实现

- 新增 `WelfareCardCode`、`WelfareCardAccount`、`WelfareCardLedger`、`WelfareCardBindingCommand` 与向前迁移 `20260816090000_m3_welfare_card_binding`。
- 卡密/兑换秘密使用带盐 `scrypt` 摘要；数据库、响应 DTO、日志和幂等响应快照均不保留明文。
- API-038 `POST /v1/consumer/welfare-card-accounts/bind` 只从已验证会话派生 `companyId` 与 `consumerUserId`，拒绝客户端归属字段；响应只返回掩码卡号和账户白名单字段，并设置 `private/no-store/noindex`。
- 同一会话同一 `Idempotency-Key` 精确重放；同键异体冲突。卡码领取以 Serializable 事务、状态/版本条件更新和唯一 `cardCodeId` 账户约束防止双领。
- 首次绑定同时创建唯一账户并追加不可更新/删除的 `CLAIM/CREDIT` 账本；账户余额与 CLAIM 金额相等，全部金额为整数分。
- PAGE-062 提供福利卡入口，PAGE-064 支持卡号密码、完整兑换码与 `wx.scanCode` 结果；网络未知结果保留同一业务签名并复用幂等键。
- 原生小程序继续只通过 `miniapp-kit` 的唯一 `wx.request` 适配器和生成契约类型请求 API；没有充值、提现、转账或 `PERSONAL_RECHARGE` 能力。

## 状态机、权限、OpenAPI 与错误码

- 状态机：卡码 `UNCLAIMED -> CLAIMED`，账户 `NONE -> ACTIVE`，同一原子事务追加 `CLAIM/CREDIT`；错误秘密、禁用/过期卡、冻结/非激活计划批次、重复领取和他人领取均零副作用。
- 权限：仅当前 `CONSUMER_USER` 会话可绑定本人账户；未登录、停用账户、未知字段或客户端所有权覆盖全部关闭失败。
- OpenAPI：API-038、`WelfareCardBindRequestDto`、`WelfareCardAccountResponseDto` 和统一类型由确定性脚本生成；响应不含秘密、公司/用户归属、供应商或供应价。
- 主要错误码：`AUTHENTICATION_REQUIRED`、`ACCOUNT_SUSPENDED`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`CARD_CODE_INVALID`、`CARD_ALREADY_CLAIMED`、`CARD_RECIPIENT_MISMATCH`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`。

## 先失败后通过证据

| 证据 | 命令/结果 | 状态 |
| --- | --- | --- |
| RED API | API-038 Supertest 3/3 均因 HTTP 404 失败 | `EXPECTED_FAIL` |
| RED 迁移 | M3-P052 迁移契约因目标文件 `ENOENT` 失败 | `EXPECTED_FAIL` |
| RED 小程序 | PAGE-062/PAGE-064 构建行为测试 3/3 因页面缺失失败 | `EXPECTED_FAIL` |
| GREEN API | `welfare-card-binding-api.test.mjs`，3/3 | `LOCAL_PASS` |
| GREEN 仓储 | `prisma-welfare-card-binding-repository.test.mjs`，4/4；含加盐摘要、并发单领、幂等和零副作用 | `LOCAL_PASS` |
| GREEN 迁移 | `m3-p052-welfare-card-binding-migration.contract.test.mjs`，1/1 | `LOCAL_PASS` |
| GREEN 小程序 | 用户小程序全包 20/20，其中 P0-052 为 3/3 | `LOCAL_PASS` |
| GREEN P0 | P0-052 focused Chromium 1/1 | `LOCAL_PASS` |
| API 全量 | 44 个文件、226/226 | `LOCAL_PASS` |
| P0 E2E 全量 | Chromium 75/75；P0-052 为第 55 项 | `LOCAL_PASS` |
| 全量门禁 | `pnpm verify`，`PNPM_VERIFY_OK:steps=17:base=HEAD`，退出码 0 | `LOCAL_PASS` |
| 迁移演练 | 首次因本机 MySQL 停止而 `P1001` 失败；`pnpm infra:up` 后 `empty=2; upgrade=2; restore=2; product=33; cleanup=PASS` | `LOCAL_PASS` |
| 秘密扫描 | 989 个受跟踪文件，无命中 | `LOCAL_PASS` |
| GitHub Actions | Draft PR #102 首轮 head `5c850db4a070e3b3955bfa121b006ca0689ae5c8` 的 run `31940900582` / job `95149828722` 因工作簿 manifest 哈希过期失败；其余该回归组 28/29 通过 | `FAIL_FIXED_PENDING_RETEST` |

## 环境、P0 与未执行项

- 本地环境：Windows、Node `22.23.1`、pnpm `10.12.1`、Docker MySQL `8.4.11`、Playwright Chromium。
- `P0-052` 自动化技术子行为为 `LOCAL_PASS`；真实卡码由 EXT-012 阻塞，扫码仅使用受控模拟结果，因此不得升级为 `DEVICE_PASS` 或正式业务验收 PASS。
- `P0-053` 保持 `LOCKED/NOT_EXECUTED`；福利卡适用范围、支付、混合支付与退款没有在本切片实现。
- staging / DEVICE / PRODUCTION：全部 `NOT_EXECUTED`。

## 风险与回滚

- 主要风险：没有真实发行凭据时不能验证卡码来源、扫码格式和真实领取人；不能用测试种子或模拟扫码冒充发行验收。
- 回滚：原子 revert 本切片提交；未部署环境不执行数据库动作。若迁移已在非生产环境应用，先停止写入并按演练恢复备份，再回退应用或创建向前修复迁移；已发布迁移和账本历史不得原地改写。
- API-038 和两张小程序页面均为新增入口；回滚不影响已合并的 P0-051 计划/批次能力，但会移除账户/卡码/CLAIM 账本模型。

## 工作簿

- 总控工作簿已由同步后的 CSV/JSON 事实源增量更新，12 个工作表全部渲染；公式错误扫描 0 项。
- 工作簿 SHA-256：`32CC1C4F0A2AACD678C55296F37242C943D5DD0D549F9971534B0BB60FCB2EC6`；`manifest.json` 已同步为同一值。

## 下一门禁

先提交并推送当前证据修复，等待 Draft PR #102 新精确 head 的 Actions 与评论状态。只有 Draft PR 精确 head CI 成功、人工明确授权合并且合并后的 `main` CI 成功，M3-P053 才可解锁；M4-M6 继续禁止进入。
