# M2-P021 商品详情与价格隔离交接

## 结论与边界

- 当前结论：`LOCAL_PASS / IN_PROGRESS`。实现提交 `9b27b398777e8d1399adc6b40fbbf81fccabada1` 已完成 focused 行为测试；台账同步、完整 `pnpm verify`、Draft PR 和 exact-head CI 尚未完成。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@d8da461fa3884ec4fbd7a92403b610f7f3ac70aa`；分支 `codex/m2-product-detail-price-isolation`；Issue [#65](https://github.com/EasyStep-lee/flt1/issues/65)；PR 尚未创建。
- 唯一范围：`P0-021`。个人详情只显示零售销售价，企业采购详情只显示企业集采销售价；供应价、供应价快照、应付金额和内部毛利不得进入对客 DTO、OpenAPI、页面状态、缓存或埋点。
- 明确未进入：`M2-P061` 及以后任务、M3 企业认证和采购交易、订单、支付、配送、正式数据、staging、真机和生产。

## 前序 GitHub 门禁

- PR [#64](https://github.com/EasyStep-lee/flt1/pull/64) 最终 head `5c66ed1147e44dad53ab8a29e77f7b71e692111c` 的 Actions run `31564008036`、job `94012014445` 成功。
- 用户按该精确 head 授权后，PR #64 合并为 `main@d8da461fa3884ec4fbd7a92403b610f7f3ac70aa`；合并后 main run `31564696638`、job `94014030429` 成功，因此 P021 起点有效。

## 实际变更

- 保留公开个人接口 `GET /v1/catalog/products/{productId}`，响应白名单只含 `retailSalePrice`，继续允许公共缓存。
- 新增企业私有接口 `GET /v1/enterprise/catalog/products/{productId}`，响应白名单只含 `enterpriseSalePrice`，固定 `private/no-store/noindex`。
- 新增递归价格隔离策略：供应价、供应价快照、应付金额和毛利返回 `SENSITIVE_FIELD_LEAK`；错误渠道售价返回 `FIELD_FORBIDDEN`。
- Prisma 商品详情查询改用显式字段 `select`，不查询 `approvedSupplyPrice`。
- 企业门户固定页面 `/enterprise/procurement/products/[productId]` 使用生成契约和 `openapi-fetch`；用户小程序仍只消费个人零售价。
- 企业会话使用 `__Host-fulishe-enterprise-portal` Cookie；生产默认解析器拒绝访问，真实企业认证由 M3 接入，不以测试桩冒充完成。

## 新鲜测试证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED focused API | 3 项中 2 项因企业路由不存在返回 404 失败，退出码 1 | 已确认 |
| 隔离策略 unit | 3/3 | PASS |
| Prisma 查询与策略 | 6/6 | PASS |
| API Supertest | 4/4；个人价、企业价、未认证 401、非集采商品 409 | PASS |
| OpenAPI 契约 | 2/2 | PASS |
| 用户小程序详情 | 8/8；污染字段不进入页面状态 | PASS |
| 企业门户运行时 | 1/1 | PASS |
| P021 Playwright | 1/1；两端 HTML、头部和敏感字段隔离 | PASS |
| OpenAPI generate/check | 字节一致 | PASS |
| 完整 `pnpm verify` | 尚未执行 | NOT_EXECUTED |
| 当前提交 CI | PR 尚未创建 | NOT_EXECUTED |

## 数据、环境、风险与回滚

- 数据库迁移：不需要。既有 `Product/Sku` 已有集采标识和两类对客销售价，本切片只收紧查询与响应边界。
- 本地 focused 证据：`LOCAL_PASS`；CI、staging、device、production 均为 `NOT_EXECUTED`。
- 企业真实登录为 M3 边界，当前生产默认解析器拒绝所有企业会话；测试注入解析器只验证本切片授权后价格白名单，不升级为真实认证证据。
- 风险：M3 接入真实会话时必须继续从服务端会话派生企业身份，并保留当前私有缓存和 DTO 白名单；不得增加客户端 `channel` 或 `enterpriseId` 选择。
- 回滚：回退本切片提交；无迁移、无正式数据回填，不改写历史。

## 唯一下一步

同步机器台账并在干净提交上运行完整 `pnpm verify`，随后推送并创建 Draft PR，读取 exact-head Actions。PR 未经用户对精确 head 授权转 Ready/合并且合并后 main CI 未通过前，不进入 `M2-P061`。
