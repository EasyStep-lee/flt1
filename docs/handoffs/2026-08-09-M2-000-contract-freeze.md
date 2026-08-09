# M2-000 契约冻结交接（2026-08-09）

> 后续门禁补充：PR #36 已以精确 head `313546a08fe58f2152a5f2b9a347871effbe562b` 获人工授权并合并为 `main@2f52c218ab88f3a7419f2a77b7e6b730fd7365b6`；PR CI run `31300560907` 与合并后 main CI run `31301103092` 均成功，M2-P006 已据此解锁。以下内容保留交接生成时的历史状态。

## 结论

`LOCAL_PASS`。M2-000 已完成契约冻结，但当前分支尚未取得 PR CI、人工合并或合并后 main CI，因此不得开始 M2-P006，也不得把任何 M2 业务 P0 标记为通过。

## 基线和 GitHub

- 唯一方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`
- 仓库：`EasyStep-lee/flt1`
- 基线：`origin/main@162787ae1687116badf0972664005332220976f9`
- M1-GATE：PR #34 已合并；main CI run `31295823535` / job `93200635788` 成功
- 当前 Issue：[#35](https://github.com/EasyStep-lee/flt1/issues/35)
- 当前分支：`codex/m2-contract-freeze`
- 实现提交：`25dfc2a56bf6943e12cf30cf05b1323385cd65df`
- 当前 PR/CI：Draft PR 待发布；当前提交 CI 为 `NOT_EXECUTED`
- 未解决评论、合并：待创建 PR 后读取；未经用户按精确 head 授权不得合并

## 实际变更

- 新增确定性 M2 契约生成器和 113 字段/11 转换/5 职能/5 页面/13 API/18 P0/58 失败行为的冻结产物。
- 新增台账同步器，更新字段、状态、权限、页面、P0、API、迁移计划、任务、阶段门禁和项目状态。
- 把 M1-GATE 的 PR #34 合并与 `main@162787a` 新鲜 CI 证据写回控制台账。
- 保留 M1 已实现的五个页面壳；M2 业务仍明确为 `NOT_IMPLEMENTED/NOT_EXECUTED`。
- MIG-005～009 只是计划，没有修改 Prisma schema、没有生成或应用数据库迁移。
- OpenAPI 路径/DTO/错误码是冻结草案，运行时契约和生成物没有被本切片虚报为完成。

## 先失败后通过

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `node --test tests/contracts/m2-contract-freeze.contract.test.mjs` | `FAIL`，0/6 | 缺少冻结产物、生成器和 M1→M2 控制状态，符合预期 RED |
| 同一 focused 测试（首次实现后） | `FAIL`，5/6 | 暴露台账同步后生成器不能读取自身冻结类型；未降低断言 |
| `node scripts/generate-m2-contract-freeze.mjs --check` | `PASS` | 修复后字节确定性通过 |
| `node --test tests/contracts/m2-contract-freeze.contract.test.mjs` | `PASS`，6/6 | 范围、字段、失败行为、不变量、拒绝夹具与控制状态全部通过 |
| `pnpm verify`（首次全量尝试） | `NOT_EXECUTED`，外层 184 秒超时中断 | 聚合器未返回产品失败；增加超时后重新执行，未把中断记为通过或失败 |
| `pnpm verify`（第二次） | `FAIL` | 3 个 M1-GATE 交接测试仍把当前项目游标锁在 M1；保留历史门禁断言并改为验证当前 M2 游标 |
| `pnpm verify`（第三次） | `FAIL`，M1 合同 31/43 | 12 个 M1 切片合同仍把当前项目游标锁在各自历史切片；保留历史 PR/CI 与行为断言，只修正当前控制状态 |
| `node --test tests/contracts/*.test.mjs` | `PASS`，43/43 | M1 历史证据与 M2-000 新契约同时通过 |
| `pnpm verify`（最终） | `PASS`，17/17，退出码 0，602.9 秒 | 回归、API、foundation E2E、P0 E2E、Prisma、迁移演练、build、秘密扫描全部通过；报告见 `artifacts/test-results/verification/pnpm-verify.json` |
| 执行总控工作簿检查 | `PASS` | 使用工作簿工具更新并渲染 12 张表，人工检查 Dashboard 与各表布局；公式错误扫描 0 项 |

最终全量门禁基于提交前工作树和 `HEAD@162787ae1687116badf0972664005332220976f9` 执行；当前提交精确 head 的 CI 仍为 `NOT_EXECUTED`，必须由 Draft PR Actions 独立验证。

## P0 证据边界

P0-006、007、008、009、010、011、012、013、014、015、016、017、018、019、021、061、063、071 已有契约映射和负向测试 ID，但业务实现证据仍为 `NOT_EXECUTED`。本切片唯一通过项是 M2-000 契约冻结本身，不是上述 P0 的正式验收。

## 风险、人工缺口和回滚

- `EXT-007` 分类/模板真实内容待业务提供；`EXT-008` 强监管品开放条件待合规确认。安全回退分别是不写入真实内容和强监管默认关闭。
- 最大实现风险是后续 DTO 泄露供应价、把供应商商品当作可售商品、同一自然人自审、覆盖历史或创建多份 SKU 库存真源；冻结产物已为这些边界建立失败行为。
- 回滚：回退本切片原子提交即可；由于没有数据库迁移、运行时 API 或外部副作用，不需要数据回滚。
- 用户未跟踪的图片、UI 资产、提示词包和输出目录均未覆盖或纳入本切片。

## 下一最小切片

M2-000 PR 精确 head CI、人工合并和合并后 main CI 全部成功后，才进入 `M2-P006`：先写 `SupplierProduct` 不能直接售卖、双审核前不能产生 `Product/Sku`、跨供应商越权与 DTO 白名单的失败测试，再实现最小纵向切片。
