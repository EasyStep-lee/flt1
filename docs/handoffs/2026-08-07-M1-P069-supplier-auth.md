# M1-P069 供应商注册、登录与职能选择交接

## 结论与基线

- 阶段/任务/P0：`M1` / `M1-P069` / `P0-069`；结论仍为 `LOCAL_PASS`，阶段未完成。
- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 基线：`main@ff8d5ae6d998a2f05ade69f8e220e2ec5a6527b3`；分支：`codex/m1-m1-p069`；已验证实现提交：`72f3696ca3a2dfb0756cb34e69a183bc488f62c6`。
- 工作区只保留用户已有未跟踪素材；这些素材未暂存、未修改。M1-P070 及商品、价格、订单、支付、配送、售后、对账均未进入。

## 实际范围

- PAGE-013～015 分离供应商注册、登录与职能选择；页面 `noindex`，涵盖加载、空、错误、无权限、离线/超时、过期、成功状态。
- API-006/007 使用 DTO 白名单；`supplierId`、`userId`、身份、token、供应价、财务及银行字段不出现在响应。供应商归属只由已验证账号和服务端会话派生。
- 审批通过在同一事务激活申请联系人 `SupplierUser` 和唯一 `SUPPLIER_ACCOUNT_ADMIN`；多职能一次只激活一个固定工作区会话。
- 登录、失败、选择、重放与会话签发追加 `LoginAudit`；供应商/用户/职能账号或类型停用、撤销、过期后旧会话立即失效。
- 登录响应使用同一次服务端时钟映射职能账号状态；已过期但库内仍标记 `ACTIVE` 的账号对 PAGE-015 返回不可用，避免页面误导为可点击，同时 API-007 继续失败关闭。
- 独立 API 域请求固定 `credentials: include`；认证成功和失败均返回 `Cache-Control: private, no-store, max-age=0`。
- 同账号选择重放在事务内轮换不透明 `sessionHash` 并重新签发 Secure HttpOnly Cookie，仍只有一个活动会话；同一 nonce 改选其他账号返回冲突。
- 浏览器按方案使用同一运营域名下的 `/v1`；本地 Vite 将 `/v1` 代理到 `127.0.0.1:$API_PORT`，生产同源转发由部署网关提供。本切片未开启宽泛 CORS，也不把独立 API 域冒充已验收拓扑。
- P0 浏览器门禁另启专用 Vite 运行入口，由测试自身启动注入式 Nest API；Chromium 真实提交登录/选择请求并验证最终 Cookie jar，而不是仅使用 Playwright route Mock。

## 数据、迁移与契约

- 迁移：`20260807010000_supplier_auth_sessions`；新增 `SupplierAuthSelection`，并补足供应商用户、职能账号与会话约束。已发布迁移禁止回改，只能前向修复。
- 选择上下文只保存 nonce 哈希、用户、requestId、二次验证要求、选中账号/会话、到期/使用时间；不保存原始 nonce 或原始会话 token。
- API-006 错误：`AUTH_INVALID`、`SUPPLIER_NOT_ACTIVE`、`ACCOUNT_SUSPENDED`、`RATE_LIMITED`、`VALIDATION_FAILED`、`DATA_SCOPE_FORBIDDEN`。
- API-007 错误：`WORKSPACE_FORBIDDEN`、`WORKSPACE_SESSION_CONFLICT`、`SECOND_VERIFICATION_REQUIRED`、`VALIDATION_FAILED`、`DATA_SCOPE_FORBIDDEN`。
- OpenAPI 仍由后端确定性生成，Web 继续复用生成契约和 `openapi-fetch`；本次加固未改变 OpenAPI shape。

## 新鲜测试证据

