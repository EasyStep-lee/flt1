# M2-P010 “看他还卖什么”交接

## 结论与边界

- 结论：`LOCAL_PASS`；Draft PR、精确 head CI、人工合并、合并后 `main` CI、staging、微信真机和 production 均为 `NOT_EXECUTED`。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`；基线 `main@fb242c025673e937f63850f0677d7b0ffa61cdf4`；分支 `codex/m2-more-from-supplier`；实现与本地验证提交 `6b380f7f6c408f5570cc0ec0a563dcf0be927110`；Issue [#45](https://github.com/EasyStep-lee/flt1/issues/45)。
- 唯一范围：`P0-010`，按当前商品 `supplierId` 查询同一供货来源的公司在售零售商品，保持公司统一销售、收款、结账和售后主体。
- 明确未进入：`P0-089`完整用户商品浏览与真机验收、`InventoryBalance`/`P0-063`、供应商店铺、交易/支付/配送、数据库迁移以及 `M2-P011`。

## 实际变更

- 新增 `GET /v1/catalog/suppliers/{supplierId}/products`，查询条件固定为供应商与公司均为 `ACTIVE`、零售 `Product` 为 `ACTIVE` 且至少有一个 `ACTIVE` SKU；支持排除当前商品和确定性分页。
- Prisma 仓库保留精确 `supplierId` 过滤，并在仓库结果越界、非在售候选、停用来源或店铺语义出现时拒绝返回。
- 对客 DTO 仅返回供应来源标签、公司统一销售/结账说明、商品 ID/名称/零售价/在售 SKU 数；不返回供应价、结算、供应商私有字段或店铺字段。
- 用户原生小程序新增 `/pages/supplier-products/index`，通过 `miniapp-kit` 唯一 `wx.request` 适配器与生成契约类型读取 API，覆盖加载、成功、空态、离线/错误和重试。
- OpenAPI 和共享类型已确定性生成；P0、页面、API、测试、阶段和项目状态台账及总控工作簿同步到本切片。

## 数据、权限、错误码与回滚

- 无新增 Prisma 模型、字段或迁移；只读查询不写库存、价格、资金或审计实体。
- 公开或按需登录用户只能读取公司统一货架白名单；`supplierId` 仅用于供货来源筛选，不改变 seller/payee/checkout 主体。
- 错误码：`SUPPLIER_NOT_ACTIVE`、`SUPPLIER_SCOPE_FORBIDDEN`、`PRODUCT_NOT_SALEABLE`、`FORBIDDEN_CAPABILITY`；请求参数继续由全局校验处理。
- 回滚：回退本分支 P010 应用、契约与页面提交；本切片无迁移或数据清理。回滚会移除 API-031 与 PAGE-054。

## 先失败后通过的测试证据

| 证据 | 实际结果 | 状态 |
| --- | --- | --- |
| RED API | 6/6 因端点 404 失败 | 已确认 |
| RED 小程序 | 2/2 因 PAGE-054 构建产物缺失、`ENOENT` 失败 | 已确认 |
| API focused | 6/6 | PASS |
| Prisma 仓库与契约 focused | 3/3 | PASS |
| 小程序构建运行时 focused | 成功、空态、离线重试 3/3 | PASS |
| P0 Playwright | 构建后小程序运行时 1/1 | PASS |
| 全量门禁 | `pnpm verify`，`PNPM_VERIFY_OK:steps=17:base=HEAD` | PASS |
| P0 E2E | 33/33 | PASS |
| Prisma | validate、13/13 迁移完整性、空库/升级/恢复 rehearsal | PASS |
| OpenAPI/构建/秘密扫描 | generate/diff/check/breaking、build、596 个已跟踪文件 | PASS |

完整报告：`artifacts/test-results/verification/pnpm-verify.json`；切片证据：`artifacts/verification/M2-P010/more-from-supplier.json`。

## 环境、风险与外部缺口

- 本地证据环境为 Windows、Node 22.23.1、Node VM 与 Chromium；只升级到 `LOCAL_PASS`。
- 微信开发者工具与真机、生产 HTTPS API、微信 `request` 合法域名、staging 和 production 均未执行。生产构建必须显式设置 `USER_MINIAPP_API_BASE_URL`，禁止使用默认本地地址。
- PAGE-054 当前只覆盖 P0-010；不能据此宣称 P0-089 或完整用户小程序浏览闭环完成。
- 非阻塞既有警告：前端大 chunk、Ant Design 弃用提示与某测试代理拒绝连接日志；均未导致门禁失败，本切片不跨范围重构。

## GitHub 门禁与下一步

- PR #44 已按精确 head `fbf8fe62...` 授权合并为 `main@fb242c0`；PR Actions run `31351519702` 与合并后 main run `31352608893` 均成功，因此 P0-009 为 `CI_PASS`。
- 当前 Issue #45；Draft PR 尚未创建，当前切片 PR CI、评论、review、merge 与合并后 main CI 均为 `NOT_EXECUTED`。
- 下一动作仅为提交证据收尾、推送 `codex/m2-more-from-supplier`、创建 Draft PR，并读取精确 head Actions 和未解决评论。
- 未经用户对届时精确 head 的明确授权，不得转 Ready 或合并；合并后 `main` CI 成功前不得开始 M2-P011。
