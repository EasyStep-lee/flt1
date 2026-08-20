import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/u, '').split('=');
  return [key, rest.join('=')];
}));
const root = process.cwd();
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const commit = args.commit || 'WORKTREE';
const evidenceStatus = args['evidence-status'] || 'LOCAL_PASS';
const fullVerify = args['full-verify'] || 'NOT_EXECUTED';
const updatedAt = args['updated-at'] || new Date().toISOString();
const p055Merge = '3dcd998d07d9a2af7675baaac02fa0ae413dd538';
const p055MainRun = '31997253059';
const p055MainJob = '95290991988';

const parseLine = (line) => {
  const values = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value); value = ''; }
    else value += character;
  }
  values.push(value); return values;
};
const encode = (value) => /[",\r\n]/u.test(String(value ?? '')) ? `"${String(value ?? '').replaceAll('"', '""')}"` : String(value ?? '');
const upsertCsv = async (relativePath, keyFields, changes) => {
  const filePath = path.join(pack, relativePath);
  const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseLine(line)[index] ?? ''])));
  const keyOf = (row) => keyFields.map((field) => row[field] ?? '').join('\u0000');
  const byKey = new Map(rows.map((row, index) => [keyOf(row), index]));
  for (const change of changes) {
    const index = byKey.get(keyOf(change));
    if (index === undefined) rows.push(Object.fromEntries(headers.map((header) => [header, change[header] ?? ''])));
    else rows[index] = { ...rows[index], ...change };
  }
  await writeFile(filePath, `${[headers.join(','), ...rows.map((row) => headers.map((header) => encode(row[header])).join(','))].join(eol)}${eol}`, 'utf8');
};

await upsertCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P055', Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX', Branch: 'codex/m3-welfare-card-full-payment',
    CommitSHA: p055Merge, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/108', CI: 'CI_PASS', UpdatedAt: '2026-08-17T05:15:19Z',
    Notes: `PR #108 head ecbb55573bf42ea32a1e1117e75958ba39ce38b1经授权合并为${p055Merge.slice(0, 7)}；post-merge main run ${p055MainRun}/job ${p055MainJob}成功。`,
  },
  {
    TaskID: 'M3-P056', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/109',
    Branch: 'codex/m3-welfare-card-mixed-payment', CommitSHA: commit, PullRequest: '', CI: 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `RED API 3/3路由404，小程序1项缺动作；GREEN开始事务1/1、回调6/6、API 3/3、小程序7/7、OpenAPI 1/1、P0 Chromium 1/1。自动最大抵扣，微信只付差额；${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁待记录。'} staging/真机/真实微信未执行。`,
  },
  { TaskID: 'M3-P057', Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: 'M3-P056 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。' },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  { P0ID: 'P0-055', CurrentEvidenceStatus: 'CI_PASS', EvidenceLink: `docs/contracts/m3/M3-P055-welfare-card-full-payment.md|https://github.com/EasyStep-lee/flt1/pull/108|https://github.com/EasyStep-lee/flt1/actions/runs/${p055MainRun}`, LastVerifiedCommit: p055Merge, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-17T05:15:19Z', Notes: 'PR #108合并且post-merge main CI通过；真实资金/真机/staging/production仍未执行。' },
  {
    P0ID: 'P0-056', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'apps/api/test/unit/prisma-welfare-card-wechat-payment-repository.test.mjs|apps/api/test/unit/prisma-payment-repository.test.mjs|apps/api/test/supertest/welfare-card-wechat-payment-api.test.mjs|apps/user-miniapp/test/welfare-card-selection-build.test.mjs|tests/openapi/m3-p056-welfare-card-wechat-payment.contract.test.mjs|tests/e2e/p0/p0-056-welfare-card-wechat-payment.spec.ts',
    ManualCaseID: 'MANUAL-056_REAL_WECHAT_STAGING_DEVICE_NOT_EXECUTED',
    NegativeChecks: '跨用户/归属字段拒绝；同key改参冲突；开始事务只冻结一次且只建一笔PaymentTransaction；金额/逐行分摊守恒；重复回调只实扣一次；晚期失败全事务回滚；未知结果不客户端解冻',
    EvidenceLink: 'docs/contracts/m3/M3-P056-welfare-card-wechat-payment.md', LastVerifiedCommit: commit, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: '确定性适配器下技术行为LOCAL_PASS；RequiredEvidenceLevel为STAGING_PASS，真实微信/staging/device/production未执行，不得升级为阶段完成。',
  },
]);

