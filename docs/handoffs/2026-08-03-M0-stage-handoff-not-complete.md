# M0 未完成交接（待 M0-GATE）

## 1. 身份与基线

- 阶段：`M0 环境、工程底座与契约冻结`
- 交接任务：`M0-012 形成M0交接证据包`
- 生成时间：2026-08-03T06:39:59.823Z
- 工作目录：`C:\Users\lichuanjun\Documents\flt1\`
- 开发分支：`codex/m0-m0-handoff`
- 证据源提交：`a98c6edcbb356cd8b3209cf2695b44f36655bc93`
- 综合方案SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 提示词/执行包：`V1.1 / 1.1.0`

## 2. 严格范围

本交接只汇总并验证M0工程底座，不新增供应商、商品、价格、库存、订单、福利卡、微信支付、配送、对账、CMS或任何业务页面。M0没有映射业务P0；不得把基础Playwright、UI图片或本地命令写成业务P0通过。

## 3. M0本地结果

- M0-001至M0-011均为`DONE/LOCAL_PASS`，提交对象存在且均为证据源提交的祖先。
- M0-012交付本机器证据、未完成阶段交接和恢复入口；完成后只允许进入`M0-GATE`评审。
- 根级质量门禁、固定SHA的CI模板、确定性OpenAPI/统一类型、Web与小程序传输适配、迁移演练、五端应用壳和安全配置均有本地证据索引。
- 阶段结论固定为`NOT_COMPLETE_AWAITING_M0_GATE`；本文件不是门禁批准记录。

## 4. M0任务与提交索引

| 任务 | 结果 | 实现提交 | 证据级别 | 独立交接 | 实现文件数 |
|---|---|---|---|---|---:|
| M0-001 | 冻结产品基线与变更规则 | `958ce3952ea2395216fbadc3af244c5de6dbd8a1` | LOCAL_PASS | `docs/handoffs/2026-08-02-M0-001-958ce39.md` | 6 |
| M0-002 | 只读盘点本机与仓库环境 | `96346b15c23debfff03cf8c328da51e26bc3669c` | LOCAL_PASS | `docs/handoffs/2026-08-02-M0-002-environment.md` | 4 |
| M0-003 | 确认GitHub目标与协作边界 | `00346170e48733ebd1a46807a738deca0704848e` | LOCAL_PASS | `docs/handoffs/2026-08-02-M0-003-github-boundary.md` | 4 |
| M0-004 | 初始化pnpm workspace与Turborepo | `9067c36c87949693bc53432a57b149314b592cc2` | LOCAL_PASS | `docs/handoffs/2026-08-02-M0-004-workspace-foundation.md` | 19 |
| M0-005 | 初始化NestJS/Prisma/MySQL/Redis/BullMQ底座 | `5c8764c16ec2064ea146e51898b0716e0b43bd36` | LOCAL_PASS | `docs/handoffs/2026-08-02-M0-005-foundation-stack.md` | 43 |
| M0-006 | 初始化五端应用壳 | `a542c56b8e375c6331cc093d8f102d2bf837f5ea` | LOCAL_PASS | `docs/handoffs/2026-08-02-M0-006-application-shells.md` | 88 |
| M0-007 | 建立配置Schema与秘密扫描 | `4d46293f668dcbd0dc5465ed65803e4fda9a3618` | LOCAL_PASS | `docs/handoffs/2026-08-02-M0-007-configuration-and-secrets.md` | 23 |
| M0-008 | 建立确定性OpenAPI、统一类型与传输适配 | `743142676f96530289259ec426c8689a30c0d315` | LOCAL_PASS | `docs/handoffs/2026-08-02-M0-008-openapi-contracts.md` | 52 |
| M0-009 | 建立测试金字塔与失败测试模板 | `4b93d52423b19eaabe65f01b56ec21b944d28d39` | LOCAL_PASS | `docs/handoffs/2026-08-02-M0-009-test-pyramid-foundation.md` | 24 |
| M0-010 | 建立Prisma迁移与回滚演练 | `62ead13dfb9c6680a4c173fa09377ce6cf8e23b9` | LOCAL_PASS | `docs/handoffs/2026-08-02-M0-010-prisma-migration-rehearsal.md` | 8 |
| M0-011 | 建立pnpm verify与GitHub CI门禁 | `6033fa14d52ab8ef847bfcb275747ec94d0c904a` | LOCAL_PASS | `docs/handoffs/2026-08-03-M0-011-pnpm-verify-github-ci.md` | 19 |

机器索引同时保存每个实现提交的完整变更文件列表、交接文件SHA-256及低层证据文件SHA-256：`artifacts/verification/M0-012/m0-stage-handoff-evidence.json`。

## 5. 新鲜验证

| 检查 | 结果 |
|---|---|
| 根`pnpm verify` | PASS 17/17，提交 `a98c6edcbb356cd8b3209cf2695b44f36655bc93`，基线 `ad40cf8a01ca0d801139de7cfa266041e19b2e43` |
| M0业务P0 | `NOT_APPLICABLE`；M0映射P0数量为0，不是业务E2E通过 |
| GitHub Actions | `NOT_EXECUTED` |
| Pull Request | `NOT_EXECUTED` |
| main合并与复验 | `NOT_EXECUTED / NOT_EXECUTED` |
| 正式M0门禁 | `NOT_EXECUTED` |

## 6. 环境与恢复命令

- Node：`v22.23.1`；pnpm：`10.12.1`；Turborepo：`2.10.8`。
- 冻结安装：`pnpm install --frozen-lockfile --ignore-scripts`
- 本地基础设施：`pnpm infra:up`；状态：`pnpm infra:status`；停止：`pnpm infra:down`
- 公司后台：`pnpm --filter @fulishe/company-admin dev`（127.0.0.1:5173）
- 供应商后台：`pnpm --filter @fulishe/supplier-portal dev`（127.0.0.1:5174）
- 企业门户：`pnpm --filter @fulishe/portal-web dev`（127.0.0.1:3000）
- API：先`pnpm --filter @fulishe/api build`，再`pnpm --filter @fulishe/api start`
- 全量验证：`pnpm verify -- --base-ref <40位不可变基线提交>`
- 交接自检：`pnpm test:m0-handoff`；正式证据自检：`node ./scripts/verify-m0-handoff-evidence.mjs --require-fresh-verification`

## 7. OpenAPI、迁移、数据与页面边界

- OpenAPI/DTO/错误码：M0只建立健康检查契约、统一错误结构、确定性生成和传输适配；没有业务API。
- Prisma/Migration：产品schema仍无业务模型，产品SQL迁移数量为0；三数据库演练使用临时夹具，不代表MIG-001已应用。
- 页面：五端只有可独立构建的应用壳与公开/私有缓存索引边界，没有业务页面闭环。
- 资金/供应价/订单/配送：均未实现；没有真实支付、退款、银行转账或生产数据变更。

## 8. 外部与人工阻塞

| ID | 需要提供或决定 | 状态 | 阻塞正式验收 | 安全边界 |
|---|---|---|---|---|
| EXT-001 | 确认目标owner/repo或仓库URL、默认分支 | NOT_PROVIDED | NO | 不得猜测远程；不得把Token粘贴聊天 |
| EXT-002 | 确认Codex/开发人员的最小仓库权限 | NOT_PROVIDED | NO | 只授权分支、Draft PR和只读CI；合并仍人工 |
| EXT-003 | 配置Actions Secrets与Environment审批 | NOT_PROVIDED | YES | 仅在GitHub UI/密钥管理器输入，不写仓库 |
| EXT-004 | 确认开发/预发布/生产域名、服务器、数据库和对象存储责任人 | NOT_PROVIDED | NO | M0只使用本地替代；生产资料不进聊天 |

GitHub CLI认证只证明本机登录，不证明目标仓库、默认分支或写权限。没有可验证origin时不得推送、创建PR或伪造Actions结果。

## 9. 安全复核

- 未把真实密钥、证书、Token、个人资料或支付凭据写入交接。
- 用户原有未跟踪UI资产、预览图片和旧版本资料不属于本阶段提交，必须继续保留并精确暂存。
- 供应价、资金、自然人双审、个人/企业配送隔离等产品红线尚未进入业务实现阶段，M0证据不能替代后续P0测试。

## 10. 风险与回滚

- 主要风险：GitHub目标与权限未确认，工作流尚未在真实PR执行；CODEOWNERS仍为示例；Actions Secrets/Environment尚未配置。
- 证据风险：本地`LOCAL_PASS`不能替代`CI_PASS`、`STAGING_PASS`、`DEVICE_PASS`或`PRODUCTION_PASS`。
- 应用回滚：交接生成器提交使用`git revert a98c6edcbb356cd8b3209cf2695b44f36655bc93`；各历史任务按机器索引中的`rollback.command`逐项回退。
- 数据恢复：M0-012不含迁移、数据回写或外部状态；不得删除用户未跟踪文件。
- 触发阈值：基线哈希、任务提交、交接/证据哈希、17步根门禁任一不一致即停止门禁评审并修复证据。

## 11. 下一任务

- 唯一允许开始：`M0-GATE M0阶段门禁验收`。
- 建议先做：以只读方式独立运行最新`pnpm verify`、迁移演练、OpenAPI差异、交接自检，并核对真实GitHub/PR/Actions状态。
- 禁止提前执行：M1及以后业务开发、真实支付/退款、生产部署/迁移、直接修改或推送main。
- M1解锁：`false`。

## 12. 门禁结论

- 结论：`NOT_COMPLETE_AWAITING_M0_GATE`
- 正式`M0-GATE`：`NOT_EXECUTED`
- 审核人/时间：`UNASSIGNED / NOT_EXECUTED`
- 说明：只有授权人工确认GitHub目标与门禁要求，并由M0-GATE基于最新证据作出结论后，才可能讨论M1；本交接本身不批准阶段。
