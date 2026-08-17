# M3-P054 福利卡适用范围切片交接

## 当前结论

- 结论：`CI_PASS`（绑定代码 head `6b3af8df6b2400d01081dd64c9bea7d27b4f04ba`）。本切片最终本地 `pnpm verify` 17/17、exit 0，且该代码 head 的 GitHub Actions 成功；这不是 M3 阶段 PASS，也不是实际福利卡资金、微信真机、staging 或 production 验收。
- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，与锁定基线一致。
- 前置切片：PR #104 head `24f1a03be05820970503a6af4a9b5492e252d3da` 已按精确授权合并为 `main@236285071ec6601b175cadaca341b0e46950d73d`；合并后 main Actions run `31980331613` / job `95245932370` 成功。
- 当前 GitHub：仓库 `EasyStep-lee/flt1`；Issue [#105](https://github.com/EasyStep-lee/flt1/issues/105)；分支 `codex/m3-welfare-card-scope-rules`；Draft PR [#106](https://github.com/EasyStep-lee/flt1/pull/106)。实现与证据提交为 `71ea302`、`a0007e1`、`485e9cc`、`8c3279c`，兼容修复为 `6b3af8d`。Actions run `31985356527` / job `95259316934` 在精确代码 head `6b3af8df6b2400d01081dd64c9bea7d27b4f04ba` 成功；PR 无评论、无 review，保持 Draft、未合并。包含本交接的最终证据 head 仍须重新取得 CI 才能请求人工精确 head 授权。
- M3-P055 保持 `LOCKED`；M4-M6 继续禁止进入。

## 目标、非目标与方案映射

- 唯一目标：P0-054。分类、商品、SKU 白名单/黑名单及配送费适用规则由服务端统一裁决，商品详情、购物车和确认订单只消费 API-039 的逐行结果。
- 对应方案：福利卡适用范围、个人结算和小程序页面；关联 P0-053、P0-088、P0-090、P0-091、P0-092、P0-098，但不把关联项升级为完整通过。
- 非目标：福利卡冻结/扣款、全额支付、混合支付、退款、个人充值、真实微信、真实卡计划/商品配置、真机验收及任何配送行为。

## 实际变更

- 新增集中式福利卡范围策略；保留 v1 `ALL_PRODUCTS|CATEGORY|PRODUCT|SKU`，增加 v2 `COMPOSITE` 的分类/商品/SKU include/exclude 列表。
- 黑名单先于白名单；商品黑名单可覆盖分类或 SKU 白名单；存在任一白名单时至少命中一项，无白名单时默认包含。列表要求 UUID、单列表去重、总计不超过 1000 项并拒绝未知字段；非法存量规则 fail closed。
- 福利卡计划创建 API 接受向后兼容的 v2 规则并返回稳定 422；无 Prisma schema 变化、无新迁移。
- API-039 为每个本人可用账户返回 `itemApplicability[]` 和 `deliveryFeeApplicability`，金额使用整数分且由服务端重算；不返回规则清单、owner 标识、完整卡号、供应价或卡密。
- 商品详情、购物车、确认订单均经 `miniapp-kit` 和生成契约读取 API-039；详情资格失败不拖垮公开商品，购物车资格失败不阻断普通结算，客户端不复制范围算法。
- OpenAPI、统一类型、字段/权限/页面/API/P0/测试/阶段台账、JSON 证据及 12 页执行总控工作簿同步更新。

## 先红后绿与完整验证

| 证据 | 实际结果 |
| --- | --- |
| RED API | 复合规则账户因旧实现拒绝 `COMPOSITE`，focused 1 项失败且目标账户缺失 |
| RED 小程序 | 商品详情、购物车、确认订单 3 项因适用提示未实现而失败 |
| GREEN API | `welfare-card-eligibility-api` + `welfare-card-programs-api`：8/8 |
| GREEN OpenAPI | P0-053/P0-054 相关契约：2/2 |
| GREEN 小程序 | 相关构建行为：26/26 |
| GREEN P0 | focused Chromium：1/1 |
| 交接契约 | `pnpm test:m0-handoff`：29/29 |
| 冻结契约 | `pnpm test:m1-contract`：90/90 |
| 真实迁移演练 | `PRISMA_MIGRATION_REHEARSAL_OK:empty=2:upgrade=2:restore=2:product=33:cleanup=PASS` |
| 最终全量 | `pnpm verify`：`PNPM_VERIFY_OK:steps=17`，exit 0；报告 `artifacts/test-results/verification/pnpm-verify.json` |

完整门禁保留了真实失败过程：首次回归发现工作簿哈希及旧 M3 进度断言未同步；修复后第二轮发现 19 个冻结契约仍绑定 M3-P052/P053；再修复后第三轮业务/API/P0 已通过，但本机 Docker Desktop 未运行使迁移演练失败。启动 Docker Desktop 后单独演练通过，完整命令于 `2026-08-17T01:03:01.863Z` 至 `2026-08-17T01:17:05.460Z` 首次通过 17/17。

PR #106 首次 Actions run `31984928553` / job `95258143141` 在 head `8c3279cb8d21b58102443baa40d6b4c7cf5e1417` 真实失败：oasdiff 报告旧响应字段 `includedIds`、`excludedIds` 变为可选。修复提交 `6b3af8d` 将请求/响应 DTO 分离，并让组合规则响应继续必填返回兼容字段；focused API 8/8、OpenAPI 21/21、oasdiff 0 error、typecheck 通过。修复后的本地完整命令于 `2026-08-17T01:34:34.080Z` 至 `2026-08-17T01:50:48.581Z` 再次通过 17/17，GitHub Actions run `31985356527` 同步通过。未删除测试、未降低业务断言。

最终完整门禁包含：API 45 文件/231 项、P0 E2E 76/76、Prisma 33 条产品迁移演练、13 个 workspace 构建及 1008 个受跟踪文件秘密扫描。Vite 大包和 Ant Design deprecated 输出为非阻断警告；E2E 中的预期断网代理错误由失败恢复用例触发，测试通过。

## P0、环境与证据边界

- P0-054 自动化技术行为：`LOCAL_PASS`。服务端范围裁决、黑名单优先、配送费计划标记、三页面一致消费、非法规则关闭失败、只读/并发确定性和 DTO 隔离有新鲜本地证据。
- P0-053 保持已合并的 `CI_PASS`；P0-055 及支付/账本行为保持 `NOT_EXECUTED/LOCKED`。
- LOCAL：Windows、Node `22.23.1`、pnpm `10.12.1`、Playwright Chromium、Docker Desktop `29.7.2`、Docker MySQL；`LOCAL_PASS`。
- CI：代码 head `6b3af8d` 为 `CI_PASS`；包含最新台账/工作簿/交接的证据提交仍需精确 head CI。STAGING、DEVICE、PRODUCTION：`NOT_EXECUTED`。
- 真实福利卡计划/商品与真机数据属于人工/外部输入，不影响本切片技术代码验证，但不得据此升级业务、真机或正式验收状态。

## 风险、工作区与回滚

- 主要风险：配送费当前技术切片保持服务端金额 0；后续真实配送费接入仍必须在服务端重算并重新执行范围策略。支付切片必须再次校验规则版本、账户状态、余额、订单价格与幂等键，不能信任预览结果。
- 无数据库迁移和历史回写。回滚方式：revert 本切片原子提交，重新生成 OpenAPI/类型并执行 `pnpm verify`；既有 M3-P051/P052/P053 数据不受影响。
- 未覆盖或暂存无关文件。工作区中两张既有 P031/P051 页面 PNG 被完整浏览器门禁重新生成但未纳入本切片提交；历史 `.codex-*`、`outputs/` 和 UI 资产仍保持未跟踪。

## 下一唯一允许动作

提交并推送本次 CI 证据更新，等待 Draft PR #106 最终精确 head 的必需检查全部成功。之后只能请求用户对该精确 head 明确授权转 Ready/合并；合并后还必须等待 `main` CI 成功，才允许进入 M3-P055。不得自行转 Ready、合并或提前进入下一切片。
