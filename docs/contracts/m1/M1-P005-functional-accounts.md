# M1-P005 供应商职能账号实现合同

## 本切片边界

- 只实现供应商主体的八类 `FunctionalAccountType`、`SupplierUser`、`FunctionalAccount` 持久化，以及 API-013/API-014 的查询和邀请。
- `supplierId`、自然人身份和当前 `functionalAccountId` 只能来自服务端固定职能会话；请求 DTO 禁止携带任何所有权选择器。
- 八类账号类型各自对应唯一、服务端固定的 `workspaceRoute`。本切片只实现 PAGE-016 主体管理和 PAGE-024 职能账号管理内容。
- 创建邀请是敏感账号变更，必须通过二次验证并使用 `Idempotency-Key`；生产未接入验证器时默认拒绝。
- 响应采用 DTO 白名单，不返回手机号、邮箱、`supplierId`、`identityId` 或内部菜单结构。

## 冻结负向场景

- `NEG-M1-005-01 CROSS_WORKSPACE`：非主体管理工作区调用账号管理操作，返回 `403 WORKSPACE_FORBIDDEN`，不写入。
- `NEG-M1-005-02 SELF_PRIVILEGE_ESCALATION`：自然人为自己赋予主体管理权限，返回 `422 ACCOUNT_TYPE_INVALID`，不写入并记录安全事件。
- `NEG-M1-005-03 LAST_ADMIN_SUSPEND`：停用最后一个有效主体管理员，返回 `409 STATE_TRANSITION_INVALID` 并保持原状态。
- `NEG-M1-005-04 SECOND_VERIFICATION`：敏感账号变更未通过二次验证，返回 `428 SECOND_VERIFICATION_REQUIRED`，不写入。

## 后续阶段禁区

- M1-P069 才实现供应商登录、激活和多职能账号选择；本切片不签发会话。
- M1-P070 才实现八套职能业务页面壳和职能切换；本切片不伪造后续业务菜单。
- 商品、价格、库存、履约、售后和财务业务仍按 M2 至 M5 顺序实施。

## 环境与回退

- 本地内存仓库用于 API/权限测试；真实运行使用 Prisma 仓库。
- 二次验证的真实外部服务、预发布和生产迁移均未执行。
- 应用可按原子提交回退；已发布数据库迁移不得修改或逆向删除，需用向前修复迁移恢复兼容性。

