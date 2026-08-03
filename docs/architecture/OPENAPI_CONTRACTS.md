# M0-008 OpenAPI、DTO与分端传输契约

## 1. 范围

本任务只为现有健康接口建立后端确定性OpenAPI、生成类型、统一错误结构、Web类型客户端、原生小程序类型接线和破坏性变更执行器。

不新增供应商、商品、价格、库存、订单、福利卡、支付、配送或财务业务接口；不创建Prisma业务模型或迁移；不把M0-009测试框架、M0-011完整`pnpm verify`和正式GitHub Actions接线提前到本任务。

## 2. 确定性生成链

```text
NestJS Controller + DTO allowlist
  → SwaggerModule.createDocument()
  → 稳定键排序与供应价字段守卫
  → packages/contracts/openapi.json
  → openapi-typescript 7.13.0
  → packages/contracts/types.ts
```

- `scripts/generate-openapi.ts`只创建注入空探针的Nest应用上下文，不监听端口，不连接MySQL、Redis或BullMQ，也不读取支付、短信、对象存储或生产配置。
- `@nestjs/swagger 11.4.6`固定依赖的`js-yaml 5.2.1`存在高危拒绝服务公告，根工作区只对该依赖链定向覆盖到已修复的`5.2.2`；`pnpm audit --prod`必须保持零已知漏洞。
- OpenAPI对象递归按键排序；数组保持语义顺序；JSON与TypeScript统一使用LF并以一个换行结束。
- `pnpm openapi:check`在系统临时目录重新生成两份文件并逐字节比较，不改写期望文件；差异分别返回`OPENAPI_SPEC_DRIFT`或`OPENAPI_TYPES_DRIFT`。
- 首个契约只包含`GET /health/live`与`GET /health/ready`。业务Controller只能在所属后续切片中增加。

## 3. DTO白名单与统一错误

- Controller通过`@ApiOkResponse({ type: ...Dto })`显式指定响应DTO，不允许Prisma实体直接成为响应类型。
- 生成器在写文件前递归拒绝`supplyPrice`、`approvedSupplyPrice`、`supplyPriceSnapshot`、供应商应付和毛利字段。
- `ApiErrorResponseDto`固定`statusCode/code/message/requestId/path/timestamp`六个字段；运行时由`createApiErrorResponse`统一生成安全消息。
- 基础错误码为：`REQUEST_INVALID`、`AUTHENTICATION_REQUIRED`、`ACCESS_DENIED`、`RESOURCE_NOT_FOUND`、`SERVICE_UNAVAILABLE`、`INTERNAL_ERROR`。
- 当前健康就绪接口在503时仍返回`HealthReadinessDto`，以便表达哪个基础依赖不可用；它不暴露连接串、异常栈或秘密。

## 4. 分端传输

| 端 | 类型来源 | 唯一传输边界 |
|---|---|---|
| 公司后台 | `@fulishe/contracts` | `@fulishe/web-api-client`内的`openapi-fetch` |
| 供应商后台 | `@fulishe/contracts` | `@fulishe/web-api-client`内的`openapi-fetch` |
| 企业门户 | `@fulishe/contracts` | `@fulishe/web-api-client`内的`openapi-fetch` |
| 用户小程序 | `FoundationMiniappContracts`映射生成的`operations` | `@fulishe/miniapp-kit`内唯一注入式`runtime.request` |
| 跑腿小程序 | `FoundationMiniappContracts`映射生成的`operations` | `@fulishe/miniapp-kit`内唯一注入式`runtime.request` |

三个Web应用只暴露各自的Client工厂，不在模块加载时发送请求。两个原生小程序不依赖`openapi-fetch`或浏览器Fetch语义，应用源码仍禁止直接调用`wx.request`。

## 5. oasdiff门禁

`scripts/check-openapi-breaking.mjs`固定`oasdiff 1.17.0`，按Windows/Linux/macOS与x64/arm64选择官方发布包并校验内置SHA-256后执行：

```text
oasdiff breaking <base> <revision> --fail-on ERR --format text --color never
```

本地文件比较：

```powershell
pnpm openapi:breaking -- --base packages/contracts/openapi.json --revision packages/contracts/openapi.json
```

CI目标提交比较接口：

```powershell
pnpm openapi:breaking -- --base-ref <目标分支提交SHA> --revision packages/contracts/openapi.json
```

脚本通过`git show <ref>:packages/contracts/openapi.json`读取目标提交，不能用当前工作区文件冒充目标分支基线。实际PR工作流与`pnpm verify`由M0-011接入；在没有origin和PR时不得声称CI已执行。

## 6. 验证与回滚

```powershell
pnpm openapi:generate
pnpm openapi:check
pnpm test:openapi
pnpm test:miniapp-transport
pnpm typecheck
pnpm test
pnpm test:api
pnpm build
```

回滚使用M0-008实现提交的`git revert`。本任务没有数据库迁移和数据回写；`.cache/oasdiff`及构建产物均可重新生成，不得删除用户未跟踪的UI资产。
