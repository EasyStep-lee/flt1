# M0-006 五端应用壳交接

## 1. 身份

- 阶段/任务：`M0 / M0-006 初始化五端应用壳`
- 日期/时区：2026-08-02，UTC-04:00
- 本地仓库：`C:\Users\lichuanjun\Documents\flt1`
- 开发分支：`codex/m0-m0-006`
- 实现提交：`a542c56b8e375c6331cc093d8f102d2bf837f5ea`
- P0映射：无；本任务为M0工程基础任务
- 远程/PR/CI：`BLOCKED_EXTERNAL / NOT_EXECUTED`，本地没有origin

## 2. 结果与范围

M0-006建立了公司管理后台、供应商后台、Next.js企业门户、用户原生微信小程序和跑腿原生微信小程序五个独立可构建入口，并新增展示型共享UI包和唯一的小程序请求适配包。门户公开区与企业认证/私有区在渲染、缓存、索引和会话命名空间上已明确隔离。

本任务没有创建80个正式业务页面，没有实现登录、权限、供应商、商品、价格、库存、订单、福利卡、支付、配送、对账或CMS；没有新增业务API、OpenAPI、DTO、错误码、Prisma模型或SQL迁移。

## 3. 五端入口与技术版本

| 端 | 工作区包 | 技术/固定版本 | 独立边界 |
|---|---|---|---|
| 公司管理后台 | `@fulishe/company-admin` | React 19.2.8、Vite 8.2.0、Ant Design 6.5.3、TanStack Query 5.101.4 | `/company-admin/`，`fulishe:company-admin` |
| 供应商后台 | `@fulishe/supplier-portal` | React 19.2.8、Vite 8.2.0、Ant Design 6.5.3、TanStack Query 5.101.4 | `/supplier/`，`fulishe:supplier-portal` |
| 企业门户 | `@fulishe/portal-web` | Next.js 16.2.12 App Router、React 19.2.8、Ant Design 6.5.3、TanStack Query 5.101.4 | 公开根路由与`/enterprise/*`隔离，`fulishe:enterprise-portal` |
| 用户小程序 | `@fulishe/user-miniapp` | 原生微信小程序、TypeScript 5.9.3、esbuild 0.28.1 | 独立`dist/`，`fulishe:user-miniapp` |
| 跑腿小程序 | `@fulishe/runner-miniapp` | 原生微信小程序、TypeScript 5.9.3、esbuild 0.28.1 | 独立`dist/`，`fulishe:runner-miniapp` |

`@fulishe/ui`只提供壳组件和主题，不处理权限；五个应用源码之间零交叉导入。`@fulishe/miniapp-kit`是两个小程序唯一请求边界，应用源码中没有直接`wx.request`或`fetch`调用。

## 4. 门户公开、认证与私有边界

| 路由区 | 当前壳路由 | 构建/运行契约 |
|---|---|---|
| 公开 | `/` | 静态生成，`revalidate=300`，允许公开索引与共享缓存 |
| 认证 | `/enterprise/login` | 动态渲染、`force-no-store`、`noindex` |
| 私有 | `/enterprise/workspace` | 动态渲染、`force-no-store`、`noindex` |

- Next响应头对`/enterprise/:path*`强制`Cache-Control: private, no-store, max-age=0, must-revalidate`和`X-Robots-Tag: noindex, nofollow, noarchive`。
- `robots.txt`禁止抓取`/enterprise/`，`sitemap.xml`只登记公开根壳。
- 生产构建实测：`/`为5分钟ISR；认证与私有路由为动态路由。
- 运行态测试真实启动构建后的Next服务器并验证响应头、页面标记、robots和sitemap，结果1/1通过。
- `fulishe.example.invalid`仅是不可解析的壳层占位域名，正式域名归后续配置/部署任务。

## 5. 小程序请求边界

- 两个小程序各自只有`pages/shell/index`一个内部壳页和独立微信开发者工具根目录。
- `project.config.json`使用公开非生产`touristappid`，不包含真实AppID或秘密。
- `miniapp-kit`只包含一个注入式`runtime.request<T>()`调用和安全错误归一化；不存在浏览器fallback。
- M0-008才由确定的后端OpenAPI生成`@fulishe/contracts`并替换当前`GeneratedContractsFromM0008`占位边界。本任务不宣称契约生成已经完成。

