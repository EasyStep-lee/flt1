# M3-P028 企业注册认证契约

## 任务边界

- 阶段：M3；Issue：#91；主验收：P0-028；PAGE-031 同时提供 P0-077 的初始界面证据，但不在本切片宣称 P0-077 完成。
- 目标：企业从“社区集采”入口创建草稿，提交主体、营业执照对象引用、联系人、开票和收货资料，经公司补正/审核后成为 `ACTIVE` 企业。
- 非目标：企业正式登录、采购货架完善、采购车、下单、付款、配送、OA/预算/多级审批。
- EXT-013 合同、对公转账与发票法务财务口径仍为 `BLOCKED_EXTERNAL`；技术闭环不代表正式合规验收。

## 数据与状态

- `EnterpriseCustomer`：固定 `companyId`、企业名称、统一社会信用代码、注册地址、企业类型、营业执照对象键/有效期、联系人、协议版本/状态、认证状态和乐观锁版本。
- `EnterpriseUser`：企业管理员身份、手机号/邮箱及状态；不把企业归属交给客户端决定。注册访问凭据为短期签名令牌，服务端不持久化其明文。
- `EnterpriseAddress`：本企业收货人、电话、地区、详细地址、备注和默认标记。
- `EnterpriseInvoiceProfile`：本企业开票抬头、税号、注册地址/电话、开户行及仅可脱敏回显的银行账号。
- `EnterpriseCertificationSnapshot` 与 `EnterpriseCustomerStatusHistory` 只追加，保留每次提交、补正、审核与暂停的版本证据。
- 状态链：`DRAFT -> PENDING_REVIEW -> CORRECTION_REQUIRED -> PENDING_REVIEW -> ACTIVE -> SUSPENDED`；拒绝进入 `REJECTED`。非法转换不产生部分写入。

## 权限、字段和隐私

- 注册创建前必须通过可替换的手机号验证器；默认实现拒绝并返回 `SERVICE_UNAVAILABLE`。
- 草稿/进度使用短期签名注册访问令牌；对象归属从令牌派生，拒绝客户端 `companyId`、`enterpriseCustomerId`、`status`、`reviewedBy`，且令牌明文不写数据库、服务端 HTML 或日志。
- 公司审核仅允许固定 `/company-admin/workspaces/supplier-ops` 的 `COMPANY_SUPPLIER_OPS` 会话；公司范围从会话派生。
- 对客响应仅返回脱敏手机号、信用代码、税号和银行账号；不返回营业执照原始内容、令牌哈希、供应价、供应商应付、毛利或内部请求快照。
- `/enterprise/register` 及认证 API 均 `noindex,nofollow`、`private/no-store`；认证令牌和敏感表单不得进入服务端 HTML、缓存、日志或埋点。

## API 与错误码

- `POST /v1/enterprise/registrations`：创建企业认证草稿；`Idempotency-Key` 必填。
- `GET/PATCH /v1/enterprise/registrations/me`：按注册令牌读取/维护本企业草稿或补正资料。
- `POST /v1/enterprise/registrations/me/submit-review`：提交或重提审核。
- `GET /v1/company/enterprise-registrations`：公司职能查看认证队列。
- `POST /v1/company/enterprise-registrations/{enterpriseId}/review`：补正、批准或拒绝。
- `POST /v1/company/enterprise-registrations/{enterpriseId}/suspend`：暂停已认证企业并保留历史可读边界。
- 稳定错误：`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`FIELD_FORBIDDEN`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_CONFLICT`、`CREDIT_CODE_DUPLICATE`、`ENTERPRISE_NOT_FOUND`、`ENTERPRISE_SCOPE_FORBIDDEN`、`STATE_TRANSITION_INVALID`、`APPROVAL_VERSION_CONFLICT`、`SERVICE_UNAVAILABLE`。

## 最小验收路径

1. 默认外部验证器拒绝且不创建数据。
2. 创建完整草稿；相同幂等键重放，异体请求冲突；信用代码归一化唯一。
3. 注册令牌只能读取和修改本企业；所有者字段篡改失败且无副作用。
4. 草稿提交，公司要求字段级补正，企业修正重提，公司批准为 `ACTIVE`；版本、快照、状态历史均追加。
5. 并发/旧版本审核只允许一个成功；暂停后禁止新采购但历史资料仍按权限可读（采购执行属于后续切片）。
6. PAGE-031 在本切片实现主体、联系人、开票、收货和首次提交，覆盖加载、失败、重复和成功；响应式且不可索引/公共缓存。完整预览、持久化进度和字段级补正体验留给主任务 M3-P077，当前只记录 `PARTIAL_LOCAL_PASS`。
