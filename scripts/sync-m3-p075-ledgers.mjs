import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const pullRequest = Number(args['pull-request'] || 0) || null;
const pullRequestUrl = pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}` : '';
const pullRequestState = pullRequest ? 'DRAFT' : 'NOT_CREATED';
const pullRequestCi = args['pr-ci'] || 'NOT_EXECUTED';
const pullRequestCiRun = Number(args['pr-run'] || 0) || null;
const pullRequestCiJob = Number(args['pr-job'] || 0) || null;
const pullRequestCiHead = args['pr-head'] || null;
const pullRequestCiCompletedAt = args['pr-completed-at'] || null;
const workbookSync = args['workbook-sync'] || 'PENDING';
const implemented = ['LOCAL_PASS', 'CI_PASS'].includes(evidenceStatus);
if (pullRequestCi === 'CI_PASS' && (!pullRequest || !pullRequestCiRun || !pullRequestCiJob || !pullRequestCiHead || !pullRequestCiCompletedAt)) {
  throw new Error('CI_PASS_REQUIRES_PR_RUN_JOB_HEAD_AND_COMPLETED_AT');
}

const p074 = {
  issue: 120,
  pr: 121,
  head: 'a0603c8cc4d64b66f5fd0fb9ca6e82ed9ae5b6a2',
  merge: 'ea1c72976cfa068cb38f3b5cc93172252c688a1e',
  prRun: 32462939307,
  prJob: 96713437526,
  mainRun: 32466425921,
  mainJob: 96723873849,
  mergedAt: '2026-08-21T09:08:00Z',
  mainCompletedAt: '2026-08-21T09:20:04Z',
};

const parseLine = (line) => {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else value += character;
  }
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
    const index = byKey.get(keyOf(change));
    if (index === undefined) throw new Error(`missing ledger row ${relativePath}:${keyOf(change)}`);
    rows[index] = { ...rows[index], ...change };
  }
  const output = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => encode(row[header])).join(',')),
  ].join(eol);
  await writeFile(filePath, `${output}${eol}`, 'utf8');
};

await upsertCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P074', Status: 'DONE', EvidenceStatus: 'CI_PASS', CommitSHA: p074.merge,
    PullRequest: `https://github.com/EasyStep-lee/flt1/pull/${p074.pr}`, CI: 'CI_PASS', UpdatedAt: p074.mergedAt,
    Notes: `PR #121精确head ${p074.head}经run ${p074.prRun}/job ${p074.prJob}验证并按授权合并为${p074.merge}；post-merge main run ${p074.mainRun}/job ${p074.mainJob}成功。授权客户案例/staging/device/production未执行。`,
  },
  {
    TaskID: 'M3-P075', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/122', Branch: 'codex/m3-portal-publicity-pages',
    CommitSHA: commit, PullRequest: pullRequestUrl, CI: pullRequestCi, UpdatedAt: updatedAt,
    Notes: `关于、能力、案例、新闻、公告详情和联系页内容完整；授权资质/案例默认拒绝；公告保留版本与生效日期；每页有明确下一步。${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁尚未通过。'}${pullRequestCi === 'CI_PASS' ? `PR #${pullRequest} head ${pullRequestCiHead} run ${pullRequestCiRun}/job ${pullRequestCiJob}通过。` : ''}M5 CMS、授权客户材料、staging/device/production未执行。`,
  },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  {
    P0ID: 'P0-074', CurrentEvidenceStatus: 'CI_PASS', LastVerifiedCommit: p074.merge,
    Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: p074.mergedAt,
    EvidenceLink: `docs/contracts/m3/M3-P074-portal-home.md|https://github.com/EasyStep-lee/flt1/pull/${p074.pr}|https://github.com/EasyStep-lee/flt1/actions/runs/${p074.mainRun}`,
    Notes: 'PR #121合并且post-merge main CI成功；授权客户案例/staging/device/production未执行。',
  },
  {
    P0ID: 'P0-075', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'NEG-M3-P075-01|NEG-M3-P075-02|NEG-M3-P075-03|tests/e2e/p0/p0-075-portal-publicity-pages.spec.ts|tests/contracts/m3-p075-portal-publicity-pages.contract.test.mjs',
    ManualCaseID: 'N/A',
    NegativeChecks: '缺必需内容/CTA/版本日期；未授权资质或客户信息泄露；未知slug未404或公开缓存索引回退',
    EvidenceLink: 'docs/contracts/m3/M3-P075-portal-publicity-pages.md|artifacts/verification/M3-P075/portal-publicity-pages.json|artifacts/verification/M3-P075/portal-publicity-desktop.png|artifacts/verification/M3-P075/portal-publicity-mobile.png',
    LastVerifiedCommit: commit, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: `${implemented ? '本地内容完整性、CTA、授权空态、公告版本日期、404、SSG/ISR、移动响应式和敏感字段负向检查通过。' : '实现进行中。'}RequiredEvidenceLevel为CI_PASS；客户案例/资质公开授权NOT_EXECUTED。`,
  },
]);

