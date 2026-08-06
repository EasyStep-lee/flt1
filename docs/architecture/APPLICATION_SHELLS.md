# M0-006 五端应用壳

## 1. 范围

本任务只建立五个可独立构建的运行入口、三类Web会话命名空间、门户渲染/索引/缓存边界，以及两个原生小程序指向单一`miniapp-kit`的请求边界。

不实现80个正式业务页面、账号认证、权限、供应商、商品、价格、库存、订单、福利卡、支付、配送、对账或CMS；不创建业务API、DTO、错误码、Prisma模型或迁移。

## 2. 运行入口

| 应用 | 包 | 技术 | 本地入口/构建产物 |
|---|---|---|---|
| 公司后台 | `@fulishe/company-admin` | React 19 + Vite 8 + Ant Design 6 + TanStack Query 5 | `127.0.0.1:5173` / `apps/company-admin/dist` |
| 供应商后台 | `@fulishe/supplier-portal` | React 19 + Vite 8 + Ant Design 6 + TanStack Query 5 | `127.0.0.1:5174` / `apps/supplier-portal/dist` |
| 企业门户 | `@fulishe/portal-web` | Next.js 16 App Router + React 19 + Ant Design 6 + TanStack Query 5 | `127.0.0.1:3000` / `apps/portal-web/.next` |
| 用户小程序 | `@fulishe/user-miniapp` | 原生微信小程序 + TypeScript + esbuild | `apps/user-miniapp/dist` |
| 跑腿小程序 | `@fulishe/runner-miniapp` | 原生微信小程序 + TypeScript + esbuild | `apps/runner-miniapp/dist` |

五个应用之间不得直接导入源码或共享会话入口。`@fulishe/ui`只提供展示组件和主题，不承载权限判断。

## 3. 会话边界

| 端 | 命名空间 | 入口边界 |
|---|---|---|
| 公司后台 | `fulishe:company-admin` | `/company-admin/login`、`/company-admin/account-select`、单一`/company-admin/workspaces/*` |
| 供应商后台 | `fulishe:supplier-portal` | `/supplier/register`、`/supplier/login`、单一`/supplier/workspaces/*` |
| 企业门户 | `fulishe:enterprise-portal` | 公开区无企业会话；登录与`/enterprise/*`使用独立私有会话 |
| 用户小程序 | `fulishe:user-miniapp` | 只供个人用户端，不能复用跑腿员会话 |
| 跑腿小程序 | `fulishe:runner-miniapp` | 只供跑腿端，不能复用个人用户会话 |

当前只冻结名称、入口和单职能上下文，不签发真实Cookie/Token；认证与自然人/职能权限归M1。

## 4. 门户渲染、索引与缓存

- `src/app/(public)`：根壳页为静态生成并设置`revalidate = 300`；后续公开宣传页面必须沿用SSG/ISR。
- `src/app/(auth)`：认证入口强制动态、`fetchCache = force-no-store`、`robots index/follow = false`。
- `src/app/(private)`：企业私有区强制动态、`fetchCache = force-no-store`、`robots index/follow = false`。
- `next.config.mjs`对`/enterprise/:path*`追加`Cache-Control: private, no-store`和`X-Robots-Tag: noindex`。
- `robots.txt`禁止抓取`/enterprise/`；`sitemap.xml`当前只登记公开根壳，不含认证或私有路由。
- `fulishe.example.invalid`是不可解析的壳层占位域名；正式域名配置归后续配置/部署任务。

运行态测试会真实启动构建后的Next服务器，证明公开根路由不是`private/no-store`，认证/私有路由同时具备`private/no-store`和`noindex`。

## 5. 原生小程序传输边界

- 两个小程序都依赖`@fulishe/miniapp-kit`，应用源码禁止直接调用`wx.request`或浏览器`fetch`。
- `miniapp-kit`只有一个注入式`runtime.request`调用，负责基础成功/失败归一化，不包含业务API。
- 两个小程序使用不同session namespace，且各自只有`pages/shell/index`一个内部壳页。
- `project.config.json`使用公开非生产`touristappid`，微信开发者工具指向各自`dist/`。
- M0-008已由后端确定生成OpenAPI、创建`@fulishe/contracts`类型，并把两个小程序的占位映射替换为`FoundationMiniappContracts`；业务请求仍须在所属后续切片中按生成operation增加。

## 6. 验证与回滚

聚焦命令：

```text
pnpm test:shells
pnpm test:miniapp-transport
pnpm test:seo-cache
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

回滚使用M0-006实现提交的`git revert`。所有构建产物均被`.gitignore`排除，可重新生成；不得用回滚删除用户UI资产或M0-005数据库卷。
