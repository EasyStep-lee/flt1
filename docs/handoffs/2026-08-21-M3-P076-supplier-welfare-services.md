# M3-P076 供应商与福利服务页交接

## 结论

- 阶段：`M3_IN_PROGRESS`；本切片：`M3-P076 / P0-076`；本地结论 `LOCAL_PASS`，M3 不因本切片自动 PASS。
- 方案章节：综合方案 §8 门户全站、§13 安全与隐私边界；方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 基线：`origin/main@3d82a41f916d9348aac9a6d490cf6702950a1fe1`；P075 PR #123 head `a45037ac77e0d26585e0a8642c4b964d2a534323` 已合并，post-merge main run `32482552107` / job `96771882721` 成功。
- 开发分支：`codex/m3-portal-supplier-welfare-services`；Issue #124；Draft PR 待创建。
- 实现与稳定性提交：`d342b26`、`c9c877e`、`caf0d0b`、`7059ce7`、`5b78aca`、`2b43d78`；证据提交待形成最终 head。

## 唯一目标与非目标

- 唯一目标：完成供应商合作公开页、福利卡服务 SSG/ISR 页，以及最小、有保护的企业福利咨询纵向闭环。
- P0：`P0-076 供应商与福利服务页`；同时保持 P0-003 供应商入驻、P0-027 公开宣传、P0-075 企业宣传和 P0-082 SEO/安全边界。
- 非目标：P077 企业注册认证、咨询线索后台、M5 CMS、真实验证码服务、真实数据保护密钥、staging、真机和生产发布。
- 公开咨询不创建 `EnterpriseCustomer`、福利卡账户、资金发放、供应商店铺或任何收付记录。

## 实际变更

- 新增 `/welfare-card-service` 静态 ISR 页，包含适用场景、办理边界、员工使用与退款口径，以及最小咨询表单。
- 完成 `/supplier-cooperation` 条件、分类、材料、流程、FAQ、注册和登录收口；不承诺必然通过，不生成供应商店铺。
- 新增 `POST /v1/public/business-inquiries`，请求 DTO 仅允许 `contactName / enterpriseName / mobile / demandSummary / consentToUse=true`。
- `companyId`、咨询类型、来源页、同意版本、状态和请求证据均由服务端派生；归属固定为唯一 `ACTIVE` 公司。
- 入库前经数据保护 Adapter 处理手机号；明文手机不落库、不写日志、不进响应。生产默认 Adapter 未配置时失败关闭 `503`。
- 来源校验、Fetch Metadata、验证码 Adapter、固定窗口限流、指纹哈希、`Idempotency-Key + requestHash`、同载荷重放、异载荷 409 和未知结果原键恢复均有行为证据。
- 新增 `BusinessInquiry` Prisma 模型及 `20260821130000_m3_public_business_inquiry`迁移；数据库触发器拒绝 UPDATE/DELETE，保留只追加证据。
- OpenAPI 和生成类型字节稳定；Web 使用同源 Next 代理，公开响应只返回线索号、状态、提交时间和安全提示。
- 更新字段字典、状态机、权限、页面、迁移、API、P0、任务、证据、阶段台账、项目状态、M3 冻结证据与执行总控工作簿。

## 先失败后通过证据

| 证据 | 结果 |
|---|---|
| RED API | `FAIL`：`business-inquiries` 模块尚不存在 |
| RED P0-076 Chromium | `FAIL`：`/welfare-card-service` 返回 404 |
| API focused | `PASS 4/4` |
| 迁移契约 | `PASS 3/3` |
| P0-076 Chromium | `PASS 3/3` |
| Portal package tests | `PASS 4/4` |
| P075 + P076 联合回归 | `PASS 6/6` |
| P0-063 稳定性复测 | 先在全量负载下失败（下拉竞态保留默认 INCREASE）；改为只点击当前可见选项后 `PASS 3/3`，最终两轮全量 P0 均通过 |
| 迁移演练 | 中途因 Docker Engine 停止失败；恢复环境后 focused 及最终连续门禁均 `PASS empty=2 / upgrade=2 / restore=2 / product=38 / cleanup=PASS` |
| 完整 `pnpm verify` | `PASS 17/17`；API `251/251`，P0 E2E `95/95`，foundation E2E `3/3`，13 个 workspace build，1131 个跟踪文件秘密扫描 |
| OpenAPI | generate/check 字节稳定，oasdiff `1.17.0` 无 breaking 变化 |
| 工作簿 | artifact-tool 导入/更新/导出，12 张预览，公式错误 0，二次导入验证 `PASS` |

## P0、环境和外部边界

- P0-076 当前为 `LOCAL_PASS`；只有 Draft PR 最终精确 head Actions 成功后才能升级为 `CI_PASS`。
- 本地环境：Windows，Node `22.23.1`，pnpm `10.12.1`，Next.js `16.2.12`，Playwright Chromium，Docker Desktop Linux Engine `29.7.2`，MySQL `8.4.11`。
- 截图：`artifacts/verification/M3-P076/welfare-service-desktop.png`、`welfare-service-mobile.png`；已人工查看，无明显裁切或溢出。
- 真实验证码 provider 与数据保护密钥：`BLOCKED_EXTERNAL / NOT_EXECUTED`；未要求用户在聊天提供任何密钥。
- staging、真实域名/备案、device、production：`NOT_EXECUTED`。
- 本地 Mock/Adapter 成功不等于真实验证码或真实密钥验收。

## 风险与保留改动

- 公开咨询在真实环境上线前必须在密钥系统配置验证码和数据保护 Adapter；未配置时会预期失败关闭。
- Next.js 未知 slug 的 `NoFallbackError` 日志对应预期 404；不是本切片业务失败。
- 既有 Vite chunk size 告警仍存在；本切片未新增 breaking API、供应价泄露或资金入口。
- 全量 Playwright 重写了多个已跟踪历史截图（M3-P031/P051/P059/P062/P073/P075/P076）；这些工作区改动不暂存、不删除，作为用户既有/测试生成改动保留。
- 其他无关未跟踪文件和用户改动不纳入本切片。

## 回滚

- 共享环境上线前：按原子提交反向 revert，并在专用开发库重建迁移链验证。
- 迁移已进入共享环境后：停止新咨询写入，回滚应用到兼容版本，只使用新的向前修复迁移；不改写已发布迁移，不删除 `BusinessInquiry` 与幂等证据。
- 回滚后应将项目状态恢复为 P075 merged-main、P076 未开始，并重跑 OpenAPI、迁移演练、focused tests 和 `pnpm verify`。

## GitHub 与下一门禁

- 仓库：`EasyStep-lee/flt1`；基线分支：`main`；开发分支：`codex/m3-portal-supplier-welfare-services`；Issue #124；Draft PR 待创建。
- 只允许创建/更新 Draft PR 并修复本切片 CI。未经用户对最终 head 明确授权，不得转 Ready 或合并。
- `M3-P077` 保持锁定。只有 P076 Draft PR 最终 head CI 成功、人工授权合并且 post-merge `main` CI 成功后，才允许进入 P077；M4 及以后继续锁定。
