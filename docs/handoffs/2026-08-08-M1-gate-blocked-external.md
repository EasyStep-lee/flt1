# M1-GATE 阶段门禁交接

阶段结论：`BLOCKED`。M1 的技术门禁候选证据已经收口，但 `EXT-005` 仍为 `NOT_PROVIDED`，对应 M1 人工门槛尚未满足，且外部依赖表标记 `BlocksFormalAcceptance=YES`，因此不得把 M1 写成 PASS，M2 继续锁定。

## 基线与候选版本

- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，本轮校验 `PASS`。
- 候选 `main`：`4ff02588379b1928448826d9f83b863c8c8b5bd8`。
- 最后业务切片：M1-P072，PR #32，head `efb50c01049686ce5acf8463342a53d4e572a7cd`，已合并为候选 `main`。
- PR #32 精确 head CI：运行 `31239438856` / job `93057793375`，`CI_PASS`。
- 合并后 main CI：运行 `31240531655` / job `93060624824`，`CI_PASS`。
- 本门禁记录：Issue #33，分支 `codex/m1-m1-gate`；Draft PR 在本记录提交后创建。

## 范围与非范围

本切片仅汇总 M1-000 及 14 个 M1 业务切片的精确 PR head、PR CI、合并提交、合并后 main CI，并对当前树重跑 M1 合同、P0 E2E、迁移、OpenAPI 和根级门禁。未实现 M2 分类、商品、价格或库存；未接入真实身份源、短信、预发布或生产。

## M1 技术证据

| 证据 | 结果 | 边界 |
| --- | --- | --- |
| 15 个 M1 前置任务 | `CI_PASS` | 全部已通过独立 PR 合并和合并后 main CI |
| 14 项主 P0 | `CI_PASS` 技术证据 | 统一在 `main@4ff0258` 复验；不替代正式主体资料验收 |
| M1 合同 | `LOCAL_PASS` | 37/37 |
| M1 P0 E2E | `LOCAL_PASS` | Chromium 24/24；无微信真机要求 |
| Prisma 迁移演练 | `LOCAL_PASS` | `empty=2 / upgrade=2 / restore=2 / product=11 / cleanup=PASS` |
| OpenAPI / DTO / 错误码 | `LOCAL_PASS` | 确定性生成、类型无漂移、oasdiff 无破坏变更 |
| 根级 `pnpm verify` | `LOCAL_PASS` | 17/17；完整运行时间写入机器证据 |

六个阶段关键不变量均有行为证据：单商户主体、供应商数据域、职能页面隔离、自然人双人复核、超级管理员无旁路、敏感字段响应白名单。

## 先红后绿与完整验证

- RED：`node --test ./tests/handoffs/m1-gate-preflight.contract.test.mjs` 首次因机器证据、门禁台账状态和交接文件尚不存在而 `0/3`、退出码 `1`。
- GREEN：同一门禁契约最终 `3/3`、退出码 `0`；`pnpm test:m1-contract` 为 `37/37`、退出码 `0`；执行包自检退出码 `0`。
- 完整门禁：`pnpm verify -- --base-ref 4ff02588379b1928448826d9f83b863c8c8b5bd8` 于 `2026-08-08T07:09:58.4740809Z` 至 `2026-08-08T07:18:38.3465071Z` 运行，`17/17`、退出码 `0`；P0 Chromium `24/24`，迁移演练 `product=11 / cleanup=PASS`，秘密扫描 `512` 个已跟踪文件通过。
- 工作簿：11 张机器台账已同步到总控工作簿，12 张工作表逐表渲染检查，公式错误扫描为 `0`；工作簿 SHA-256 为 `03FC173FFFC63093CA768216F374E20CAA7226AFC5CE7BB678807D35CFD20CB3`。

## 实际变更与兼容边界

- 新增 M1-GATE 机器证据、行为契约和本交接；同步任务、P0、测试证据、阶段门禁、项目状态、执行包校验器、manifest 与总控工作簿。
- 仅把已合并 M1 切片的旧 `LOCAL_PASS` 台账升级为可追溯的精确 head `CI_PASS`，并把 M1-GATE 明确记录为 `BLOCKED/LOCAL_PASS`；未把正式验收写成通过。
- 本切片没有新增或修改 Prisma Schema、SQL 迁移、领域状态迁移、权限定义、页面路由、OpenAPI operation、DTO 或错误码；现有字段字典、状态机、权限矩阵、页面映射和 API 台账只在工作簿中与 CSV 真源同步。
- 用户已有的未跟踪 UI 资产、浏览器资料和旧方案文件均未修改、未暂存。

## 真实阻塞

`EXT-005` 要求授权人员确认江苏福礼团供应链科技有限公司的营业执照、对客名称、客服与开票资料。这些资料必须进入受控存储；不得在聊天中粘贴营业执照全图、完整个人信息、税控或开票凭据。仓库只需记录授权人、确认时间、脱敏对客字段和受控存储引用。

`EXT-006` 仍为 `NOT_PROVIDED`，但外部依赖表标记 `BlocksFormalAcceptance=NO`；现有实现保持可配置规则与默认拒绝，不伪造供应商合规结论。

## 环境证据边界

- 本地：`LOCAL_PASS`。
- 候选 main CI：`CI_PASS`，不等于门禁记录 Draft PR 的精确 head CI。
- 预发布：`NOT_EXECUTED`。
- 真机：`NOT_REQUIRED_M1_PC_WEB`。
- 生产：`NOT_EXECUTED`。
- 正式业务验收：`BLOCKED_EXTERNAL_EXT_005`。

## GitHub、风险与回滚

- PR #32 已合并，Issue #31 已关闭，对应的评论、review 和未解决 review thread 均为 0。
- 当前 main 仍无 branch protection，Rulesets 仍为空，production Environment 无 required reviewer；这些是实时复核后的已知治理限制，本切片不修改 GitHub 设置。
- 两套后台的大 bundle 和 Actions Node 20 弃用注解保留为 `WARN`，未导致候选 main CI 失败。
- 应用回滚：仅对本门禁证据提交新建受审 PR 执行 `git revert`，禁止改写公共历史。
- 数据库回滚：本切片无 Schema 或迁移变更，不需要数据回滚。

## 继续条件

1. 授权人员以脱敏元数据和受控存储引用完成 `EXT-005` 确认。
2. 在当前 M1-GATE 分支重新生成精确 head 证据，运行 focused 和全量门禁，并等待该 head CI 通过。
3. 只有用户对该精确 head 授权 Ready/合并且合并后 main CI 成功，才能将 M1 记为 PASS 并开始 M2-000。

当前唯一允许任务仍为 `M1-GATE`；M2 继续锁定。