| 证据 | 结果 |
| --- | --- |
| 原始业务 RED | API-006/007 未实现时 `3/3` 按预期 404 失败 |
| 加固 RED：共享 Web 客户端 | 缺少 Cookie-bound export，`1` 项按预期失败 |
| 加固 RED：认证错误缓存 | `2/12` 因错误响应无 Cache-Control 按预期失败 |
| 加固 RED：重放恢复 | `1/12` 因同账号重放无 Set-Cookie 按预期失败 |
| 加固 RED：过期账号可见状态 | `1/13` 因已过期账号仍返回 `ACTIVE` 按预期失败；最小状态映射修复后 `13/13` |
| API/Prisma focused GREEN | 组合业务 focused 为 `27/27`；API lint/typecheck 均退出码 `0` |
| Web 客户端与供应商门户 GREEN | `5/5`（含真实同源开发代理行为） |
| 同源开发代理 RED / GREEN | 实际 Vite 请求先为 `404`；配置后上游路径、Host 和 `Set-Cookie` 转发 `3/3` 通过 |
| 真实浏览器纵向链路 RED / GREEN | 专用运行入口未启动时 `ERR_CONNECTION_REFUSED`；接入后 P0-069 `4/4`，真实登录、选择、跳转和 Cookie 属性通过 |
| 干净 CI RED 1 / 修复 | run `31154584849` 在 typecheck 因预构建 `dist` 不存在而失败；改为源码类型＋构建产物动态加载，并让 P0 门禁独立构建 API；focused 类型检查、API build、Chromium `1/1` 通过 |
| 干净 CI RED 2 / 修复 | run `31155519986` 已通过 typecheck，但回归 P0 缺少 `@fulishe/config/dist`；新增依赖闭包合同先红，再以 `@fulishe/api...` 构建 API 及 workspace 依赖后转绿，浏览器断言不变 |
| `pnpm lint` / `pnpm typecheck` | 均退出码 `0` |
| 当前实现 head `pnpm verify` | head `72f3696…`：`17/17`，P0 E2E `19/19`，Prisma `published=9/current=9`，迁移 `empty=2/upgrade=2/restore=2/product=9/cleanup=PASS`，秘密扫描 `484` 文件 |

Actions run `31154584849`（head `a392b65…`）和 run `31155519986`（head `dbb40d1…`）均已真实失败并保留为修复证据；前者暴露静态 `dist` 类型依赖，后者暴露 API workspace 依赖未构建。两项都只修复干净环境装配，业务断言未降低；后续证据提交的新 head 必须重新通过 CI。

## P0、环境与缺口

- P0-069 当前仍为 `LOCAL_PASS`；head `af60e0a…` 的 Actions run `31156560809` 曾成功，但新增过期状态加固后的 head `72f3696…` 尚未推送，故当前精确 head CI、人工审查、用户对精确 head 的 Ready/合并授权、合并后 main CI 均未完成。
- 本地环境：Windows、Node 22.23.1、pnpm 10.12.1、Docker MySQL、Playwright Chromium。
- Staging/生产均 `NOT_EXECUTED`。本切片为 PC Web，不要求微信真机；生产供应商凭证与二次验证 Adapter 继续默认拒绝，真实身份源为外部接入缺口。
- 供应商门户 bundle 仍有超过 500 kB 的非阻断告警；需在性能验收前拆包。本地迁移演练不能替代 staging/生产迁移证据。
- Chromium loopback 诊断实际接受 `Secure`、`HttpOnly`、`SameSite=Strict` 的 `__Host-` Cookie，但这只是本地诊断，不升级为 staging 或生产证据；独立 API origin 的 credentialed CORS 未实现也未验收。
- 真实浏览器纵向测试使用注入式内存仓储和测试凭证验证器；它证明页面、代理、Nest API 和 Cookie 传输，不证明生产身份源、短信或二次验证服务。
- 同 nonce、同账号的顺序重放已验证会恢复 Cookie；但当前实现每次恢复轮换 `sessionHash`，尚无多请求并发及响应乱序下“较旧 Set-Cookie 不覆盖较新有效 Cookie”的行为证据。该缺口必须留在 M1-P069 内继续加固，不能以当前 CI 成功替代。

## GitHub、回滚与下一步

- 仓库：`EasyStep-lee/flt1`；Issue [#27](https://github.com/EasyStep-lee/flt1/issues/27)；Draft PR [#28](https://github.com/EasyStep-lee/flt1/pull/28)。
- 当前不具备 Ready/合并授权。推送新 head 后必须读取对应 Actions 和未解决评论；不得使用旧 head CI 宣称通过。
- 应用回滚：逐个 `git revert` M1-P069 实现/加固/证据提交。数据库回滚：生产发布前恢复经验证备份，或新增受审前向修复迁移；禁止编辑已发布 SQL。
- 唯一下一最小切片是 M1-P069 同账号并发重放与响应乱序 Cookie 恢复：先写失败行为测试，再采用不泄露原始 token、不能绕过二次验证的最小实现。该缺口和新 head CI 完成后才可请求 PR #28 的 Ready/合并授权；只有合并且合并后 main CI 成功，才允许启动 `M1-P070`。
