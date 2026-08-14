# 2026-08-14 M3-P026 按原支付结构退款交接

阶段结论：`IN_PROGRESS / CI_PASS`。M3-P025 已由 PR #86 按精确 head `cd4b9ea32499793ea947bb646778db307a9c4acd` 合并到 `main@c4ab850ef7d6f6693376097350e2d0ddc27c6755`，合并后 Actions run `31796060635` / job `94753324144` 成功。本切片实现提交为 `b80d348`，OpenAPI 名单修复为 `a30d94a`，职能页回归修复为 `87f3bd3`，异常恢复补强为 `87917f8`；包含异常恢复修复的本地 `pnpm verify` 17/17 通过。Draft PR #88 的精确 head `87917f8c131b04ce810d76b9d74406c2d0276ec3` 已由 Actions run `31807427052` / job `94789600099` 验证成功；人工合并和 post-merge main CI 尚未执行。真实福利卡账本、真实微信退款及 staging 未执行，所以 P0-026 整项保持 `NOT_EXECUTED`。

## 基线、范围与 Git

- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`；基线校验通过，仅有执行包冻结副本的已知提示。
- 当前阶段/任务：M3 / M3-P026；API-043；MIG-013；公司订单客服退款发起页。
- 分支：`codex/m3-structured-refund`；基线：`main@c4ab850ef7d6f6693376097350e2d0ddc27c6755`；当前已验证 PR head：`87917f8c131b04ce810d76b9d74406c2d0276ec3`。
- GitHub：Issue #87；Draft PR #88；PR CI 为 `CI_PASS`（run `31807427052` / job `94789600099`）；人工合并和 post-merge main CI 为 `NOT_EXECUTED`。
- 用户既有未跟踪文件和 `.codex-*` 临时证据均保留且未暂存。

## 完成范围

- 新增 `RefundAuthorization`、`RefundTransaction`、`RefundTransactionEvent`、`RefundImpactRecord` 和对应枚举、关系、唯一键、金额约束及不可变触发器。
- API-043 仅消费已批准授权快照；请求不接受金额、退款目标或归属字段；同一自然人批准后不得切换职能发起退款。
- 使用原 `OrderPaymentAllocation` 和累计历史退款进行整数分分配，支持多次部分退款的确定性余数，累计不超过原福利卡/微信分配与批准金额。
- 福利卡目标固定为原福利卡账户，微信目标固定为原 `PaymentTransaction`；默认适配器失败关闭，测试使用确定性适配器桩。
- 每个通道以乐观锁先认领后外呼，防止并发重复；福利卡未知或处理中时不启动微信；外部未知持久化为 `UNKNOWN` 且重放不再次外呼。
- 同阶段自审补强：通道认领后适配器抛出异常时先持久化 `UNKNOWN` 再返回安全错误，福利卡和微信重放均不再次外呼，避免永久卡在 `PROCESSING`。
- 原子追加退款交易、状态事件及 `FINANCIAL`、`INVENTORY`、`RECONCILIATION` 三类影响；库存影响只记录待售后决定，不在 M3 修改可售库存。
- 公司订单客服固定职能页面新增真实退款发起表单和 loading/success/duplicate/unknown/error 状态；金额和目标数据不可输入。
- OpenAPI 与生成类型新增 API-043，DTO 白名单和错误码已纳入确定性生成。

## 明确非目标

- 不实现 M5 售后申请、责任归因、审批或退款授权生成页面。
- 不实现真实福利卡账本入账、真实微信退款/回调/查单、真实资金或人工财务核验。
- 不决定退货商品是否重新入库，不修改库存数量；只追加待售后决定的影响快照。
- 不开始 M3-P027，不进入 M4/M5/M6，不执行 staging、真机、生产迁移或上线。

## 测试证据

| 证据 | 结果 |
|---|---|
| RED：API-043 Supertest | 3/3 按预期失败：期望 201/401/202，实际 404 |
| 退款分配 unit | 2/2 通过；1801/3999 两次 2900 退款得到 900/2000 与 901/1999 |
| 退款 API + 公司 workspace focused | 9/9 通过 |
| 适配器异常恢复 focused | 福利卡与微信异常后均持久化 `UNKNOWN`；重放不再次外呼 |
| MIG-013 contract + OpenAPI contract | 通过 |
| 公司后台 lint/typecheck/build | 退出码 0；仅有 Vite 大 chunk 非阻断警告 |
| P0-026 API/页面 Playwright | 2/2 通过 |
| `pnpm prisma:validate` | 退出码 0 |
| `pnpm prisma:migrate:dry-run` | 退出码 0；empty=2、upgrade=2、restore=2、product=28、cleanup=PASS |
| OpenAPI generate/check/breaking | 字节稳定；breaking 0 errors；新增全局错误枚举产生兼容性 warning，但门禁通过 |
| 首次 `pnpm verify` | `FAIL`：实现尚未提交时 `openapi-diff` 正确检测到生成物相对 HEAD 有差异；没有跳过门禁 |
| 最终 `pnpm verify` | `f3c60d8` 退出码 0；17/17 PASS；58 项 P0 E2E 通过；报告 `artifacts/test-results/verification/pnpm-verify.json` |
| 自审补强后的 `pnpm verify` | 包含 `87917f8` 修复的本地工作树，退出码 0；17/17 PASS |
| Draft PR exact-head CI | `87917f8`；Actions run `31807427052` / job `94789600099`；SUCCESS |

## P0 与环境边界

- P0-026 自动化子行为：`LOCAL_PASS`；原结构、原目标、整数分守恒、同自然人隔离、并发/幂等、UNKNOWN 不重发、影响追加均有行为测试。
- P0-026 整项：`NOT_EXECUTED`；required level 为 `STAGING_PASS`，真实福利卡账本和真实微信退款均未执行。
- LOCAL：`LOCAL_PASS`；PR CI：`CI_PASS`；STAGING/DEVICE/PRODUCTION：`NOT_EXECUTED`。
- 外部边界：真实微信商户证书/APIv3 密钥、真实福利卡账本连接、回调域名、staging 与财务核验必须由授权人工配置/执行；不得把秘密或真实敏感资金数据放入仓库或聊天。

## 风险与回滚

- 风险：默认通道适配器故意失败关闭，当前候选不能执行真实退款；没有 M5 已批准授权来源时 API 只可由受控测试/未来售后流程使用。
- 风险：退款成功后的福利卡账本、微信查询补偿和退货库存处置仍是后续切片；不得把当前自动化结果当作真实资金闭环。
- 未发布回滚：回退本分支提交并重建开发库；不触碰用户未跟踪文件。
- 已发布回滚：回退应用版本但保留退款授权、交易、事件和影响历史；以新向前修复迁移处理，不得删除或改写审计记录。

## 下一步门禁

下一动作仅限处理 M3-P026 Draft PR #88 的评论、确认最新 head CI，并等待人工按最新精确 head 授权转 Ready/合并；合并后 main CI 成功前不得开始 M3-P027。当前明确禁止 M3-P027、M4、M5、M6 以及任何真实资金或生产操作。