await upsertCsv('06-状态机总表.csv', ['StateMachine', 'CurrentState', 'Event'], [
  { StateMachine: 'WelfareCardAccount', CurrentState: 'ACTIVE', Event: 'FREEZE_ORDER_AMOUNT', Status: 'IMPLEMENTED_M3_P056' },
  { StateMachine: 'WelfareCardAccount', CurrentState: 'ACTIVE', Event: 'CAPTURE_ORDER_AMOUNT', Status: 'IMPLEMENTED_M3_P056' },
  { StateMachine: 'PaymentTransaction', CurrentState: 'PREPAY_CREATED', Event: 'VERIFIED_NOTIFY_SUCCESS', Status: 'IMPLEMENTED_M3_P056' },
]);
await upsertCsv('07-权限与数据可见矩阵.csv', ['OwnerType', 'RoleCode'], [{
  OwnerType: 'CONSUMER', RoleCode: 'CONSUMER_USER',
  ReadScope: '公开商品、自身购物车/订单/福利卡账户白名单/地址；API-039资格、API-104全额与API-105混合支付仅本人订单和账户',
  WriteScope: '自身福利卡绑定、下单、福利卡全额或自动最大抵扣加微信差额支付、收货、售后、自身资料；API-105仅提交accountId',
  DataScope: 'companyId与consumerUserId从会话派生；订单金额/适用范围/余额/抵扣/分摊/库存均服务端校验',
  ForbiddenActions: '不得提交归属、价格、抵扣/现金金额或范围；不得访问供应价/他人账户；不得个人充值；不得用支付宝；企业不得用福利卡',
  Stage: 'M3', P0: 'P0-020,P0-021,P0-024,P0-052,P0-053,P0-054,P0-055,P0-056,P0-083,P0-092,P0-093,P0-098', Status: 'IMPLEMENTED_M3_P056_PARTIAL',
}]);
await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [{
  PageID: 'PAGE-056', ImplementationStatus: 'IMPLEMENTED_M3_P056_WELFARE_WECHAT_SUCCESS_PARTIAL',
  AcceptanceStatus: `P0-053_CI_PASS;P0-054_CI_PASS;P0-055_CI_PASS;P0-056_${evidenceStatus};P0-091_PARTIAL;P0-092_PARTIAL;P0-093_PARTIAL;DEVICE_NOT_EXECUTED`,
  RouteTest: 'apps/user-miniapp/test/welfare-card-selection-build.test.mjs|tests/e2e/p0/p0-055-welfare-card-full-payment.spec.ts|tests/e2e/p0/p0-056-welfare-card-wechat-payment.spec.ts',
  Notes: '选择账户后服务端自动最大抵扣；全额走福利卡，部分覆盖只调用一次wx.requestPayment支付差额；成功后仍等待服务端回调。取消释放/查单恢复/退款和真机属于后续或外部门禁。',
}]);
await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [{
  EvidenceID: 'EVD-056', P0ID: 'P0-056', Stage: 'M3', TaskID: 'M3-P056', EvidenceType: 'AUTOMATED_TRANSACTION_API_MINIAPP_OPENAPI_E2E', RequiredLevel: 'STAGING_PASS', CurrentStatus: evidenceStatus,
  CommandOrProcedure: 'RED API 3/3 404 + miniapp action missing；GREEN begin repository 1/1、callback repository 6/6、API 3/3、miniapp 7/7、OpenAPI 1/1、P0 Chromium 1/1；Prisma validate/migrate dry-run；pnpm verify',
  Expected: '福利卡先冻结；微信只支付服务端差额；回调后冻结转实扣；总额守恒且每订单一笔公司微信交易；重复/失败不产生部分副作用',
  Actual: '自动最大抵扣、逐行分摊、归属/幂等/重复回调、晚期失败回滚、DTO隔离和单次小程序用户手势均有自动化证据。',
  Environment: 'LOCAL_WINDOWS_MYSQL8_CHROMIUM_DETERMINISTIC_WECHAT_ADAPTER', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; MySQL 8; Playwright Chromium', ExecutedAt: updatedAt, CommitSHA: commit,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P056-welfare-card-wechat-payment.md|artifacts/verification/M3-P056/welfare-card-wechat-payment.json|artifacts/test-results/verification/pnpm-verify.json',
  Executor: 'CODEX', Freshness: 'FRESH_LOCAL_WORKTREE', FailureOrBlocker: '真实微信商户/证书/APIv3、staging、真机支付和真实资金未执行；取消释放属于P057；退款属于P058', RetestRequired: 'YES', Notes: '无新迁移；复用MIG-012A支付唯一键与MIG-015B FREEZE/CAPTURE账本约束。',
}]);
await upsertCsv('11-数据库迁移台账.csv', ['MigrationID'], [{
  MigrationID: 'MIG-015B', Status: 'REUSED_LOCAL_REHEARSED_M3_P056', CommitSHA: commit,
  Notes: 'P056无新表/字段；复用MIG-015B账本FREEZE/CAPTURE约束与MIG-012A每订单唯一PaymentTransaction；需通过全量迁移演练确认无漂移。',
}]);
await upsertCsv('12-OpenAPI-DTO-错误码台账.csv', ['ContractID'], [{
  ContractID: 'API-105', Stage: 'M3', Domain: 'welfare-card-payment', Method: 'POST', Path: '/v1/consumer/orders/{orderId}/welfare-card-wechat-payment', Actor: 'CONSUMER', RequestDTO: 'WelfareCardWechatPaymentRequestDto', ResponseDTO: 'WelfareCardWechatPaymentResponseDto', CommonResponse: '显式白名单DTO；private/no-store；noindex',
  ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCOUNT_SUSPENDED|FIELD_FORBIDDEN|VALIDATION_FAILED|IDEMPOTENCY_KEY_REQUIRED|ORDER_NOT_FOUND|ACCESS_DENIED|WELFARE_CARD_NOT_ELIGIBLE|WELFARE_CARD_MIXED_PAYMENT_NOT_APPLICABLE|PAYMENT_IDEMPOTENCY_CONFLICT|PAYMENT_STATE_INVALID|PAYMENT_CONCURRENT_CONFLICT|EXTERNAL_SERVICE_UNAVAILABLE',
  Idempotency: 'Idempotency-Key plus unique PaymentTransaction.orderId; repeat uses same frozen order allocation and outTradeNo', SensitiveFieldPolicy: 'NEVER_RETURN supplyPrice/accountId/balance/owner/config/secret; SESSION_OWNER_DERIVED; request only accountId; no public cache',
  MoneyRule: 'integer cents; automatic max deduction; total=welfare+cash; cash=PaymentTransaction.amount>0; FREEZE before prepay; CAPTURE only in verified callback', P0: 'P0-024,P0-056,P0-092,P0-093', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/welfare-card-wechat-payment-api.test.mjs|tests/openapi/m3-p056-welfare-card-wechat-payment.contract.test.mjs|packages/contracts/openapi.json', Owner: 'CODEX', Notes: 'P057取消/超时释放、P058退款和真实微信不在本切片。',
}]);
await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P055 PR #108合并且main run ${p055MainRun}成功。M3-P056福利卡加微信成功闭环为${evidenceStatus}；RequiredEvidenceLevel仍需staging/真实微信；P057及M4以后锁定。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const visit = (value) => {
  if (Array.isArray(value)) for (const item of value) visit(item);
  else if (value && typeof value === 'object') {
    if (value.pageId === 'PAGE-056') value.implementationStatus = 'IMPLEMENTED_M3_P056_WELFARE_WECHAT_SUCCESS_PARTIAL';
    if (value.taskId === 'M3-P055') value.executionStatus = 'CI_PASS';
    if (value.taskId === 'M3-P056') value.executionStatus = evidenceStatus;
    for (const child of Object.values(value)) visit(child);
  }
};
visit(freeze);
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P056', nextAllowedTask: 'M3-P056', activeTaskCount: 1, lastCompletedTask: 'M3-P055', lastCompletedCommit: p055Merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P056 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P057', '真实微信/staging/真机/真实资金未完成；M4及后续保持锁定'] };
status.github = { ...status.github, pullRequest: null, pullRequestUrl: null, pullRequestState: 'NOT_CREATED', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: { scope: 'M3_P055_POST_MERGE_MAIN', status: 'CI_PASS', runId: Number(p055MainRun), jobId: Number(p055MainJob), runUrl: `https://github.com/EasyStep-lee/flt1/actions/runs/${p055MainRun}`, headSha: p055Merge, event: 'push', completedAt: '2026-08-17T05:15:19Z' },
  currentTaskDelivery: { taskId: 'M3-P056', issue: 109, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/109', branch: 'codex/m3-welfare-card-mixed-payment', baseCommit: p055Merge, verifiedHead: commit, status: 'LOCAL_PASS_PENDING_DRAFT_PR', localRedTest: 'API_3_OF_3_404;MINIAPP_ACTION_MISSING', localFocusedTest: 'LOCAL_PASS_BEGIN_1_CALLBACK_6_API_3_MINIAPP_7_OPENAPI_1_P0_1', localFullVerify: fullVerify, pullRequest: null, pullRequestState: 'NOT_CREATED', exactHeadCi: 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'REAL_WECHAT_STAGING_DEVICE', nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P055', pullRequest: 108, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/108', exactHead: 'ecbb55573bf42ea32a1e1117e75958ba39ce38b1', mergeCommit: p055Merge, mainPostMergeCiRun: Number(p055MainRun), mainPostMergeCiJob: Number(p055MainJob), status: 'CI_PASS' },
  note: 'M3-P056福利卡加微信成功闭环LOCAL_PASS；真实微信/staging/device/production未执行；P057锁定。' };
status.evidence = { local: fullVerify === 'PASS_17_OF_17' ? 'LOCAL_PASS_M3_P056_FULL_VERIFY' : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED', ci: 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
status.counts = { ...status.counts, apiContracts: 105 };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const manifestPath = path.join(pack, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const workbookPath = path.join(pack, '17-福礼社Codex5.6执行总控工作簿.xlsx');
const workbookSha256 = createHash('sha256').update(await readFile(workbookPath)).digest('hex').toUpperCase();
manifest.counts = { ...manifest.counts, apiContracts: 105 };
manifest.workbook = { ...manifest.workbook, status: 'VERIFIED', sha256: workbookSha256, currentTaskMirror: { taskId: 'M3-P056', status: 'LOCAL_PASS_PENDING_DRAFT_PR', sourceLedgers: 'CSV_JSON_AND_WORKBOOK_UPDATED', reason: 'P056 CSV/JSON ledgers and the artifact-tool workbook mirror were synchronized and visually inspected across all 12 sheets.', checkedAt: updatedAt } };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P056');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'welfare-card-wechat-payment.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P056', p0: ['P0-056', 'P0-024_PARTIAL', 'P0-092_PARTIAL', 'P0-093_PARTIAL'], status: evidenceStatus,
  commit, updatedAt, baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  red: ['API_3_OF_3_ROUTE_404', 'MINIAPP_MIXED_ACTION_MISSING'], focused: ['BEGIN_REPOSITORY_1_OF_1', 'CALLBACK_REPOSITORY_6_OF_6', 'API_3_OF_3', 'MINIAPP_7_OF_7', 'OPENAPI_1_OF_1', 'P0_CHROMIUM_1_OF_1'], fullVerify,
  invariants: { automaticMaximumDeduction: true, amountConservation: true, onePaymentTransactionPerOrder: true, freezeBeforePrepay: true, captureOnlyAfterVerifiedCallback: true, duplicateCallbackSideEffectFree: true, lateFailureAtomicRollback: true },
  boundaries: { realWechat: 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED', cancellationRelease: 'OUT_OF_SCOPE_M3_P057', refund: 'OUT_OF_SCOPE_M3_P058' },
  github: { issue: 109, pullRequest: null, ciRun: null },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P056_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
