# M2-P008 供应商独立价格页面交接

## 结论与边界

- 结论：`LOCAL_PASS`；Draft PR #42 已存在，但多商品未知结果保护修复改变了 head，新 head 精确 CI、人工合并和合并后 `main` CI 均为 `NOT_EXECUTED`。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@15a10daae913e2dae8c97f3a47d92ef1497a3c1e`；分支 `codex/m2-supplier-pricing`；验证绑定提交 `0e24a1d7f3cd49388a52faf09d1242e2e8dab483`；Issue [#41](https://github.com/EasyStep-lee/flt1/issues/41)；Draft PR [#42](https://github.com/EasyStep-lee/flt1/pull/42)。
- 唯一范围：`P0-008`、PAGE-018、API-022 和任务内细化 API-090；供应商价格职能提交 SKU 完整集合的初始供应价、个人零售价和企业集采价。
- 明确未进入：上架后供应价审批、零售/集采销售价即时调价、P0-019、P0-071、分类模板、库存、货架、订单、支付、配送；`M2-P009` 保持锁定。

## 实际变更

- 新增 `SUPPLIER_PRICING` 固定会话解析、策略、DTO、服务和控制器；供应商归属只能从会话派生。
- 新增 `GET /v1/supplier/pricing/products`（API-090）与 `PUT /v1/supplier/pricing/products/{supplierProductId}/initial-prices`（API-022），响应为显式 DTO 白名单并使用 `private, no-store`。
- PAGE-018 读取本供应商商品与 SKU，校验非负安全整数分、完整且唯一的 SKU 集合，提交未知结果时以完全相同的 body 和 `Idempotency-Key` 恢复。
- PR 审计追加双商品未知结果保护：任一商品结果未知时冻结其他商品输入和提交，只允许原商品按原请求恢复；成功后再解锁，防止单一待恢复请求被覆盖。
- PAGE-017 商品资料页不请求、渲染或缓存三类价格；客户端提交任何归属字段会被递归拒绝。
- 冻结初始价格快照只追加；同键并发重放返回相同结果，同键不同载荷冲突，存在待审任务时拒绝第二次申请。
- 公司价格审核只能批准或驳回冻结报价，不能静默改写价格；审计只记录状态/版本，不写三价，审计失败导致完整事务回滚。

## 数据、迁移、OpenAPI 与回滚

- 无新增 Prisma 迁移；复用 M2-P007 的 `ApprovalTask`、历史、命令和审计模型。
- Prisma 实现使用行锁并在同一事务写入价格快照、审批历史、审计和幂等响应。
- 确定性 OpenAPI 与共享类型已生成；API-090 作为 M2-P008 的任务内契约细化追加到 API 台账，冻结的 M2-000 初始契约保持不改写。
- 关键错误：`PRICE_INVALID`、`SUPPLIER_SCOPE_FORBIDDEN`、`WORKSPACE_FORBIDDEN`、`INITIAL_PRICE_STATE_INVALID`、`INITIAL_PRICE_REVIEW_PENDING`、`IDEMPOTENCY_CONFLICT`、`AUDIT_REQUIRED`。
- 回滚：可回退本分支应用提交到 `main@15a10da`；本切片没有数据库迁移。若已产生开发环境价格审核快照，应保留追加历史并用前向业务补正处理，不原地删除审计记录。

## 测试证据

| 证据 | 命令/结果 | 状态 |
| --- | --- | --- |
| RED | focused API 首跑因 API-022 不存在返回 404 | 已确认 |
| API focused | M2-P008 与相邻 P007 API 测试 14/14，其中 P008 8/8 | PASS |
| PAGE-018 focused | Playwright 4/4；新增 NEG-M2-008-06 先失败后通过 | PASS |
| 契约回归 | `test:m1-contract` 49/49；交接契约 23/23 | PASS |
| 全量门禁 | `pnpm verify`，`PNPM_VERIFY_OK:steps=17:base=HEAD` | PASS |
| P0 E2E | 全仓 31/31 | PASS |
| Prisma | schema validate 通过；13 条迁移链 `empty=2 / upgrade=2 / restore=2 / product=13 / cleanup=PASS` | PASS |
| OpenAPI | generate/diff/check 与 oasdiff breaking 门禁通过 | PASS |
| 秘密扫描 | 573 个已跟踪文件通过 | PASS |

完整报告：`artifacts/test-results/verification/pnpm-verify.json`；切片证据：`artifacts/verification/M2-P008/supplier-pricing.json`。

## P0、环境与风险

- P0-008：`LOCAL_PASS`。供应商商品页不含价格；独立价格页可设置并提交三价；公司不得静默改价。
- P0-019、P0-071：`NOT_EXECUTED`，不得由本切片推断完成。
- CI、staging、生产：`NOT_EXECUTED`；本切片为 PC 浏览器功能，不要求微信真机，设备证据标记为 `NOT_REQUIRED_M2_P008_PC_BROWSER_ONLY`。
- 本地 API 失败恢复主要由内存仓储覆盖；真实 MySQL 证据为完整迁移链演练，不等同于 staging/生产业务验收。
- 非阻塞警告：公司/供应商后台构建 chunk 超过 500 kB；Ant Design 存在 `Spin.tip`、`Card.bordered` 弃用提示。本切片不做跨范围性能重构。

## GitHub 门禁与下一步

- PR #40 已按精确 head 授权合并，`main@15a10da` 的 Actions run `31311672836` 成功，M2-P008 因此解锁。
- 当前 Issue #41；Draft PR #42 已创建。旧 head `fd42a00` 的 Actions run `31316158183` 成功且评论/review thread 为 0，但该 CI 不替代修复后新 head 的精确 CI。
- 下一动作仅为提交证据收尾、推送新 head、读取对应 Actions 与未解决评论。
- 未经用户对届时精确 head 的明确授权不得转 Ready 或合并；人工合并且合并后 `main` CI 成功前，不得开始 M2-P009。
