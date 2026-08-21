# M3-P073 门户全站导航交接

## 结论

- 阶段：`M3_IN_PROGRESS`；本切片：`M3-P073 / P0-073`；阶段不因本切片自动 PASS。
- 当前证据：`LOCAL_PASS`；Draft PR #119 已创建，等待其精确 head CI、人工合并和 post-merge `main` CI。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 基线：`origin/main@ae8545de7eb8502a56fa827b95092f472a8153a0`；PR #117 已按授权精确 head `da5dae7dbee7add9cfe6b86747dbd623c56cac03` 合并，post-merge main run `32434122906` / job `96631713342` 成功。
- 分支：`codex/m3-portal-navigation`；Issue #118；Draft PR #119。
- 用户已有 M3-P031、M3-P051、M3-P059 截图改动及其他无关未跟踪文件保持原样，未纳入本切片。

## 实际变更

- 公开导航补齐福利卡固定入口，同时保留既有服务场景入口；桌面与 390px 移动端均可访问方案要求的八个固定入口。
- 公开态企业动作明确为注册/登录，且不显示企业采购车或工作台。
- 私有企业路由组增加统一品牌页头和货架/采购车/工作台导航；继续继承 `noindex`、`private/no-store`。
- 页脚增加公司主体、对客脱敏手机和平台服务协议/隐私政策入口。
- 新增两个静态 ISR 法律入口页，但明确 `NOT_EXECUTED`，不伪造法务审定内容。
- 无 Prisma 迁移、OpenAPI、DTO、错误码或真实登录实现。

## 先失败后通过证据

| 证据 | 结果 |
|---|---|
| RED P0-073 Chromium | `FAIL 2/2`：公开导航缺福利卡；私有企业布局缺货架/采购车/工作台导航 |
| Portal lint/typecheck/build | PASS；法律页为静态 ISR，私有企业交易路由保持动态 |
| GREEN P0-073 Chromium | `PASS 2/2`；覆盖公开桌面/移动导航、页脚、法律路由、公开/私有入口隔离和私有缓存边界 |
| 完整 `pnpm verify` | `PASS 17/17`，退出码 0；API 49 files / 247 tests、基础 E2E 3/3、P0 Chromium 87/87、Prisma validate、37 个迁移完整性与真实 MySQL 演练、OpenAPI、build、秘密扫描全部通过 |

失败证据未通过删测试、降断言或跳过门禁处理。

## P0、环境与外部边界

- P0-073 当前 `LOCAL_PASS`；RequiredEvidenceLevel 为 `CI_PASS`。
- 本地环境：Windows，Node `22.23.1`，pnpm `10.12.1`，Next.js production build，Playwright Chromium。
- 迁移演练：`empty=2 / upgrade=2 / restore=2 / product=37 / cleanup=PASS`；本切片无新迁移。OpenAPI 生成字节一致且 oasdiff 无变化。
- 正式平台服务协议、隐私政策及其法务审定：`NOT_EXECUTED`；页面只建立入口并如实提示状态。
- staging、真实域名/备案、device、production：`NOT_EXECUTED`。

## 风险与回滚

- 真实登录态与企业身份授权由 P0-077 完成；本切片只验证公开/私有路由组呈现和既有服务端缓存边界，不把测试 Cookie 冒充真实认证。
- 法律占位状态不得用于正式上线；上线前必须由授权法务人员提供并审定版本化文本。
- 无数据迁移或 API breaking change；回滚只需撤销导航、法律页、私有布局、样式和证据文件。

## GitHub 与下一门禁

- 仓库：`EasyStep-lee/flt1`；基线分支：`main`；开发分支：`codex/m3-portal-navigation`；Issue #118。
- Draft PR #119 必须以最新精确 head 通过 Actions；未经用户对该 head 明确授权，不得转 Ready 或合并。
- `M3-P074` 保持锁定。只有 P073 PR 合并且合并后 `main` CI 成功，才允许进入 P074；M4 及以后继续锁定。
