# M3-P053 福利卡账户选择契约

## 目标与非目标

- 阶段：M3；任务：M3-P053；主验收：P0-053，关联 P0-092 的账户选择技术子行为。
- 唯一目标：针对个人当前购物车，服务端按实时零售价、账户可用余额和计划适用范围，只返回本人当前可用账户，并计算每个账户最大可抵扣额。
- API：API-039 `GET /v1/consumer/welfare-card-accounts/eligible`；页面：PAGE-056 `/pages/checkout/index` 的福利卡选择子区块。
- 非目标：P0-054 适用范围管理、地址/发票与完整确认订单、福利卡冻结或扣减、账本写入、微信支付、混合支付、取消、退款，以及 M4-M6。

## 请求、金额与范围

- 查询只接受成对的 `skuId[]` 与 `quantity[]`，最多 100 项；SKU 不得重复，数量为 1–9999 的整数。
- `companyId`、`consumerUserId`、`buyerId`、价格、配送费、账户 ID 和抵扣金额均不得由客户端提交；未知字段返回 `FIELD_FORBIDDEN`。
- 服务端从当前 ACTIVE 个人会话派生公司和用户，重新读取可售零售 SKU 与整数分零售价；缺失、跨公司、下架、关闭零售或非法价格均以 `PRODUCT_NOT_SALEABLE` 关闭失败。
- 账户可用额为 `max(0, balanceAmount-frozenAmount)`；商品适用额按 `ALL_PRODUCTS|CATEGORY|PRODUCT|SKU` 及 `includedIds/excludedIds` 逐行计算。
- 最大可抵扣额固定为 `min(可用额, 可适用商品金额 + 计划允许时的服务端配送费)`；本切片配送费仍为服务端固定 0，不接受客户端覆盖。
- 仅返回最大可抵扣额大于 0 的账户；余额、冻结额或规则异常的账户关闭失败并不展示。

## 权限、DTO 与零副作用

- Prisma 查询先限定 `consumerUserId`、公司、账户 ACTIVE、计划 `ACTIVE+APPROVED` 和批次 `ISSUED`；服务层再次核对公司、用户和状态。
- 响应白名单：本单商品/配送/总额，以及账户 ID、计划名、掩码卡号、余额/冻结/可用额、状态、版本、范围类型/说明、可适用额和最大可抵扣额。
- 响应不含完整卡号、卡密、公司/用户/批次/计划内部归属、供应价、供应商应付或任何 `PERSONAL_RECHARGE` 字段。
- 响应固定 `Cache-Control: private, no-store` 与 `X-Robots-Tag: noindex, nofollow`。
- API-039 是可重复的只读计算：不创建订单、不预扣库存、不冻结/扣减福利卡、不追加账本、不写审计或幂等命令。

## 页面与失败行为

- PAGE-056 从本地购物车只提取 SKU 和数量，经 `miniapp-kit` 唯一 `wx.request` 适配器调用生成契约类型。
- 页面显示 loading、empty、error、permission、offline、success；用户只能选择一个账户或“不使用福利卡”，没有手输抵扣金额控件。
- 选择仅保存账户 ID 供后续独立支付切片使用；页面明确说明当前不执行冻结、扣款或支付，不把模拟选择冒充资金完成。
- NEG-M3-P053-01：非法字段、商品/数量或金额溢出返回稳定错误且零写。
- NEG-M3-P053-02：未登录、停用会话、跨用户账户均不展示且零写。
- NEG-M3-P053-03：无效计划/批次/账户、范围不适用、重复或并发读取均确定且零副作用。

## 数据库与环境边界

- 本切片不新增迁移：M3-P051/P052 已有 `WelfareCardProgram.scopeType/scopeRules/canPayDeliveryFee`、账户余额/冻结/状态及商品分类/商品/SKU 字段足以完成只读计算。
- staging、真机、生产均未执行；Node VM/Playwright 仅提供自动化技术证据，不升级为 `DEVICE_PASS`。
- 真实福利计划、真实账户余额、财务口径和实际支付仍受 EXT-012 与后续人工/外部门禁约束。
