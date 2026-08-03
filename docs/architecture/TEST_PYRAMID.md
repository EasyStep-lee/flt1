# M0-009测试金字塔与证据归档

## 1. 范围

本切片只建立测试底座，不实现商品、价格、库存、订单、福利卡、支付、配送、对账或任何正式业务P0。既有Node测试继续保留，用于保护M0-005至M0-008已经验证的工程契约。

| 层级 | 工具与项目 | 当前示例 | 运行入口 |
|---|---|---|---|
| 单元 | Vitest `unit` | `@fulishe/test-kit`并发和幂等探针 | `pnpm test:unit` |
| API契约 | Vitest `api-contract` + Supertest | Nest健康与安全错误响应，不开放网络端口 | `pnpm test:api:supertest` |
| 浏览器E2E | Playwright `chromium` | 门户公开ISR与私有noindex/no-store壳边界 | `pnpm test:e2e:foundation` |
| 既有回归 | Node test runner | 工作区、配置、应用壳、OpenAPI等M0契约 | `pnpm test`及对应聚焦命令 |

Vitest使用根配置中的独立projects，避免单元与API契约混报。Playwright固定单个Chromium项目和一个worker，保存失败截图、trace和video。当前浏览器用例只证明技术壳边界，不代表门户正式页面或企业采购流程通过。

## 2. 并发与幂等工具

`@fulishe/test-kit`是测试专用、runner-neutral的共享包：

- `runConcurrently`在全部参与者就绪后统一释放，并按输入顺序收集成功/失败结果；
- `requireExactlyOneFulfilled`验证竞争只有一个赢家，零个或多个赢家都以稳定测试错误失败；
- `verifyIdempotentReplay`用同一key重复调用并比较可观察结果，结果漂移立即失败。

这些工具只组织和断言测试，不充当生产锁、幂等存储、事务或业务实现。后续切片仍需用真实数据库约束、事务、版本号和服务端幂等机制完成对应P0。

## 3. RED→GREEN纪律

先复制`docs/testing/FAILURE_TEST_TEMPLATE.md`登记TaskID/P0ID、不变量、失败命令和预期失败原因；确认RED后才写最小实现。GREEN必须同时记录focused test和受影响回归，不能以字符串搜索、旧报告或测试文件存在代替执行证据。

M0-009的示例RED是测试底座契约找不到`packages/test-kit`、Vitest/Playwright配置和失败测试模板；完成本切片后同一契约转为GREEN。该示例不映射业务P0。

## 4. 报告与归档

```powershell
pnpm test:reports
```

命令依次生成：

- `artifacts/test-results/vitest/results.json`和`junit.xml`；
- `artifacts/test-results/playwright/results.json`、`junit.xml`和HTML报告；
- `artifacts/test-results/manifest.json`，列出每个报告文件的字节数和SHA-256。

整个`artifacts/test-results/`可作为一次执行的归档单元，但默认忽略，不把运行时报告提交到源码。正式CI上传和保留周期属于M0-011；报告存在不等于CI、真机、预发布或生产验收通过。

## 5. 本地验证

```powershell
pnpm test:foundation-contract
pnpm test:unit
pnpm test:api:supertest
pnpm exec playwright test --config ./playwright.config.ts --list
pnpm test:e2e:foundation
pnpm test:reports
./tests/test-foundation/test-foundation-clean-install.ps1
```

Playwright首次在开发机运行前需要安装匹配版本的Chromium。浏览器二进制不进入仓库；真实设备、小程序开发者工具和生产浏览器矩阵仍按后续P0与人工门禁执行。
