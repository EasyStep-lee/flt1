# 2026-08-13 M3-P023 跨供应商库存原子预扣交接

阶段结论：`IN_PROGRESS / CI_PASS`。M3-P022 已由 PR #80 合并为 `main@7cfde37b1e7946ee8241fbf9d08151850ec39838`，合并后 Actions run `31763921395` 成功。本切片库存子行为的代码 head `c2fec070cbeb47f3b556240236ec54fd7c82b2f0` 已完成 focused、本地 `pnpm verify` 17/17 和 PR #82 Actions run `31769514599`；PR 仍为 Draft，证据提交自身 CI、人工合并及合并后 main CI尚待执行。P0-023 还包含福利卡冻结释放，当前没有实现，因此 P0-023 整项保持 `NOT_EXECUTED`，不得宣称完整通过。

## 基线、范围与 GitHub

- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线：`main@7cfde37b1e7946ee8241fbf9d08151850ec39838`。
- 当前任务：M3-P023；P0-023 的库存子行为；API-036/API-048；无新增迁移。
- Issue：[#81](https://github.com/EasyStep-lee/flt1/issues/81)；分支：`codex/m3-inventory-reservation`；实现提交：`f11bc6272c1a8b5371315cfce2f6e0de892eeeac`；代码 head：`c2fec070cbeb47f3b556240236ec54fd7c82b2f0`；Draft PR：[#82](https://github.com/EasyStep-lee/flt1/pull/82)。
- 唯一目标：个人和企业跨供应商主订单在同一数据库事务中原子预扣每个 SKU 的唯一共享库存；任一 SKU 失败则整单回滚；重试不重复占用；明确取消、失败或超时可幂等释放；支付结果 `UNKNOWN` 时禁止释放。
- 非目标：福利卡冻结、福利卡账本、微信支付/回调/退款、库存确认、配送、售后和对账；M3-P024 及后续保持锁定。

## 实际变更

- 在订单创建的 `Serializable` 事务内按 `skuId` 固定顺序读取并条件更新 `InventoryBalance`，执行 `available -= quantity`、`reserved += quantity` 和版本递增。
- 每次成功占用追加 `InventoryChangeLog(ORDER_RESERVATION)`；用稳定业务键写入 `InventoryCommand(order-reserve)`，避免同一订单重放二次预扣。
- 任一 SKU 缺货、库存不存在或版本冲突时抛出并回滚整张主订单、履约子单、事件、库存日志和命令，防止部分写入。
- 新增仓储内部 `releaseOrderInventory` 契约：仅明确取消、失败或超时可释放；重复释放返回已完成结果；`UNKNOWN` 与 `PAID` 失败关闭，不改变库存。
- API 将缺货和并发冲突稳定映射为 `409 INVENTORY_INSUFFICIENT` / `409 INVENTORY_RESERVATION_CONFLICT`；对客 DTO 仍不返回库存内部字段、供应价或归属字段。
- OpenAPI、生成类型、字段/任务/P0/测试/API/阶段台账、项目状态和总控工作簿已同步；P0-023 因福利卡子行为未实现维持 `NOT_EXECUTED`。

## RED / GREEN 新鲜证据

- RED 单元：库存余额没有变化、缺货仍创建订单、释放方法不存在。
- RED API：缺货场景期望稳定 409，实际返回 500。
- GREEN：`node --test apps/api/test/unit/prisma-order-repository.test.mjs`，5/5 通过；覆盖全有或全无预扣、并发不超卖、释放重放和 `UNKNOWN` 失败关闭。
- GREEN：focused API 5/5 通过；覆盖稳定 409、无部分订单写入和对客响应无库存内部字段。
- GREEN：`pnpm exec playwright test tests/e2e/p0/p0-023-inventory-reservation.spec.ts --config playwright.p0.config.ts`，1/1 通过；覆盖三个供应商共享库存的原子占用及缺货整单回滚。
- GREEN：API 模块 Node 单元 69/69、Vitest 契约 192/192，API lint/typecheck 通过。
- GREEN：`pnpm prisma:validate`、`pnpm prisma:migrations:check`、`pnpm prisma:migrate:dry-run`、`pnpm openapi:generate`、`pnpm openapi:check` 通过；迁移 rehearsal 为 empty=2、upgrade=2、restore=2、product=25、cleanup=PASS。第一次 rehearsal 因本地 MySQL 容器停止而失败，执行 `pnpm infra:up` 后重跑成功，不伪装首次执行结果。
- OpenAPI breaking：首次未传 base 参数，按脚本约束返回 `OASDIFF_BASE_REQUIRED`；改用 `pnpm openapi:breaking -- --base-ref origin/main` 后无 breaking error。新增全局错误枚举值产生非破坏性警告。
- 第一次全量：`pnpm verify` 因 `p0-023-inventory-reservation.spec.ts` 严格类型检查发现数组项可能为 `undefined` 而失败；增加显式夹具断言后，focused P0 1/1 与全仓 typecheck 通过。
- 第二次全量：回归测试发现历史交接/合同的当前任务游标仍停在 M3-P020/M3-P022，且总控工作簿更新后 manifest 哈希未同步；只推进动态项目状态断言和工作簿清单哈希，保留历史 SHA、PR 和阶段结论，focused 交接 29/29、合同 88/88 通过。
- 第三次全量：`pnpm verify` 于 `2026-08-14T03:32:40.339Z` 至 `2026-08-14T03:50:33.734Z` 执行，退出码 0，17/17 步骤通过；报告：`artifacts/test-results/verification/pnpm-verify.json`。既有 Vite 页面状态测试在未启动 API 时仍记录代理 `ECONNREFUSED`，Ant Design/Vite 记录弃用和 chunk-size 警告，但聚合门禁结果为 PASS。
- PR #82 首次 CI：head `d5c9caf48ab670b963c4631fae8c327ddd04a12a`、run `31768384279` 失败；干净 CI 在 typecheck 时没有 `apps/api/dist`，P0 测试的静态 dist 导入暴露本地残留构建产物掩盖的问题。
- CI 修复：保留真实 `OrderService` 行为测试，只把 dist 模块改为 P0 门禁完成 API 构建后的延迟运行时导入；无增量 tests tsconfig typecheck、API 构建、focused P0 1/1 和 ESLint 通过。
- 修复后全量：`pnpm verify` 于 `2026-08-14T04:03:05Z` 至 `2026-08-14T04:18:55Z` 再次执行，退出码 0，17/17 步骤通过。
- PR #82 代码 head CI：`c2fec070cbeb47f3b556240236ec54fd7c82b2f0` 对应 Actions run `31769514599`、job `94672373547`，于 `2026-08-14T04:27:30Z` 成功；PR 当时为 Draft、CLEAN/MERGEABLE、无评论和评审。

## 数据、状态机、权限与错误码

- 数据：复用 `InventoryBalance`、`InventoryChangeLog`、`InventoryCommand` 和 M3-P022 订单模型；没有 Prisma schema 或迁移变更。
- 不变量：每个 SKU 只有一个共享库存余额；`available/reserved` 只做整数增减；多 SKU 占用全有或全无；所有变化追加日志；相同业务键不重复生效。
- 状态：`UNKNOWN` 只允许查询/恢复，禁止释放；仅明确取消、失败或超时进入释放；已支付禁止释放。
- 权限与归属：仓储从已验证订单读取买家、供应商和 SKU 归属，不信任客户端 `companyId`、`supplierId`、`functionalAccountId` 或 `buyerId`。
- 错误码：`INVENTORY_INSUFFICIENT`、`INVENTORY_RESERVATION_CONFLICT` 均为 409；响应仍使用 DTO 白名单。

## 环境等级与缺口

- 当前证据：库存子切片 `LOCAL_PASS`，Windows / Node 22.23.1 / pnpm 10.12.1 / Docker MySQL 8.4 rehearsal / 本地 mock 会话与外部依赖。
- P0-023 整项：`NOT_EXECUTED`；福利卡冻结/释放尚未实现，不能升级为 `LOCAL_PASS`。
- 当前切片库存代码 head：`CI_PASS`；PR #82 仍为 Draft，证据提交的新 head CI 尚待执行，未获人工合并授权。
- `STAGING_PASS`、`DEVICE_PASS`、`PRODUCTION_PASS`：`NOT_EXECUTED`。
- 本切片不要求真实支付或真机交互；Mock 结果不得升级为 staging、真机或生产证据。

## 风险、回滚与下一门禁

- 风险：当前只完成订单创建时的库存占用和内部释放契约，尚未把真实支付生命周期接入释放调用；在 M3-P024 及后续资金切片完成前不能启用真实交易流量。
- 并发风险：采用固定 SKU 顺序、乐观版本条件和 `Serializable` 事务；数据库 `P2034` 映射为可重试冲突，但仍需 PR CI 和后续压力证据。
- 回滚：回退本切片应用、契约和文档提交；没有新增迁移。若已产生测试数据，只通过测试环境清理，不能修改历史库存日志冒充回滚。
- 下一步：提交并推送本交接/台账证据，读取最终 PR head Actions 与未解决评论。只有最终 head CI 成功、人工按该精确 head 授权合并且合并后 main CI 成功，才可开始 M3-P024。
