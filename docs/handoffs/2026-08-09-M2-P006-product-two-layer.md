# M2-P006 商品两层模型交接

## 结论

`LOCAL_PASS`。本地完成供应商商品资料层到公司可售商品层的最小纵向切片；P0-006 有新鲜行为证据。CI、staging、真机和 production 均未被本地证据替代，其中本切片 Draft PR/CI/人工合并/合并后 `main` CI 为 `NOT_EXECUTED`。

## 基线与 Git

- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 仓库：`EasyStep-lee/flt1`。
- 基线：`main@2f52c218ab88f3a7419f2a77b7e6b730fd7365b6`，对应 M2-000 PR #36 合并提交。
- 当前分支：`codex/m2-product-model`。
- Issue：[#37](https://github.com/EasyStep-lee/flt1/issues/37)。
- 实现提交：`575109830ad9b23407a22ea417a9180b0dc14000`。
- PR：`NOT_CREATED`；Draft/Ready、最新 CI、评论、合并状态均为 `NOT_EXECUTED`。

## 实际变更

- Prisma：增加 `SupplierProduct`、`SupplierProductSku`、状态历史、命令幂等、`Product`、`Sku`；新增迁移 `20260809074000_m2_product_two_layer_model`。
- 领域/API：供应商资料草稿、修改、提交；会话派生供应商范围；请求字段白名单；双审门禁；幂等与并发物化。
- OpenAPI：API-019 至 API-021；生成统一类型；响应 DTO 不含归属和任何价格字段。
- 页面：供应商商品职能独立工作区 `/supplier/workspaces/product/products`，只维护商品资料和 SKU，不含价格控件。
- 证据：任务/P0/页面/API/迁移/测试台账、项目状态、工作簿均同步到 `LOCAL_PASS` 边界。

## RED / GREEN / 回归

| 类型 | 命令 | 结果 |
| --- | --- | --- |
| RED | `pnpm exec vitest run apps/api/test/supertest/supplier-products-api.test.mjs --config vitest.config.ts --project api-contract` | FAIL：缺少 `in-memory-supplier-product.repository.js`，证明行为尚未实现 |
| focused API | 同上 | PASS：1 文件 / 5 测试 |
| focused page | `pnpm exec playwright test tests/e2e/p0/p0-006-product-two-layer.spec.ts --config playwright.p0.config.ts --project chromium` | PASS：1 测试 |
| 页面回归 | `pnpm --filter @fulishe/supplier-portal build` 后运行 `p0-070-supplier-workspaces.spec.ts` | PASS：3 测试 |
| API 集成 | `pnpm test:api` | PASS：18 文件 / 103 Vitest 测试，另 3 项 Node contract 测试 |
| Prisma | `pnpm prisma:validate`、`pnpm prisma:migrate:dry-run` | PASS：empty=2、upgrade=2、restore=2、product=12、cleanup=PASS |
| OpenAPI | `pnpm openapi:generate`、`pnpm openapi:check` | PASS：字节确定性 |
| 全量 | `pnpm verify` | PASS：`PNPM_VERIFY_OK:steps=17`；P0 E2E 25/25；退出码 0 |

## P0 与环境证据

- P0-006：`LOCAL_PASS`。
- CI：本切片 `NOT_EXECUTED`。
- staging：`NOT_EXECUTED`；真实 MySQL 迁移、数据回填和回滚演练尚未在 staging 执行。
- device：`NOT_REQUIRED_M2_P006_BROWSER_ONLY`；不声称真机通过。
- production：`NOT_EXECUTED`。

## 风险与回滚

- 当前分类/模板只校验标识格式；真实末级分类、启用状态和模板版本约束属于 M2-P011/M2-P012。
- 初始价格审核页面属于 M2-P007/M2-P008；当前内部物化门禁可阻止未双审商品进入公司货架。
- 代码回滚：按原子提交 revert；不改写公共历史。
- 数据库回滚：本地演练可逆；进入共享环境后不执行破坏性 down migration，采用向前修复迁移，先验证表为空/无依赖再制定人工回退。
- OpenAPI 回滚：与服务端代码和生成类型同提交回退。

## 下一最小切片与禁止范围

下一切片是 M2-P007 公司双页面审核上架，但当前明确禁止进入。必须先创建本切片 Draft PR，等待精确 head CI 成功，再由人工授权合并，并验证合并后 `main` CI 成功。M3 及以后阶段继续锁定。
