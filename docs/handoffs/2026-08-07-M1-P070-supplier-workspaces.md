# M1-P070 供应商职能账号独立页面交接

## 结论与基线

- 阶段/任务/P0：`M1` / `M1-P070` / `P0-070`；当前结论 `LOCAL_PASS`，M1 阶段未完成。
- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 基线：`main@417d165d0668327af26bbcdadaf7bbd7fdb31471`；分支：`codex/m1-m1-p070`；实现提交：`a9457dc1fc9b5bc9d38faa8c1360a70e88791ce5`；回归修复提交：`9e63b832930e20a9ba4bf47860c5c3e4c6c5692a`、`77ebf06feb5f40b43b182a24a254e457a0713ff4`；请求时序加固提交：`55da216205059c646772de00e350f34d93776796`。
- 用户已有未跟踪素材未暂存、未修改。P071、P072、M2 商品/价格/库存业务、M3 履约和 M5 售后/财务均未进入。

## 实际范围

- PAGE-016～023 分别固定为主体、商品、价格、库存、履约、售后、财务、审计工作台。共享组件不共享会话、菜单、模块目录或页面查询状态；每个页面只显示一个本职能内部菜单。
- API-084 `GET /v1/supplier-auth/workspace/current` 只返回当前职能 code/name/pageId/route/单一菜单；API-085 `GET /v1/supplier-auth/workspace/page` 只返回当前职能的筛选、模块目录、详情和交付时间线。
- `supplierId`、`functionalAccountId`、`identityId`、token、供应价、供应商应付、毛利和银行资料均不进入响应。所有归属由 Secure HttpOnly 供应商职能会话派生；客户端提交归属覆盖字段在查目录前被拒绝。
- 固定 route 必须与会话精确相等；手工访问其他职能、未知本职能模块、切换后的旧会话均失败关闭。错误响应使用规范化 path，不回显恶意 query 中的归属字段。
- 页面覆盖 loading、empty、error、permission-denied、offline-or-timeout、success。M2/M3/M5 模块仅标记 `DEFERRED`，不伪造商品、价格、库存、履约、售后或账单数据。
- 页面请求使用单调递增序列保证 latest-request-wins；较旧的筛选/路由成功、失败或 loading 完成均不能覆盖最新请求状态，避免共享页面组件发生跨查询上下文污染。
- PAGE-024 账号管理保留 P005 真实查询/邀请能力，但先经过 PAGE-016 主体管理会话门禁；兼任人员仍须经 P069 账号选择签发新的单职能会话，不存在综合后台。

## 数据、权限、状态与契约

- 本切片无 Prisma schema 变更、无新模型、无迁移。产品迁移链仍为 10 条且哈希未漂移。
- 八个固定映射为 `SUPPLIER_ACCOUNT_ADMIN/PAGE-016/account-admin`、`SUPPLIER_PRODUCT/PAGE-017/products`、`SUPPLIER_PRICING/PAGE-018/pricing`、`SUPPLIER_INVENTORY/PAGE-019/inventory`、`SUPPLIER_FULFILLMENT/PAGE-020/fulfillment`、`SUPPLIER_AFTERSALES/PAGE-021/aftersales`、`SUPPLIER_FINANCE/PAGE-022/finance`、`SUPPLIER_AUDIT/PAGE-023/audit`。
- API-084 错误：`AUTHENTICATION_REQUIRED`、`AUTH_SESSION_REVOKED`、`WORKSPACE_FORBIDDEN`、`DATA_SCOPE_FORBIDDEN`、`VALIDATION_FAILED`。
- API-085 另含 `WORKSPACE_MODULE_NOT_FOUND`。成功和失败响应均保持 `private, no-store, max-age=0`。
- OpenAPI 由后端确定性生成；`supplierFunctionalSession` Cookie security 和 DTO 白名单已进入生成契约，生成类型继续供 Web/小程序共享。

## 先红后绿与完整验证

| 证据 | 实际结果 |
| --- | --- |
| API RED | API-084/API-085 缺失时 `5/5` 按预期失败 |
| OpenAPI RED | 两个 operation/DTO 白名单缺失时 `2/2` 按预期失败 |
| Chromium RED | PAGE-016 缺角色门禁且 PAGE-017～023 缺页面状态时 `2/2` 按预期失败 |
| 请求时序 RED | 较旧慢筛选响应在新结果已展示后仍覆盖页面，新增用例 `1/1` 按预期失败 |
| API focused GREEN | `supplier-workspace-api.test.mjs` `5/5` |
| OpenAPI focused GREEN | `m1-p070-supplier-workspace-contract.test.mjs` `2/2` |
| 请求时序 focused GREEN | 单调请求序列最小修复后 `1/1` |
| P005/P070 Chromium GREEN | `3/3`；扩大到 P005/P069/P070 为 `8/8` |
| M1 历史契约 | 推进状态断言修正后 `35/35`；没有改变历史精确 head/CI 证据 |
| P070 迁移演练 | `empty=2/upgrade=2/restore=2/product=10/cleanup=PASS`；schema 前后哈希一致 |
| 完整 `pnpm verify` | 加固提交 `55da216` 上 `17/17`、退出码 `0`；P0 E2E `22/22`、迁移 `published=10/current=10`、秘密扫描 495 个跟踪文件；证据提交后将再执行一次提交级复验 |

完整验证早期有三项真实失败并已保留：生成契约未提交导致 `openapi-diff` 失败；P069 浏览器 Mock 未覆盖新门禁导致连接 3000 端口失败；八个历史证据测试仍把 P069 当作当前任务。修复均只补装配/进度断言，没有删测试、降断言或放宽权限。

## P0、环境与风险

- P0-070 当前仅 `LOCAL_PASS`。NEG-M1-070-01～05 覆盖跨职能、跨供应商覆盖、合并页面、旧会话复用和旧响应覆盖新状态。
- 本地环境：Windows、Node 22.23.1、pnpm 10.12.1、Docker MySQL 8.4.11、Playwright Chromium。staging/production 均 `NOT_EXECUTED`；PC Web 切片不要求微信真机。
- 供应商门户产物约 1118.31 kB（gzip 352.74 kB），仍有大于 500 kB 的非阻断拆包告警；Ant Design `Spin.tip` 和 `Card.bordered` 仍有弃用告警。
- 生产身份源、供应商凭证和二次验证 Adapter 仍默认拒绝，真实外部集成未执行。本地内存仓储、注入式测试会话与 Docker MySQL 证据不替代 staging 或生产。

## GitHub、回滚与下一门禁

- 仓库：`EasyStep-lee/flt1`；Issue [#29](https://github.com/EasyStep-lee/flt1/issues/29)；Draft PR [#30](https://github.com/EasyStep-lee/flt1/pull/30)。先前 head `056f142` 的 Actions run `31180343194`、job `92871915961` 已成功，但它早于请求时序加固，不能替代当前 head CI；加固/证据最终 head 的精确 CI、评论、审查、合并及合并后 main CI 尚未执行。
- 应用回滚：按提交顺序 `git revert` P070 实现、回归和证据提交；数据库无需回滚，因为 schema/迁移未变。
- 下一步仅允许推送 PR 元数据提交、读取新精确 head 的 Actions 与评论并修复当前切片。未获用户对精确 SHA 的 Ready/合并授权且合并后 main CI 未通过前，禁止启动 P071、P072 或 M2。
