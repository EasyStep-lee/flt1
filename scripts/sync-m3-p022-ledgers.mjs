import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = '2026-08-14T01:49:30.853Z';
const mergedM3P020Commit = 'f2b64fa64520db4d5daf051b1a58d3f295519331';
const mergedM3P020Head = 'd9b80f2aa3ac42175db59f73d2f21968326aee46';
const implementationCommit = '5e95f3e6aad7483bd2fe13470c5c31fcb4bc80d4';
const verifiedHead = '4e5a468c423848a4a70a011147f3f8cbe93be3b7';

const parseLine = (line) => {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value); value = ''; }
    else value += character;
  }
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(value);
  return values;
};
const encode = (value) => /[",\r\n]/u.test(String(value ?? ''))
  ? `"${String(value ?? '').replaceAll('"', '""')}"`
  : String(value ?? '');
const updateCsv = async (relativePath, update) => {
  const filePath = path.join(pack, relativePath);
  const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  const headers = parseLine(lines[0]);
  const output = [lines[0]];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const values = parseLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const result = update({ ...row });
    output.push(result === null ? line : headers.map((header) => encode(result[header])).join(','));
  }
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await updateCsv('03-任务台账.csv', (row) => {
  if (row.TaskID === 'M3-P020') return {
    ...row, Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/77', Branch: 'codex/m3-user-home',
    CommitSHA: mergedM3P020Head, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/78', CI: 'CI_PASS',
    UpdatedAt: '2026-08-14T00:18:14Z',
    Notes: 'PR #78精确head d9b80f2经授权转Ready并合并；merge commit f2b64fa；post-merge main CI run 31756365765成功。',
  };
  if (row.TaskID === 'M3-P022') return {
    ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/79', Branch: 'codex/m3-cross-supplier-orders',
    CommitSHA: verifiedHead, PullRequest: '', CI: 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: 'RED为个人/企业订单创建API均404；GREEN为API 4/4、小程序2/2，pnpm verify 17/17通过。一单跨3供应商，按supplierId精确拆履约单，渠道价服务端重算，供应价仅内部快照；未进入库存预扣、福利卡、支付、配送。',
  };
  if (row.TaskID === 'M3-P023') return {
    ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: '仅在M3-P022精确head PR CI成功、人工合并且合并后main CI成功后解锁；当前禁止库存预扣与资金实现。',
  };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.P0ID === 'P0-020') return {
    ...row, CurrentEvidenceStatus: 'CI_PASS', LastVerifiedCommit: mergedM3P020Commit,
    Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-14T00:18:14Z',
    Notes: 'PR #78 exact-head CI通过并经用户授权合并；main@f2b64fa post-merge run 31756365765成功。微信开发者工具、真机、staging和production仍未执行。',
  };
  if (row.P0ID === 'P0-022') return {
    ...row, CurrentEvidenceStatus: 'LOCAL_PASS',
    AutomatedTestID: 'NEG-M3-P022-01|NEG-M3-P022-02|NEG-M3-P022-03|apps/api/test/supertest/cross-supplier-order-api.test.mjs|apps/user-miniapp/test/cart-order-build.test.mjs',
    EvidenceLink: 'docs/contracts/m3/M3-P022-cross-supplier-orders.md|docs/handoffs/2026-08-13-M3-P022-cross-supplier-orders.md',
    LastVerifiedCommit: verifiedHead, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: 'LOCAL_PASS覆盖3供应商统一主订单、按supplierId拆单、个人/企业渠道价、幂等重放、归属伪造拒绝、未知结果恢复及pnpm verify 17/17。CI、staging、真机、production未执行；库存预扣属于M3-P023。',
  };
  return null;
});

await updateCsv('08-页面路由接口P0映射.csv', (row) => row.PageID === 'PAGE-055' ? {
  ...row, ImplementationStatus: 'PARTIAL_IMPLEMENTED_M3_P022', AcceptanceStatus: 'LOCAL_PASS',
  RouteTest: 'apps/user-miniapp/test/cart-order-build.test.mjs',
  Notes: 'M3-P022仅实现跨供应商分组展示、统一提交与未知结果复用幂等键；增删改购物车和完整结算仍属P0-090/P0-091后续切片。',
} : null);

await updateCsv('10-测试证据登记.csv', (row) => {
  if (row.EvidenceID === 'EVD-020') return {
    ...row, CurrentStatus: 'CI_PASS', ExecutedAt: '2026-08-14T00:18:14Z', CommitSHA: mergedM3P020Commit,
    CIRunURL: 'https://github.com/EasyStep-lee/flt1/actions/runs/31756365765',
    Freshness: 'FRESH_MAIN_POST_MERGE', FailureOrBlocker: 'staging、微信开发者工具、真机、production未执行',
    Notes: 'PR #78已合并；main@f2b64fa post-merge CI成功。',
  };
  if (row.EvidenceID === 'EVD-022') return {
    ...row, CurrentStatus: 'LOCAL_PASS',
    CommandOrProcedure: 'focused API 4/4；miniapp 2/2；Prisma repository 2/2；P0 E2E 1/1；pnpm verify',
    Actual: 'RED: 两个POST订单API均404。GREEN: focused全部通过；pnpm verify 17/17，退出码0，报告artifacts/test-results/verification/pnpm-verify.json。',
    Environment: 'LOCAL_WINDOWS_NODE22_MOCK_EXTERNALS', ExecutedAt: updatedAt,
    CommitSHA: verifiedHead, ArtifactOrScreenshot: 'docs/handoffs/2026-08-13-M3-P022-cross-supplier-orders.md|artifacts/test-results/verification/pnpm-verify.json',
    Executor: 'CODEX', Freshness: 'FRESH_LOCAL', FailureOrBlocker: 'CI、staging、真机、production未执行',
    RetestRequired: 'YES', Notes: 'Mock不升级为外部证据；本切片不预扣库存、不创建支付或配送。',
  };
  return null;
});

