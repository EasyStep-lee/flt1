# M1-P069 供应商注册、登录与职能选择契约

## 目标与完成定义

- 阶段：M1；任务：M1-P069；P0：P0-069。
- 供应商合作入口分别进入 `/supplier/register` 与 `/supplier/login`，注册和登录不能合并为同一表单或同一认证动作。
- 供应商经公司审核为 `ACTIVE` 时，在同一事务中激活申请主联系人对应的 `SupplierUser` 和唯一 `SUPPLIER_ACCOUNT_ADMIN` 职能账号。
- API-006 `POST /v1/supplier-auth/login` 认证自然人，不接受 `supplierId`、`functionalAccountId` 或 `workspaceRoute` 覆盖；单一有效账号直达，多账号返回 `/supplier/account-select` 逐一选择。
- API-007 `POST /v1/supplier-auth/workspaces/{accountId}/select` 使用短期、一次性选择上下文签发仅含一个职能账号的 Secure HttpOnly 会话；同账号重放返回同一仍有效的不透明 Cookie 以恢复未知结果，仍只保留同一活动会话，选择另一账号冲突。并发重放即使响应乱序，也不能让较晚到达的响应覆盖为失效 Cookie。
- 登录、失败、账号选择和会话签发追加 `LoginAudit`；原始密码、验证码、选择 nonce、会话 token 和完整手机号不得进入响应、日志或审计字段。

## 依赖与非目标

- 基线：`main@ff8d5ae6d998a2f05ade69f8e220e2ec5a6527b3`；方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 依赖 M1-P003 的供应商注册/审核、M1-P005 的供应商职能账号类型与邀请、M1-P045 的不可变审计、M1-P046 的字段隔离。
- 不实现 M1-P070 的八类职能完整内部页面、内部菜单和业务列表；不实现商品、价格、库存、订单、支付、配送、售后、对账。
- 不接真实短信或生产身份提供方。生产凭证及二次验证适配器默认失败关闭；本地测试桩成功不升级为 staging/生产证据。

## 字段、状态和数据范围

- `SupplierUser.supplierId` 仅由审核激活或受信邀请在服务端写入；登录请求、URL、Cookie 外字段和页面状态均不能覆盖。
- `SupplierAuthSelection` 保存 `userId`、哈希后的 nonce、`requestId`、是否需要二次验证、选中账号/会话、到期与使用时间；不保存原始 nonce。
- `AuthSession.userType=SUPPLIER_USER`，`userId`、`functionalAccountId`、`workspaceRoute` 与当前数据库关系必须一致；新会话撤销该自然人旧供应商职能会话。
- 会话 token 由随机服务端 `AuthSession.id` 与服务端 HMAC 密钥确定性派生；选择 nonce 不能推导 token。数据库仍只保存 token 的 SHA-256，重放不覆盖原 hash，响应和日志仍不暴露 token。
- 可登录要求：`Supplier.status=ACTIVE`、`SupplierUser.status=ACTIVE`、职能账号及账号类型均为 `ACTIVE`、账号未过期。
- API-006 的账号卡片必须用同一次服务端时钟判断有效期；库内仍为 `ACTIVE` 但已过期的账号只返回不可用状态，不能让 PAGE-015 先展示为可选再由 API-007 拒绝。
- 供应商暂停、用户锁定/暂停/撤销、职能账号停用/撤销/过期后，旧 Cookie 立即失效。

## API 与 DTO 白名单