const pageIds = ['PAGE-026', 'PAGE-027', 'PAGE-028', 'PAGE-029', 'PAGE-044', 'PAGE-045', 'PAGE-046'];
await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], pageIds.map((PageID) => ({
  PageID,
  P0: ['PAGE-044', 'PAGE-045', 'PAGE-046'].includes(PageID)
    ? (PageID === 'PAGE-046' ? 'P0-075,P0-074,P0-076,P0-027' : 'P0-075,P0-073,P0-082,P0-027')
    : 'P0-075,P0-027',
  ImplementationStatus: implemented ? 'IMPLEMENTED_M3_P075_STATIC' : 'M3_P075_IN_PROGRESS',
  AcceptanceStatus: `P0-027_CI_PASS;P0-075_${evidenceStatus};M5_CMS_NOT_EXECUTED`,
  RouteTest: 'apps/portal-web/test/publicity-seo-boundary.test.mjs|tests/e2e/p0/p0-027-portal-publicity.spec.ts|tests/e2e/p0/p0-075-portal-publicity-pages.spec.ts',
  Notes: 'Next.js公开SSG/ISR宣传页具备完整正文、授权默认拒绝、公告版本/生效日期、未知slug 404和明确下一步；不展示供应价、完整联系方式、虚构资质或客户材料。M5 CMS/正式素材授权/真实域名仍NOT_EXECUTED。',
})));

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [
  {
    EvidenceID: 'EVD-074', CurrentStatus: 'CI_PASS', ExecutedAt: p074.mergedAt,
    CommitSHA: p074.merge, CIRunURL: `https://github.com/EasyStep-lee/flt1/actions/runs/${p074.mainRun}`,
    Executor: 'GITHUB_ACTIONS+CODEX', Freshness: 'MERGED_MAIN',
    FailureOrBlocker: '授权客户案例/staging/device/production未执行', RetestRequired: 'YES',
    Notes: `PR #121精确head ${p074.head} CI成功并合并；post-merge main run ${p074.mainRun}/job ${p074.mainJob}成功。`,
  },
  {
    EvidenceID: 'EVD-075', EvidenceType: 'AUTOMATED_PUBLICITY_CONTENT_AUTHORIZATION_VERSION_CTA_SECURITY_RESPONSIVE',
    CurrentStatus: evidenceStatus,
    CommandOrProcedure: 'RED P0-075 Chromium 1/3；最小补齐新闻/公告详情/联系CTA；portal lint/typecheck/build；GREEN P0-075 Chromium 3/3；related portal tests；pnpm verify',
    Actual: implemented ? '宣传页内容、明确CTA、授权默认拒绝、公告版本日期、未知slug 404、公开缓存与敏感字段边界通过。' : '实现中。',
    Environment: 'LOCAL_WINDOWS_NODE22_NEXT_ISR_PLAYWRIGHT_CHROMIUM', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Next.js 16.2.12; Playwright Chromium',
    ExecutedAt: updatedAt, CommitSHA: commit,
    CIRunURL: pullRequestCi === 'CI_PASS' && pullRequestCiRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${pullRequestCiRun}` : '',
    ArtifactOrScreenshot: 'docs/contracts/m3/M3-P075-portal-publicity-pages.md|artifacts/verification/M3-P075/portal-publicity-pages.json|artifacts/verification/M3-P075/portal-publicity-desktop.png|artifacts/verification/M3-P075/portal-publicity-mobile.png',
    Executor: pullRequestCi === 'CI_PASS' ? 'GITHUB_ACTIONS+CODEX' : 'CODEX',
    Freshness: pullRequestCi === 'CI_PASS' ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_WORKTREE',
    FailureOrBlocker: pullRequestCi === 'CI_PASS'
      ? '人工合并、post-merge main CI、客户/资质正式公开授权、staging/device/production未执行'
      : '客户/资质正式公开授权、Draft PR精确head CI、staging/device/production未执行',
    RetestRequired: 'YES',
    Notes: '不宣称P076咨询表单、P077真实认证、M5 CMS或正式内容发布完成；不进入P076。',
  },
]);

await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P074 PR #121合并且main run ${p074.mainRun}成功。M3-P075企业宣传页面为${evidenceStatus}；P076及M4以后锁定；授权客户/资质、staging/device/production未执行。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
for (const negative of freeze.negativeTests) {
  if (negative.taskId === 'M3-P074') negative.executionStatus = 'CI_PASS';
  if (negative.taskId === 'M3-P075') negative.executionStatus = evidenceStatus;
}
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P075', nextAllowedTask: 'M3-P075',
  activeTaskCount: 1, lastCompletedTask: 'M3-P074', lastCompletedCommit: p074.merge,
  prohibitedUntilGate: [
    'M3-P075 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P076',
    'M3-GATE通过前M4及以后保持锁定；授权客户/资质、staging/device/production未执行',
  ],
};
status.github = {
  ...status.github,
  pullRequest, pullRequestUrl: pullRequestUrl || null, pullRequestState,
  pullRequestMerged: false, mergeCommitSha: null, mergedAt: null,
  lastVerifiedPullRequestHead: pullRequestCi === 'CI_PASS' ? pullRequestCiHead : null,
  pullRequestCi: {
    status: pullRequestCi,
    runId: pullRequestCiRun,
    jobId: pullRequestCiJob,
    runUrl: pullRequestCiRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${pullRequestCiRun}` : null,
    headSha: pullRequestCiHead,
    completedAt: pullRequestCiCompletedAt,
  },
  latestCi: {
    scope: 'M3_P074_POST_MERGE_MAIN', status: 'CI_PASS', runId: p074.mainRun, jobId: p074.mainJob,
    runUrl: `https://github.com/EasyStep-lee/flt1/actions/runs/${p074.mainRun}`, headSha: p074.merge,
    event: 'push', completedAt: p074.mainCompletedAt,
  },
  currentTaskDelivery: {
    taskId: 'M3-P075', issue: 122, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/122',
    branch: 'codex/m3-portal-publicity-pages', baseCommit: p074.merge,
    verifiedHead: pullRequestCi === 'CI_PASS' ? pullRequestCiHead : commit,
    status: pullRequestCi === 'CI_PASS'
      ? 'CI_PASS_PENDING_HUMAN_MERGE'
      : pullRequest ? 'DRAFT_PR_CI_PENDING' : implemented ? 'LOCAL_PASS_PENDING_DRAFT_PR' : 'IN_PROGRESS',
    localRedTest: 'RECORDED_FAIL_2_OF_3_MISSING_NEWS_AND_CONTACT_NEXT_ACTIONS',
    localFocusedTest: implemented ? 'LOCAL_PASS_P075_3_OF_3' : 'NOT_EXECUTED', localFullVerify: fullVerify,
    pullRequest, pullRequestState, exactHeadCi: pullRequestCi, review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED',
    mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'AUTHORIZED_CUSTOMER_QUALIFICATION_STAGING_DEVICE_PRODUCTION', nextTaskUnlocked: false,
  },
  previousTaskDelivery: {
    taskId: 'M3-P074', issue: p074.issue, pullRequest: p074.pr,
    pullRequestUrl: `https://github.com/EasyStep-lee/flt1/pull/${p074.pr}`, exactHead: p074.head,
    mergeCommit: p074.merge, mainPostMergeCiRun: p074.mainRun, mainPostMergeCiJob: p074.mainJob, status: 'CI_PASS',
  },
  note: `M3-P074 merged-main CI_PASS；M3-P075企业宣传页面${evidenceStatus}${pullRequestCi === 'CI_PASS' ? `（PR #${pullRequest} run ${pullRequestCiRun}）` : ''}；P076/M4以后锁定。`,
};
status.evidence = {
  local: implemented ? 'LOCAL_PASS_M3_P075' : 'NOT_EXECUTED_M3_P075',
  ci: pullRequestCi === 'CI_PASS' ? 'CI_PASS' : 'NOT_EXECUTED',
  staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
};
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const manifestPath = path.join(pack, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.workbook = {
  ...manifest.workbook,
  status: workbookSync === 'VERIFIED' ? 'VERIFIED' : 'SYNC_PENDING',
  currentTaskMirror: {
    taskId: 'M3-P075', status: implemented ? 'LOCAL_PASS_PENDING_DRAFT_PR' : 'IN_PROGRESS',
    sourceLedgers: workbookSync === 'VERIFIED' ? 'CSV_JSON_AND_WORKBOOK_UPDATED' : 'CSV_JSON_UPDATED_WORKBOOK_PENDING',
    reason: 'P074 merged-main evidence is closed and P075 publicity content, authorization fail-closed, version/date and next-action evidence are current; P076 remains locked.',
    checkedAt: updatedAt,
  },
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P075');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'portal-publicity-pages.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P075', p0: ['P0-075'], status: evidenceStatus, commit, updatedAt,
  baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  red: [{ command: 'pnpm exec playwright test --config playwright.p0.config.ts tests/e2e/p0/p0-075-portal-publicity-pages.spec.ts --project=chromium', exitCode: 1, result: 'FAIL_2_OF_3', reason: '新闻列表、规则公告详情和联系页缺少统一明确下一步入口' }],
  focused: implemented ? [
    { command: 'pnpm --filter @fulishe/portal-web lint && pnpm --filter @fulishe/portal-web typecheck && pnpm --filter @fulishe/portal-web build', result: 'PASS' },
    { command: 'pnpm exec playwright test --config playwright.p0.config.ts tests/e2e/p0/p0-075-portal-publicity-pages.spec.ts --project=chromium', result: 'PASS_3_OF_3' },
  ] : [],
  fullVerify,
  invariants: {
    completePublicityContent: true, explicitNextActionOnListAndDetailPages: true,
    qualificationsFailClosedWithoutPublicAuthorization: true, customerCasesFailClosed: true,
    anonymousScenarioNotCustomerEndorsement: true, announcementVersionAndEffectiveDatePreserved: true,
    unknownSlugReturns404: true, publicStaticIsr: true, noSensitiveOrInternalPriceFields: true,
    desktopAndMobileResponsive: true,
  },
  boundaries: {
    migration: 'NONE', openapi: 'NONE', businessInquiryForm: 'OUT_OF_SCOPE_P076_M5',
    authorizedCustomerCases: 'NOT_EXECUTED', qualificationPublicMaterials: 'NOT_EXECUTED',
    cms: 'OUT_OF_SCOPE_M5', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
  },
  github: {
    issue: 122, pullRequest, pullRequestState, ciStatus: pullRequestCi,
    runId: pullRequestCiRun, jobId: pullRequestCiJob, headSha: pullRequestCiHead,
    completedAt: pullRequestCiCompletedAt,
  },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P075_LEDGERS_SYNCED:${commit}:${evidenceStatus}:${workbookSync}\n`);
