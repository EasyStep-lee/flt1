# M1-P004 供应商对象与数据范围隔离交接

## 结论

- 任务：`M1-P004`，P0：`P0-004`。
- 本地结论：`DONE / LOCAL_PASS`。
- 已验证实现 head：`a33af8067c1ac17251223682a588a85292038630`。
- 对比基线：`171e1964edb6d13d39bd529e5e767e8792926272`（M1-P003 合并后的 `main`）。
- 下一顺序任务：`M1-P005`，只处于 `READY`；本任务完成 Draft PR 精确 head CI、自审授权、合并和合并后 main CI 前不得启动。

## 本切片实现

- 新增统一供应商数据范围策略，冻结 `SUPPLIER_PROFILE / PRODUCT / ORDER / INVENTORY / STATEMENT / ACCOUNT` 六类资源的服务端供应商归属检查。
- 新增 `GET /v1/supplier/me`，供应商身份只来自认证上下文，不接收客户端 `supplierId`；响应继续使用买方安全白名单 DTO。
- 已有供应商私有补正与提交审核写接口拒绝客户端 `companyId / functionalAccountId / supplierId` 所有权字段。
- 越权访问存在对象与探测不存在对象返回相同 `SUPPLIER_SCOPE_FORBIDDEN`，不泄露对象是否存在；导出前发现任一跨供应商记录时整批拒绝并返回 `DATA_SCOPE_FORBIDDEN`。
- OpenAPI 与生成类型确定性更新；无 Prisma 模型或迁移变化。

## 先红后绿证据

- RED：单元测试先因 `dist/supplier-scope/supplier-scope.policy.js` 不存在而报 `ERR_MODULE_NOT_FOUND`；API 测试先期望 `GET /v1/supplier/me` 为 `200`、实际为 `404`。既有 M1-P003 API 测试仍为 `8/8 PASS`。
- GREEN：范围策略 `3/3`，供应商 API `9/9`，M1-P004 契约 `2/2`；P003/P004 组合契约 `8/8`。
- OpenAPI：生成后字节一致；兼容扫描为 `40 WARN / 0 ERROR`，警告来自共享错误码枚举的加法变化。
- Prisma：Schema 有效；无新迁移；本地 Docker MySQL 演练 `empty=2 / upgrade=2 / restore=2 / product=3 / cleanup=PASS`。
- 根门禁：`pnpm verify` `17/17 PASS`，机器报告绑定实现提交 `a33af806...`。

## P0 证据边界

- 已验证的是服务端统一范围策略、本人资料读取、所有权字段拒绝、对象存在性不泄露和导出前混入拒绝。
- 商品、订单、库存、对账、账号的业务 CRUD 和导出端点尚未进入当前阶段；策略已冻结，但后续每个真实入口仍须接入并新增集成测试。
- 本 API 策略切片不包含浏览器页面或真机；不把现有 P0 浏览器回归冒充为 P0-004 页面验收。

## 环境、风险与回退

- 证据环境：Windows 本地工作区、Node/pnpm、Docker MySQL；预发布、生产和正式验收均未执行。
- 生产职能会话解析器仍按 M1-P069/M1-P070 边界默认拒绝；真实资源端点未实现是当前主要剩余风险。
- 既有 Vite 大 chunk、Turbo no-output、`NO_COLOR` 警告继续保留；本切片未声称修复。
- 回退应用代码、契约和测试时反向回退本切片提交即可；没有数据库迁移需要撤销。任何已发布迁移仍只能通过向前修复或备份恢复处理。

## 恢复顺序

- 读取根与提示词包 `AGENTS.md`、基线锁、本交接、项目状态和 `M1-P005` 任务行。
- 实时核验本任务 Draft PR 的精确 head CI、未解决评论、自审授权、合并和合并后 main CI。
- 外部闭环完成前不得把 `M1-P005` 置为 `IN_PROGRESS`，不得进入 M2。
