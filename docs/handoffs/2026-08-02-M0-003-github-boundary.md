# M0-003 GitHub目标与协作边界交接

## 1. 身份

- 阶段/任务：`M0 / M0-003 确认GitHub目标与协作边界`
- 日期/时区：2026-08-02，UTC-04:00
- 本地仓库：`C:\Users\lichuanjun\Documents\flt1`
- 开发分支：`codex/m0-github`
- 审计基准HEAD：`ed14571d3b32828aeebbda7143c39c93295b5530`
- 实现提交：`BOUNDARY_COMMIT`
- P0映射：无；本任务为M0工程治理任务

## 2. 结论

M0-003的本地协作边界已经确认，结论为 `LOCAL_ONLY_BOUNDARY_CONFIRMED`：本机可继续M0本地工程，但目标GitHub仓库仍未确认，所有远程操作保持 `BLOCKED_EXTERNAL`。

这不是“GitHub仓库已接入”。当前证据只能证明GitHub CLI账号可用，不能证明任何一个仓库就是本项目目标。执行包 `18-仓库接入与启动指令.md` 明确允许缺少目标仓库时继续M0本地工程，因此M0-003可在完整登记边界后本地完成，并将下一任务推进到M0-004。

## 3. 仓库与权限登记

| 项目 | 当前登记 | 证据边界 |
|---|---|---|
| GitHub owner/repo | `null / UNCONFIRMED` | 用户未提供owner/repo或URL，本地无可验证origin |
| origin | `null` | `git remote -v`为空；未添加远程 |
| 默认分支 | `null / UNCONFIRMED` | `main`只是执行包推荐值，不作为确认事实 |
| 仓库可见性 | `null / NOT_EXECUTED` | 无目标仓库，未查询 |
| 仓库写权限 | `BLOCKED_EXTERNAL` | 已认证账号不等于对未知仓库有写权限 |
| GitHub认证 | `AUTHENTICATED` | `gh`验证账号为 `EasyStep-lee`，未记录或输出凭据材料 |
| 当前本地分支 | `codex/m0-github` | 从M0-002已验证提交继续 |
| PR / Issue / CI | `NOT_EXECUTED` | 无目标仓库，不创建、不更新、不声称通过 |

## 4. 当前允许动作

- 只读检查本地Git状态、分支和历史。
- 创建 `codex/` 前缀的本地开发分支。
- 精确暂存并提交当前任务文件。
- 继续M0-004及后续M0本地工程；不得把本地结果提升为CI或远程证据。

## 5. 当前禁止动作

- 不得根据账号名、目录名或仓库列表猜测owner/repo。
- 不得自行添加origin、fetch/pull/push任何未知远程。
- 不得创建或更新远程Issue、PR、评论、标签、里程碑或Actions。
- 不得直接修改或推送main，不得强推或改写公共历史。
- 不得修改成员权限、Secrets、Environment、分支保护或Actions权限。
- 不得合并PR、创建Release、部署或执行生产迁移。

## 6. 待人工确认项

| ID | 必须提供/确认 | 解锁范围 |
|---|---|---|
| `TARGET_OWNER_REPO` | 明确的owner/repo或GitHub URL | 添加/验证origin及远程读取 |
| `DEFAULT_BRANCH` | 目标仓库默认分支，推荐main | 基线分支、PR目标、保护规则 |
| `REMOTE_WRITE` | Codex可推送开发分支并创建Draft PR的明确授权与实际权限 | 推送、Draft PR、Issue协作 |
| `BRANCH_PROTECTION` | 仓库管理员配置main保护、必需检查和审批 | 合并门禁 |
| `SECRETS_AND_ENVIRONMENTS` | 仓库管理员在GitHub/密钥系统中配置 | 外部CI、预发布和生产；秘密不进入聊天或Git |

## 7. 先红后绿与验证证据

| 验证 | 命令/证据 | 结果 |
|---|---|---|
| 失败测试 | `./tests/github/github-collaboration-boundary.ps1` | 预期失败：缺少审计脚本 |
| focused test | 同一命令 | PASS：未猜测仓库、远程写入受阻、本地M0可继续 |
| 实际审计 | `./scripts/audit-github-collaboration-boundary.ps1` | PASS：生成M0-003机器证据 |
| 敏感信息检查 | JSON令牌模式与token字段检查 | PASS：未记录凭据材料 |
| 产品基线 | `./scripts/verify-product-baseline.ps1` | PASS；执行状态变化仅产生允许的快照告警 |

- 机器证据：`artifacts/verification/M0-003/github-collaboration-boundary.json`。
- `pnpm verify`：`NOT_EXECUTED`，工程命令尚未由M0-004/M0-011建立。
- Schema/migration/OpenAPI/DTO/错误码/页面：无变更。
- 真机、预发布、生产、真实支付：`NOT_EXECUTED`。

## 8. 风险与回滚

- 主要风险是把“账号已认证”误判成“项目仓库已确认”；机器报告以不同字段隔离二者。
- 后续若用户确认目标仓库，必须重新运行同一审计并验证owner/repo、默认分支和权限，不能沿用本次 `UNCONFIRMED` 证据。
- 本任务仅增加本地审计、测试和证据；可使用实现提交的 `git revert` 回滚，不得用破坏性reset覆盖用户材料。

## 9. 下一任务

- 唯一允许开始：`M0-004 初始化pnpm workspace与Turborepo`，仅限本地工程。
- 远程目标确认可在后续独立同步，但确认前PR、CI、Issue和push持续为 `BLOCKED_EXTERNAL/NOT_EXECUTED`。
- 禁止提前执行M0-005及以后、业务功能或任何生产操作。
