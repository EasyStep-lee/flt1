# M0-GATE GitHub治理配置交接

## 1. 范围与身份

- 仓库：`EasyStep-lee/flt1`（public）
- 默认分支：`main`
- 开发分支：`codex/m0-m0-handoff`
- 执行任务：`M0-GATE`前置治理配置
- 授权人工及当前唯一直接协作者：`EasyStep-lee`
- 开发/审核模式：单人开发、单一授权审核人、只使用现有GitHub账号
- 非目标：不合并PR、不进入M1、不配置虚假秘密、不触发预发布或生产部署。

## 2. 正式CODEOWNERS

- 正式文件：`.github/CODEOWNERS`
- 删除占位模板：`.github/CODEOWNERS.example`
- 当前所有责任路径映射到真实GitHub账号`@EasyStep-lee`。
- 明确覆盖：全仓、Prisma迁移、支付、福利卡、权限、配送和`.github`治理文件。
- 用户已明确不新增GitHub账号；当前及后续治理均以现有`@EasyStep-lee`为唯一代码责任人，不得恢复占位账号。

## 3. GitHub Environments

| Environment | 创建状态 | 允许部署分支 | 必需审批人 |
|---|---|---|---|
| `staging` | `CONFIGURED` | 仅`main` | 未配置 |
| `production` | `CONFIGURED` | 仅`main` | `NOT_CONFIGURED`；单人模式采用人工发布授权 |

仓库为private时，`production`必需审批人配置曾返回HTTP 422；仓库改为public后，实时GET只显示`branch_policy`，没有required reviewer。当前只能记录为`NOT_CONFIGURED`，不能继续写成套餐必然不支持，也不能写成已启用；未经用户对该设置明确授权不得修改。正式生产仍必须由同一授权人工明确批准，且M0不执行生产部署。

## 4. 单人审核规则

- 唯一授权审核责任人：`@EasyStep-lee`；不邀请、不创建第二个GitHub账号。
- GitHub不允许PR作者批准自己的PR，因此使用`DOCUMENTED_SELF_REVIEW`记录，不伪造`APPROVED`状态。
- 自审必须核对精确head SHA、最新CI、实际diff、P0/P1、迁移、秘密扫描和回滚，并明确写出“自审通过、允许合并”。
- 在该明确结论出现前，人工审核保持`NOT_EXECUTED`；Codex不得替授权人写成已审核或自行合并。

## 5. Actions Secrets决定

- 仓库级Actions Secrets：空。
- `staging` Environment Secrets：空。
- `production` Environment Secrets：空。
- 当前`.github/workflows/ci.yml`没有任何`secrets.*`引用，M0质量CI不需要外部秘密。
- 当前服务端配置Schema中只有`DATABASE_URL`和`REDIS_URL`是必需秘密；真实预发布/生产基础设施、账号和责任人尚未提供，禁止写入开发占位值或猜测值。
- 微信AppSecret、微信支付API v3密钥、证书私钥及后续第三方令牌属于后续阶段外部输入，不得在M0提前创建假值。
- 真实秘密只能由具名人工在GitHub Environment、部署平台或受控密钥系统中输入，不进入聊天、Git、文档、截图或测试产物。

## 6. 验证与证据边界

- GitHub API实时确认仓库可见性为`public`；`main`返回`Branch not protected (HTTP 404)`，Rulesets为`[]`。
- GitHub API复核两个Environment均为`custom_branch_policies=true`，且各自唯一部署分支策略为`main`。
- `gh secret list --repo EasyStep-lee/flt1`及两个Environment Secret清单均为空。
- CODEOWNERS契约测试先因正式文件不存在而失败`6/7`，实现后通过`7/7`。
- 本配置没有Schema、Migration、OpenAPI、DTO、错误码、业务页面或业务P0变化。
- GitHub设置完成不等于PR已合并或`M0-GATE`已通过；M1继续锁定。

## 7. 合并前证据漂移处置

- 用户曾对head `0ad4dc64abd1523f70fd95f4ebcd39121bb49d08`明确回复“自审通过，允许合并”，记录在PR评论`5173829395`。
- 合并前实时复核发现该head仍将仓库写成private并保留HTTP 403套餐结论，与当前public/未配置保护事实冲突。
- 合并已暂停，旧head授权标记为`SUPERSEDED_BEFORE_MERGE`；证据修正提交和新CI完成后必须重新审核新head。

## 8. 回滚

- CODEOWNERS代码回滚：对本治理提交执行`git revert <commit-sha>`，不得改写公共历史。
- Environment设置回滚：由仓库管理员在GitHub Settings中删除对应Environment或部署分支策略；删除前确认没有部署记录、Environment Secret或活动部署。
- 当前两个Environment没有Secret，也没有由本次操作触发的部署。
