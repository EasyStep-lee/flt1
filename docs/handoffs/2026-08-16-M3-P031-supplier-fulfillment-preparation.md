# M3-P031 供应商备货切片交接

- 结论：CI_PASS_PENDING_HUMAN_MERGE（Draft PR；人工评审、合并和 post-merge `main` CI 尚未执行）
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 仓库：`EasyStep-lee/flt1`
- 基线：`main@bb4b03f94f818cf9c1002decce28933cf4f687a3`
- 分支：`codex/m3-supplier-fulfillment-preparation`
- 实现提交：`fee4b9f`、`0526eba`、`7393dc9`、`c930b37`
- Issue：[#97](https://github.com/EasyStep-lee/flt1/issues/97)
- PR：[#98](https://github.com/EasyStep-lee/flt1/pull/98)，Draft；首轮精确 head `188eb66c0e6e5c877284e13c030942360a1dbc7b` 的 Actions run `31922365208` / job `95104212863` 成功；不得自行转 Ready 或合并

## 唯一目标与非目标

复用 M3-P022 已在公司主订单事务中按 `buyerOrderId + supplierId` 唯一生成的 `supplier_fulfillment_order`，使当前 `SUPPLIER_FULFILLMENT` 职能只能查看和推进本供应商已支付/已激活的个人与企业履约子单。节点仅覆盖接单、报缺、开始备货、标记就绪和按渠道移交。

对应方案为 §0.3、§4.3 至 §4.5、§7.11 至 §7.12、§8.9、§10.2、§10.15、§13；主验收项为 P0-031，兼容 P0-070 固定职能页面，页面为 PAGE-020，API 为 API-052/API-053。

本切片没有创建 `DeliveryTask`、跑腿大厅、`EnterpriseDeliveryOrder`、公司派车、收货、售后、对账、结算或钱包；M4-M6 均未进入。

## 数据、状态、权限与接口

- MIG-015A：`20260816010000_m3_supplier_fulfillment_preparation`。升级既有子单，增加 `subOrderNo`、渠道、激活/备货/移交/结算分离状态、供应价汇总内部字段、审核取货点快照和乐观锁版本；新增追加式节点日志与 readiness outbox。
- 历史子单号用最多 31 位订单号加完整去连字符 supplier UUID 回填，避免短前缀碰撞；`buyer_order_id + supplier_id` 继续保持唯一。
- 状态：`PENDING -> ACCEPTED -> PREPARING -> READY_FOR_HANDOVER -> HANDED_OVER`；`REPORT_SHORTAGE` 只追加异常节点并递增版本，不覆盖订单项或库存。
- 个人订单移交对象只允许 `RUNNER`，发布 `COURIER_READINESS`；企业订单只允许 `COMPANY_LOGISTICS`，发布 `COMPANY_LOGISTICS_READINESS`。
- `supplierId`、职能账号和自然人均从已验证单一职能会话派生；错误 owner、客户端 owner 字段、陈旧版本、非法乱序和幂等冲突全部失败关闭。
- GET `/v1/supplier/fulfillment-sub-orders` 与 POST `/v1/supplier/fulfillment-sub-orders/{subOrderId}/nodes` 已进入确定性 OpenAPI；Web 契约类型已重新生成。
- DTO 白名单不返回 `supplierId`、买家 owner、完整地址/电话、销售金额、供应金额、供应价、结算、支付或福利卡结构。
- 稳定错误码包含 `SUPPLIER_SCOPE_FORBIDDEN`、`FIELD_FORBIDDEN`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`VERSION_CONFLICT`、`STATE_TRANSITION_INVALID`、`FULFILLMENT_HANDOVER_PARTY_INVALID`。

## 页面

PAGE-020 `/supplier/workspaces/fulfillment` 保持 `SUPPLIER_FULFILLMENT` 固定职能路由，新增本方子单列表、状态/渠道/取货点摘要、时间线以及接单、报缺、开始备货、就绪和移交操作。loading、empty、error、permission-denied、offline-or-timeout、success 继续使用既有独立页面壳；截图位于 `artifacts/verification/M3-P031/supplier-fulfillment-page.png`。

## 先失败后通过证据

- RED：API Supertest 3/3 因路由不存在返回 HTTP 404；迁移契约因迁移文件不存在返回 ENOENT；PAGE-020 Playwright 因业务面板不存在失败。
- GREEN focused：API 3/3、迁移契约 1/1、PAGE-020 Chromium 1/1、相关订单/支付/企业汇款仓库单测 14/14 通过。
- `pnpm prisma:validate` 通过。
- `pnpm prisma:migrate:dry-run` 通过：`empty=2 upgrade=2 restore=2 product=31 cleanup=PASS`。
- `pnpm openapi:generate` / `pnpm openapi:check`：通过且字节稳定。
- `pnpm lint` / `pnpm typecheck` / supplier portal build：通过。
- `pnpm verify -- --base-ref bb4b03f94f818cf9c1002decce28933cf4f687a3`：17/17 通过（证据提交 `c930b3727a2904736ee8121b05d812771aab0acb`）；API contract 220/220、foundation Playwright 3/3、P0 Chromium 73/73。
- OpenAPI breaking 检查为 0 error、252 warning；warning 来自新增全局错误码枚举值，不是删除或收窄接口。
- 验证收敛记录：首次预提交验证因预期的未提交 OpenAPI 生成差异停止；一次错误地给 Vitest 传入 `--runInBand`（参数不支持）后使用标准命令重跑通过；随后补齐 OpenAPI 路径清单、工作簿 manifest 哈希和随总控推进变化的历史状态断言，focused 合同最终 90/90。

证据文件：

- `docs/contracts/m3/M3-P031-supplier-fulfillment-preparation.md`
- `artifacts/verification/M3-P031/supplier-fulfillment-preparation.json`
- `artifacts/verification/M3-P031/supplier-fulfillment-page.png`
- `tests/migrations/m3-p031-supplier-fulfillment-migration.contract.test.mjs`
- `apps/api/test/supertest/supplier-fulfillment-preparation-api.test.mjs`
- `tests/e2e/p0/p0-031-supplier-fulfillment-preparation.spec.ts`

## 台账、工作簿与 P0

任务、P0-031、PAGE-020、EVD-031、API-052/API-053、MIG-015A、M3 门禁和项目状态已同步。总控工作簿更新对应镜像行和看板计数，公式错误扫描 0 项，关键区域完成渲染复核；工作簿 SHA-256 为 `22026B35741C9639EA1101B1D021AE7E11F0E156A72025A24CCF7EDF3E5DE0A9`。

P0-031 当前仅为 `LOCAL_PASS`。它证明本地技术切片符合本方数据域、备货状态机、幂等/版本控制、渠道隔离和字段白名单；不自动证明 M4 配送、真实移交/收货或正式验收。

## 环境边界、风险与回滚

- LOCAL：Windows、Node 22.23.1、pnpm 10.12.1、Docker MySQL 8.4.11、Playwright Chromium。
- CI：首轮 exact-head CI_PASS（run `31922365208` / job `95104212863`）；STAGING：NOT_EXECUTED；DEVICE：NOT_EXECUTED；PRODUCTION：NOT_EXECUTED。
- 风险：readiness outbox 只冻结 M4 消费契约，尚无真实配送消费者；取货点快照依赖 M1 已审核数据。M4 后续实现不得回改本迁移，只能向前演进。
- 回滚：应用代码可原子 revert；迁移在未发布环境可从演练备份恢复，发布后不得修改历史迁移，必须以前向修复迁移处理。回退旧应用时保留新增列/表的兼容窗口。
- 用户原有未跟踪文件保持原状，未纳入本切片。

## 下一门禁

保持 PR #98 为 Draft，并要求证据同步后的最新 head 再次取得精确 CI。只有人工对该精确 head 明确授权合并且合并后的 `main` CI 成功后，M3-P051 才可解锁；在此之前 M3-P051、M4-M6 均禁止进入。
