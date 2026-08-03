# pnpm verify 与 GitHub CI 门禁

## 1. 证据边界

M0-011只建立可在本地复现的质量聚合器和GitHub Actions模板。当前仓库没有可验证`origin`，`owner/repo`、默认分支、远程写权限、实际分支保护、PR和Actions运行均未确认。因此本地通过只能记录为`LOCAL_PASS`，不能记录为`CI_PASS`。

## 2. 本地统一入口

运行：

```powershell
pnpm verify
```

本地没有远程基线时使用当前`HEAD`作为明确的本地回退基线，并在报告中登记`LOCAL_HEAD_FALLBACK`。如需对比某个已获取的真实基线，先解析为40位提交SHA再执行：

```powershell
pnpm verify -- --base-ref <40位提交SHA>
```

聚合器严格按顺序执行工作区检查、lint、OpenAPI生成/提交差异/确定性检查/oasdiff、typecheck、单元/回归/API/E2E、Prisma validate、已发布迁移完整性、三数据库迁移演练、build和秘密扫描。任一步失败即失败，后续步骤在JSON中明确记录为`NOT_EXECUTED_AFTER_FAILURE`；不存在`--skip`或静默成功入口。

机器报告写入被Git忽略的`artifacts/test-results/verification/pnpm-verify.json`，包含当前提交、比较基线、基线来源、每步命令、时间、耗时和结果。

## 3. M0 P0 E2E空套件策略

M0在阶段门禁中映射的业务P0数量为0，因此`pnpm test:e2e:p0`读取机器状态和阶段门禁后，明确输出：

```text
P0_E2E_NOT_APPLICABLE:stage=M0:p0Count=0:reason=M0_HAS_NO_MAPPED_P0
```

这不是业务E2E通过。门户技术壳仍由`pnpm test:e2e:foundation`真实运行。后续阶段只要P0数量大于0而`tests/e2e/p0`没有测试，命令必须失败；有测试时才调用Playwright执行。

## 4. GitHub Actions基线

`.github/workflows/ci.yml`在Pull Request、`main` push和人工触发时运行。工作流：

1. 以完整Git历史checkout且不持久化写凭据；
2. 安装精确Node、pnpm与冻结依赖；
3. 安装与仓库锁定版本匹配的Playwright Chromium；
4. PR使用事件中的`pull_request.base.sha`，push使用`before`，人工触发使用当前提交父提交；初始push没有可比较提交时直接失败；
5. 将解析出的40位不可变提交作为`VERIFY_BASE_REF`运行`pnpm verify`；
6. 无论成功失败均尝试上传本次验证报告，但上传动作不能改变主门禁结果。

CI环境禁止使用`HEAD`冒充目标分支基线。迁移历史检查与oasdiff共用事件真实基线提交，spec/类型生成后存在未提交差异时门禁失败。

## 5. Action固定提交

以下`v4`引用于2026-08-03通过GitHub API解析为不可变提交，并在工作流中使用完整SHA：

| Action | 提交SHA |
|---|---|
| `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` |
| `pnpm/action-setup` | `b906affcce14559ad1aafd4ab0e942779e9f58b1` |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` |

Dependabot可以提出依赖更新PR，但不能绕过固定SHA、测试和人工评审。

## 6. 人工配置与启用

仓库管理员确认目标仓库后，必须再确认默认分支和`.github/workflows/ci.yml`的`main`触发是否一致，配置`verify`为必需检查、至少一名人工审批、禁止强推/删除及未解决review thread合并。`CODEOWNERS.example`中的占位账号必须替换后才能改名为正式`CODEOWNERS`。

Secrets、Environment、仓库权限、分支保护和最终合并只由授权人工配置。工作流不包含真实外部服务密钥，也不执行生产部署或生产迁移。
