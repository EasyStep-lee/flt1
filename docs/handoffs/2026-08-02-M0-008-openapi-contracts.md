# M0-008 确定性OpenAPI与分端传输契约交接

## 1. 身份

- 阶段/任务：`M0 / M0-008 建立确定性OpenAPI、统一类型与传输适配`
- 日期/时区：2026-08-02，UTC-04:00
- 本地仓库：`C:\Users\lichuanjun\Documents\flt1`
- 开发分支：`codex/m0-openapi-dto`
- 实现提交：`743142676f96530289259ec426c8689a30c0d315`
- P0映射：无；本任务为M0工程基础任务
- 远程/PR/CI：`BLOCKED_EXTERNAL / NOT_EXECUTED`，本地没有origin

## 2. 结果与范围

M0-008建立了由NestJS Controller和DTO确定生成的OpenAPI契约、字节稳定的spec与TypeScript类型、统一安全错误结构、Web三端共享`openapi-fetch` Client、两个原生小程序的生成类型映射，以及固定版本并校验发布包哈希的oasdiff门禁。

本次只纳入既有`GET /health/live`和`GET /health/ready`两个健康接口。没有新增供应商、商品、价格、库存、订单、福利卡、支付、配送或财务业务接口；没有创建Prisma业务模型、SQL迁移或业务页面。

## 3. 确定性生成与DTO白名单

- `scripts/generate-openapi.ts`创建只含契约Controller和空健康探针的Nest应用上下文，不监听端口、不连接MySQL/Redis/BullMQ，也不读取真实支付、短信、对象存储或生产秘密。
- `SwaggerModule.createDocument()`产物递归按键排序，数组保持语义顺序；`openapi.json`和`types.ts`统一LF并以单个换行结束。
- 两次生成得到完全相同的字节。spec SHA-256为`BEF335789CCF20A4B4EB7E981FED10818B8B70CC821E2D0BAAC5158E94265B1B`，types SHA-256为`27A36876DE3A52E278E0EE029A8F3920A694744392D16F34D5E76928334ACB64`。
- Controller响应通过`HealthLivenessDto`和`HealthReadinessDto`显式白名单生成，不从Prisma实体推断响应。
- 生成前递归拒绝供应价、供应价快照、供应商应付和毛利字段；本次spec和类型均为零命中。

## 4. 错误结构与分端传输

