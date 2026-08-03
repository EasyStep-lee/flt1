# apps层职责

`apps/`只容纳可独立启动、构建或部署的运行时入口。M0-004只冻结目录责任，不创建应用壳；应用壳属于M0-005/M0-006。

后续保留的应用目录：

| 目录 | 职责 | 最早任务 |
|---|---|---|
| `api/` | NestJS统一API与健康检查 | M0-005 |
| `company-admin/` | 公司职能账号后台 | M0-006 |
| `supplier-portal/` | 供应商职能账号后台 | M0-006 |
| `portal-web/` | Next.js企业门户与企业采购入口 | M0-006 |
| `user-miniapp/` | 原生微信用户小程序 | M0-006 |
| `runner-miniapp/` | 原生微信跑腿配送小程序 | M0-006 |

依赖规则：应用可以依赖 `packages/*`；应用之间不得直接导入源码，也不得共享登录会话入口。

M0-008以后，公司后台、供应商后台和企业门户分别通过自身`src/api-client.ts`调用`@fulishe/web-api-client`，不直接新建临时`fetch`/`axios`客户端；用户与跑腿小程序通过`@fulishe/contracts`复用生成类型，但运行时仍只经过`@fulishe/miniapp-kit`的`wx.request`适配器。
