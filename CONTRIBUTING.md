# 贡献规则

## 开始前

1. 阅读根目录 `AGENTS.md`、V1.1综合方案、当前任务行、项目状态和最近交接。
2. 运行 `./scripts/verify-product-baseline.ps1`。
3. 只恢复 `nextAllowedTask`，一次只处理一个任务。
4. 保护工作树中的用户材料，不使用 `git reset --hard` 或未经审查的 `git add -A`。

## 开发顺序

1. 写清目标、非目标、依赖、完成定义和回滚。
2. 先写失败测试，确认失败原因正确。
3. 实现最小切片，运行focused tests和根级`pnpm verify`；CI必须使用事件真实基线提交。
4. 精确暂存本任务文件并创建原子提交。
5. 更新执行台账、项目状态和交接证据。

## 分支与远程

- 本地开发分支使用 `codex/` 前缀。
- GitHub `owner/repo`、默认分支和写权限未确认前，不添加origin、不推送、不创建Issue/PR。
- 不直接修改或推送main，不强推、不改写公共历史、不操作Secrets或生产环境。

## 证据纪律

- `LOCAL_PASS`、`CI_PASS`、`DEVICE_PASS`、`STAGING_PASS`、`PRODUCTION_PASS`不能互相替代。
- 尚未建立或没有执行的命令必须记录为 `NOT_EXECUTED`；外部依赖缺失记录为 `BLOCKED_EXTERNAL`。
- 根级`pnpm verify`失败时修复根因；不得使用skip变量、`--if-present`、降低断言或删除检查绕过门禁。
- 没有真实Actions运行时，本地`pnpm verify`只能记为`LOCAL_PASS`，不能写成`CI_PASS`。
