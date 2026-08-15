# M3-P027 门户宣传与公开 SEO 契约

状态：`IN_PROGRESS / TESTS_NOT_EXECUTED`。本文件冻结 P0-027 的静态公开门户边界，不表示 M5 CMS、真实域名或正式发布已经完成。

## 目标与完成定义

- 在 Next.js App Router 公开区实现 `/`、`/about`、`/capabilities`、`/cases`、`/cases/[slug]`、`/supplier-cooperation`、`/news`、`/news/[slug]` 和 `/contact`。
- 每个页面必须由服务端 HTML 直接提供可抓取正文，并具有唯一 title、description、canonical、Open Graph 与结构化数据。
- 所有公开路由使用静态生成或 ISR，不返回 `private`、`no-store` 或 `noindex`；企业登录和交易区现有私有边界不得回退。
- sitemap 只列公开且确实可访问的路由；robots 继续禁止 `/enterprise/`、`/company-admin/` 和 `/supplier/` 私有路径。
- P0-027 focused、P0 E2E、门户边界测试和全量 `pnpm verify` 均有新鲜通过证据。

## 内容字段与数据来源

本切片不新增数据库字段。静态页面定义只包含以下代码内白名单字段：

| 字段 | 类型 | 规则 |
|---|---|---|
| `slug` | 小写短横线字符串 | 固定白名单；未知 slug 返回 404 |
| `title` | UTF-8 字符串 | 页面唯一且不得冒充客户或资质 |
| `description` | UTF-8 字符串 | 页面唯一；不得含供应价、内部毛利或精确库存 |
| `eyebrow` | UTF-8 字符串 | 公共内容类型提示 |
| `publishedAt` | `YYYY-MM-DD` | 仅公告使用；固定为已确认的基线/公告日期 |
| `version` | 字符串 | 规则公告必须显示版本与生效日期 |
| `sections` | 只读模块数组 | 仅渲染受控文本，不接受请求输入或富文本 HTML |
| `disclosure` | UTF-8 字符串 | 匿名能力场景必须声明并非特定客户案例或背书 |

公司主体和品牌名来自 `@fulishe/contracts`；客服展示只使用 EXT-005 仓库内脱敏值 `189****9999`。未确认的域名、备案、办公地址、服务时间、客户名称、Logo、交易额、销量、资质图片和服务覆盖范围不得补写。

## 页面与状态

| 页面 | 必须正文 | 失败/空态 |
|---|---|---|
| 首页 | 主视觉、公司主体、核心服务、供应链能力、社区集采边界、分类能力、匿名场景、供应商合作、公告、CTA | 不展示虚构销量、倒计时、集采价或精确库存 |
| 关于 | 公司简介、经营主体、理念、服务承诺、联系入口 | 未获公开授权的资质与历程明确不展示 |
| 能力 | 品类、准入、审核、库存协同、统一结账、个人/企业配送边界、售后 | 不披露供应商名单、供应价或内部阈值 |
| 案例列表/详情 | 匿名能力场景与授权声明 | 未知 slug 为 404；不得创建虚构客户案例 |
| 供应商合作 | 条件、开放分类边界、资料、审核流程、注册/登录入口 | 不承诺必然通过；不内嵌供应商后台 |
| 新闻列表/详情 | 规则公告的类别、日期、版本、适用对象和历史链接 | 未知 slug 为 404；不可静默改写版本语义 |
| 联系 | 公司主体、客服、企业采购/供应商合作/投诉用途说明 | 无商务线索表单；地址/服务时间未确认时不虚构 |

## 权限、缓存与敏感字段

- Actor 固定为 `PUBLIC`；本切片无会话、owner、tenant 或客户端归属字段。
- 公开 HTML、metadata、JSON-LD、sitemap、robots 和日志中禁止 `supplyPrice`、`approvedSupplyPrice`、`supplyAmount`、`grossMargin`、供应商应付、精确库存和完整敏感联系方式。
- canonical origin 从 `NEXT_PUBLIC_PORTAL_ORIGIN` 读取；本地默认使用保留域名 `https://fulishe.example.invalid`。真实域名、DNS、TLS、备案和发布仍是外部门禁。
- 页面 `revalidate=300`；M5 才实现 PortalContent、revision、发布/下线和按 slug 失效，不在本切片伪造 CMS。

## API、迁移与错误码

- Prisma 迁移：`NOT_APPLICABLE`；本切片没有持久化实体或写操作。
- OpenAPI/DTO：`NOT_APPLICABLE`；M5 的 API-075 至 API-078 保持 `PLANNED`，不得提前实现。
- 页面错误：未知案例或公告 slug 由 Next.js `notFound()` 返回 404；不存在公开写接口，因此幂等、并发写冲突和恢复不适用。

## RED 行为测试

- `P0-027-RED-01`：目标公开路由当前返回 404，服务端 HTML 缺正文和唯一 SEO。
- `P0-027-RED-02`：sitemap 当前只包含首页，缺少公开宣传路由和详情路由。
- `P0-027-RED-03`：无授权客户场景、未知 slug 404、敏感字段泄露和私有路由隔离尚无行为证据。

## 非目标

- 不实现 M3-P028 企业注册认证或 M3-P030 社区集采边界完整切片。
- 不实现 M5 CMS、商务咨询 API、草稿/预览/发布/下线、富文本、上传或缓存失效后台。
- 不发布真实域名，不提交备案，不连接地图服务端，不展示未授权客户/资质素材。

## 回滚

回退本切片应用、测试和台账提交即可；无数据库迁移。若已生成静态制品，重新构建并替换为上一候选制品；不得改写公共 Git 历史。
