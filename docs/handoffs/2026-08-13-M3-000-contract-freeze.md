# M3-000 契约冻结交接

阶段结论：`IN_PROGRESS / LOCAL_PASS`。本切片已形成可编码 M3 契约，但尚未提交、取得 Draft PR 精确 head CI 或人工合并；M3 的 45 项业务 P0 全部保持 `NOT_EXECUTED`，`M3-P020` 仍锁定。

## 基线与 GitHub

- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，本轮校验通过。
- M2-GATE：PR #74 按授权精确 head `5c00e74d2d0f4bd6a7368f368a01e19a4425e68e` 转 Ready 并合并。
- M2-GATE merge commit：`6cbe9460109c3b0ed5eb4ba307eec4c2cb5d23d9`。
- 合并后 main CI：run `31686758134` / job `94404518581`，对应上述 merge commit，`CI_PASS`。
- 当前任务：Issue #75，分支 `codex/m3-contract-freeze`，基线为上述 merge commit；Draft PR 尚未创建。

## 唯一目标与非目标

目标是冻结用户/企业主体、购物车、跨供应商订单、福利卡、微信支付、退款、库存、供应商履约子单、客户端适配和门户缓存隔离的字段、状态、权限、DTO、错误码、失败行为与 P0 追踪。

非目标：不创建 M3 迁移，不实现交易运行时或页面，不接真实微信/银行，不创建 M4 配送单，不进入 M5 对账结算，不把契约测试冒充业务验收。

## 冻结结果

- 232 个字段全部解析为明确类型、格式、校验和 P0；修正草案错误：`ConsumerAddress.lat` / `EnterpriseAddress.lat` 从错误的时间类型改为 `Decimal(10,7)`，`WelfareCardProgram.canPayDeliveryFee` 从错误的金额类型改为 `Boolean`。
- 34 个状态转换、6 个职能、39 个页面、25 个 API、6 个计划迁移进入机器可读冻结制品。
- 福利卡资金来源严格为 `ENTERPRISE_GRANT`、`COMPANY_GIFT`、`PHYSICAL_CARD_OR_CODE`，个人充值 API、路由、配置、枚举占位均禁止。
- 个人线上现金严格为 `WECHAT_PAY`；企业支付为公司微信或对公转账，个人不暴露对公转账。
- 金额为整数分；福利卡加微信满足资金分配守恒；退款按原支付结构且累计不超过实付。
- 跨供应商库存预扣全有或全无；预扣、确认、释放具有业务键幂等。
- 小程序仅经 `miniapp-kit` 的 `wx.request` 适配器复用生成契约类型；门户登录、预览、交易区 `noindex` 且 `private/no-store`。
- M3 不创建个人或企业配送执行对象，只冻结供 M4 消费的 outbox 边界。

## 先红后绿证据

- RED：`node --test tests/contracts/m3-contract-freeze.contract.test.mjs`，退出码 `1`；4/4 因冻结制品和生成器不存在而失败，原因符合预期。
- GREEN：同命令退出码 `0`，4/4 通过；同时验证生成器两次输出逐字节一致且与受控制品一致。
- focused lint：M3 生成器、同步器及契约测试 `eslint --max-warnings=0` 通过。
- 总控工作簿：使用 `@oai/artifact-tool` 完成 12 个工作表前后渲染、关键范围检查和公式错误扫描；未发现 `#REF!/#DIV/0!/#VALUE!/#NAME?/#N/A`。
- 完整 `pnpm verify`：`2026-08-13T10:27:15.371Z` 至 `10:42:11.925Z`，17/17 步骤全部通过，退出码 `0`；包含 workspace、lint、确定性 OpenAPI/breaking、typecheck、unit、regression、API、foundation/P0 E2E、Prisma validate、迁移完整性、MySQL 迁移演练、build 和受跟踪文件秘密扫描。测试中的本机代理 `ECONNREFUSED` 是预期失败恢复输入，不是失败步骤。

## P0 与环境边界

- M3 的 45 个 P0 只建立 `M3-Pxxx`、契约引用和每项至少三条负向行为映射，证据仍为 `NOT_EXECUTED`。
- local：契约 focused 4/4、合同回归 87/87、`pnpm test` 及完整 `pnpm verify` 17/17 均为 `LOCAL_PASS`。
- 当前分支 CI、staging、真机、production：`NOT_EXECUTED`。
- 真实微信支付/退款、对公转账、法务文本、真机授权及生产发布仍属人工/外部边界。

## 风险与回滚

- 风险：枚举会随实际纵向实现进一步收窄，但不得扩展为个人充值、支付宝、供应商收款或 M3 配送执行；任何改变资金责任或经营主体的变更必须人工确认。
- 本切片无数据库、外部服务或生产状态变更。回滚使用受审 PR 的 `git revert`；工作簿和 CSV 与冻结制品必须同一提交回退，不改写公共历史。

## 下一步与禁止范围

先运行完整 `pnpm verify`，复核 diff，创建原子提交并推送 Draft PR，读取精确 head Actions 与未解决评论。只有该 PR 经人工精确 head 授权合并且合并后 main CI 成功，才能将 M3-000 标记完成并进入 `M3-P020`。当前明确禁止开始 `M3-P020`、M4、M5、M6 或真实资金操作。
