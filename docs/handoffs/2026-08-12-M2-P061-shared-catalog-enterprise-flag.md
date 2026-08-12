# M2-P061 商品资源与集采标识交接

## 结论

- 切片结论：`LOCAL_PASS`；P0-061 本地证据成立，但尚无当前提交的 GitHub CI、人工合并或合并后 main CI。
- 方案 SHA-256：`1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92`，基线自检通过。
- 仓库/基线：`EasyStep-lee/flt1`，`main@b2fee8424b803a5e629f1c243632bbefe2d566c3`。
- 分支/Issue：`codex/m2-shared-catalog-enterprise-flag`，Issue #67。
- 明确未进入：M2-P063 InventoryBalance、M3 企业认证/采购交易、订单、资金、配送、staging、真机与生产。

## 本切片范围

个人零售与企业采购复用同一公司 `Product/Sku`、分类模板和媒体。只有公司上架的 ACTIVE 商品、ACTIVE SKU 且供应商开启集采标识时才进入企业采购货架。供应商对已上架商品修改渠道标识使用版本、幂等键和追加历史；企业和供应商归属均从会话派生。

## 实际变更

- Prisma 新增 `ProductChannelVisibilityHistory` 和 `ProductChannelVisibilityEvent`；MIG-008A 建立唯一版本、外键、约束和 UPDATE/DELETE 禁止触发器。
- 新增企业货架 `GET /v1/enterprise/catalog/products`，只返回企业销售价、共享资源标识和显式媒体白名单。
- 新增供应商渠道修改与历史读取 API-094/API-095；跨供应商、非法状态、版本冲突、幂等冲突和重复目录资源均失败关闭。
- 五类商品详情统一复用同一媒体 DTO；企业详情保持 private/no-store/noindex，生产默认企业会话解析器继续拒绝，待 M3 接入真实认证。
- 供应商商品独立页面增加渠道标识和历史区块；企业采购货架增加私有动态列表页。
- 同步字段、状态机、权限、页面、OpenAPI、迁移、任务、P0、测试证据、执行包自检和总控工作簿。

## 测试证据

| 证据 | 结果 |
|---|---|
| RED API | 2/2 按预期失败，新增路由均为 404 |
| focused API | 3/3 PASS |
| focused 契约/迁移 | 3/3 PASS |
| focused Chromium | 2/2 PASS |
| API 全量 | 32 files，179/179 PASS |
| P0 E2E 全量 | 48/48 PASS |
| 阶段契约全量 | 80/80 PASS |
| 迁移契约全量 | 41/41 PASS |
| workspace test | 全部适用 workspace PASS |
| lint/typecheck/build | 13 个适用 workspace 与根级目标 PASS |
| MySQL 迁移演练 | empty=2、upgrade=2、restore=2、product=23、cleanup=PASS |
| OpenAPI | 生成字节稳定；oasdiff 0 error、169 warning |
| 基线/秘密/禁止能力 | baseline、执行包、secrets、no-franchise、no-supplier-storefront 均 PASS |

第一次全量契约运行发现旧 OpenAPI 路由/DTO 清单、历史当前任务断言和 M2 冻结生成器未同步；修正为 P061 合法新增契约后均已重跑通过。提交前执行 `pnpm verify` 能完成 lint，但按设计在 `openapi:diff` 发现尚未提交的生成契约并退出；形成原子提交后必须对该提交重跑完整 `pnpm verify`。

## P0 与安全边界

- P0-061：`LOCAL_PASS`。企业列表与个人详情使用相同 Product/SKU/category/template/media 标识；集采标识和 ACTIVE 状态由服务端过滤。
- P0-021 回归：企业只返回 `enterpriseSalePrice`；个人只返回 `retailSalePrice`；供应价、对方渠道价、归属键和行为人身份均不返回。
- M2-P063 未实现：本切片没有宣称 InventoryBalance、跨渠道库存并发或库存守恒完成。
- staging/device/production 全部 `NOT_EXECUTED`；无真实企业、正式商品或生产账号证据。

## 风险与回滚

- 风险：全局错误码枚举增加 `DUPLICATE_CATALOG_RESOURCE`，oasdiff 给出非 breaking 警告；客户端应按可扩展错误码处理。
- 风险：Vite 管理端 bundle 超过 500 kB，仅为既有非阻断警告，后续性能切片再拆包。
- 回滚应用：回退本切片 API、供应商页和企业货架页；生产默认企业解析器仍拒绝访问。
- 回滚数据库：已应用环境不删除 MIG-008A 或不可变历史；用向前迁移停用入口/修复约束。未应用环境可直接不部署该迁移。
- 回滚契约/证据：随代码提交整体 revert，并重新生成 OpenAPI、工作簿和 manifest 哈希。

## GitHub 门禁与下一步

当前没有 PR、当前 head CI、评论或合并证据。提交、推送并创建 Draft PR 后，必须读取 exact-head Actions 和未解决评论；只有 exact-head CI 成功且用户对该精确 head 明确授权，才可转 Ready/合并。人工合并及合并后 main CI 成功前，禁止进入 `M2-P063`。
