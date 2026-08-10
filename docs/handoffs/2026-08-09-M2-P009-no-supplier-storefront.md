# M2-P009 无供应商店铺边界交接

## 结论与边界

- 结论：`LOCAL_PASS`；Draft PR、精确 head CI、人工合并和合并后 `main` CI 均为 `NOT_EXECUTED`。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@590a7708439afe40d4b2259fd346a9638bdbaf6f`；分支 `codex/m2-no-supplier-storefront`；实现与本地验证提交 `834d0dc9ae75908f261122e3c83f7da168642bec`；Issue [#43](https://github.com/EasyStep-lee/flt1/issues/43)。
- 唯一范围：`P0-009`，禁止消费者侧供应商装修页、供应商独立收款/结算、店铺购物车和店铺优惠券。
- 明确未进入：`P0-010`“看他还卖什么”、分类模板、库存、货架、购物车、优惠券、订单、支付、结算和任何数据库迁移。

## 实际变更

- 新增可执行运行时策略，允许供应商后台供货协作，递归拒绝公开请求/响应中的店铺、供应商支付账户、店铺购物车和优惠券归属字段。
- `GET /v1/public/merchant-profile` 对三类越界选择器返回 `FORBIDDEN_CAPABILITY`，仍只返回公司统一销售、收款和退款主体白名单。
- 新增确定性仓库检查器，覆盖消费者路由、公开 OpenAPI DTO、Prisma 模型和 13 条迁移建表语句；供应商职能后台路径保持允许。
- 门户首页新增 P0-009 责任边界区，继续使用 Next.js SSG/ISR，只展示公司统一货架、结账和服务边界。
- OpenAPI 与共享类型已确定性生成；错误码台账、页面/P0/证据/阶段台账、项目状态和 12 张工作表已同步。

## 数据、迁移、权限、错误码与回滚

- 无新增 Prisma 模型、字段或迁移；不创建店铺、支付账户、店铺购物车或店铺优惠券实体。
- 公开访问只允许读取公司主体白名单；供应商商品职能的供货协作不受影响，但不会获得对客店铺或收款能力。
- 新增安全错误：`FORBIDDEN_CAPABILITY`；无外部副作用、资金或库存写入。
- 回滚：回退应用提交 `834d0dc`；本切片无迁移和数据清理。回滚后会失去新增运行时/仓库门禁和门户责任说明。

## 测试证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED | 策略与检查器模块缺失；API 3 项返回 `REQUEST_INVALID`；门户缺少 P0-009 区 | 已确认 |
| 策略 focused | 4/4 | PASS |
| 仓库契约 focused | 4/4；schema=1、migration=13、OpenAPI path=30、route file=164 | PASS |
| API focused | 7/7 | PASS |
| 门户 focused | Playwright 1/1；公开首页仍静态生成/ISR | PASS |
| 全量门禁 | `pnpm verify`，`PNPM_VERIFY_OK:steps=17:base=HEAD` | PASS |
| P0 E2E | 32/32 | PASS |
| Prisma | validate、迁移完整性和迁移 rehearsal | PASS |
| OpenAPI | generate/diff/check 与 oasdiff breaking | PASS |
| 秘密扫描 | 579 个已跟踪文件 | PASS |

完整报告：`artifacts/test-results/verification/pnpm-verify.json`；切片证据：`artifacts/verification/M2-P009/no-supplier-storefront.json`。

## P0、环境与风险

- P0-009：`LOCAL_PASS`。运行时策略、API、公开页面与仓库结构扫描均有新鲜行为证据。
- CI、staging、生产：`NOT_EXECUTED`；本切片只含 PC 门户与策略门禁，微信真机为 `NOT_REQUIRED_M2_P009_PC_BROWSER_AND_POLICY_ONLY`。
- 仓库扫描是结构防线，不能替代运行时策略；二者均已纳入测试。未来公开目录/DTO必须继续通过同一门禁。
- 非阻塞警告：既有前端 chunk 超过 500 kB、Ant Design `Spin.tip`/`Card.bordered` 弃用提示和测试代理拒绝连接日志；均未导致门禁失败，本切片不跨范围重构。

## GitHub 门禁与下一步

- PR #42 已按精确 head `23397b8e...` 授权合并为 `main@590a770`；合并后 Actions run `31346326144` 成功，P0-008 因此达到 `CI_PASS` 并解锁本切片。
- 当前 Issue #43；Draft PR 尚未创建，PR CI、评论和合并状态均为 `NOT_EXECUTED`。
- 下一动作仅为提交证据收尾、推送本分支、创建 Draft PR，并读取精确 head Actions 与未解决评论。
- 未经用户对届时精确 head 的明确授权不得转 Ready 或合并；合并后 `main` CI 成功前不得开始 M2-P010。
