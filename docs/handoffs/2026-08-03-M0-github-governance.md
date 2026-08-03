# M0-GATE GitHub治理配置交接

## 1. 范围与身份

- 仓库：`EasyStep-lee/flt1`（private）
- 默认分支：`main`
- 开发分支：`codex/m0-m0-handoff`
- 执行任务：`M0-GATE`前置治理配置
- 授权人工及当前唯一直接协作者：`EasyStep-lee`
- 非目标：不合并PR、不进入M1、不配置虚假秘密、不触发预发布或生产部署。

## 2. 正式CODEOWNERS

- 正式文件：`.github/CODEOWNERS`
- 删除占位模板：`.github/CODEOWNERS.example`
- 当前所有责任路径映射到真实GitHub账号`@EasyStep-lee`。
- 明确覆盖：全仓、Prisma迁移、支付、福利卡、权限、配送和`.github`治理文件。
- 后续增加独立数据库、财务、安全或物流责任人时，应在对应路径追加真实账号或团队；不得恢复占位账号。

## 3. GitHub Environments

| Environment | 创建状态 | 允许部署分支 | 必需审批人 |
|---|---|---|---|
| `staging` | `CONFIGURED` | 仅`main` | 未配置 |
| `production` | `CONFIGURED` | 仅`main` | `BLOCKED_BY_GITHUB_PLAN` |

`production`必需审批人曾尝试配置为真实账号`EasyStep-lee`，GitHub返回HTTP 422，明确提示当前计费方案不支持required reviewers保护规则。因此不得记录为审批规则已启用。若正式生产工作流需要GitHub原生审批，必须升级到支持该规则的方案或迁移到支持审批的组织仓库后重新配置并复核。

## 4. Actions Secrets决定

- 仓库级Actions Secrets：空。
- `staging` Environment Secrets：空。
- `production` Environment Secrets：空。
- 当前`.github/workflows/ci.yml`没有任何`secrets.*`引用，M0质量CI不需要外部秘密。
- 当前服务端配置Schema中只有`DATABASE_URL`和`REDIS_URL`是必需秘密；真实预发布/生产基础设施、账号和责任人尚未提供，禁止写入开发占位值或猜测值。
- 微信AppSecret、微信支付API v3密钥、证书私钥及后续第三方令牌属于后续阶段外部输入，不得在M0提前创建假值。
- 真实秘密只能由具名人工在GitHub Environment、部署平台或受控密钥系统中输入，不进入聊天、Git、文档、截图或测试产物。

## 5. 验证与证据边界

- GitHub API复核两个Environment均为`custom_branch_policies=true`，且各自唯一部署分支策略为`main`。
- `gh secret list --repo EasyStep-lee/flt1`及两个Environment Secret清单均为空。
- CODEOWNERS契约测试先因正式文件不存在而失败`6/7`，实现后通过`7/7`。
- 本配置没有Schema、Migration、OpenAPI、DTO、错误码、业务页面或业务P0变化。
- GitHub设置完成不等于PR已合并或`M0-GATE`已通过；M1继续锁定。

## 6. 回滚

- CODEOWNERS代码回滚：对本治理提交执行`git revert <commit-sha>`，不得改写公共历史。
- Environment设置回滚：由仓库管理员在GitHub Settings中删除对应Environment或部署分支策略；删除前确认没有部署记录、Environment Secret或活动部署。
- 当前两个Environment没有Secret，也没有由本次操作触发的部署。
