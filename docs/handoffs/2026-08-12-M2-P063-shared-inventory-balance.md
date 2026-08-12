# M2-P063 跨渠道共用库存交接

## 结论与范围

- 当前结论：`LOCAL_PASS`；提交 `80cc4ea` 的完整 `pnpm verify` 17/17 通过，仍需 Draft PR exact-head Actions、人工合并和合并后 main CI。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 分支：`codex/m2-shared-inventory-balance`；基线：main `09433c0`；Issue：#69。
- 仅完成唯一库存真源、供应商库存页面/API、调整/盘点/报损/预警、追加流水和内部原子库存契约。
- 未进入订单、支付、福利卡、超时释放、M2-P071、M3、staging、真机或生产。

## 实现

- 迁移 `20260812100000_m2_shared_inventory_balance` 创建 `InventoryBalance`、`InventoryChangeLog`、`InventoryCommand`，既有 SKU 一次回填初始库存。
- 每个平台 SKU 唯一余额；数量非负，流水算术受 CHECK 约束，历史由 UPDATE/DELETE 触发器保护。
- Prisma 仓储以 serializable 事务、版本条件更新和幂等响应快照处理调整及内部 reserve/release/confirmSale。
- 供应商 API 与 `PAGE-019` 只使用服务端会话派生归属和 DTO 白名单，不返回任何供应价、销售价、归属或审计身份。
- OpenAPI 和生成 TypeScript 契约已确定性更新；页面覆盖 loading/empty/error/permission/offline/success/unknown-result。

## 测试证据

| 证据 | 结果 |
|---|---|
| RED focused API | 2/2 按预期因新路由 404 失败 |
| GREEN focused API | 2/2 PASS |
| 内部领域并发/幂等/负库存 | 2/2 PASS |
| 契约与迁移 | 2/2 PASS |
| 供应商端构建契约 | 4/4 PASS |
| P0-063 + P0-070 focused Chromium | 4/4 PASS |
| Prisma validate / OpenAPI check | PASS |
| MySQL 迁移演练 | empty=2、upgrade=2、restore=2、product=24、cleanup=PASS |
| 完整 pnpm verify | PASS 17/17，`80cc4ea`，2026-08-12T11:33:23.512Z 至 11:47:18.001Z |

完整验证依次暴露并修复 OpenAPI schema 清单遗漏、P0-063 Mock 查询 URL、重复 PAGE-019、执行包工作簿哈希、历史契约当前任务硬编码、Node/Vitest runner 归属和旧价格审计测试随机 UUID 误报。最终 `80cc4ea` 的 17 个聚合步骤全部退出 0；没有删除测试、降低业务断言或跳过门禁。

## 风险、环境与回滚

- 本地 Windows、Node 22.23.1、pnpm 10.12.1、MySQL 8.4.11、Chromium 有真实证据；CI/staging/device/production 均未执行。
- M3 必须在同一 InventoryBalance 上组合跨供应商整单预扣；本切片没有订单级全事务，因此不得宣称 P0-023 或 M3 交易闭环完成。
- 应用回滚：revert 本切片原子提交。数据库已应用环境不删除表、不改历史，使用向前修复迁移；回滚前备份。
- 唯一后续动作：通过最终验证后推送并创建 Draft PR；未经用户对精确 head 授权合并且合并后 main CI 未通过，不进入 M2-P071。
