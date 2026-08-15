# M3-P029 统一企业采购切片交接

- 结论：LOCAL_PASS（待 Draft PR 精确 head CI、人工合并与 post-merge main CI）
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 仓库：`EasyStep-lee/flt1`
- 基线：`main@fa083beb195c769cc4168dcac38e817e3df2a873`
- 分支：`codex/m3-enterprise-procurement`
- Issue：[#93](https://github.com/EasyStep-lee/flt1/issues/93)
- PR/CI：尚未创建/NOT_EXECUTED

## 唯一目标与非目标

实现认证企业跨供应商提交一个公司主订单时的企业结算聚合：会话派生企业和采购员，校验所选地址/发票归属，固化不可变快照，并冻结 `WECHAT_PAY` 或 `BANK_TRANSFER` 单一付款路由。未实现 P0-079/P0-080 完整页面、供应商备货、企业统一配送、收货、售后或发票执行；不创建 `DeliveryTask`。

## 数据、状态与接口

- MIG-015：新增 `EnterpriseProcurementOrder`，与 `BuyerOrder` 一对一，保存企业/采购员归属、地址/发票 JSON 快照、付款方式、转账审核状态、订单状态和版本。
- 数据库触发器禁止修改所有者、快照、付款方式和创建时间，禁止删除聚合。
- `POST /v1/enterprise/orders` 请求新增 `enterpriseAddressId`、`invoiceProfileId`、`paymentMethod`；拒绝客户端 `enterpriseCustomerId`、`purchaserUserId` 等所有者字段。
- 响应仅返回脱敏手机号、税号和已脱敏银行账号；不返回供应价或内部所有者 ID。
- 对公转账提交/复核和微信回调在各自事务中同步推进企业采购状态；付款路由不可交叉。

## 新鲜测试证据

- RED：实现前新增企业结算字段后预期 201，实际 422。
- GREEN focused：统一企业采购 + 旧跨供应商 API 共 10 tests PASS。
- Prisma 仓储：订单、微信支付、企业转账共 13 tests PASS。
- Prisma validate PASS；MIG-015 真实 MySQL 8 dry-run `empty=2 upgrade=2 restore=2 product=30 cleanup=PASS`。
- OpenAPI generate/check PASS；`pnpm verify` 17/17 PASS（含 API 217/217、P0 E2E 70/70、真实 MySQL 迁移演练、构建与秘密扫描）。

## P0 与环境边界

P0-029 仅登记当前自动化技术部分为 partial evidence，整体仍为 `NOT_EXECUTED`：完整门户采购界面、统一配送、收货、售后和发票均未在本切片执行。真实微信支付、银行转账、staging、真机、生产均未执行，不得升级为更高证据等级。

## 风险与回滚

- 风险：MIG-015 新表引用 MIG-011 企业主体和既有 BuyerOrder；生产应用前仍需 staging 备份/恢复演练。
- 回滚：代码提交可原子 revert；已应用迁移不得回写，使用向前修复迁移。新表存在写入后不得直接删除。
- 用户未跟踪文件均保持原状，未纳入本切片。

## 下一门禁

本切片 Draft PR 的最新 head CI 成功、人工明确授权合并且 `main` post-merge CI 成功前，M3-P030 及后续阶段保持锁定。