## 6. 先红后绿与问题收敛

| 阶段 | 证据 |
|---|---|
| 首轮失败测试 | 10项边界测试0通过、10失败，原因是五端包和传输边界尚不存在 |
| 小程序边界首次实现 | 结构测试识别不到带泛型的`runtime.request<T>()`；修正测试解析规则后验证真实单调用边界 |
| 首轮lint | 发现测试中的未使用变量和未定义`URL`；改用明确的`path.resolve`后通过 |
| 首轮Next构建 | Turbopack拒绝把包导出中的`.js`源路径映射到`.ts/.tsx`；共享UI改为先构建并从产物入口消费后通过 |
| 首轮生产依赖审计 | Next间接依赖暴露4项已知漏洞；精确覆盖到`postcss 8.5.25`和`sharp 0.35.3`后审计归零，Next构建与运行测试继续通过 |
| 最终干净复现 | PASS：临时目录、冻结锁文件、忽略生命周期脚本、静态边界、9包lint/typecheck、五端逐个构建、17项包级任务 |

pnpm报告`esbuild`和`sharp`生命周期脚本未自动批准；本任务没有用忽略审计代替修复。`sharp 0.35.3`安全覆盖后，Next生产构建、ISR/动态路由生成和运行态响应测试均已实际通过；当前壳未使用Next Image。后续启用图像处理时必须在受控CI里显式验证依赖脚本允许清单。

## 7. 最终验证

| 验证 | 结果 |
|---|---|
| 五端结构契约 | PASS：6/6 |
| 小程序传输边界 | PASS：4/4 |
| 工作区lint/typecheck/build | PASS：9/9、9/9、9/9 |
| 包级构建与测试任务 | PASS：17/17 |
| 门户运行态缓存/索引边界 | PASS：1/1 |
| 干净冻结安装和五端逐个构建 | PASS |
| API契约回归 | PASS：3/3 |
| Prisma Schema校验 | PASS，零新增模型/迁移 |
| `pnpm audit --prod` | PASS：0项已知漏洞 |
| 产品基线 | PASS；只有执行状态追加导致的预期目录快照告警 |
| 执行包自检 | PASS |

机器证据：`artifacts/verification/M0-006/application-shells.json`。

## 8. 明确未执行

- 共享配置Schema、环境分层和秘密扫描：`NOT_EXECUTED`，归属M0-007。
- OpenAPI、DTO、错误码和生成契约接入：`NOT_EXECUTED`，归属M0-008。
- Vitest、Supertest、Playwright和P0 E2E：`NOT_EXECUTED`，归属M0-009。
- migration dry-run、备份恢复和升级演练：`NOT_EXECUTED`，归属M0-010。
- 根级`pnpm verify`与GitHub CI：`NOT_EXECUTED`，归属M0-011。
- 微信开发者工具、真机、预发布、生产和正式域名：`NOT_EXECUTED`。

## 9. 主要文件与回滚

- 五端：`apps/company-admin/**`、`apps/supplier-portal/**`、`apps/portal-web/**`、`apps/user-miniapp/**`、`apps/runner-miniapp/**`
- 共享边界：`packages/ui/**`、`packages/miniapp-kit/**`
- 验证：`tests/application-shells/**`、`artifacts/verification/M0-006/application-shells.json`
- 说明：`docs/architecture/APPLICATION_SHELLS.md`、本交接文件

代码回滚使用本任务实现提交的`git revert`。构建产物均由`.gitignore`排除并可重新生成；不得删除用户的UI资产、预览图片或M0-005保留的数据卷。

## 10. 下一任务

- 唯一允许开始：`M0-007 建立环境分层、配置Schema、密钥管理与日志脱敏规范`。
- M0-007只处理配置、秘密与日志安全边界，不实现页面业务、OpenAPI、业务模型或交易流程。
- GitHub目标确认前，push、PR、Issue和CI持续为`BLOCKED_EXTERNAL/NOT_EXECUTED`。
