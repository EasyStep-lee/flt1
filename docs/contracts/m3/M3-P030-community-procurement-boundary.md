# M3-P030 社区集采边界契约

## 任务边界

- 阶段：M3。
- 唯一目标：将 PAGE-030 `/enterprise-procurement` 实现为持续开放的普通企业采购公开入口。
- 方案章节：§8 门户宣传与“社区集采”企业采购入口、§9 订单福利卡支付。
- P0：P0-030 社区集采边界。
- 用户故事：公众理解企业采购模式并进入企业注册/登录；认证企业从入口进入既有企业采购货架。
- 非目标：M3-P031 供应商备货；企业统一配送、收货、售后、发票执行；企业内部 OA、预算或采购审批；任何团购活动模型。

## 字段、状态、权限与接口

本切片不新增数据库字段、迁移、状态机、业务 API、DTO 或错误码。公开页只使用版本化静态公开内容，不能接收或持久化以下字段：

- `communityId`、`communityScope`；
- `leaderId`、`leaderCommission`；
- `campaignStartAt`、`campaignEndAt`、`countdownAt`；
- `groupThreshold`、`groupMemberCount`、`groupStatus`；
- `budgetApprovalId`、`procurementApprovalFlowId`、`oaWorkflowId`。

页面不得返回供应价、供应价快照、内部毛利、精确库存或企业用户数据。公开页是 `PUBLIC_SSG_ISR`；注册、登录、货架、采购车、结算、工作台和订单继续是 `noindex` 且 `private/no-store`。公开入口无登录权限要求；交易入口仍由现有服务端企业会话与权限校验控制。

## 成功与失败行为

- 成功：`GET /enterprise-procurement` 返回可抓取的服务端 HTML、唯一 metadata/canonical、结构化数据、企业注册/登录和认证后货架入口；明确长期开放、普通企业采购、无需指定社区/活动时段/成团门槛/团长。
- 失败：页面构建或运行失败时不得伪造业务状态；入口链接仍只指向已有受控路由。
- 禁止副作用：不得创建活动、团长、团单、企业审批或配送数据；不得把公开响应标记为私有，也不得把私有交易页放入 sitemap。

## 最小验收

1. 运行时 HTML 与 headers 验证公开 SSG/ISR、metadata/canonical、P0 标记和固定边界。
2. 验证企业注册、登录和认证后货架链接；验证 sitemap 包含公开入口。
3. 验证 HTML 不包含活动型交互/字段、供应价或内部经营字段。
4. focused portal test、P0 Playwright、全量门禁均通过后才登记本地证据。
