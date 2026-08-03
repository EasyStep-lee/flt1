# M0-009 测试金字塔与失败测试模板交接

## 1. 身份

- 阶段/任务：`M0 / M0-009 建立测试金字塔与失败测试模板`
- 日期/时区：2026-08-02，UTC-04:00
- 本地仓库：`C:\Users\lichuanjun\Documents\flt1`
- 开发分支：`codex/m0-m0-009`
- 实现提交：`4b93d52423b19eaabe65f01b56ec21b944d28d39`
- P0映射：无；本任务为M0工程基础任务
- 远程/PR/CI：`BLOCKED_EXTERNAL / NOT_EXECUTED`，本地没有origin

## 2. 结果与范围

M0-009建立了可执行的三层测试底座：Vitest单元项目、Vitest + Supertest API契约项目、Playwright Chromium浏览器项目；同时新增runner-neutral并发/幂等测试工具、RED→GREEN失败测试模板，以及JSON/JUnit/HTML报告和SHA-256归档清单。

本次没有新增供应商、商品、价格、库存、订单、福利卡、支付、配送或财务业务能力；没有创建Prisma业务模型、SQL迁移、正式业务页面或GitHub Actions。门户E2E只验证M0-006公开/私有技术壳边界，不能写成门户业务验收通过。

## 3. 测试金字塔

| 层级 | 项目 | 本次可执行示例 | 最终结果 |
|---|---|---|---|
| 单元 | Vitest `unit` | `@fulishe/test-kit`并发和幂等探针 | 5/5 PASS |
| API契约 | Vitest `api-contract` + Supertest | Nest健康接口、安全404和依赖降级；不监听网络端口 | 3/3 PASS |
| 浏览器E2E | Playwright `chromium` | 门户公开ISR、登录/私有区noindex和private/no-store | 3/3 PASS |
| 既有回归 | Node test runner | M0-005至M0-008工程契约继续保留 | 根回归45/45 PASS |

Vitest根配置以projects隔离单元和API契约；包级脚本显式固定仓库root，避免Turbo从包目录启动时找不到测试。Playwright固定一个Chromium项目和一个worker，并保留失败截图、trace和video。

## 4. 并发、幂等与失败模板

- `runConcurrently`等待全部竞争参与者就绪后统一释放，并按输入顺序返回结果。
- `requireExactlyOneFulfilled`要求竞争恰有一个成功者；零个或多个均以稳定错误失败。
- `verifyIdempotentReplay`以同一key执行两次并比较可观察结果，结果漂移立即失败。
- 上述能力只服务测试，不是生产锁、事务、幂等存储或业务实现。
- `docs/testing/FAILURE_TEST_TEMPLATE.md`要求每个后续切片登记TaskID/P0ID、不变量、RED失败原因、GREEN命令、并发/幂等、回滚和人工边界。

## 5. 报告归档

`pnpm test:reports`真实生成：

- Vitest JSON与JUnit：8/8 PASS；
- Playwright JSON、JUnit与HTML：3/3 PASS；
- `artifacts/test-results/manifest.json`：6个报告文件的字节数和SHA-256，绑定实现提交`4b93d52`且tracked worktree clean。

报告目录默认被Git忽略，可整体作为一次本地执行归档。CI上传、保留周期和根级聚合门禁归M0-011，本任务未声称CI通过。

## 6. 先红后绿与问题收敛

| 阶段 | 证据 |
|---|---|
| 预期RED | 0通过、4失败：`packages/test-kit`、Vitest/Playwright配置、报告脚本和失败模板均不存在 |
| 首次GREEN | 同一契约4/4通过；Vitest 5/5、Supertest 3/3、Playwright发现3项通过 |
| 全仓首次回归 | Turbo从`packages/test-kit`目录启动时以包目录为root，出现“无测试文件”；固定两个包脚本的`--root ../..`后包级和全仓入口均通过 |
| 浏览器执行 | 下载与Playwright 1.62.1匹配的Chromium 151.0.7922.34，生产构建后3/3通过 |
| 最终干净复现 | 忽略生命周期脚本的冻结安装、契约、Vitest、Supertest、Playwright发现、13包lint/typecheck/build全部通过；原工作树未变化 |

## 7. 最终验证

| 验证 | 结果 |
|---|---|
| M0-009底座契约 | RED 0/4、GREEN 4/4 |
| Vitest单元 | PASS：5/5 |
| Supertest API契约 | PASS：3/3；不开放网络端口 |
| Playwright Chromium | PASS：3/3 |
| 报告聚合 | PASS：Vitest 8/8、Playwright 3/3、6文件哈希清单 |
| 根级`pnpm test` | PASS：45/45；Turbo 24/24任务 |
| `pnpm test:api` | PASS：Node契约3/3 + Supertest 3/3 |
| 工作区lint/typecheck/build | PASS：13/13、13/13、13/13 |
| M0-009干净冻结安装 | PASS |
| Git已跟踪文件秘密扫描 | PASS：270个文件，0命中 |
| `pnpm audit --prod` | PASS：0项已知漏洞 |
| OpenAPI逐字节漂移检查 | PASS |
| 产品基线 | PASS；只有执行状态追加导致的预期目录快照告警 |
| 执行包与12页工作簿 | PASS；公式错误0，逐页视觉检查通过 |

机器证据：`artifacts/verification/M0-009/test-pyramid-foundation.json`。

## 8. 明确未执行

- Prisma migration dry-run、空库/升级路径、备份恢复和向前修复演练：`NOT_EXECUTED`，归属M0-010。
- 根级`pnpm verify`、GitHub Actions、PR与CI报告上传：`NOT_EXECUTED/BLOCKED_EXTERNAL`，归属M0-011。
- 业务P0自动化、真实支付/退款、预发布、真机和生产：`NOT_EXECUTED`。
- 当前测试工具只提供测试编排和断言，不替代后续业务切片的数据库事务、唯一约束、乐观锁或服务端幂等实现。

## 9. 主要文件与回滚

- 测试配置：`vitest.config.ts`、`vitest.report.config.ts`、`playwright.config.ts`
- 测试工具：`packages/test-kit/**`
- API契约：`apps/api/test/supertest/health-api.test.mjs`
- 浏览器E2E：`tests/e2e/portal-foundation.spec.ts`
- 契约与干净安装：`tests/test-foundation/**`
- 模板与边界：`docs/testing/FAILURE_TEST_TEMPLATE.md`、`docs/architecture/TEST_PYRAMID.md`
- 报告清单：`scripts/write-test-report-manifest.mjs`

代码回滚使用`git revert 4b93d52423b19eaabe65f01b56ec21b944d28d39`。没有数据库迁移、数据回写、真实外部集成或业务状态需要撤销；本地报告和浏览器缓存均可重新生成，不得删除用户未跟踪的UI资产。

## 10. 下一任务

- 唯一允许开始：`M0-010 建立Prisma迁移与回滚演练`。
- M0-010只建立Prisma validate、空库/升级路径dry-run、备份/恢复及向前修复规则，不得提前实现业务模型或M0-011完整`pnpm verify`/GitHub CI。
- GitHub目标确认前，push、PR、Issue和CI持续为`BLOCKED_EXTERNAL/NOT_EXECUTED`。
