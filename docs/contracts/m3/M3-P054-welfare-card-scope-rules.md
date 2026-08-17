# M3-P054 福利卡适用范围统一校验契约

## 目标与非目标

- 阶段：M3；任务：M3-P054；主验收：P0-054，关联 P0-021、P0-092 的适用提示技术子行为。
- 唯一目标：由 API-039 对购物车逐 SKU 统一判定分类/商品/SKU 白名单、黑名单与配送费规则，并让商品详情、购物车、确认订单复用同一结果与原因。
- API：沿用 `GET /v1/consumer/welfare-card-accounts/eligible`；页面：商品详情、PAGE-055 购物车、PAGE-056 确认订单。
- 非目标：计划审批/发行/启用，福利卡冻结、扣减、账本、微信支付、混合支付、取消退款、配送费计价，以及 P0-055 以后能力。

## 规则版本与优先级

- 继续接受版本 1：`ALL_PRODUCTS|CATEGORY|PRODUCT|SKU` 配合 `includedIds/excludedIds`，不改变既有计划语义。
- 增加 `COMPOSITE` 及版本 2：`categoryIncludedIds`、`productIncludedIds`、`skuIncludedIds`、`categoryExcludedIds`、`productExcludedIds`、`skuExcludedIds`。
- 黑名单先判定：SKU、商品或分类命中任一黑名单即不可用；其中商品黑名单必须覆盖分类、商品或 SKU 白名单。
- 未命中黑名单时，只要任一白名单非空，就必须命中任一白名单才可用；所有白名单为空时默认可用。
- 每个列表内部禁止重复；允许同一资源同时存在于对应白名单和黑名单，以便明确验证黑名单优先。六个列表合计最多 1000 个 UUID，拒绝未知字段与错误版本。
- 数据库存量继续使用 `WelfareCardProgram.scopeType` 与 JSON `scopeRules`，本切片无需迁移；读取到非法或不匹配规则时关闭失败，不展示对应账户。

## API-039 响应白名单

- 每个返回账户增加 `itemApplicability[]`：仅含请求中的 `skuId`、`eligible`、整数分 `eligibleAmount` 与稳定原因。
- 原因白名单：`ALL_PRODUCTS`、`DEFAULT_INCLUDED`、`CATEGORY_INCLUDED`、`PRODUCT_INCLUDED`、`SKU_INCLUDED`、`CATEGORY_EXCLUDED`、`PRODUCT_EXCLUDED`、`SKU_EXCLUDED`、`OUTSIDE_WHITELIST`。
- 每个账户增加 `deliveryFeeApplicability`：仅含 `eligible` 与整数分 `eligibleAmount`；配送费仍由服务端拥有，本切片固定为 0，客户端不得提交或覆盖。
- 聚合公式固定为 `eligibleGoodsAmount + eligibleDeliveryFee`，再以账户可用余额取最小值；商品价格继续由服务端实时读取。
- 不返回计划规则清单、分类/商品内部编号、完整卡号、归属字段、供应价或任何个人充值字段。

## 三页面一致性与失败行为

- 三页面都只消费 API-039 的逐行结论，不在客户端复刻白名单/黑名单优先级。
- 商品详情公开数据仍可独立加载；未登录、离线或资格服务失败时显示“登录后查看”或“暂时无法判断”，不得把商品详情整体置为失败。
- 购物车显示每个 SKU 的“福利卡可用/当前账户不可用/登录后查看或暂时无法判断”，资格查询失败不得阻止普通微信结算入口。
- 确认订单按账户显示逐行原因及配送费是否适用，不允许手输抵扣额。
- NEG-M3-P054-01：非法版本、字段、UUID、列表内重复或超限返回稳定 `VALIDATION_FAILED` 且零写。
- NEG-M3-P054-02：未登录、停用会话与跨用户账户不泄露规则或适用结论。
- NEG-M3-P054-03：并发/重复读取结果确定、零副作用；非法存量规则关闭失败。

## 环境边界

- 自动化只证明本地/CI 技术行为；真实计划、真实商品、真机弱网、staging、生产与实际支付均不在本切片证据等级内。
- 永久不增加个人现金充值、客户端配送费、供应商收款或供应价对客字段。
