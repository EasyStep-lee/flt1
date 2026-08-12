# M2-P019 上架商品分级调价交接

## 结论与边界

- 当前结论：`LOCAL_PASS / IN_PROGRESS`。实现提交 `739b0b0d786406536a67762f01e599bbcdaded9f`、调度失败恢复加固提交 `007f065cdd4b12e30828fec1848d4b78b86f9dfc` 与完整验证 head `66a251160cf5229550c35dbd14f3e8a0660cd753` 已形成；真实 RED、focused API/契约/P0 E2E、OpenAPI、MySQL 迁移演练及完整 `pnpm verify` 通过。Draft PR、精确 head CI、自评与人工合并尚未执行。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@413adffe4e4276d3378e8218e99022193627e57a`；分支 `codex/m2-tiered-price-change`；Issue [#63](https://github.com/EasyStep-lee/flt1/issues/63)；PR 尚未创建。
- 唯一范围：`P0-019` 上架后供应价送审、销售价免审、立即/预约生效、版本/历史、幂等、并发、审计、两个固定职能页面。
- 明确未进入：M2-P020 及以后任务、订单、支付、退款、库存预扣、配送、正式价格数据、staging、真机和生产。

## 前序 GitHub 门禁

- PR [#62](https://github.com/EasyStep-lee/flt1/pull/62) 最终 head `37e9f103382a0a397cdbcbc848ae5aff2eed1d79` 的 Actions run [31492400216](https://github.com/EasyStep-lee/flt1/actions/runs/31492400216)、job `93781784327` 成功。
- 用户授权该精确 head 后，PR #62 合并为 `main@413adffe4e4276d3378e8218e99022193627e57a`；合并后 main run [31552935068](https://github.com/EasyStep-lee/flt1/actions/runs/31552935068)、job `93979305359` 成功，因此 P019 起点有效。

## 实际变更

- 新增 `SupplyPriceChangeRequest`、不可变 `SupplyPriceChangeHistory`、三类 `PriceChangeLog`、持久化 `PriceEffectOutbox` 与 `PriceChangeCommand`。
- 供应价提交时冻结旧价、申请价、基础版本、原因与约定生效时间；同 SKU 只允许一个 `SUBMITTED/APPROVED` 申请。
- 公司上架后供应价审核使用独立 `/v1/company/price-reviews/supply-price-changes/{taskId}/decision`，强制二次验证且审核人 `identityId` 必须不同于申请人；原 `/v1/company/price-reviews/{taskId}/decision` 保持首上架初始价格审核响应兼容。
- 已到生效时间的供应价按 `SUBMITTED → APPROVED → EFFECTIVE` 两次合法版本推进；未来生效写 outbox。
- 零售与企业集采销售价不创建审核任务，立即或预约增加各自版本并追加 `PriceChangeLog`；响应 `reviewCreated=false`。
- `price-effects` BullMQ 延迟任务在启动及每 30 秒扫描未处理 outbox；最终失败记录 `FAILED`，原幂等命令重试可移除失败任务并恢复调度。
- 供应商价格页新增上架后分级调价区；公司价格审核页新增旧价、申请价、涨跌比例、原因、生效时间和历史状态队列。

## 权限、DTO、状态机与错误码

- 供应商固定职能：`SUPPLIER_PRICING`，路由 `/supplier/workspaces/pricing`，只访问当前会话 `supplierId`。
- 公司固定职能：`COMPANY_PRICE_REVIEW`，路由 `/company-admin/workspaces/price-review`，只处理唯一公司价格审核队列。
- 客户端递归传入 `companyId/supplierId/identityId/functionalAccountId/buyerId` 统一拒绝；响应白名单不返回这些内部归属或自然人键。
- 主要错误码：`PRICE_CHANGE_PENDING`、`PRICE_INVALID`、`VERSION_CONFLICT`、`SELF_APPROVAL_FORBIDDEN`、`SECOND_VERIFICATION_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`AUDIT_REQUIRED`、`PRICE_EFFECT_SCHEDULE_FAILED`。
- 供应价不得进入公开、个人、企业采购、跑腿或普通日志；既有公开目录 DTO 未扩展供应价字段。

## 新鲜测试证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED focused API | 3/3 因三个行为接口返回 404 失败，退出码 1 | 已确认 |
| GREEN focused API | 9/9；旧价保持、异人审核、销售价免审、归属拒绝、幂等、并发、预约、审计回滚、调度失败恢复 | PASS |
| 相关初始双审核回归 | 15/15 | PASS |
| P019 契约与迁移契约 | 3/3 | PASS |
| P019 Playwright | 2/2 | PASS |
| API / supplier-portal / company-admin build | PASS | PASS |
| Prisma validate | PASS | PASS |
| 迁移演练首跑 | 5 个外键约束名与 Prisma 默认名漂移 | FAIL_CONFIRMED |
| 迁移演练修复后 | empty=2、upgrade=2、restore=2、product=22、cleanup=PASS | PASS |
| OpenAPI generate/check | 字节一致 | PASS |
| 完整 `pnpm verify` | head `66a2511`；17/17；API 172/172；P0 Chromium 46/46；811.6s | PASS |

完整门禁曾三次真实失败并修复：OpenAPI 路径/schema 冻结清单漂移、工作簿 manifest 哈希未同步、历史 M2 契约将当前任务硬编码为 P018；均保留失败轮次并在后续 focused/全量重跑通过。

## 数据、迁移与回滚

- 迁移：`packages/db/prisma/migrations/20260812013000_m2_tiered_price_changes/migration.sql`。
- 无正式历史商品或价格数据回填；迁移只增加价格治理表、唯一键、检查约束、外键和不可变触发器。
- 回滚应用提交并停止 `price-effects` worker。共享环境若已应用迁移，不改写已发布 SQL；保留申请、历史、日志、outbox、命令与审计，以后续前向迁移修复。

## 环境、风险与唯一下一步

- 本地证据：Windows、Node 22.23.1、Docker Desktop 29.6.2、MySQL 8、Chromium。
- staging、device 与 production 为 `NOT_EXECUTED`；正式供应商价格和财务口径未录入，本切片不依赖它们完成代码验收。
- 风险：预约任务最终失败会标记 outbox `FAILED` 并等待同一幂等命令恢复或运营排查；不得直接修改 SKU 当前价绕过历史。
- 唯一下一步：同步最终本地证据后推送、创建 Draft PR、读取精确 head Actions 与未解决评论并完成自评。未经用户对最终精确 head 授权，不转 Ready、不合并，不进入 M2-P020。
