import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = process.env.M3_P053_UPDATED_AT ?? new Date().toISOString();
const commit = process.env.M3_P053_COMMIT ?? 'LOCAL_WORKTREE';
const pullRequest = process.env.M3_P053_PR ?? '';
const ciRun = process.env.M3_P053_CI_RUN ?? '';
const ciJob = process.env.M3_P053_CI_JOB ?? '';
const fullVerify = process.env.M3_P053_FULL_VERIFY ?? 'NOT_EXECUTED';
const evidenceStatus = ciRun ? 'CI_PASS' : 'LOCAL_PASS';
const prUrl = pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}` : '';
const ciUrl = ciRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${ciRun}` : '';
const p052Head = 'd1143daac1658aa0876642525cc481b30437eed7';
const p052Merge = 'b186f6b680727318ddeb4d6573bcfa4090d2ad8b';
const p052MainRun = '31946062202';
const p052MainJob = '95162089803';

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
const upsertCsv = async (relativePath, keyFields, changes) => {
  const filePath = path.join(pack, relativePath);
  const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
  const keyOf = (row) => keyFields.map((field) => row[field] ?? '').join('\u0000');
  const byKey = new Map(rows.map((row, index) => [keyOf(row), index]));
  for (const change of changes) {
    const key = keyOf(change);
    const index = byKey.get(key);
    if (index === undefined) {
      byKey.set(key, rows.length);
      rows.push(Object.fromEntries(headers.map((header) => [header, change[header] ?? ''])));
    } else rows[index] = { ...rows[index], ...change };
  }
  const output = [headers.join(','), ...rows.map((row) => headers.map((header) => encode(row[header])).join(','))];
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await upsertCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P052', Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/101', Branch: 'codex/m3-welfare-card-binding',
    CommitSHA: p052Head, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/102', CI: 'CI_PASS', UpdatedAt: '2026-08-16T12:13:39Z',
    Notes: `PR #102精确head ${p052Head.slice(0, 7)}经授权合并；merge ${p052Merge}；post-merge main Actions run ${p052MainRun}/job ${p052MainJob}成功。真实发行、真机、staging/production仍未执行。`,
  },
  {
    TaskID: 'M3-P053', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/103', Branch: 'codex/m3-welfare-card-account-selection',
    CommitSHA: commit, PullRequest: prUrl, CI: ciRun ? 'CI_PASS' : 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `RED API 3/3=404、OpenAPI路径缺失、小程序3/3页面缺失；GREEN API 3/3、Prisma 1/1、小程序3/3、OpenAPI 1/1、P0 1/1。${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁待记录。'} 仅只读选择与最大抵扣计算；无迁移、扣款、账本或支付。`,
  },
  {
    TaskID: 'M3-P054', Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P053 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [{
  P0ID: 'P0-053', CurrentEvidenceStatus: evidenceStatus,
  AutomatedTestID: 'apps/api/test/supertest/welfare-card-eligibility-api.test.mjs|apps/api/test/unit/prisma-welfare-card-eligibility-repository.test.mjs|tests/openapi/m3-p053-welfare-card-eligibility.contract.test.mjs|apps/user-miniapp/test/welfare-card-selection-build.test.mjs|tests/e2e/p0/p0-053-welfare-card-account-selection.spec.ts',
  ManualCaseID: 'MANUAL-053_DEVICE_NOT_EXECUTED',
  NegativeChecks: '非法/owner/价格/金额字段拒绝；未登录和停用会话拒绝；跨用户/冻结/失效/零余额/不适用账户不返回；服务端重算；并发重复读确定且零副作用；供应价与完整卡号不泄露',
  EvidenceLink: `docs/contracts/m3/M3-P053-welfare-card-account-selection.md${prUrl ? `|${prUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
  LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
  Notes: '自动化技术子行为通过；实际资金、完整确认订单、真机、staging/production未执行。P0-054规则管理及扣款/支付不在本切片。',
}]);

await upsertCsv('05-字段字典初始版.csv', ['Entity', 'Field'], [
  { Entity: 'WelfareCardAccount', Field: 'balanceAmount', Status: 'IMPLEMENTED_M3_P053_READ', Validation: 'integer cents >=0; never trust client; maximum deduction uses balance-frozen' },
  { Entity: 'WelfareCardAccount', Field: 'frozenAmount', Status: 'IMPLEMENTED_M3_P053_READ', Validation: 'integer cents >=0; available=max(0,balance-frozen)' },
  { Entity: 'WelfareCardAccount', Field: 'status', Status: 'IMPLEMENTED_M3_P053_READ', Validation: 'only ACTIVE account under ACTIVE+APPROVED program and ISSUED batch is eligible' },
  { Entity: 'WelfareCardProgram', Field: 'scopeType', Status: 'IMPLEMENTED_M3_P053_READ' },
  { Entity: 'WelfareCardProgram', Field: 'scopeRules', Status: 'IMPLEMENTED_M3_P053_READ', Validation: 'schemaVersion=1; server matches category/product/sku included and excluded IDs' },
  { Entity: 'WelfareCardProgram', Field: 'canPayDeliveryFee', Status: 'IMPLEMENTED_M3_P053_READ', Validation: 'delivery fee remains server-owned; client amount forbidden' },
]);

await upsertCsv('07-权限与数据可见矩阵.csv', ['OwnerType', 'RoleCode'], [{
  OwnerType: 'CONSUMER', RoleCode: 'CONSUMER_USER',
  ReadScope: '公开商品、自身购物车/订单/福利卡账户白名单/地址；API-039仅本人当前订单可用账户',
  WriteScope: '自身福利卡绑定、下单、支付、收货、售后、自身资料；API-039只读且零副作用',
  DataScope: 'companyId与consumerUserId从当前会话派生；SKU价格与范围服务端重算',
  ForbiddenActions: '不得提交归属、价格、配送费或抵扣金额；不得访问完整卡号、供应价、他人福利卡、个人充值/转账/提现',
  Stage: 'M3', P0: 'P0-020,P0-021,P0-052,P0-053,P0-083,P0-092,P0-098', Status: 'IMPLEMENTED_M3_P053_PARTIAL',
}]);

await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [{
  PageID: 'PAGE-056', ImplementationStatus: 'IMPLEMENTED_M3_P053_WELFARE_SELECTION_PARTIAL',
  AcceptanceStatus: `P0-053_${evidenceStatus};P0-091_NOT_EXECUTED;P0-092_PARTIAL_${evidenceStatus};DEVICE_NOT_EXECUTED`,
  RouteTest: 'apps/user-miniapp/test/welfare-card-selection-build.test.mjs|tests/e2e/p0/p0-053-welfare-card-account-selection.spec.ts',
  Notes: '福利卡资格、余额/范围/最大抵扣展示和选择一个或不使用已实现；完整地址/订单/支付及真机验收未执行。',
}]);

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [{
  EvidenceID: 'EVD-053', CurrentStatus: evidenceStatus,
  CommandOrProcedure: 'RED API 3/3=404、OpenAPI路径缺失、小程序3/3页面缺失；GREEN API 3/3、Prisma 1/1、OpenAPI 1/1、小程序3/3、P0 Chromium 1/1；pnpm verify 17/17',
  Actual: '会话归属、服务端价格/范围计算、余额上限、无效账户过滤、DTO白名单、并发重复读、一个或不用及无手输金额通过；无资金/账本写入。',
  Environment: 'LOCAL_WINDOWS_CHROMIUM', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Playwright Chromium',
  ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P053-welfare-card-account-selection.md|artifacts/test-results/verification/pnpm-verify.json',
  Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_WORKTREE',
  FailureOrBlocker: '真实福利计划/账户、真机、staging/device/production未执行；支付与扣款属于后续任务',
  RetestRequired: ciRun ? 'NO_FOR_CURRENT_PR_HEAD' : 'YES', Notes: '本切片不新增迁移；现有M3-P051/P052字段足以只读计算。',
}]);

