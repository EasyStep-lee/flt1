# M1-P069 供应商注册、登录与职能选择交接

## 结论与基线

- 阶段/任务/P0：`M1` / `M1-P069` / `P0-069`；结论仍为 `LOCAL_PASS`，阶段未完成。
- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 基线：`main@ff8d5ae6d998a2f05ade69f8e220e2ec5a6527b3`；分支：`codex/m1-m1-p069`；精确本地验证实现提交：`1c2ae1cd08a9669dd2b37b396dfa6eb40f0e63b3`。
- 工作区只保留用户已有未跟踪素材；这些素材未暂存、未修改。M1-P070 及商品、价格、订单、支付、配送、售后、对账均未进入。

## 实际范围

- PAGE-013～015 分离供应商注册、登录与职能选择；页面 `noindex`，涵盖加载、空、错误、无权限、离线/超时、过期、成功状态。
- API-006/007 使用 DTO 白名单；`supplierId`、`userId`、身份、token、供应价、财务及银行字段不出现在响应。供应商归属只由已验证账号和服务端会话派生。
- 审批通过在同一事务激活申请联系人 `SupplierUser` 和唯一 `SUPPLIER_ACCOUNT_ADMIN`；多职能一次只激活一个固定工作区会话。
- 登录、失败、选择、重放与会话签发追加 `LoginAudit`；供应商/用户/职能账号或类型停用、撤销、过期后旧会话立即失效。
- 登录响应使用同一次服务端时钟映射职能账号状态；已过期但库内仍标记 `ACTIVE` 的账号对 PAGE-015 返回不可用，避免页面误导为可点击，同时 API-007 继续失败关闭。
- 独立 API 域请求固定 `credentials: include`；认证成功和失败均返回 `Cache-Control: private, no-store, max-age=0`。
- 同账号选择重放不再覆盖 `sessionHash`：随机 `AuthSession.id` 与服务端 HMAC 密钥确定性派生同一 43 字符 Cookie，数据库仍只保存 SHA-256。三次并发重放的响应即使乱序到达也携带同一有效 Cookie，仍只有一个活动会话；同一 nonce 改选其他账号返回冲突。
- 单职能账号直达也创建不返回页面的不可变选择授权：同一自然人以相同 `requestId` 并发或重试 API-006 时复用同一会话与 Cookie，响应乱序不会让浏览器最后落地失效 Cookie；对客 DTO 和单账号直达页面流程不变。
- API-006/007 的可选验证码在服务边界统一校验：只有未提供或最多 16 字符的字符串可进入 Adapter；对象、数组、数字、`null` 与超长值先返回 `VALIDATION_FAILED`，不会创建选择授权、签发会话或消耗已有授权。
- 选择 nonce 使用现有服务端签名密钥及独立域字符串做 HMAC-SHA-256：同一实例、用户和 `requestId` 的重试稳定，服务端密钥不同则 nonce 不同，不能再仅凭公开的用户与请求标识预测；数据库仍只保存 nonce 哈希。
- 二次验证首次成功并完成同账号选择后，`usedAt + selectedAccountId + selectedSessionId` 证明该选择已完成；同 nonce、同账号的未知结果重放直接恢复原会话，不再次调用或消费一次性验证码。未完成、改选、过期或会话失效仍按原路径失败关闭。
- `SUPPLIER_AUTH_SESSION_SIGNING_KEY` 在 staging/production 缺失、使用开发占位值或不符合 43～128 位 base64url 格式时启动失败；结构化日志会脱敏。密钥轮换会让现有供应商 Cookie 失败关闭，须安排重新登录窗口。
- 浏览器按方案使用同一运营域名下的 `/v1`；本地 Vite 将 `/v1` 代理到 `127.0.0.1:$API_PORT`，生产同源转发由部署网关提供。本切片未开启宽泛 CORS，也不把独立 API 域冒充已验收拓扑。
- P0 浏览器门禁另启专用 Vite 运行入口，由测试自身启动注入式 Nest API；Chromium 真实提交登录/选择请求并验证最终 Cookie jar，而不是仅使用 Playwright route Mock。

## 数据、迁移与契约

