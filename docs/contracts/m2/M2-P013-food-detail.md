# M2-P013 食品详情契约

- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 阶段/任务：`M2 / M2-P013`
- P0：`P0-013`
- Issue：[#51](https://github.com/EasyStep-lee/flt1/issues/51)
- 基线：`main@9a85a641624951310a984fc844562265db20cb82`
- 分支：`codex/m2-food-detail`
- 当前证据：`NOT_EXECUTED`；先冻结契约，再取得行为 RED

## 唯一目标与完成定义

在 P012 已发布模板版本基础上实现 `FOOD` 详情类型。食品模板发布前必须证明配料、营养成分、生产许可、保质期、储存方式和过敏原六项为必填字段，口味、净含量和包装数为 SKU 规格维度，并包含固定食品安全提示模块。供应商商品进入资料审核前按模板校验；公司双审物化后，对客商品详情按已绑定模板版本和商品快照白名单渲染。

完成需要模板类型的向前迁移、模板/商品校验、公开详情 API、用户小程序详情页面、确定性 OpenAPI，以及 focused、API、P0 E2E、迁移演练和 `pnpm verify` 的新鲜证据。

## 非目标

- 不实现或宣称完成生鲜、服饰、数码、礼盒模板（P0-014 至 P0-017）。
- 不实现强监管品类开关 P0-018，不导入真实生产分类、资质或商品数据。
- 不改变公司统一销售、收款和售后主体；不增加供应商店铺或供应商直接结账。
- 不进入价格变更、库存扣减、购物车、订单、支付、配送或结算。

## 字段字典与固定结构

| 对象/字段 | 规则 |
| --- | --- |
| `CategoryTemplate.profile` | `GENERIC \| FOOD`；现有模板向前迁移为 `GENERIC`，仅 `FOOD` 启用本切片规则 |
| `ingredients` | 配料表，产品级必填纯文本，详情进入 `ingredients-nutrition` |
| `nutrition-facts` | 营养成分，产品级必填纯文本，详情进入 `ingredients-nutrition` |
| `production-license` | 生产许可证信息，产品级必填纯文本，详情进入 `production-information` |
| `shelf-life` | 保质期，产品级必填纯文本，详情进入 `production-information` |
| `storage-method` | 储存方式，产品级必填纯文本，详情进入 `consumption-storage` |
| `allergens` | 过敏原，产品级必填纯文本；无已知过敏原也必须显式填写，不接受空值 |
| `flavor` | 口味，SKU 必填规格字段和维度 |
| `net-content` | 净含量，SKU 必填规格字段和维度 |
| `package-count` | 包装数，SKU 必填规格字段和维度 |
| `food-safety-warning` | 服务端固定 `NOTICE` 模块；提示正文不来自供应商或公司富文本，客户端不可覆盖 |
| `Product.detailSnapshot` | 继续保存审核时的名称、品牌、属性和资质快照；详情读取商品绑定的精确模板版本，不读取后来活动版本 |

食品模板可包含额外公司定义的纯文本字段，但字段键必须在模板白名单内；产品级属性和 SKU 属性不得夹带未定义键、HTML、脚本、样式、固定提示保留键或供应价字段。

## 状态、历史与安全

1. `FOOD` 草稿在创建和修改时即校验固定结构；发布前再次校验，失败不写模板、历史或审计。
2. 供应商商品草稿可以修正，但提交资料审核时必须完整满足其精确 `FOOD` 模板版本；缺项返回 `TEMPLATE_DATA_INVALID`。
3. `food-safety-warning`、`regulatoryWarning` 等保留键以及任何试图隐藏、覆盖固定提示的 HTML/CSS 内容返回 `REGULATORY_WARNING_REQUIRED`。
4. 已发布/退役模板不可改；模板升级只影响新绑定商品，既有 `Product.categoryId + templateVersion + detailSnapshot` 不变。
5. 对客 DTO 只返回名称、品牌、零售价、SKU 展示规格、模板版本和排序后的详情模块；不得返回供应价、公司/职能身份、审批、资质对象地址、结算或内部快照。
6. 公开详情仅返回 `ACTIVE + retail enabled + 至少一个 ACTIVE SKU` 商品；缓存为短时公开缓存，错误不降级为其他商品。

## API、页面与错误码

- 模板管理现有 API 增加 `profile`；PAGE-005 提供明确的食品模板预置入口并展示固定字段摘要。
- `GET /v1/catalog/products/{productId}`：返回公司统一货架中的食品详情白名单；本切片细化既有 `API-030` 的 `P0-013` 子集，`P0-021` 与 `P0-088` 仍未完成。
- 用户小程序新增 `pages/product-detail/index`；唯一通过 `miniapp-kit` 的 `wx.request` 适配器调用生成契约，覆盖 loading、success、error、retry 和非食品/不可售错误。
- 主要错误码：`TEMPLATE_SCHEMA_INVALID`、`TEMPLATE_DATA_INVALID`、`REGULATORY_WARNING_REQUIRED`、`TEMPLATE_VERSION_IMMUTABLE`、`PRODUCT_NOT_FOUND`、`PRODUCT_NOT_SALEABLE`。

## RED 与完成定义

- `NEG-M2-013-01 / FOOD_REQUIRED_FIELD_MISSING`：缺任一固定字段、模块或 SKU 维度时返回 `TEMPLATE_SCHEMA_INVALID` 且无副作用。
- `NEG-M2-013-02 / FOOD_WARNING_OVERRIDE`：供应商属性或富文本试图隐藏/改写固定食品提示时返回 `REGULATORY_WARNING_REQUIRED`，固定提示仍由服务端生成。
- `NEG-M2-013-03 / FOOD_HISTORY_REWRITE`：发布食品模板新版本后，既有商品详情仍使用原模板版本与审核快照，字节等价的历史模板定义未被更新。
- 正常流显示六项食品信息、三个 SKU 维度和固定提示；公开响应及小程序构建制品不得包含供应价字段。
- staging、真实商品/资质、真机和 production 保持 `NOT_EXECUTED`。