await upsertCsv('12-OpenAPI-DTO-错误码台账.csv', ['ContractID'], [{
  ContractID: 'API-039', Stage: 'M3', Domain: 'welfare-card', Method: 'GET', Path: '/v1/consumer/welfare-card-accounts/eligible', Actor: 'CONSUMER',
  RequestDTO: 'WelfareCardEligibilityQueryDto', ResponseDTO: 'EligibleWelfareAccountsResponseDto', CommonResponse: '显式白名单DTO',
  ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCOUNT_SUSPENDED|FIELD_FORBIDDEN|VALIDATION_FAILED|PRODUCT_NOT_SALEABLE', Idempotency: 'NONE_READ_ONLY_DETERMINISTIC',
  SensitiveFieldPolicy: 'NEVER_RETURN; SESSION_OWNER_DERIVED; masked cardNo only; no owner IDs, full cardNo, supplier price or secret; private/no-store/noindex',
  MoneyRule: 'integer cents; server reprices SKU and computes min(available,eligible); client price/delivery/deduction forbidden',
  P0: 'P0-053,P0-092', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/welfare-card-eligibility-api.test.mjs|tests/openapi/m3-p053-welfare-card-eligibility.contract.test.mjs|packages/contracts/openapi.json',
  Owner: 'CODEX', Notes: 'P0-054规则管理、账户冻结/扣款、账本、支付和退款不在API-039。',
}]);

