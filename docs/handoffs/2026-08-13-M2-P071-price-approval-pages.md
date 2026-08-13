# M2-P071 独立价格与审批页面交接

## 结论与范围

- 当前结论：`LOCAL_PASS`；实现提交 `0a0ed67` 的完整 `pnpm verify` 17/17 通过，仍需 Draft PR、exact-head Actions、人工合并和合并后 main CI。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 分支：`codex/m2-price-approval-pages`；基线：main `b9eb7f7`；Issue：#71。
- 仅完成供应商价格独立页面分区、供应价申请清单、公司价格审核历史意见读取及 DTO 白名单；没有进入 M2-GATE、订单、支付、福利卡、配送、M3、staging、真机或生产。

## 实现与契约

- 供应商价格页以“供应价变更申请”和“销售价直接调价”两个页签清晰分离；供应价表显示旧价、申请价、原因、生效意图、状态和审核意见，两类销售价继续免审版本化。
- 公司价格审核页显示原值、新值、涨跌比例、原因、申请/约定生效时间、版本和意见，并以追加时间线查看完整历史；没有批量通过入口或 API。
- 新增 `GET /v1/supplier/pricing/supply-price-changes` 和 `GET /v1/company/price-reviews/supply-price-changes/{taskId}/history`，归属均从固定职能会话派生。
- 历史 DTO 仅返回事件、前后状态、版本、意见和发生时间，不返回 supplierId、companyId、identityId、functionalAccountId 或审核自然人身份。
- 数据库迁移：`N/A`。复用 M2-P019 的 `SupplyPriceChangeHistory` 追加历史、版本、幂等和异人审核约束，没有新增表或迁移。

## 测试证据

| 证据 | 结果 |
|---|---|
| RED API | 1/2 因供应商申请读取路由 404 失败 |
| RED 契约 | 2/2 因新路径及历史 DTO 缺失失败 |
| GREEN focused API | 3/3 PASS，含重复决策幂等和陈旧并发决策 409 |
| GREEN 契约 | 2/2 PASS，含递归敏感字段白名单检查 |
| P0-071 + P0-019 focused Chromium | 4/4 PASS |
| 工作簿/执行包 | 149 任务、119 P0、100 API；重新导入、渲染、公式错误扫描 0；自检 PASS |
| MySQL 迁移演练 | empty=2、upgrade=2、restore=2、product=24、cleanup=PASS |
| 完整 `pnpm verify` | PASS 17/17，`0a0ed67`，2026-08-13T02:30:13.340Z 至 02:45:06.531Z |

完整验证前四轮失败均如实保留：先后发现 OpenAPI 路径/schema 白名单遗漏、历史交接状态扩展值破坏稳定枚举、历史切片把 M2-P063 写死、Docker Desktop Linux Engine 停止。对应修复为补齐白名单、把重跑事实放入独立字段、更新动态接力断言、恢复 Docker；没有删除测试、降低断言或跳过门禁。第五轮同一聚合器 17/17 通过。

## P0、权限与安全

- P0-071：`LOCAL_PASS`；exact-head `CI_PASS` 尚未执行。
- 供应价只在供应商本方价格职能和公司价格审核职能的私有 `no-store` 页面/API 可见；未加入买家端、门户公开区、跑腿端、缓存、索引或日志。
- 同一自然人自审、二次验证、状态冲突、版本并发和业务键幂等沿用 M2-P019 的服务端规则；页面没有旁路。
- 两个新读取接口使用显式 DTO，不直接序列化 Prisma 实体；OpenAPI 生成、漂移、oasdiff breaking 与秘密扫描均通过。

## 环境、风险与回滚

- 本地 Windows、Node 22.23.1、pnpm 10.12.1、Docker Desktop、MySQL 8.4.11、Chromium 有新鲜证据；CI/staging/device/production 均为 `NOT_EXECUTED`。
- 风险：新列表/历史读取会增加私有价格查询流量，staging 量级下需继续观察索引和分页；本切片没有资金、订单、库存或新迁移风险。
- 回滚：revert 本切片应用/证据提交即可；无 schema 回滚、历史删除或数据修复需求。
- 唯一后续动作：推送并创建 Draft PR，读取 exact-head Actions 和评论。未经对该 head 的明确授权合并、合并及 main CI 通过，不执行 M2-GATE 或进入 M3。