await updateCsv('11-数据库迁移台账.csv', (row) => row.MigrationID === 'MIG-012' ? {
  ...row, PlannedName: '20260814003000_m3_cross_supplier_orders', DependsOn: 'MIG-011',
  Objects: 'BuyerOrder/BuyerOrderItem/SupplierFulfillmentOrder/BuyerOrderEvent',
  Purpose: '跨供应商统一主订单与按supplierId履约拆分',
  ForwardSteps: '创建订单、履约拆分、内部价格快照和不可变创建事件；不修改InventoryBalance',
  BackwardOrRecovery: '已发布迁移不回改；失败前恢复备份或创建向前修复迁移；应用回退时保留新增表直到确认无新写入',
  DataBackfill: '无历史数据回填；仅新增空表、约束、索引和不可变事件触发器',
  Verification: 'prisma validate；migration chain；MySQL dry-run；金额/归属/幂等/不可变事件约束',
  BackupRequired: 'YES', Status: 'LOCAL_PASS', AppliedLocalAt: updatedAt, CommitSHA: verifiedHead,
  EvidenceLink: 'packages/db/prisma/migrations/20260814003000_m3_cross_supplier_orders/migration.sql|docs/contracts/m3/M3-P022-cross-supplier-orders.md',
  Notes: 'M3-P022不进行库存预扣；MIG-013及福利卡/支付迁移保持PLANNED。',
} : null);

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  if (row.ContractID !== 'API-036' && row.ContractID !== 'API-048') return null;
  return {
    ...row, RequestDTO: 'CreateOrderRequestDto', ResponseDTO: 'CreateBuyerOrderResponseDto',
    CommonResponse: '显式白名单DTO；错误={statusCode,code,message,requestId}',
    ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCESS_DENIED|FIELD_FORBIDDEN|VALIDATION_FAILED|PRODUCT_NOT_SALEABLE|IDEMPOTENCY_KEY_REQUIRED|IDEMPOTENCY_CONFLICT',
    Idempotency: 'Idempotency-Key',
    SensitiveFieldPolicy: 'NEVER_RETURN；DTO白名单；companyId/consumerUserId/enterpriseCustomerId/supplierId由会话与商品派生',
    MoneyRule: '金额字段整数分；服务端按个人零售价或企业集采价重算；供应价仅内部快照',
    OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
    ContractTest: 'apps/api/test/supertest/cross-supplier-order-api.test.mjs|packages/contracts/openapi.json', Owner: 'CODEX',
    Notes: row.ContractID === 'API-036'
      ? 'M3-P022实现个人跨供应商统一主订单；不预扣库存、不创建支付或配送。'
      : 'M3-P022仅实现企业跨供应商统一主订单API；不据此宣称P0-029/P0-062/P0-079完成。',
  };
});

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? {
  ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS',
  Notes: 'M3-P020已在main@f2b64fa取得post-merge CI_PASS；M3-P022跨供应商订单LOCAL_PASS，M3-P023及后续仍NOT_EXECUTED，阶段未通过。',
} : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P022', nextAllowedTask: 'M3-P022',
  activeTaskCount: 1, lastCompletedTask: 'M3-P020', lastCompletedCommit: mergedM3P020Commit, lastPassedGate: 'M2-GATE',
  prohibitedUntilGate: ['M3-P022合并且合并后main CI成功前不得开始M3-P023', 'M3-P023及福利卡、支付、配送切片保持锁定'],
};
status.github = {
  ...status.github, pullRequest: null, pullRequestUrl: null, pullRequestState: 'NOT_CREATED', pullRequestMerged: false,
  mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: { scope: 'M3_P020_MAIN_POST_MERGE', status: 'CI_PASS', runId: 31756365765, jobId: 94632831707, runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31756365765', headSha: mergedM3P020Commit, event: 'push', completedAt: '2026-08-14T00:18:14Z', firstAttempt: 'PASS' },
  currentTaskDelivery: { taskId: 'M3-P022', issue: 79, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/79', branch: 'codex/m3-cross-supplier-orders', baseCommit: mergedM3P020Commit, implementationCommit, deliveryHead: verifiedHead, status: 'LOCAL_PASS_PENDING_PR_CI_AND_MERGE', localFocusedTest: 'LOCAL_PASS_API_4_MINIAPP_2_PRISMA_2_P0_E2E_1_OPENAPI', localFullVerify: 'LOCAL_PASS_17_OF_17', pullRequest: null, pullRequestState: 'NOT_CREATED', exactHeadCi: 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: null, nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P020', pullRequest: 78, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/78', exactHead: mergedM3P020Head, mergeCommit: mergedM3P020Commit, mainPostMergeCiRun: 31756365765, mainPostMergeCiJob: 94632831707, status: 'CI_PASS' },
  note: 'M3-P020已在main取得CI_PASS。M3-P022本地focused与pnpm verify 17/17通过，等待Draft PR精确head CI与人工合并；M3-P023及后续保持锁定。',
};
status.evidence = { local: 'LOCAL_PASS_M3_P022_FULL', ci: 'CI_PASS_M3_P020_ONLY', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
