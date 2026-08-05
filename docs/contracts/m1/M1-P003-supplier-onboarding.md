# M1-P003 供应商入驻纵向切片契约

## 目标与边界

本切片只实现 `P0-003`：供应商公开注册、草稿补正、提交审核、公司供应商运营审核，以及
`DRAFT`、`PENDING_REVIEW`、`CORRECTION_REQUIRED`、`ACTIVE` 四种入驻状态的可见性。
唯一产品基线为 `福礼社单商户供应链平台V1.1综合方案.html`，机器契约为
`artifacts/verification/M1-000/m1-contract-freeze.json`。

本切片不实现供应商登录/账号选择、职能账号邀请、商品、价格、库存、交易、支付、配送、
对账或结算。供应商不是店铺，也不是对客交易或收款主体。生产会话与短信验证码的真实
适配由后续任务接入；默认适配器必须安全拒绝，自动化测试只能通过显式注入的测试替身运行。

## 服务端所有权与鉴权接缝

- 公开注册请求禁止 `companyId`、`supplierId`、`status`、`actorId`、`applicantId` 和
  `reviewedBy`；`companyId` 只绑定唯一有效 Company。
- `PATCH /v1/supplier/me` 与 `POST /v1/supplier/me/submit-review` 的 `supplierId` 只来自
  服务端认证上下文，不接受请求头、查询参数、路径或请求体覆盖。
- `GET /v1/company/suppliers` 与审核接口只接受 `COMPANY_SUPPLIER_OPS` 固定职能会话。
- M1-P069/M1-P070 完成前，生产默认认证解析器拒绝私有接口；测试通过依赖注入提供受信上下文，
  不在生产代码中加入可由客户端伪造的测试身份头。

## DTO 白名单

### 公开注册

`SupplierRegistrationRequest` 只接受：`legalName`、`creditCode`、`contactName`、`mobile`、
`email?`、`verificationCode`、`qualificationFiles[]`、`pickupAddress`、`pickupLat`、
`pickupLng`、`agreementVersion`。入驻允许先保存不完整的资质或取货点草稿；提交审核时再执行
完整性校验。资质文件值是已上传文件的受控引用，不接收文件正文或任意外链。

`SupplierRegistrationResponse` 只返回 `registrationId`、`status`、`nextAction`、
`submittedAt?`，不得回显验证码、手机号、邮箱、完整资质快照、结算资料或内部归属字段。

### 草稿补正与提交

`SupplierProfilePatchRequest` 只接受冻结字段 `version`、取货点和资质快照；服务端控制主体、
信用代码、状态和结算资料。只有 `DRAFT` 或 `CORRECTION_REQUIRED` 可修改。提交审核要求：

- 至少一个资质文件引用；
- 取货地址非空且不超过 500 字；
- 纬度在 -90..90、经度在 -180..180；
- 请求版本与当前版本一致。

`EXT-006` 的正式准入资质清单仍未提供，因此这里只使用可配置的最低完整性规则，不把任何
测试文件解释成真实合规结论。

### 公司审核

审核决定只允许 `REQUEST_CORRECTION` 或 `APPROVE`。补正意见必须为 1..1000 字；审核版本必须
与当前待审任务一致。审核人与申请人的自然人标识由服务端写入，历史状态事件和审核任务只追加
或版本推进，不覆盖旧证据。

## 状态机

本切片实现并测试：

1. `DRAFT --SUBMIT--> PENDING_REVIEW`
2. `PENDING_REVIEW --REQUEST_CORRECTION--> CORRECTION_REQUIRED`
3. `CORRECTION_REQUIRED --RESUBMIT--> PENDING_REVIEW`
4. `PENDING_REVIEW --APPROVE--> ACTIVE`

冻结的 `ACTIVE -> SUSPENDED/EXITING -> EXITED` 仍保留在 M1 总契约中，但当前 API 没有对应请求
DTO，不在本切片擅自扩展。

## 幂等、并发与错误

- 所有写接口要求 `Idempotency-Key`；注册的同键同体重放返回第一次结果，不生成第二个 Supplier。
- 统一社会信用代码先去首尾空白并转大写，再以唯一索引和事务双重防重。
- 更新、提交与审核使用整数 `version` 乐观锁；受影响记录不是恰好一条时返回版本冲突。
- `NEG-M1-003-01`：重复主体返回 `409 SUPPLIER_DUPLICATE`。
- `NEG-M1-003-02`：草稿被直接批准返回 `409 STATE_TRANSITION_INVALID`，状态不变。
- `NEG-M1-003-03`：注册幂等重放返回原结果，数据库只有一个主体。
- `NEG-M1-003-04`：资料不完整提交返回 `422 VALIDATION_FAILED`，草稿仍可编辑。

## 页面和缓存

- `/supplier/register`：公开但 `noindex,nofollow` 且 `no-store`，包含资料表单、暂存结果、状态和
  下一步提示；不得把申请进度当作供应商业务会话。
- `/company-admin/workspaces/supplier-ops`：只呈现供应商入驻列表、状态筛选、资质摘要和审核动作；
  永不返回或展示供应价。
- 两页采用“蓝绿供应链专业感＋暖红福利元素”，覆盖 loading、empty、error、
  permission-denied、offline-or-timeout 和 success 状态。
