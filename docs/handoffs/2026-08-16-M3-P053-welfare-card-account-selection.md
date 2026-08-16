# M3-P053 福利卡账户选择切片交接

## 当前结论

- 结论：`LOCAL_PASS`；本切片完整 `pnpm verify` 17/17 通过，但不是 M3 阶段 PASS，也不是实际资金、真机、staging 或生产验收。
- 基线方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`。
- 基线：PR #102 head `d1143daac1658aa0876642525cc481b30437eed7` 已按授权合并为 `b186f6b680727318ddeb4d6573bcfa4090d2ad8b`；main Actions run `31946062202` / job `95162089803` 成功。
- 当前：Issue [#103](https://github.com/EasyStep-lee/flt1/issues/103)，分支 `codex/m3-welfare-card-account-selection`，本地验证提交 `e1df027d53f2980e418e118bed22d15aa0832601`；Draft PR、精确 head CI、评论和合并均未执行。

## 实际变更

- 新增 API-039，只接受 SKU/数量并从会话派生归属，按服务端实时零售价计算本单金额、范围适用额和 `min(可用余额, 可适用金额)`。
- Prisma 读取先限定本人、公司、ACTIVE 账户、`ACTIVE+APPROVED` 计划和 `ISSUED` 批次；对客 DTO 只返回掩码卡号与账户选择白名单。
- PAGE-056 新增福利卡选择子区块：通过 `miniapp-kit` 调用生成契约，展示余额、范围和最大抵扣额，只能选一个或不使用，没有手输金额。
- API 与页面均不冻结/扣减账户，不写账本，不创建订单或支付，不进入 P0-054/P0-055 及后续阶段。
- Prisma schema 已满足需求，本切片无迁移；回滚仅需原子 revert 应用/API/页面和证据文件。

## 先红后绿

| 证据 | 结果 |
| --- | --- |
| RED API | 3/3 因 API-039 返回 404 失败 |
| RED OpenAPI | 路径不存在，读取 `.get` 失败 |
| RED 小程序 | 3/3 因 PAGE-056 构建产物不存在失败 |
| GREEN API | `welfare-card-eligibility-api.test.mjs` 3/3 |
| GREEN Prisma | `prisma-welfare-card-eligibility-repository.test.mjs` 1/1 |
| GREEN 小程序 | `welfare-card-selection-build.test.mjs` 3/3 |
| GREEN OpenAPI | `m3-p053-welfare-card-eligibility.contract.test.mjs` 1/1 |
| GREEN P0 | focused Chromium 1/1 |
| 全量门禁 | `pnpm verify` 17/17，exit 0；报告提交 `e1df027d53f2980e418e118bed22d15aa0832601` |

完整门禁首次在未提交生成契约上按预期被 `openapi-diff` 拒绝；提交实现后又分别发现 PAGE-056、API-039 路径及三个 DTO 未登记到精确清单。上述约束均已补齐并保持原断言强度，最终报告为 `artifacts/test-results/verification/pnpm-verify.json`，时间 `2026-08-16T13:00:47.499Z` 至 `2026-08-16T13:16:55.939Z`。

## P0、环境、风险与回滚

- P0-053 自动化技术子行为当前为 focused `LOCAL_PASS`；真实账户/资金、真机、staging 和 production 均 `NOT_EXECUTED`。
- P0-092 仅完成账户选择技术子区块；完整确认订单、地址、支付结果恢复和真机页面验收不得在本切片宣称完成。
- PAGE-063 的账本/福利卡详情仍属于 P0-059/P0-097，保持未完成；M3-P054 及后续任务在本 PR 合并和 post-merge main CI 前锁定。
- 主要风险：当前选择只保存账户 ID，后续支付切片必须在服务端重新校验版本、余额、范围和订单价格，绝不能信任客户端选择或预览金额。
- 回滚：revert 本切片提交并重新生成 OpenAPI；无数据库迁移或历史数据回写。已存在的 M3-P051/P052 计划、账户与账本不受影响。
