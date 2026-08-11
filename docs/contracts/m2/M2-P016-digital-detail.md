# M2-P016 数码详情契约

## 任务卡

- 阶段：`M2`。
- 唯一目标：完成 `P0-016` 数码分类模板、供应商数码商品与型号 SKU 校验、公开详情 DTO 白名单、公司模板预置和用户原生小程序数码详情区块。
- 方案章节：第五章 5.2、5.4；第七章 7.7；P0-016。
- 前置：`P0-015` 已通过 PR #56 合并为 `main@dfd03e1b0ba554c56231e5c6b4c5515d15d772a6`，合并后 CI run `31462310044` 成功。
- 非目标：`P0-017` 及以后模板、`P0-021`/`P0-088` 完整商品详情、正式生产数据、价格审批、库存扣减、交易、支付与配送。

## 字段、SKU 和模块

| 范围 | 键 | 类型/规则 | 公开模块 |
| --- | --- | --- | --- |
| 商品 | `dimensions` | 必填纯文本 | `technical-parameters` |
| 商品 | `power` | 必填纯文本 | `technical-parameters` |
| 商品 | `voltage` | 必填纯文本 | `technical-parameters` |
| 商品 | `interfaces` | 必填纯文本 | `technical-parameters` |
| 商品 | `energy-efficiency` | 必填纯文本 | `energy-efficiency` |
| 商品 | `execution-standard` | 必填纯文本 | `technical-parameters` |
| 商品 | `package-list` | 必填富文本语义、按纯文本安全展示 | `package-and-installation` |
| 商品 | `installation-instructions` | 必填富文本语义、按纯文本安全展示 | `package-and-installation` |
| 商品 | `warranty-period` | 必填纯文本 | `warranty` |
| SKU | `color` | 必填纯文本规格维度 | `specifications` |
| SKU | `capacity` | 必填纯文本规格维度 | `specifications` |
| SKU | `model` | 必填纯文本规格维度；归一后唯一 | `specifications` |

型号经 `NFKC + trim + lowercase` 归一后必须在同一商品内唯一，重复返回 `DIGITAL_MODEL_DUPLICATE`，且不创建供应商商品。`digital-after-sales` 是 `AFTER_SALE` 模块，只从已发布模板 `afterSaleRules` 生成；供应商商品 JSON 不能覆盖。对客固定显示江苏福礼团供应链科技有限公司为唯一销售、结账和售后主体。

## 权限、数据范围和历史

- 模板仍只由公司 `COMPANY_PRODUCT_OPS` 独立页面创建、编辑和发布。
- 供应商只能在本方商品中写入已发布模板允许的字段；`supplierId` 从已验证会话派生。
- 已发布 `profile + fieldSchema + skuDimensions + detailModules + afterSaleRules` 不可原地覆盖；商品继续引用原 `categoryId + templateVersion` 快照。
- 公开 DTO 永不返回供应价、资质私有引用、内部审批快照、`companyId`、`functionalAccountId`、`identityId` 或结算字段。

## OpenAPI、错误码和验收

- 复用 `GET /v1/catalog/products/{productId}`；响应 `templateProfile` 扩展为 `FOOD|FRESH|APPAREL|DIGITAL`，其他白名单字段保持兼容。
- `DIGITAL_REQUIRED_FIELD_MISSING`：必填商品字段或 SKU 维度缺失。
- `DIGITAL_MODEL_DUPLICATE`：SKU 型号归一后重复。
- `DIGITAL_HISTORY_REWRITE`：尝试修改已发布的数码模板版本。
- `TEMPLATE_SCHEMA_INVALID`：数码模板缺失固定字段、模块或三个 SKU 维度。
- `TEMPLATE_DATA_INVALID`：供应商字段越过已发布模板白名单、含危险标记或试图覆盖公司售后/保修规则。
- `PRODUCT_NOT_SALEABLE`：非在售、非零售、无启用 SKU 或快照不完整。
- P0 映射：`P0-016`；`P0-021` 和 `P0-088` 仍为 `NOT_EXECUTED`。

## 最小验收路径

1. 数码模板结构、必填字段和型号唯一性单元测试先 RED 后 GREEN。
2. 公司模板 API、供应商商品 API、公开详情 API 覆盖正常、缺失、重复、历史及敏感字段路径。
3. 公司独立页面创建 DIGITAL 草稿，用户小程序通过生成契约渲染数码模块及失败/重试状态。
4. 执行 focused、全量 API/P0、迁移演练、OpenAPI 确定性和 `pnpm verify`。