- 迁移：`20260807010000_supplier_auth_sessions`；新增 `SupplierAuthSelection`，并补足供应商用户、职能账号与会话约束。已发布迁移禁止回改，只能前向修复。
- 本次并发恢复加固没有新增或修改 Prisma schema/迁移；`published=9/current=9`。
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
| 加固 RED：并发/乱序 Cookie | API `1/14` 因三次并发重放返回三个 Cookie 按预期失败；Prisma `1/4` 因重放仍覆盖 hash 按预期失败 |
| 加固 RED：签名密钥 | 配置合同 `4/10` 因密钥未校验/脱敏按预期失败；密钥轮换旧 Cookie 测试 `1/15` 按预期失败 |
| 加固 RED：单账号直登并发 | API `1/16` 因同一 `requestId` 的三次并发直登签发三个会话/Cookie 按预期失败 |
| 加固 RED：可选验证码边界 | API `2/18`：登录验证码对象错误返回 200 并签发会话，二次验证码对象错误返回 428，均未先做 DTO 校验 |
| 加固 RED：选择 nonce 密钥绑定 | API `1/19` 因两组不同服务端签名密钥仍生成相同 nonce 按预期失败；改为独立域 HMAC 后同密钥重放稳定、不同密钥结果不同 |
| 加固 RED：二次验证未知结果恢复 | API `1/20`：首次选择已成功后，同 nonce 同账号重试再次调用一次性验证器并返回 `428`；最小修复后重试 `200`、同一 Cookie、`Idempotency-Replayed=true`，验证器仍只调用一次 |
| API/Prisma focused GREEN | 服务边界最小校验、nonce HMAC 及完成态重放后，组合业务 focused 为 `34/34`；spy 证明非法输入时两个 Adapter 零调用，合法二次验证码随后仍可使用原授权，完成态重放不重复消费验证码；配置合同 `10/10`；API lint/typecheck 均退出码 `0` |
| Web 客户端与供应商门户 GREEN | `5/5`（含真实同源开发代理行为） |
| 同源开发代理 RED / GREEN | 实际 Vite 请求先为 `404`；配置后上游路径、Host 和 `Set-Cookie` 转发 `3/3` 通过 |
| 真实浏览器纵向链路 RED / GREEN | 专用运行入口未启动时 `ERR_CONNECTION_REFUSED`；接入后 P0-069 `4/4`，真实登录、选择、跳转和 Cookie 属性通过 |
| 干净 CI RED 1 / 修复 | run `31154584849` 在 typecheck 因预构建 `dist` 不存在而失败；改为源码类型＋构建产物动态加载，并让 P0 门禁独立构建 API；focused 类型检查、API build、Chromium `1/1` 通过 |
| 干净 CI RED 2 / 修复 | run `31155519986` 已通过 typecheck，但回归 P0 缺少 `@fulishe/config/dist`；新增依赖闭包合同先红，再以 `@fulishe/api...` 构建 API 及 workspace 依赖后转绿，浏览器断言不变 |
| `pnpm lint` / `pnpm typecheck` | 均退出码 `0` |
| 秘密扫描首轮失败/修复 | 内部 DI 符号名误触 `credential-assignment` 共 `1` 项；未放宽规则，仅重命名内部符号后 `484` 个跟踪文件通过 |
| 当前实现 head `pnpm verify` | 精确 head `1c2ae1c…`：退出码 `0`、`17/17`，P0 E2E `19/19`，Prisma `published=9/current=9`，迁移 `empty=2/upgrade=2/restore=2/product=9/cleanup=PASS`，秘密扫描 `484` 文件 |

Actions run `31154584849`（head `a392b65…`）和 run `31155519986`（head `dbb40d1…`）均已真实失败并保留为修复证据；前者暴露静态 `dist` 类型依赖，后者暴露 API workspace 依赖未构建。两项都只修复干净环境装配，业务断言未降低；后续证据提交的新 head 必须重新通过 CI。

## P0、环境与缺口

- P0-069 当前仍为 `LOCAL_PASS`；PR #28 的远端旧 head `e7afe9f…` Actions run `31167601155` 成功，但二次验证未知结果恢复实现 head `1c2ae1c…` 与本交接证据尚未推送，因此该成功不能升级为当前精确 head CI。人工审查、用户对精确 head 的 Ready/合并授权、合并后 main CI 均未完成。
- 本地环境：Windows、Node 22.23.1、pnpm 10.12.1、Docker MySQL、Playwright Chromium。
- Staging/生产均 `NOT_EXECUTED`。本切片为 PC Web，不要求微信真机；生产供应商凭证与二次验证 Adapter 继续默认拒绝，真实身份源为外部接入缺口。
- 供应商门户 bundle 仍有超过 500 kB 的非阻断告警；需在性能验收前拆包。本地迁移演练不能替代 staging/生产迁移证据。
- Chromium loopback 诊断实际接受 `Secure`、`HttpOnly`、`SameSite=Strict` 的 `__Host-` Cookie，但这只是本地诊断，不升级为 staging 或生产证据；独立 API origin 的 credentialed CORS 未实现也未验收。
- 真实浏览器纵向测试使用注入式内存仓储和测试凭证验证器；它证明页面、代理、Nest API 和 Cookie 传输，不证明生产身份源、短信或二次验证服务。
- staging/production 会话签名密钥注入仍为 `NOT_EXECUTED`；轮换会主动使现有供应商会话失效，运维必须安排重新登录窗口并记录审计，不能把开发占位值或旧密钥写回仓库。

## GitHub、回滚与下一步

- 仓库：`EasyStep-lee/flt1`；Issue [#27](https://github.com/EasyStep-lee/flt1/issues/27)；Draft PR [#28](https://github.com/EasyStep-lee/flt1/pull/28)。
- 当前不具备 Ready/合并授权。推送新 head 后必须读取对应 Actions 和未解决评论；不得使用旧 head CI 宣称通过。
- 应用回滚：逐个 `git revert` M1-P069 实现/加固/证据提交。数据库回滚：生产发布前恢复经验证备份，或新增受审前向修复迁移；禁止编辑已发布 SQL。
- 当前代码最小切片已完成；唯一下一门禁是推送含证据的新 head，读取 PR #28 对应的精确 Actions、未解决评论和合并状态。只有当前 head CI 成功后才可请求对该精确 SHA 的 Ready/合并授权；只有人工授权合并且合并后 main CI 成功，才允许启动 `M1-P070`。
