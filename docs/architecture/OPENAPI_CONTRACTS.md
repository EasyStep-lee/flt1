# M0-008 / M1-P047 OpenAPI、DTO与分端传输契约

## 1. 范围

M0-008先为健康接口建立后端确定性OpenAPI、生成类型、统一错误结构、Web类型客户端、原生小程序类型接线和破坏性变更执行器；M1-P047复用这条生成链，为当前已实现的API-005、API-008至API-015补齐机器可读合同与响应白名单门禁。

不新增供应商、商品、价格、库存、订单、福利卡、支付、配送或财务业务接口；不创建Prisma业务模型或迁移；不把M0-009测试框架、M0-011完整`pnpm verify`和正式GitHub Actions接线提前到本任务。

## 2. 确定性生成链

```text
NestJS Controller + DTO allowlist + M1 operation contract
  → SwaggerModule.createDocument()
  → 受保护成功响应的递归字段守卫与稳定键排序
  → packages/contracts/openapi.json
  → openapi-typescript 7.13.0
  → packages/contracts/types.ts
```

- `scripts/generate-openapi.ts`只创建注入空探针的Nest应用上下文，不监听端口，不连接MySQL、Redis或BullMQ，也不读取支付、短信、对象存储或生产配置。
- `@nestjs/swagger 11.4.6`固定依赖的`js-yaml 5.2.1`存在高危拒绝服务公告，根工作区只对该依赖链定向覆盖到已修复的`5.2.2`；`pnpm audit --prod`必须保持零已知漏洞。
- OpenAPI对象递归按键排序；数组保持语义顺序；JSON与TypeScript统一使用LF并以一个换行结束。
- `pnpm openapi:check`在系统临时目录重新生成两份文件并逐字节比较，不改写期望文件；差异分别返回`OPENAPI_SPEC_DRIFT`或`OPENAPI_TYPES_DRIFT`。
- M0-008首个契约只包含`GET /health/live`与`GET /health/ready`；业务Controller仍只能在各自所属切片中增加，M1-P047不新增业务路由。

## 3. DTO白名单与统一错误

- Controller通过`@ApiOkResponse({ type: ...Dto })`显式指定响应DTO，不允许Prisma实体直接成为响应类型。
- M1-P047为已实现的API-005、API-008至API-015追加`x-fulishe-contract-id`、actor、请求/响应DTO、幂等、错误码和响应策略；非公开接口声明服务端绑定的`functionalSession`，客户端不能选择owner scope。
- 生成器只对标记为`NEVER_RETURN_INTERNAL_PRICING`的成功响应递归解析`$ref`、数组及组合schema，并拒绝`supplyPrice`、`approvedSupplyPrice`、`supplyPriceSnapshot`、供应商应付和毛利字段。该范围不会误伤未来经角色及供应商scope授权的公司/供应商内部价格DTO。
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

M0底座回滚使用M0-008实现提交的`git revert`；M1契约增强按M1-P047原子提交回退。本任务没有数据库迁移和数据回写；`.cache/oasdiff`及构建产物均可重新生成，不得删除用户未跟踪的UI资产。