| API | 请求 | 成功响应 | 错误码 |
| --- | --- | --- | --- |
| API-006 `POST /v1/supplier-auth/login` | `loginAccount,password,verificationCode?,requestId` | `selectionRequired,selectionNonce,accountSelectRoute,accounts[]` | `AUTH_INVALID`,`SUPPLIER_NOT_ACTIVE`,`ACCOUNT_SUSPENDED`,`RATE_LIMITED`,`VALIDATION_FAILED`,`DATA_SCOPE_FORBIDDEN` |
| API-007 `POST /v1/supplier-auth/workspaces/{accountId}/select` | path `accountId`；body `selectionNonce,secondVerificationCode?` | `ownerType,accountTypeCode,workspaceRoute,expiresAt` | `WORKSPACE_FORBIDDEN`,`WORKSPACE_SESSION_CONFLICT`,`SECOND_VERIFICATION_REQUIRED`,`VALIDATION_FAILED`,`DATA_SCOPE_FORBIDDEN` |

- 账号卡片仅返回 opaque `accountId`、职能名称、所属供应商展示名、固定路由、状态和最近使用时间。
- API-007 响应不返回 `supplierId`、`userId`、`identityId`、`sessionHash`、token、联系方式、供应价、应付、毛利或银行字段；归属只保存在 HttpOnly Cookie 对应的服务端会话中。
- 所有认证成功和失败响应 `Cache-Control: private, no-store, max-age=0`；登录和选择页面 `noindex`。
- `SUPPLIER_AUTH_SESSION_SIGNING_KEY` 在 staging/production 由秘密管理系统运行时注入，必须是 43～128 位 base64url 字符且拒绝开发占位值。轮换该密钥会让现有供应商 Cookie 失败关闭，必须作为显式会话撤销操作安排。
- 供应商门户通过共享 `openapi-fetch` Cookie 客户端发送请求并固定 `credentials: include`，页面不接触原始会话 token。按方案使用同一运营域名：浏览器请求同源 `/v1`，本地 Vite 开发服务器代理到 `127.0.0.1:$API_PORT`，生产由同源网关转发；本切片不开放宽泛跨域 CORS。

## 页面与失败状态

- PAGE-013 `/supplier/register` 保留现有注册表单，并提供明确的已有账号登录入口。
- PAGE-014 `/supplier/login` 提供独立登录、加载、凭证错误、供应商未启用、账号停用、离线和成功状态。
- PAGE-015 `/supplier/account-select` 只展示当前已认证自然人可用的职能账号，覆盖加载、空态、过期/无权限、离线、选择成功和重放恢复。
- 单一有效账号登录后直接导航到服务端返回的固定 `workspaceRoute`；多个账号必须先进入 PAGE-015。

## 先红后绿测试

- `NEG-M1-069-01`：登录/选择请求传入 `supplierId` 等归属覆盖字段时先拒绝且不签发会话。
- `NEG-M1-069-02`：注册与登录独立；非 `ACTIVE` 供应商即使凭证正确也不能进入后台。
- `NEG-M1-069-03`：同一人员多职能不能自动合并进入；选择其他身份、其他供应商或停用账号失败。
- `NEG-M1-069-04`：重复选择同一账号幂等并可恢复丢失响应；同账号并发重放返回同一有效 Cookie，按任意响应顺序应用仍可解析到唯一活动会话；并发/顺序重放选择不同账号仅一个结果，旧会话撤销且审计追加。
- 正向：供应商审核通过后主体管理账号激活；单账号直达；多账号选择后只签发一个固定职能会话；PAGE-013～015 行为与缓存/索引边界通过；Chromium 必须通过真实 Vite 同源代理调用注入式 Nest API 完成登录、选择和 Secure HttpOnly Cookie 落地，不能只靠页面路由 Mock。

## 风险与回滚

- 真实凭证设置、短信和找回密码依赖后续授权身份服务；本切片通过 Adapter 保持生产默认拒绝。
- 会话 HMAC 密钥轮换会撤销所有未到期供应商会话；部署与回滚均须预告重新登录窗口，且不得把旧密钥写回仓库或日志。
- 回滚应用提交时保留新增选择授权表以兼容已发布数据库；数据库修复只允许新的前向迁移，不回改历史 SQL。
- 未经 P069 Draft PR 精确 head CI、人工授权合并及合并后 `main` CI 成功，不进入 M1-P070。