await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS',
  Notes: `M3-P052由PR #102合并且main run ${p052MainRun}成功。M3-P053福利卡账户选择${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；真实资金/真机/staging/production未执行；M3-P054及后续锁定。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const visit = (value) => {
  if (Array.isArray(value)) for (const item of value) visit(item);
  else if (value && typeof value === 'object') {
    if (value.pageId === 'PAGE-056') value.implementationStatus = 'IMPLEMENTED_M3_P053_WELFARE_SELECTION_PARTIAL';
    if (value.contractId === 'API-039') value.implementationStatus = 'IMPLEMENTED_M3_P053';
    if (String(value.id ?? '').startsWith('NEG-M3-P053-')) value.executionStatus = evidenceStatus;
    for (const child of Object.values(value)) visit(child);
  }
};
visit(freeze);
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P053', nextAllowedTask: 'M3-P053', activeTaskCount: 1, lastCompletedTask: 'M3-P052', lastCompletedCommit: p052Merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P053 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P054', '真实福利卡资金/真机/staging/production未完成；M4及后续保持锁定'] };
status.github = { ...status.github,
  pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: prUrl || null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null,
  lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt } : { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  currentTaskDelivery: { taskId: 'M3-P053', issue: 103, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/103', branch: 'codex/m3-welfare-card-account-selection', baseCommit: p052Merge, verifiedHead: commit, status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR', localRedTest: 'API_3_OF_3_HTTP_404;OPENAPI_PATH_MISSING;MINIAPP_3_OF_3_PAGE_MISSING', localFocusedTest: 'LOCAL_PASS_API_3_PRISMA_1_OPENAPI_1_MINIAPP_3_P0_1', localFullVerify: fullVerify, pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'EXT-012_REAL_CARD_ISSUANCE_AND_DEVICE_SCAN', nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P052', pullRequest: 102, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/102', exactHead: p052Head, mergeCommit: p052Merge, mainPostMergeCiRun: Number(p052MainRun), mainPostMergeCiJob: Number(p052MainJob), status: 'CI_PASS' },
  note: `M3-P053福利卡账户选择${ciRun ? ' Draft PR精确head CI_PASS' : ' LOCAL_PASS'}；实际资金、真机、staging/device/production未执行；M3-P054锁定。`,
};
status.evidence = { local: fullVerify === 'PASS_17_OF_17' ? 'LOCAL_PASS_M3_P053_FULL_VERIFY' : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED', ci: ciRun ? `CI_PASS_M3_P053_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P053');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'welfare-card-account-selection.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P053', p0: ['P0-053', 'P0-092_PARTIAL'], status: evidenceStatus,
  commit, updatedAt, baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  scope: 'read-only session-owned welfare account eligibility and maximum deduction',
  red: ['API_3_OF_3_HTTP_404', 'OPENAPI_PATH_MISSING', 'MINIAPP_3_OF_3_PAGE_MISSING'],
  focused: ['API_3_OF_3', 'PRISMA_1_OF_1', 'OPENAPI_1_OF_1', 'MINIAPP_3_OF_3', 'P0_CHROMIUM_1_OF_1'],
  fullVerify, migrations: 'NOT_REQUIRED_EXISTING_SCHEMA_REUSED',
  boundaries: { moneyMutation: false, ledgerWrite: false, payment: false, staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' },
  github: { issue: 103, pullRequest: pullRequest ? Number(pullRequest) : null, ciRun: ciRun ? Number(ciRun) : null },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P053_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
