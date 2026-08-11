# M2-P017 礼盒组合契约

- 阶段：M2
- 唯一目标：P0-017，组合商品明确展示子项、数量、规格和有效期下限。
- 方案依据：§5.4 福利礼盒/组合品、§7.7 分类模板详情、P0-017。
- 依赖：M2-000、M2-P012，以及已合并并通过 `main` CI 的 M2-P016。
- 非目标：P0-018 强监管开关、P0-021/P0-088 完整商品详情、库存预扣、交易、支付、配送、售后执行和供应商店铺。

## 模板与字段

- 新增不可变模板 profile：`GIFT_BOX`。
- 商品字段：
  - `bundle-items`：`BUNDLE_ITEMS`，结构化组合子项快照；每项仅含 `name`、`quantity`、`specification`、`minimumExpiryDays`，以及不对客返回的可选 `supplierProductId`。
  - `packaging`：包装说明。
  - `customization`：定制项说明。
  - `delivery-cycle`：交付周期。
  - `welfare-scenario`：福利场景。
- SKU 维度：`package`、`tier`、`custom-version`。
- 详情模块：`bundle-list`、`welfare-scenario`、`customization`、`specifications`、`gift-box-after-sales`。
- 售后主体固定为江苏福礼团供应链科技有限公司，供应商内容不得覆盖统一售后口径。

## 数据范围与历史

- `supplierProductId` 仅作为供应商草稿域内部引用；服务端使用当前会话派生的 `supplierId` 校验归属，客户端不能提交或覆盖归属字段。
- 跨供应商引用统一返回 `SUPPLIER_SCOPE_FORBIDDEN`，不区分目标不存在还是不属于当前供应商。
- 上架详情读取已审核 `detailSnapshot` 和绑定的模板版本；子项后续变化不得回写已发布礼盒快照。
- `GIFT_BOX` 已发布模板不可修改，返回 `TEMPLATE_VERSION_IMMUTABLE`。

## 公开 DTO 白名单

- 组合清单每项仅返回 `name`、`quantity`、`specification`、`minimumExpiryDays`。
- 继续返回当前平台零售价、公司统一销售/结账标识和模板化 SKU。
- 永不返回 `supplierProductId`、供应价、资质私有引用、审批、结算、毛利或供应商联系方式。

## 失败契约

- `NEG-M2-017-01`：缺少子项或子项数量/规格/有效期下限非法，`BUNDLE_SCHEMA_INVALID`。
- `NEG-M2-017-02`：引用其他供应商草稿，`SUPPLIER_SCOPE_FORBIDDEN`。
- `NEG-M2-017-03`：改写已发布礼盒模板/快照，`TEMPLATE_VERSION_IMMUTABLE`，历史响应保持不变。

## 回滚

- 应用回滚到本切片前提交。
- 数据库只前向扩展 profile 约束；如未创建 `GIFT_BOX` 记录，可用逆向约束迁移移除该枚举。已有礼盒模板时必须先停止回滚并人工迁移数据，禁止删除历史。
