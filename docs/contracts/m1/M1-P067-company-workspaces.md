# M1-P067 公司职能账号独立页面实现合同

## 唯一范围

- 本切片只实现 `P0-067`：10 类公司职能账号、固定 `workspaceRoute`、单职能菜单、服务端路由/API 鉴权和 PAGE-003 至 PAGE-012 工作区壳。
- 继续复用 M1-P066 的 `Secure`、`HttpOnly`、`SameSite=Strict` `__Host-fulishe-company-admin` Cookie；浏览器脚本不能读取或提交原始会话令牌。
- API-013/API-014 的 `company` 归属分支只允许 `COMPANY_SUPER_ADMIN`；公司、自然人、职能账号和路由全部从当前会话派生。
- 新增 API-082 `GET /v1/company-auth/workspace/current`，只返回当前职能的页面 ID、角色名称、固定路由和单一菜单 DTO。
- 后续任务 `M1-P068` / P0-068 的内部列表、筛选、详情、时间线和逐页完整状态不在本切片；M2-M5 的商品、价格、订单、福利卡、财务、物流和 CMS 业务内容均不提前实现。

## 固定工作区白名单

| 职能账号 | 页面 | 路由 | 当前菜单 |
| --- | --- | --- | --- |
| COMPANY_SUPER_ADMIN | PAGE-003 | `/company-admin/workspaces/system` | 系统与账号 |
| COMPANY_SUPPLIER_OPS | PAGE-004 | `/company-admin/workspaces/supplier-ops` | 供应商运营 |
| COMPANY_PRODUCT_OPS | PAGE-005 | `/company-admin/workspaces/product-ops` | 商品与分类 |
| COMPANY_PRICE_REVIEW | PAGE-006 | `/company-admin/workspaces/price-review` | 价格审核 |
| COMPANY_ORDER_SERVICE | PAGE-007 | `/company-admin/workspaces/order-service` | 订单客服 |
| COMPANY_WELFARE_CARD | PAGE-008 | `/company-admin/workspaces/welfare-card` | 福利卡运营 |
| COMPANY_FINANCE | PAGE-009 | `/company-admin/workspaces/finance` | 财务结算 |
| COMPANY_LOGISTICS | PAGE-010 | `/company-admin/workspaces/logistics` | 物流中心 |
| COMPANY_CONTENT | PAGE-011 | `/company-admin/workspaces/content` | 门户内容 |
| COMPANY_AUDIT | PAGE-012 | `/company-admin/workspaces/audit` | 审计风控 |

数据库前向迁移只追加上述 10 条 `FunctionalAccountType` 白名单。每个 `ownerType + code` 和 `ownerType + workspaceRoute` 继续由既有唯一键约束；不创建店铺、加盟商、个人充值或阶段外业务表。

## 会话、权限与失败合同

- 每次签发新公司职能会话时撤销同一自然人的旧活动会话；API 请求对 Cookie 做 SHA-256 后查询，不在日志、DTO 或前端状态暴露原始令牌。
- 解析会话时重新核验 `CompanyUser`、`FunctionalAccount`、`FunctionalAccountType` 的主体、自然人、状态、有效期、账号类型和固定路由。缺失/未知会话返回 `AUTHENTICATION_REQUIRED`；已撤销旧会话返回 `AUTH_SESSION_REVOKED`；状态或路由漂移返回 `WORKSPACE_FORBIDDEN`。
- 页面在 API-082 成功前不挂载业务组件。响应路由与浏览器目标不一致、手工进入其他工作区或调用其他职能 API 时返回 403，且在对象仓储查询前停止。
- 菜单 DTO 只包含当前工作区一个条目。任何其他工作区路由进入响应即违反 `WORKSPACE_MENU_VIOLATION` 合同。
- 超级管理员邀请公司职能账号必须二次验证、带幂等键并原子追加状态历史和审计；不得提交 `companyId`、`supplierId`、`identityId`、`functionalAccountId`、`ownerType` 或 `workspaceRoute`。
- 生产身份凭证和二次验证适配器尚未接入时继续默认失败关闭，不创建默认管理员密码或测试后门。

## 冻结负向用例

- `NEG-M1-067-01` / `ROUTE_DEEP_LINK`：手工打开另一职能路由返回 `WORKSPACE_FORBIDDEN`，不挂载外职能数据组件。
- `NEG-M1-067-02` / `MENU_LEAKAGE`：10 个工作区每个仅渲染自己的菜单，响应不得出现其他职能路由。
- `NEG-M1-067-03` / `API_ROLE_MISMATCH`：错误职能调用审计或公司账号 API 时，在仓储查询前返回 403。
- `NEG-M1-067-04` / `SESSION_REUSE`：切换职能后复用旧 Cookie 返回 `AUTH_SESSION_REVOKED`，新 Cookie 只访问新职能路由。

## 环境与回滚

- 自动验证环境限于本地 Windows、注入测试适配器、Docker 临时 MySQL 和 Playwright Chromium；未读取生产秘密，未改预发布或生产。
- 应用层通过原子提交 `git revert` 回滚。数据库迁移一旦发布不得编辑、删除或向后撤销；如发现白名单错误，只能追加新的前向修复迁移，并在应用回退窗口内保持已追加类型兼容。
- 真实身份源、真实二次验证、预发布迁移、生产迁移和正式人工验收保持 `NOT_EXECUTED`。
