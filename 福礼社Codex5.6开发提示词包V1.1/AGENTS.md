# 福礼社开发执行规则

## 1. 唯一产品基线

- 唯一产品方案：`福礼社单商户供应链平台V1.1综合方案.html`。
- 提示词包生成时方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 若哈希变化，先重新完整阅读并确认是否为用户批准的新基线；不得用旧版本覆盖。
- 原V29及更早方案只可作为历史背景，不是开发输入。
- UI图片是表现层基线，不得覆盖第零章、第二章及业务状态机、数据模型和P0验收规则。

## 2. 角色定位

你是开发执行模型，不是产品经理。不得重新设计经营主体、价格审核、订单、支付、配送、结算或权限边界。

可以在不改变业务结果的前提下选择合理实现细节。任何会改变产品范围、资金责任、法律责任、数据归属或外部系统范围的假设，必须停止并请求用户决定。

## 3. 锁定业务边界

1. 江苏福礼团供应链科技有限公司是唯一对客销售、收款、开票、退款和售后主体。
2. 供应商是上游供货协作方，不是店铺，不直接收款。
3. 公司和供应商每个职能账号进入固定独立页面与单职能会话。
4. 首次上架需要商品资料审核和三类初始价格审核同时通过。
5. 上架后供应价变更必须审核；平台零售价和集采销售价免审生效并留痕。
6. 供应价仅公司价格/财务及对应供应商价格/财务职能可见。
7. 个人与企业共用Product/Sku、分类模板、图文和每个Sku唯一InventoryBalance。
8. 个人和企业订单均可跨供应商，但客户只向公司提交一个主订单并结账一次。
9. 个人可使用福利卡、微信支付或福利卡加微信支付；P0不接入支付宝等其他现金通道。
10. 系统不提供个人现金充值；福利卡资金只来自企业福利发放、公司活动赠送和实体卡/兑换码。
11. 企业可使用公司微信支付或经配置的对公转账，不使用个人福利卡。
12. 个人主订单按供应商拆履约子单，每个有效子单至多一个跑腿任务。
13. 跑腿任务必须同时固化供应商取货点和用户目的地，按取货前后调用本人手机地图。
14. 企业采购由公司汇总和统一配送，绝不生成DeliveryTask或进入抢单大厅。
15. 公司与供应商线上对账、线下结算，不建设供应商钱包、提现或自动打款。
16. “社区集采”是持续开放的企业采购入口，不是指定社区、时间、团长或成团业务。
17. 一人可持有多个职能账号，但maker-checker、申请/审核和制单/复核必须按自然人identityId隔离；同一自然人不得切换账号自审，超级管理员也不能绕过。

## 4. 阶段纪律

- 依次执行M0至M6；前一阶段没有新鲜验收证据时不得宣布进入下一阶段。
- 当前任务必须写明所属阶段、目标、非目标、P0编号和完成定义。
- 不允许为了页面展示提前伪造后端、支付、库存、物流或财务闭环。
- 不允许把后续阶段功能混入当前切片。
- 需要并行时使用独立git worktree，禁止两个代理同时修改同一文件或同一迁移链。

## 5. 固定开发顺序

1. 阅读当前方案章节、现有代码和AGENTS.md。
2. 写任务边界、字段字典、状态机、权限矩阵、P0映射。
3. 更新或新增OpenAPI、DTO和错误码。
4. 先写会失败的测试并确认失败原因正确。
5. 实现数据库迁移、领域规则、接口和前端。
6. 运行focused tests。
7. 运行`pnpm verify`及迁移演练。
8. 复核diff、敏感字段、权限、幂等、回滚和历史快照。
9. 生成验收证据与交接记录。

## 6. 工程约定

- TypeScript + pnpm workspace + Turborepo。
- NestJS + Prisma + MySQL 8；Redis + BullMQ。
- 公司/供应商后台：React + Vite + Ant Design + TanStack Query。
- 企业门户：Next.js App Router + React + Ant Design + TanStack Query；公开区使用静态生成/ISR，登录与交易区使用私有动态渲染并noindex。
- 用户和跑腿端：相互独立的原生微信小程序 + TypeScript。
- OpenAPI：`@nestjs/swagger`经确定性脚本生成spec，`openapi-typescript`生成统一类型；Web用`openapi-fetch`，原生小程序通过`miniapp-kit`的`wx.request`适配器复用同一类型。
- 测试：Vitest + Supertest + Playwright。
- 部署：Docker + CI/CD。
- 金额一律使用整数分；禁止浮点金额计算。
- 时间存储、展示和账期必须使用明确时区。
- 账本、审核、价格、库存、物流节点、对账调整和付款记录采用追加或冲正，不覆盖历史。
- 数据库实体不得直接序列化到对客响应；使用独立DTO白名单。
- 每个Sku只能有一条InventoryBalance作为可成交库存真源。

## 7. 测试与质量门槛

每个业务切片必须覆盖：正常路径、越权、重复请求、并发、幂等、状态冲突、失败恢复、历史快照和敏感字段泄露。

