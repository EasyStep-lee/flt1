# M1-P047 OpenAPI 与响应白名单实现合同

## 范围

- 复用 M0-008 已交付的 `@nestjs/swagger` 确定性生成、`openapi-typescript`、`openapi-fetch`、`miniapp-kit` 和锁定版本 oasdiff，不重建工具链。
- 为当前已实现的 API-005、API-008 至 API-015 固定合同编号、actor/权限边界、请求与响应 DTO、幂等要求、用户可读错误码和响应字段策略。
- API-003/API-004/API-006/API-007 仍保持冻结但未实现；它们分别归属后续公司/供应商认证切片，本任务不创建占位路由。
- 不新增 Prisma 模型、SQL 迁移、业务页面、支付/退款/结算或 M2+ 能力。

## 生成与白名单合同

- `apps/api/src/openapi/m1-openapi-contract.ts` 是当前 M1 已实现操作的机器可读合同；生成器在写文件前应用并验证合同，然后执行稳定键排序。
- 非公开操作使用 `functionalSession` security requirement；该会话由服务端绑定职能账号与 owner scope，客户端参数不能切换主体。
- `Idempotency-Key` 合同必须与生成 operation 的 header 参数一致；成功响应必须是唯一显式 DTO；所有已声明的非 2xx 响应必须复用安全错误 DTO。
- `NEVER_RETURN_INTERNAL_PRICING` 只扫描受保护成功响应及其递归 `$ref`、数组、`allOf/anyOf/oneOf`；命中供应价、供应价快照、供应商应付或毛利字段即以 `PUBLIC_RESPONSE_FIELD_FORBIDDEN` 终止生成。

## P0 负向映射

- `NEG-M1-047-01`：向 API-005 成功响应 schema 注入 `supplyPrice` 时生成合同校验失败；带内部字段的持久化实体经公开商户服务映射后只返回精确 DTO。
- `NEG-M1-047-02`：相同源码在敌对运行环境下连续两次生成必须逐字节一致，提交产物漂移由 `openapi:check` 阻断。
- `NEG-M1-047-03`：固定并校验发布包哈希的 oasdiff 1.17.0 接受兼容变更、拒绝删除端点；本切片对 `origin/main` 无破坏性变更。
- `NEG-M1-047-04`：两个原生小程序继续复用生成 `operations` 类型，源码不能直接调用 `wx.request` 或浏览器 `fetch`。

## 环境、风险与回滚

- OpenAPI 生成只启动纯合同 Nest 上下文，不监听端口，不连接 MySQL/Redis/队列，不读取生产秘密。
- 真实 MySQL 迁移演练仅复核现有 6 条迁移；本切片没有 schema 变化或回写。
- 后续新增接口必须先加入所属阶段合同；授权供应价 DTO 必须使用新的角色/scope策略，不能通过删除本白名单门禁来放行。
- 代码按 M1-P047 原子提交 `git revert`；生成文件随源码重新生成，无数据库或外部集成回滚动作。
