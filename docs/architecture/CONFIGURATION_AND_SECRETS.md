# M0-007 配置与秘密安全边界

## 1. 范围

本切片建立共享配置Schema、development/test/staging/production四层环境、非本地环境防误配、日志脱敏、Git已跟踪文件秘密扫描，以及凭据保管和轮换规则。它不接入真实密钥、不选择具体云秘密管理服务，也不实现OpenAPI、业务DTO、业务页面、认证授权、业务模型或交易流程；确定性契约属于M0-008。

配置真源为`packages/config`，API通过`@fulishe/config`消费。仓库只允许提交根目录`.env.example`，真实`.env`及其变体由`.gitignore`排除。

## 2. 环境分层

| APP_ENV | NODE_ENV | 凭据来源 | 本地地址/开发凭据 |
|---|---|---|---|
| development | development | 本机未跟踪`.env` | 允许，仅限本机 |
| test | test | 测试进程或隔离测试环境 | 允许测试专用值 |
| staging | production | 部署平台运行时注入 | 禁止 |
| production | production | 受控秘密管理系统运行时注入 | 禁止 |

`APP_ENV`表达部署层，`NODE_ENV`保持Node生态的运行模式。staging和production必须使用`NODE_ENV=production`；连接地址不得指向回环/通配地址，不得使用`.env.example`中的开发凭据。解析失败只返回变量名、错误码和规则，不回显变量值。

## 3. 配置Schema与启动失败

`API_RUNTIME_SCHEMA`标明字段是否必需及是否为秘密。`DATABASE_URL`和`REDIS_URL`缺失时一次汇总后快速失败；URL协议、端口、超时、重试和队列前缀都按明确上下限校验。API沿用`loadRuntimeConfig`兼容入口，但实现来自共享包，避免各应用复制规则。

开发样例校验：

```powershell
pnpm config:check
```

此命令仅证明`.env.example`的结构有效，不代表staging或production凭据已经配置。API真实启动仍读取进程环境或未跟踪`.env`，缺失即失败。

## 4. 密钥管理与轮换

- 真实数据库口令、Redis口令、微信AppSecret、微信支付APIv3密钥、证书私钥、会话签名密钥及第三方令牌不得提交到Git、文档、截图、测试快照或构建产物。
- development凭据只用于本机隔离容器；test使用独立、可销毁的测试凭据；staging与production必须账户隔离、最小权限、分别授权，不得复用。
- 部署系统只在运行时把秘密注入服务端进程；任何服务端秘密不得使用`NEXT_PUBLIC_`、`VITE_`或小程序源码可见前缀。
- 轮换采用“新增版本并行可用 → 部署验证 → 切换生效 → 撤销旧版本 → 复核审计”的顺序。数据库、Redis、支付证书和签名密钥分别制定周期；发现疑似泄漏时立即撤销并按安全事件处理，不能只删除Git中的文本。
- 读取、变更、轮换和紧急撤销必须由具名自然人执行并保留审计；生产授权资料由人工安全管理员提供，Codex不得生成或猜测。

## 5. 日志脱敏

`redactLogValue`递归处理对象、数组和错误，对authorization、cookie、password、secret、token、各类key、数据库/Redis连接串和福利卡卡密字段执行键级脱敏；普通文本中的凭据URL、Bearer/Basic值和秘密赋值也会替换为`[REDACTED]`。脱敏函数不修改原对象，API结构化日志统一在写出前调用。

脱敏是最后一道防线，不代表可以主动记录敏感字段。供应价、个人信息和业务审计的字段级禁止项仍按综合方案第十四章执行，后续业务切片必须另写响应白名单与越权测试。

## 6. 秘密扫描

```powershell
pnpm secrets:scan
```

扫描器通过`git ls-files`只读取已跟踪文件，不遍历用户未跟踪的UI资产或本机资料；它检测私钥头、GitHub令牌、秘密赋值和带凭据的连接URL，输出仅包含文件、行列、规则和`[REDACTED]`，绝不打印命中值。`.env.example`只允许明确的development/test占位值和运行时引用。

扫描通过不等于不存在所有秘密。提交评审和CI仍需秘密扫描；CI编排属于M0-011。在CI接入前，本任务证据只能标记LOCAL_PASS，不能声称CI或生产安全验收完成。
