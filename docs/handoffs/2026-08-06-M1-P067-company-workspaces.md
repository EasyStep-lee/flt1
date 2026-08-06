# M1-P067 公司职能账号独立页面交接

## 身份与结论

- 仓库：`EasyStep-lee/flt1`
- 基线：`main` 提交 `1254f710d5849a322c3b5d5c948688444da3fb9f`
- 分支：`codex/m1-m1-p067`
- Issue：[#23](https://github.com/EasyStep-lee/flt1/issues/23)
- 本地全量验证提交：`2da2aacc9374bdbd066b945f19fb3405c3e3c743`
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 结论：`LOCAL_PASS`。Draft PR、精确 head CI、人工授权合并与合并后 main CI 尚未形成，因此 P0-067 不能升级为 `CI_PASS`，不得进入 M1-P068。

## 唯一范围与非范围

本切片实现 P0-067：10 类公司职能账号各自固定 `workspaceRoute`、PAGE-003 至 PAGE-012 页面壳、单一菜单白名单、服务端会话/路由/API 鉴权，以及 API-013/API-014 的公司超级管理员分支和 API-082 当前工作区接口。

M1-P068 的内部列表、筛选、详情、时间线与逐页完整状态未实现；M2-M5 的商品、价格、订单、福利卡、财务、物流和 CMS 业务内容未提前进入。供应商登录/激活仍归 M1-P069，真实身份源与二次验证仍由后续外部接入完成。

## 数据、状态、权限与接口

- 前向迁移 `20260806090000_company_fixed_workspaces` 只向 `FunctionalAccountType` 追加 10 条公司白名单，不新增 Prisma model，不回改已发布迁移。
- 真实 MySQL 校验 10 个活动类型、10 个唯一路由、10 个精确 code/route 对和 10 个单菜单 schema；8 条产品迁移无漂移，幂等重放通过。
- 会话继续使用 `Secure`、`HttpOnly`、`SameSite=Strict` 的 `__Host-fulishe-company-admin` Cookie；数据库只存 SHA-256 哈希。
- API-082 DTO 只返回 `accountTypeCode`、`accountTypeName`、`pageId`、`workspaceRoute` 和一个 `menuItems` 条目，不返回 companyId、identityId、令牌或供应价。
- API-013/API-014 的 `company` 分支只允许 `COMPANY_SUPER_ADMIN`，公司/自然人/职能归属从会话派生；邀请要求二次验证、幂等键、状态历史和追加审计。
- 失败码：`AUTHENTICATION_REQUIRED`、`AUTH_SESSION_REVOKED`、`WORKSPACE_FORBIDDEN`、`WORKSPACE_MENU_VIOLATION`、`DATA_SCOPE_FORBIDDEN`、`SECOND_VERIFICATION_REQUIRED`、`IDEMPOTENCY_CONFLICT` 与 `VALIDATION_FAILED`。

## 先红后绿证据

| 范围 | RED | 最终结果 |
|---|---|---|
| API 工作区门禁 | API-082 不存在，4/4 失败 | P067 API 6/6；认证/职能账号/Prisma 相关 25/25 |
| 公司账号管理 | company owner 分支返回 401，2/6 失败 | 超级管理员列表/邀请、越权先拒绝、会话派生通过 |
| 页面权限态 | 无权限标题未暴露 heading，1/2 失败 | P067 Chromium 2/2；全量 P0 13/13 |
| OpenAPI/历史清单 | 新路径、DTO 与动态迁移任务 ID 未被旧清单接受 | OpenAPI 12/12、迁移合同 22/22、M1 合同 33/33 |
| Secret scan | 新增命名与测试 URL 触发 2 个模式 | 452 个跟踪文件零命中 |

`NEG-M1-067-01` 深链错路由、`NEG-M1-067-02` 菜单泄露、`NEG-M1-067-03` API 职能错配、`NEG-M1-067-04` 旧会话复用均已在本地行为测试通过。

## 新鲜完整验证

| 命令/证据 | 退出码与结果 |
|---|---|
| `pnpm exec vitest ... company-workspace/company-auth/prisma/functional-account` | 0；25/25 |
| `pnpm test:migrations` | 0；22/22 |
| `pnpm test:m1-contract` | 0；33/33 |
| P067 Playwright focused | 0；2/2 |
| 受新门禁影响的 P003/P045/P046 focused | 0；4/4 |
| `node ./scripts/prisma-migration-rehearsal.mjs --report ...` | 0；empty=2、upgrade=2、restore=2、product=8、cleanup=PASS |
| `pnpm verify` | 0；17/17，`2026-08-06T10:46:16.265Z` 至 `2026-08-06T10:54:11.065Z` |

完整报告：`artifacts/test-results/verification/pnpm-verify.json`；P067 汇总：`artifacts/verification/M1-P067/company-workspaces.json`；MySQL 原始报告：`artifacts/verification/M1-P067/prisma-migration-rehearsal.json`。

## 环境、风险与回滚

- 环境：Windows、Node 22.23.1、pnpm 10.12.1、Docker 29.6.2、临时 MySQL 8.4.11、Prisma 6.19.2、Playwright Chromium。
- 未读取生产秘密，未触达配置数据库、预发布或生产；真实身份凭证、真实二次验证、预发布迁移、生产迁移与正式人工验收均为 `NOT_EXECUTED`。
- 既有 Vite bundle 大于 500 kB 与 `FORCE_COLOR`/`NO_COLOR` 警告仍为非阻塞风险。
- 应用回滚使用 `git revert` 本切片提交；数据库白名单迁移一旦发布不得编辑或倒退，发现问题时通过新的前向修复迁移并维持兼容窗口。

## GitHub 与下一门禁

当前只有 Issue #23 和本地分支/提交，Draft PR 与 Actions 尚未创建/执行。下一步仅允许推送本分支、创建 Draft PR、读取精确 head Actions 并修复同切片问题。未经用户对精确 head 明确授权，不得转 Ready 或合并；合并后 main CI 成功前不得启动 M1-P068。
