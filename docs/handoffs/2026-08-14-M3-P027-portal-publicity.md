# 2026-08-14 M3-P027 门户宣传与公开 SEO 交接

阶段结论：`IN_PROGRESS / LOCAL_PASS`。M3-P026 已由 PR #88 按精确 head `5aecd0fd8ab4a6bb4e6c4533da9403e90bb22ad0` 合并到 `main@bf017ad3f06e602394b9087213877984b51789f0`，合并后 Actions run `31856335920` / job `94941699332` 成功。本切片的 focused 测试、12 项代表性 P0 E2E、88 项契约测试和本地 `pnpm verify` 17/17 均通过；Issue #89 已创建，Draft PR、PR CI、人工合并和 post-merge main CI 尚未执行，因此 M3-P028 保持锁定。

## 基线、范围与 Git

- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`；基线校验通过。
- 当前阶段/任务：M3 / M3-P027；对应 P0-027，公开门户 PAGE-025、PAGE-026、PAGE-027、PAGE-028、PAGE-029、PAGE-043、PAGE-044、PAGE-045、PAGE-046。
- 分支：`codex/m3-portal-publicity`；基线：`main@bf017ad3f06e602394b9087213877984b51789f0`；当前证据绑定本地工作树，提交待创建。
- GitHub：仓库 `EasyStep-lee/flt1`；Issue #89；PR 未创建；CI、评论、合并均 `NOT_EXECUTED`。
- 用户既有未跟踪文件、`outputs/` 和 `.codex-*` 临时证据均保留且不会暂存。

## 完成范围

- 新增首页、关于福礼团、服务能力、匿名服务场景及详情、供应商合作、新闻公告及详情、联系我们共 9 个公开路由。
- 公开页采用 Next.js 静态生成/SSG 与 300 秒 ISR；企业登录和采购交易区继续动态渲染、`noindex`、`private/no-store`。
- 每个公开页面生成独立标题、描述、canonical、Open Graph 与 JSON-LD；`sitemap.xml` 只列公开路由，`robots.txt` 阻止登录/交易区抓取。
- 使用 EXT-005 已授权的公司全称、公开展示名“福礼团”和脱敏客服 `189****9999`；未写入营业执照原件、税号、银行账号或完整客服手机。
- 供应商合作明确为公司上游准入，不生成供应商店铺；“社区集采”明确为普通企业采购入口，不含拼团、团长或成团活动。
- 场景页使用匿名能力说明并明确不构成客户背书，未编造客户名称、成交数据、办公地址、营业时间、备案号或生产域名。
- 公开 HTML、metadata、JSON-LD、sitemap、robots 和客户端页面均通过供应价/结算字段防泄露测试；供应商注册/登录使用独立供应商门户入口。
- CSV/JSON 任务、P0、页面、测试、阶段和项目状态台账已更新。

## 明确非目标

- 不实现 M5 PortalContent/CMS、审核发布、回滚、ISR webhook 或 API-075 至 API-078。
- 不配置真实域名、DNS、TLS、ICP备案或生产 canonical。
- 不编造正式客户案例、新闻稿、资质材料、公司地址或营业时间。
- 不变更数据库迁移或 OpenAPI，不进入 M3-P028、M4、M5、M6，不执行 staging、真机或生产发布。

## 先失败后通过与验证证据

| 证据 | 结果 |
|---|---|
| RED：`pnpm --filter @fulishe/portal-web test:publicity` | 按预期失败：测试要求 `/about` 为 200，实际为 404，证明路由尚未实现 |
| portal lint / typecheck / build | 全部退出码 0；构建显示 9 个公开路由为 Static/SSG，企业交易路由为 Dynamic |
| portal publicity / package tests | 1/1 与 3/3 通过 |
| P0-027 + P0-001 + P0-009 focused Playwright | 12/12 通过 |
| handoff focused tests | 12/12 通过 |
| 全部 contract tests | 88/88 通过 |
| 独立 `pnpm test` | 退出码 0；约 395.5 秒 |
| 最终 `pnpm verify` | 退出码 0；17/17 PASS；P0 E2E 68/68；迁移演练通过；秘密扫描 877 个已跟踪文件 |
| 聚合证据 | `artifacts/test-results/verification/pnpm-verify.json`，开始 `2026-08-15T03:18:08Z`，结束 `2026-08-15T03:33:17Z` |

历史失败保留：首次全量验证因 P0 E2E 测试使用浏览器 `document` 全局导致根级 typecheck 失败；第二次被单次工具调用 120 秒终止；第三次发现 5 个旧交接状态断言；第四次发现 18 个旧契约当前任务断言；第五次外层工具在 904 秒终止。修复类型和当前任务指针后，最终通过隐藏后台进程完成同一 `pnpm verify` 的全部 17 步，没有跳过或拆分门禁。

## P0 与环境边界

- P0-027 自动化子行为：`LOCAL_PASS`；公开服务端 HTML、响应式、SEO、抓取边界、未知 slug 404、公开字段白名单均有新鲜行为证据。
- LOCAL：`LOCAL_PASS`；PR CI/STAGING/DEVICE/PRODUCTION：`NOT_EXECUTED`。
- 实际运行环境：Windows、Node 22.23.1、pnpm 10.12.1、Next.js 16.2.12、Playwright Chromium、Docker MySQL 8 迁移演练。
- 真实域名/DNS/TLS/ICP备案、授权客户案例与正式新闻素材仍需授权人工提供；不得把证书私钥、账号密码或真实敏感资料放入仓库或聊天。
- Spreadsheet skill 要求在编辑工作簿前运行 artifact-operation marker，但当前已安装 runtime 中不存在该标记器。因而 12 个 sheet 已只读导入、渲染并检查，CSV/JSON 源台账已同步，而 `17-福礼社Codex5.6执行总控工作簿.xlsx` 字节未修改，状态为 `NOT_EXECUTED_TOOL_MARKER_UNAVAILABLE`，不能把旧镜像宣称为本切片已更新。

## 风险与回滚

- 风险：`.env.example` 使用故意无效的 `https://fulishe.example.invalid`；获得授权正式 HTTPS 域名和备案前不得作为生产 canonical。
- 风险：当前案例/新闻是边界说明和匿名能力场景，不代表真实客户背书；M5 CMS 上线前仍是代码内静态基线。
- 未发布回滚：回退本切片应用、测试、文档和台账提交；本切片没有数据库或 OpenAPI 回滚。
- 已发布回滚：回退应用制品到 `main@bf017ad3f06e602394b9087213877984b51789f0`；保留任何后续审计或内容历史，禁止删除业务数据。

## 下一步门禁

下一动作仅限创建/更新 M3-P027 Draft PR、读取精确 head Actions 与评论并修复当前切片。PR 最新 head CI 成功后，仍须用户对该精确 head 授权转 Ready/合并；合并后 `main` 最新 CI 成功前不得开始 M3-P028。当前明确禁止 M3-P028、M4、M5、M6、真实域名切换和任何生产发布。