- 基础错误响应固定为`statusCode/code/message/requestId/path/timestamp`，只返回按HTTP状态选择的安全消息。
- 基础错误码为`REQUEST_INVALID`、`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`RESOURCE_NOT_FOUND`、`SERVICE_UNAVAILABLE`和`INTERNAL_ERROR`。
- 健康就绪接口的503仍返回`HealthReadinessDto`，用于表达具体基础依赖的UP/DOWN状态，不暴露连接串、异常栈或秘密。
- 公司后台、供应商后台和企业门户只通过各自的`src/api-client.ts`复用`@fulishe/web-api-client`；该共享包唯一使用`openapi-fetch`和生成的`paths`类型。
- 用户小程序和跑腿小程序通过`FoundationMiniappContracts`映射生成的`operations`类型，运行时仍只经过`@fulishe/miniapp-kit`的注入式`runtime.request`到`wx.request`边界。

## 5. oasdiff与依赖安全

- `scripts/check-openapi-breaking.mjs`固定`oasdiff 1.17.0`，按操作系统与CPU架构选择官方发布包并核验内置SHA-256。
- Windows x64发布包`oasdiff_1.17.0_windows_amd64.tar.gz`的SHA-256为`C45E73B11622BE9572ED5B16A467A9956157315223CBD22E51B00AAE725B64F9`。
- 本地文件模式验证相同spec通过、删除端点失败；真实Git模式用实现提交`7431426`读取`packages/contracts/openapi.json`并得到`No changes detected`。
- `@nestjs/swagger 11.4.6`依赖链中的`js-yaml`定向覆盖到修复版本`5.2.2`；最终`pnpm audit --prod`为零已知漏洞。
- M0-011负责把这些命令接入正式GitHub Actions；本任务没有把本地成功写成CI成功。

## 6. 先红后绿与问题收敛

| 阶段 | 证据 |
|---|---|
| 首轮失败测试 | 0通过、8失败：生成脚本、契约包、Web Client、小程序生成类型和oasdiff门禁均不存在 |
| 首轮干净冻结安装 | 生成器误经完整`AppModule`加载Prisma Client；改为与生产共享Controller注册表的纯契约Nest模块后消除外部依赖 |
| 依赖审计 | 首次发现`js-yaml 5.2.1`高危拒绝服务公告；只对`@nestjs/swagger 11.4.6`依赖链覆盖到`5.2.2`后审计归零 |
| 最终干净复现 | 冻结安装、两次确定性生成、漂移检查、8项契约测试和12包typecheck全部通过，原工作树未变化 |

## 7. 最终验证

| 验证 | 结果 |
|---|---|
| M0-008聚焦契约测试 | PASS：8/8 |
| 应用壳/小程序传输回归 | PASS：6/6、4/4 |
| 工作区lint/typecheck/build | PASS：12/12、12/12、12/12，生成脚本附加检查通过 |
| 包级测试任务 | PASS：22/22 |
| API契约/配置/门户SEO缓存 | PASS：3/3、18/18、1/1 |
| OpenAPI生成与逐字节漂移检查 | PASS；两次哈希一致 |
| oasdiff本地/真实Git提交基线 | PASS / PASS |
| M0-008干净冻结安装 | PASS |
| Prisma Schema / Compose配置 | PASS / PASS，零新增业务模型和迁移 |
| Git已跟踪文件秘密扫描 | PASS：250个文件，0命中 |
| `pnpm audit --prod` | PASS：0项已知漏洞 |
| 产品基线 | PASS；只有执行状态追加导致的预期目录快照告警 |
| 执行包自检 | PASS；控制状态更新后再次复核 |

机器证据：`artifacts/verification/M0-008/openapi-contracts.json`。

## 8. 明确未执行

- Vitest、Supertest、Playwright、并发/幂等工具和失败测试模板：`NOT_EXECUTED`，归属M0-009。
- migration dry-run、备份恢复和升级演练：`NOT_EXECUTED`，归属M0-010。
- 根级`pnpm verify`与GitHub CI：`NOT_EXECUTED`，归属M0-011。
- 业务Controller、业务DTO、数据库模型、迁移、真实支付/退款、预发布、真机和生产：`NOT_EXECUTED`。

## 9. 主要文件与回滚

- 契约生成：`apps/api/src/openapi/**`、`scripts/generate-openapi.ts`
- DTO与错误：`apps/api/src/health/health.dto.ts`、`apps/api/src/http/api-error*.ts`
- 生成产物：`packages/contracts/openapi.json`、`packages/contracts/types.ts`
- Web传输：`packages/web-api-client/**`及三个Web应用的`src/api-client.ts`
- 小程序传输：`packages/contracts/src/miniapp-contracts.ts`及两个小程序的`src/request-adapter.ts`
- 门禁与验证：`scripts/check-openapi-*.mjs`、`tests/openapi/**`
- 架构边界：`docs/architecture/OPENAPI_CONTRACTS.md`

代码回滚使用`git revert 743142676f96530289259ec426c8689a30c0d315`。没有数据库迁移、数据回写或真实外部集成需要撤销；`.cache/oasdiff`和构建产物可重新生成，不得删除用户未跟踪的UI资产。

## 10. 下一任务

- 唯一允许开始：`M0-009 建立测试金字塔与失败测试模板`。
- M0-009只能建立Vitest、Supertest、Playwright、并发/幂等工具、失败测试模板和可归档报告，不得提前实现业务流程、迁移或M0-011完整CI。
- GitHub目标确认前，push、PR、Issue和CI持续为`BLOCKED_EXTERNAL/NOT_EXECUTED`。
