# M1-P047 OpenAPI 与响应白名单交接

## 身份与结论

- 仓库：`EasyStep-lee/flt1`
- 分支：`codex/m1-m1-p047`
- Issue：[#19](https://github.com/EasyStep-lee/flt1/issues/19)
- Draft PR：[#20](https://github.com/EasyStep-lee/flt1/pull/20)，创建时 head `886e13a284decf013c26e9d71b7d8b2f5ad0850d`
- 基线：`7637fe3ce87ba08860738af847cf1aeeff60c618`，即 PR #18 合并后并经 main CI 通过的提交
- 实现提交：`ca090334d652d3a0b83e0cd5869d2b1df4b9e29f`、`c7cb19ca80a13d82cb7741f8f1c4b1e2944a7f9d`
- 结果：`LOCAL_PASS`；Draft PR 已创建，最终精确 head CI、人工审查/合并及合并后 main CI 尚未执行

本切片没有重建 M0 工具链。它为已实现的 API-005、API-008 至 API-015 增加了机器可读的 actor/权限、请求/响应 DTO、幂等、错误码和响应字段策略，并把敏感字段守卫收窄为递归解析受保护成功响应。API-003/API-004/API-006/API-007 仍归后续认证切片，未创建占位接口。

## RED、实现与 P0

- RED：`node --test ./tests/openapi/m1-p047-contract.test.mjs` 得到 0 通过、1 失败，实际缺口是 `functionalSession` 与逐操作合同元数据不存在。
- 最小实现：`m1-openapi-contract.ts` 在纯合同 Nest 上下文内追加并验证 9 个已实现 M1 操作；受保护成功响应递归解析 `$ref/items/allOf/anyOf/oneOf`，命中供应价、快照、供应商应付或毛利字段即失败。
- `NEG-M1-047-01`：注入 `supplyPrice` 的 schema 被拒绝；带内部字段的商户实体经公开 API 只返回精确 DTO。
- `NEG-M1-047-02`：两次生成逐字节一致，`openapi:check` 通过。
- `NEG-M1-047-03`：oasdiff 1.17.0 删除端点负例失败，对 `origin/main` 比较无破坏性变更。
- `NEG-M1-047-04`：两小程序继续只经 `miniapp-kit` 复用生成类型，无直接 `wx.request/fetch`。

## 新鲜验证

| 验证 | 结果 |
|---|---|
| OpenAPI focused | PASS 10/10 |
| 白名单 unit / Supertest | PASS 1/1 / 1/1 |
| miniapp-kit | PASS 2/2 |
| M1 合同回归 | 首次全量发现旧状态断言失败；修复后 PASS 30/30 |
| 最终证据/台账合同 | PASS 31/31 |
| P0 Chromium | PASS 8/8 |
| `pnpm prisma:migrate:dry-run` | PASS：empty=2、upgrade=2、restore=2、product=6、cleanup=PASS |
| `pnpm verify` | PASS 17/17；报告 `artifacts/test-results/verification/pnpm-verify.json` |
| Secret scan | PASS：415 个跟踪文件 |
| 执行包自检 | PASS：任务 149、P0 119、字段 658、页面 80、权限 22 |

全量报告记录 HEAD `ca09033`；当时工作树中 5 个历史状态断言修复与随后提交 `c7cb19c` 完全一致。没有用提交后的新代码冒充已验证内容。

## 环境、风险与回滚

- 本地 Windows、Node 22.23.1、pnpm 10.12.1、Docker 29.6.2、Compose 5.3.1、临时 MySQL 8.4.11、Playwright Chromium。
- OpenAPI 生成不监听端口、不连接数据库/Redis/队列、不读取生产秘密；真实 MySQL 演练只处理临时库并完成清理。
- 本切片无 Prisma/schema/SQL 迁移、数据回写、生产/预发布修改、支付/退款/结算接入。
- 非阻塞警告：既有 Vite bundle 大于 500 kB；`FORCE_COLOR` 存在时 `NO_COLOR` 被忽略。
- 回滚两个实现原子提交即可；生成文件可由源码重建，无数据库或外部状态回滚。

## 下一边界

下一任务是 `M1-P066`，但当前只能保持 READY。必须先核验 M1-P047 Draft PR 的最终精确 head CI，完成审查与用户授权人工合并，再核验合并后 main CI；闭环前不得进入 P066，更不得进入 M2。
