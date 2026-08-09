# M1 EXT-005 公司资料脱敏确认

本操作只为 M1-GATE 接收授权人员的最小确认回执。它不改变产品边界，不上传原始证照，也不会自动把 M1 标为 PASS。

## 人工操作

1. 授权人员在公司批准的受控存储中核验营业执照、正式对客名称、客服资料和开票资料。
2. 把 `docs/templates/ext-005-company-confirmation.template.json` 复制到受控的临时工作位置；不要直接修改模板真源。
3. 只填写脱敏元数据：确认编号、带时区的确认时间、授权人员不透明引用、公开对客字段、打码客服展示值和三个受控存储引用。
4. 所有声明只有在对应资料已经真实核验后才能改为 `true`。
5. 运行：

   ```powershell
   pnpm external-evidence:verify:ext005 -- --input C:\受控临时目录\ext-005-confirmation.json
   ```

6. 只有输出 `EXT005_CONFIRMATION_OK` 后，才可把这份不含原件的回执作为后续受审提交的输入。校验器不会修改外部依赖台账，也不会自动解除门禁。

## 禁止内容

- 不要把完整营业执照图片、统一社会信用代码、税号、银行账号、身份证、完整私人联系方式、证书或密钥写入回执、仓库、PR 或聊天。
- 不要填写 `file://`、签名 URL、带查询参数的下载地址、Data URL、Base64、PEM 或公开网盘地址。
- 客服展示值必须打码并包含 `*`；授权人员只使用 `identity://controlled/...` 不透明引用。
- 原件引用只允许 `vault://controlled/...`、`dms://controlled/...` 或 `object://controlled/...`，且不得包含访问令牌。

## 门禁边界

- `EXT-005` 当前仍是 `NOT_PROVIDED`，外部依赖表为 `BlocksFormalAcceptance=YES`。
- 当前交付仍是 Draft PR #34；获得有效回执后需要更新机器证据、focused/全量验证和新 head CI。
- 必须再取得用户对未来精确 head 的 Ready/合并授权，并验证合并后 main CI，M1 才可能 PASS。
- 在以上步骤完成前，M2 继续锁定；不得把模板、Mock 或校验器通过冒充人工确认。
