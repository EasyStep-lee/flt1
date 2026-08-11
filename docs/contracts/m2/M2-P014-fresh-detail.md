# M2-P014 生鲜详情契约

## 任务卡

- 阶段：`M2`。
- 唯一目标：完成 `P0-014` 生鲜分类模板、供应商内容校验、公开详情 DTO 白名单、公司模板预置和用户原生小程序生鲜详情区块。
- 方案章节：第五章 5.1、5.4、5.5；第六章 6.1。
- 前置：`P0-013` 已合并为 `main@81e3808c7a40824999d1ea70dd9706024e979370`，合并后 CI run `31448561555` 通过。
- 非目标：`P0-015` 及以后模板、`P0-021`/`P0-088` 完整商品详情、正式生产数据、价格、库存扣减、交易、支付与配送。

## 字段和模块

| 范围 | 键 | 类型/规则 | 公开模块 |
| --- | --- | --- | --- |
| 商品 | `variety` | 必填纯文本 | `origin-traceability` |
| 商品 | `grade` | 必填纯文本 | `origin-traceability` |
| 商品 | `origin` | 必填纯文本 | `origin-traceability` |
| 商品 | `harvest-slaughter-date` | 必填 ISO 日期 | `freshness-storage` |
| 商品 | `freshness-period` | 必填纯文本 | `freshness-storage` |
| 商品 | `temperature-zone` | `AMBIENT|CHILLED|FROZEN` | `freshness-storage` |
| 商品 | `weighing-rule` | `FIXED_WEIGHT|ACTUAL_WEIGHT` | `weighing-difference` |
| SKU | `weight-tier` | 必填纯文本规格维度 | `specifications` |
| SKU | `specification` | 必填纯文本规格维度 | `specifications` |
| SKU | `processing-method` | 必填纯文本规格维度 | `specifications` |

`fresh-after-sales` 是 `AFTER_SALE` 模块，只从已发布的 `afterSaleRules` 生成；供应商商品 JSON 不能覆盖。对客固定显示江苏福礼团供应链科技有限公司为唯一销售、结账和售后主体。

## 权限、数据范围和历史

- 模板仍只由公司 `COMPANY_PRODUCT_OPS` 独立页面创建、编辑和发布。
- 供应商只能在本方商品中写入已发布模板允许的字段；`supplierId` 从已验证会话派生。
- 已发布 `profile + fieldSchema + skuDimensions + detailModules + afterSaleRules` 不可原地覆盖；商品继续引用原 `categoryId + templateVersion` 快照。
- 公开 DTO 永不返回供应价、资质私有引用、内部审批快照、`companyId`、`functionalAccountId` 或结算字段。

## OpenAPI、错误码和验收

- 复用 `GET /v1/catalog/products/{productId}`；响应 `templateProfile` 扩展为 `FOOD|FRESH`，其他白名单字段保持兼容。
- `FRESH_REQUIRED_FIELD_MISSING`：必填商品字段或 SKU 规格缺失。
- `FRESH_WEIGHT_RULE_INVALID`：称重规则、温区或采收/屠宰日期不符合已发布模板。
- `FRESH_HISTORY_REWRITE`：尝试修改已发布的生鲜模板版本。
- `PRODUCT_NOT_SALEABLE`：非在售、非零售、无启用 SKU 或快照不完整。
- P0 映射：`P0-014`；`P0-021` 和 `P0-088` 仍为 `NOT_EXECUTED`。

## 最小验收路径

1. 生鲜模板结构和数据校验单元测试先 RED 后 GREEN。
2. 公司模板 API、供应商商品 API、公开详情 API 覆盖正常、缺失、非法、历史及敏感字段路径。
3. 公司独立页面创建 FRESH 草稿，用户小程序通过生成契约渲染生鲜模块及失败/重试状态。
4. 执行 focused、全量 API/P0、迁移演练、OpenAPI 确定性和 `pnpm verify`。
