# M3-P030 社区集采边界切片交接

- 结论：CI_PASS（Draft PR 精确 head CI 已通过，未获人工合并授权、未合并）
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 仓库：`EasyStep-lee/flt1`
- 基线：`main@4e164abe7bc343fdc977998982649e124caf6d90`
- 分支：`codex/m3-community-procurement-boundary`
- 实现提交：`78c5a734a81d1c38aa34a3f62687f8cfea52771c`
- 已验证证据 head：`3e1672b8b6b93b1207549e0e882ff35a66635ee3`
- Issue：[#95](https://github.com/EasyStep-lee/flt1/issues/95)
- PR：[#96](https://github.com/EasyStep-lee/flt1/pull/96)，Draft；不得自行转 Ready 或合并

## 唯一目标与非目标

实现公开 `/enterprise-procurement` 社区集采入口，明确它是持续开放的普通企业采购入口，并引导企业注册、登录和进入认证后采购货架。未建立指定社区、活动时段、团长、拼团、成团门槛、企业内部 OA、预算或采购审批；未扩展 M3-P029 交易执行，也未进入 M3-P031 供应商备货。

对应方案为 §8 企业采购、§9 订单福利卡支付；主验收项为 P0-030，页面映射为 PAGE-030。

## 页面、缓存与数据边界

- 新增 Next.js App Router 公开页，`dynamic='force-static'`、`revalidate=300`，含唯一 metadata、canonical、JSON-LD 和 sitemap 条目。
- 门户首页与全站导航增加“社区集采”入口；桌面和移动端均复核，移动导航首项不再被裁切。
- 页面只链接既有 `/enterprise/register`、`/enterprise/login`、`/enterprise/procurement/products`。
- 企业登录和交易路由继续执行 `noindex` 与 `private/no-store`；公开页不返回供应价、企业私有数据或内部归属字段。
- 数据库迁移：N/A；OpenAPI/DTO/错误码：N/A。

## 新鲜失败与通过证据

- RED 1：实现前生产构建后的 `GET /enterprise-procurement` 行为测试期望 200，实际 404。
- GREEN 1：路由实现后运行时行为测试 1/1 PASS，构建输出确认 5 分钟静态 ISR。
- RED 2：移动视觉复核发现首个“首页”导航边界 `x=-72.5`，发生裁切。
- GREEN 2：移动导航改为左对齐后，P0-030 Playwright 1/1 PASS，截图复核无裁切。
- 契约测试 1/1 PASS；门户包测试 4/4 PASS；P0-027 + P0-030 Playwright 12/12 PASS。
- portal lint、typecheck PASS；Prisma validate PASS；MySQL 迁移演练 `empty=2 upgrade=2 restore=2 product=30 cleanup=PASS`。
- OpenAPI generate/check PASS；在 head `3e1672b8b6b93b1207549e0e882ff35a66635ee3` 执行 `pnpm verify -- --base-ref 4e164abe7bc343fdc977998982649e124caf6d90` 17/17 PASS，API 217/217、P0 Chromium 72/72、秘密扫描 936 个跟踪文件。
- 初次误用符号基线 `origin/main` 被门禁以 `VERIFY_BASE_REF_INVALID` 拒绝；改用精确 40 位基线 SHA 后通过。该项是命令参数错误，不是产品失败。
- 证据台账推进后的第一次全量复跑在 regression 步骤 FAIL：4 个历史 handoff 契约仍固定旧任务位置；修正后 focused handoff 12/12 PASS。
- 第二次全量复跑在 contract 步骤 FAIL：18 个历史契约仍固定旧 current/previous delivery；逐项更新后完整 contract 90/90 PASS。最终精确 head 全量复跑 17/17 PASS。
- Draft PR #96 首轮精确 head Actions run `31885709995` / job `95014596327` 在 `3e1672b8b6b93b1207549e0e882ff35a66635ee3` 成功；本次证据同步提交后仍须以新 head 的最终 CI 为准。

截图：

- `artifacts/verification/M3-P030/community-procurement-desktop.png`，SHA-256 `820A13ADCA25F15A84E7C506F42A33D9B2EEC4BB3F621690441800E2F0896994`
- `artifacts/verification/M3-P030/community-procurement-mobile.png`，SHA-256 `F9B78323C19EC17D0C196E942862A629862041DDDBE6C546C62C3A06A370D48B`

## 台账与工作簿

任务、P0、PAGE-030、EVD-030、M3 门禁和项目状态 CSV/JSON 已同步。总控工作簿只更新对应镜像行及看板计数，公式错误扫描 0 项，关键区域渲染复核通过；工作簿 SHA-256 为 `CA6DF120E155B6D37BE7A6A41A0FB2735CD9AD48D0EC9B637166077DB88A1522`。

## P0 与环境边界

P0-030 当前取得本地与 Draft PR 技术证据 `CI_PASS`。完整企业注册、认证后采购货架及交易执行由既有/后续切片分别验收，不因本公开入口自动升级。真实域名、DNS、TLS、ICP备案、CMS 发布、staging、真机和 production 均为 `NOT_EXECUTED`；没有新鲜证据时不得升级。

## 风险与回滚

- 风险：公开入口内容当前随应用发布；M5 CMS 发布/下线和按 slug ISR 失效尚未实现。真实域名、备案和企业内容验收仍需外部人员完成。
- 回滚：原子 revert M3-P030 页面/导航/样式提交即可；无数据库回滚、无 API 兼容问题。若仅撤销入口，应同时移除 sitemap 与导航条目，避免孤儿页面。
- 用户未跟踪文件保持原状，未纳入切片。

## 下一门禁

证据同步提交后先取得 PR #96 最新精确 head CI。只有人工对该精确 head 明确授权合并且合并后的 `main` CI 成功后，M3-P031 才可解锁；在此之前 M3-P031、M4-M6 均禁止进入。
