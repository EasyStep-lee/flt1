# M1-P066 公司后台登录与职能账号选择交接

## 身份与结论

- 仓库：`EasyStep-lee/flt1`
- 分支：`codex/m1-m1-p066`
- Issue：[#21](https://github.com/EasyStep-lee/flt1/issues/21)
- Draft PR：[#22](https://github.com/EasyStep-lee/flt1/pull/22)，创建时 head `01eedbde3fbe6b99bb727dc581bc84330ec93dc2`
- 基线：`993184234f930ec3999164ce48668e95dca9368b`，即 M1-P047 合并后并经 main CI 通过的提交
- 已验证实现提交：`01eedbde3fbe6b99bb727dc581bc84330ec93dc2`
- 结果：`LOCAL_PASS`；Draft PR 已创建，最终证据提交的精确 head CI、人工审查/授权合并及合并后 main CI 尚未执行

本切片只实现 API-003、API-004、PAGE-001 与 PAGE-002。公司后台没有公众注册；单一有效职能账号且无需二次验证时直接签发一个工作区会话，多账号时先返回服务端账号列表并等待选择。M1-P067 的各职能独立工作台未实现。

## RED、实现与 P0

- 初始 RED：company-auth 模块不存在，API focused 不能加载；CompanyUser/AuthSession/LoginAudit 和前向迁移缺失，迁移合同 0/2；账号选择页缺失，公司后台 bundle 1/2。
- 自审追加 RED：相同 `requestId` 重试返回不同选择 nonce，API focused 7/8；改为服务端绑定用户与 requestId 的确定性 nonce 后 8/8，数据库仍只保存 nonce 哈希。
- 原始会话令牌只写入 `Secure`、`HttpOnly`、`SameSite=Strict` Cookie，数据库只存 SHA-256 哈希；成功 JSON 不含令牌。
- 登录失败按账号哈希计数，未知账号与错误凭证使用同一安全错误；连续 5 次失败后限流。
- `NEG-M1-066-01`：公司注册 API 为 404，登录页面无注册链接且 noindex/no-store。
- `NEG-M1-066-02`：多账号登录不发会话，页面只展示服务端返回的账号。
- `NEG-M1-066-03`：同一 nonce 改选第二账号返回冲突；同一自然人的新会话撤销旧活动会话。
- `NEG-M1-066-04`：停用、过期、越权和客户端伪造归属均失败关闭且不发 Cookie。

## 新鲜验证

| 验证 | 结果 |
|---|---|
| Company auth Supertest | PASS 8/8 |
| 公司后台 bundle | PASS 2/2 |
| OpenAPI | PASS 11/11；生成逐字节稳定 |
| 迁移合同 | PASS 21/21 |
| M1 合同回归 | PASS 32/32 |
| P0 Chromium | PASS 11/11 |
| `pnpm prisma:migrate:dry-run` | PASS：empty=2、upgrade=2、restore=2、product=7、cleanup=PASS |
| `pnpm verify` | PASS 17/17；报告提交 `01eedbd` |
| Secret scan | PASS：433 个跟踪文件 |

完整报告位于 `artifacts/test-results/verification/pnpm-verify.json`，P066 汇总证据位于 `artifacts/verification/M1-P066/company-auth.json`，MySQL 原始演练报告位于同目录 `prisma-migration-rehearsal.json`。

## 环境、风险与回滚

- 本地 Windows、Node 22.23.1、pnpm 10.12.1、Docker 29.6.2、临时 MySQL 8.4.11、Prisma 6.19.2、Playwright Chromium。
- 生产默认凭证校验器与二次验证器失败关闭；真实企业身份源、短信/风控、预发布、生产迁移和正式验收均未执行。
- PAGE-001 参考资产的文件名是公司登录，但正文实际是供应商入驻；实现以 V1.1 综合方案为准，只复用色彩与版式方向。
- 非阻塞警告：既有 Vite bundle 大于 500 kB；`FORCE_COLOR` 存在时 `NO_COLOR` 被忽略。
- 应用按 P066 原子提交 `git revert`；新增 SQL 已作为前向迁移发布到分支，不得回改或向后删除，必要时以兼容窗口和新的前向修复迁移处置。

## 下一边界

下一任务是 `M1-P067`，但只能保持 READY。必须先核验 PR #22 最终精确 head CI，完成审查与用户对该 head 的授权合并，再核验合并后 main CI；闭环前不得进入 P067，更不得进入 M2。
