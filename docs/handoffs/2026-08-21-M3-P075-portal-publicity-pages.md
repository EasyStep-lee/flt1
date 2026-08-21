# M3-P075 企业宣传页面交接

## 结论

- 阶段：`M3_IN_PROGRESS`；本切片：`M3-P075 / P0-075`；M3 不因本切片自动 PASS。
- 当前证据：`LOCAL_PASS`；Draft PR 和精确 head CI 尚未建立，P076 继续锁定。
- 方案章节：综合方案 §8 门户全站；方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 基线：`origin/main@ea1c72976cfa068cb38f3b5cc93172252c688a1e`。P074 PR #121 的授权 head `a0603c8cc4d64b66f5fd0fb9ca6e82ed9ae5b6a2` 已合并为 `ea1c72976cfa068cb38f3b5cc93172252c688a1e`；post-merge main run `32466425921` / job `96723873849` 成功。
- 实现提交：`4c033c6`；后续证据提交只写回实际提交、Draft PR 和 CI 状态，不扩展业务范围。
- 分支：`codex/m3-portal-publicity-pages`；Issue #122；本交接生成时尚无 PR。

## 唯一目标与非目标

- 唯一目标：关于、企业能力、供应链服务、新闻公告列表/详情和联系页面提供完整公开正文、明确下一步、授权默认拒绝、公告版本日期、未知 slug 404、静态 ISR 与响应式证据。
- P0：`P0-075 企业宣传页面`；同时保持 `P0-027` 公开宣传、`P0-074` 首页和 `P0-082` SEO/安全边界。
- 非目标：P076 供应商与福利服务页、P077 企业注册认证、M5 CMS、真实客户案例/资质发布、真实咨询提交、staging、真机和生产发布。
- 无 Prisma 迁移、OpenAPI、DTO、错误码或交易状态机变化。

## 实际变更

- 新闻列表新增“了解平台能力”收口入口。
- 规则公告详情新增“进入社区集采”收口入口。
- 联系页新增“注册企业”和“查看供应商合作”双入口。
- 新增 P0-075 行为 E2E、契约、确定性台账同步脚本、桌面/移动截图和结构化证据。
- 更新任务/P0/页面/证据/阶段台账、项目状态、M3 冻结证据、执行总控工作簿及其 manifest；P074 写入 merged-main 证据，P075 保持进行中。
- 历史契约/交接断言仅把当前状态锚点从 P074/P073 前移到 P075/P074，继续拒绝越过 `nextAllowedTask`。

## 先失败后通过证据

| 证据 | 结果 |
|---|---|
| RED P0-075 Chromium | `FAIL 2/3`：新闻列表、公告详情和联系页缺少统一明确下一步入口；已有 1 项通过 |
| 最小实现后 P0-075 Chromium | `PASS 3/3` |
| Portal lint / typecheck / build | PASS；公开页保持 Next.js 静态生成/ISR，私有交易区边界未修改 |
| Portal package tests | `PASS 4/4` |
| 相关 P0 门户回归 | `PASS 21/21` |
| 全部 contracts | `PASS 97/97` |
| 全部 handoffs contracts | `PASS 29/29` |
| 完整 `pnpm verify` | `PASS 17/17`；API `247/247`，P0 E2E `92/92`，迁移演练 `empty=2 / upgrade=2 / restore=2 / product=37 / cleanup=PASS`，秘密扫描 `1105` 个跟踪文件，13 个 workspace build 通过 |
| 独立 OpenAPI generate/check | PASS；输出字节稳定，oasdiff `1.17.0` 无变化 |

## P0、环境与外部边界

- P0-075 当前为 `LOCAL_PASS`；要求的 `CI_PASS` 必须由本切片 Draft PR 最终 head 的真实 Actions 提供。
- 本地环境：Windows，Node `22.23.1`，pnpm `10.12.1`，Next.js `16.2.12` production build，Playwright Chromium，Docker Desktop Linux Engine `29.7.2`。
- 桌面和移动截图：`artifacts/verification/M3-P075/portal-publicity-desktop.png`、`portal-publicity-mobile.png`；已人工查看，无明显裁切或溢出。
- 客户名称、Logo、图片、资质材料的正式公开授权：`NOT_EXECUTED`；页面继续使用授权默认拒绝和空态，不能视为正式素材验收。
- staging、真实域名/备案、device、production：`NOT_EXECUTED`。

## 风险与保留改动

- 未知新闻 slug 的测试会触发 Next.js `NoFallbackError` 服务端日志；浏览器收到预期 404，属于 fail-closed 证据而非业务失败。
- 构建仍有既有 Vite chunk size 提示；未发现本切片新增 breaking API 或敏感字段暴露。
- P0 全量测试重写了工作区中三个原已修改、未提交的历史截图：M3-P031、M3-P051、M3-P059。已按路径隔离且不会暂存；此前字节版本未能从工作区、Git 历史、CI 制品或可访问卷影副本恢复，因此不能宣称原字节已恢复。
- 其他无关未跟踪文件和用户改动不纳入本切片。

## 回滚

- 无数据库或 OpenAPI 回滚动作。回滚本切片提交即可撤销三个 CTA、P075 测试/契约/证据和台账更新。
- 回滚后应将项目状态恢复为 P074 merged-main，P075 未开始，并重新运行 portal focused tests 与 `pnpm verify`。

## GitHub 与下一门禁

- 仓库：`EasyStep-lee/flt1`；基线分支：`main`；开发分支：`codex/m3-portal-publicity-pages`；Issue #122。
- 仅允许创建/更新 Draft PR 并修复本切片 CI。未经用户对最终 head 的明确授权，不得转 Ready 或合并。
- `M3-P076` 保持锁定。只有 P075 Draft PR 最终 head CI 成功、人工授权合并且 post-merge `main` CI 成功后，才允许进入 P076；M4 及以后继续锁定。