完整质量链：

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:api
pnpm test:e2e:p0
pnpm prisma:validate
pnpm prisma:migrate:dry-run
pnpm openapi:generate
pnpm openapi:check
pnpm build
pnpm verify
```

不得把旧命令输出当作当前修改的验收证据。

## 8. 外部依赖与人工边界

- 不得请求用户把生产密钥粘贴到聊天中。
- 只提交`.env.example`和配置schema，不提交真实秘密。
- 微信支付、短信、对象存储等外部服务必须通过Adapter和可替换测试桩接入。
- 缺少真实账号时，完成可验证的本地Adapter、契约测试和明确的`BLOCKED_EXTERNAL`记录，不伪造真机或生产成功。
- 真实支付、退款、银行转账、小程序审核、法务合规和生产发布必须由授权人工批准。

## 9. 完成报告

每次完成必须报告：

- 当前阶段与任务；
- 实际修改文件；
- schema/migration/OpenAPI/DTO/错误码变化；
- 运行的测试命令及结果；
- P0映射与证据状态；
- 未执行的真机、预发布、生产和人工合规项；
- 残余风险与回滚方法；
- 下一项允许执行的任务。

没有证据的事项必须标为`NOT_EXECUTED`或`BLOCKED_EXTERNAL`，不得写成已完成。

## 10. GitHub协作与交付

### 10.1 操作上下文

- GitHub仓库必须由用户给出`owner/repo`、URL或可验证的本地`origin`确定；目标不明确时不得猜测或向任意远程写入。
- 结构化读取或更新Issue、PR、评论和标签时优先使用已安装的GitHub连接器；本地分支、提交、推送、当前PR发现及GitHub Actions日志使用`git`/`gh`补足，并保持本地checkout与远程PR一致。
- GitHub Actions失败必须读取真实Actions日志；不能仅凭连接器摘要、检查名称或本地结果推断根因。
- 不得索取或输出GitHub Token。认证由用户通过连接器、系统凭据或`gh auth login`完成。

### 10.2 授权边界

在“开发、修改、修复”任务中，授权Codex：

- 只读检查`git status`、分支、提交、远程和PR/Issue状态；
- 创建`codex/`前缀的开发分支；
- 只暂存本任务实际修改的文件并创建原子提交；
- 推送开发分支；
- 创建或更新Draft PR；
- 根据PR评论和CI日志修复本任务引起的问题并再次推送。

未经用户对具体动作明确批准，不得：

- 不得直接修改、提交或推送`main`；
- 合并或关闭PR；
- 强制推送、改写公共历史、删除远程分支或标签；
- 修改仓库成员权限、Secrets、分支保护、GitHub Environment或Actions授权；
- 创建正式Release、部署生产或执行生产迁移。

### 10.3 开始前检查

每个切片开始先运行并记录：

```text
git status --short
git branch --show-current
git remote -v
git log -5 --oneline
gh auth status
```

- 可运行`git fetch --prune`刷新远程引用，但不得在脏工作树上盲目`pull`、`rebase`或覆盖用户改动。
- 若当前分支已有对应PR，继续该PR；否则从已验证基线创建`codex/m{阶段}-{slug}`。
- 不允许两个代理或工作区同时修改同一文件、同一Prisma迁移链或同一PR分支。

### 10.4 分支、提交与PR

- 每个可独立验收的纵向切片使用独立分支和PR；同一P0簇的小变更可合并，但不得把M0-M6放入一个巨大PR。
- 分支格式：`codex/m0-foundation`、`codex/m3-welfare-wechat-payment`或`codex/m{阶段}-{简短功能}`。
- 提交使用明确类型和阶段，例如`feat(m2): implement supplier price approval`、`fix(m3): prevent duplicate welfare card debit`、`test(m4): cover concurrent runner claiming`。
- 禁止用`git add -A`无审查地混入用户或无关文件；禁止用`--no-verify`绕过门禁。
- PR默认Draft，标题包含阶段和功能。正文必须包含：对应Issue、范围/非范围、方案章节、P0编号、迁移/OpenAPI/页面变化、测试证据、截图、风险、回滚、外部/人工缺口。
- PR需要关联并在满足条件时关闭对应Issue；不得把Issue关闭当作验收通过。

### 10.5 CI与合并门禁

- Pull Request和`main` push的CI至少执行冻结安装、lint、typecheck、unit、API、P0 E2E、Prisma validate、migration dry-run、确定性OpenAPI生成/差异/类型/破坏性变更检查和build。
- Actions失败时先读对应运行和失败job日志，修复根因；不得删除测试、降低断言或跳过检查使CI变绿。
- 只有PR最新提交对应的必需检查全部成功，才能标记`CI_PASS`或Ready for review。
- 未解决P0/P1评论、必需检查失败、分支落后导致验证失效、迁移冲突或P0证据缺失时不得建议合并。
- PR由授权人工最终审查和合并。合并后必须以`main`最新提交重新核验阶段门禁，才允许开始下一阶段。

### 10.6 GitHub交付报告

每次GitHub交付必须报告：仓库、基线分支、开发分支、提交SHA、PR/Issue链接、Draft/Ready状态、最新CI运行及对应提交、未解决评论、是否已合并、回滚提交或方法。不能把“已推送”写成“CI已通过”，也不能把“技术可合并”写成“已合并/已上线”。
