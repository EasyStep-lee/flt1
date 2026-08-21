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
const implemented = ['LOCAL_PASS', 'CI_PASS'].includes(evidenceStatus);

const p073 = {
  issue: 118,
  pr: 119,
  head: '1abef37c40f36d45f0ecd469a33b6aecee4de754',
  merge: '099606b97d86653c37825ac5e25ea2e1eaa6077c',
  prRun: 32443950521,
  prJob: 96659978154,
  mainRun: 32449212006,
  mainJob: 96674355395,
  mergedAt: '2026-08-21T05:04:26Z',
  mainCompletedAt: '2026-08-21T05:16:01Z',
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
    TaskID: 'M3-P073', Status: 'DONE', EvidenceStatus: 'CI_PASS', CommitSHA: p073.merge,
    PullRequest: `https://github.com/EasyStep-lee/flt1/pull/${p073.pr}`, CI: 'CI_PASS', UpdatedAt: p073.mergedAt,
    Notes: `PR #119精确head ${p073.head}经run ${p073.prRun}/job ${p073.prJob}验证并按授权合并为${p073.merge}；post-merge main run ${p073.mainRun}/job ${p073.mainJob}成功。法律正式文本/staging/device/production未执行。`,
  },
  {
    TaskID: 'M3-P074', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/120', Branch: 'codex/m3-portal-home',
    CommitSHA: commit, PullRequest: pullRequestUrl, CI: pullRequestCi, UpdatedAt: updatedAt,
    Notes: `首页按主视觉、核心服务、供应链能力、社区集采、分类预览、授权案例、供应商合作、新闻和底部CTA九段顺序闭环；无授权案例显示真实空态。${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁尚未通过。'}授权客户案例/staging/production未执行。`,
  },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  {
    P0ID: 'P0-073', CurrentEvidenceStatus: 'CI_PASS', LastVerifiedCommit: p073.merge,
    Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: p073.mergedAt,
    EvidenceLink: `docs/contracts/m3/M3-P073-portal-navigation.md|https://github.com/EasyStep-lee/flt1/pull/${p073.pr}|https://github.com/EasyStep-lee/flt1/actions/runs/${p073.mainRun}`,
    Notes: 'PR #119合并且post-merge main CI成功；法律正式文本/staging/device/production未执行。',
  },
  {
    P0ID: 'P0-074', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'NEG-M3-P074-01|NEG-M3-P074-02|NEG-M3-P074-03|tests/e2e/p0/p0-074-portal-home.spec.ts|tests/contracts/m3-p074-portal-home.contract.test.mjs',
    ManualCaseID: 'N/A',
    NegativeChecks: '九段缺失或乱序；公开缓存/索引或敏感字段泄露；无授权案例时虚构客户、销量、金额或倒计时',
    EvidenceLink: 'docs/contracts/m3/M3-P074-portal-home.md|artifacts/verification/M3-P074/portal-home.json|artifacts/verification/M3-P074/portal-home-desktop.png|artifacts/verification/M3-P074/portal-home-mobile.png',
    LastVerifiedCommit: commit, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: `${implemented ? '本地九段顺序、入口、公开ISR、六类预览、授权案例空态、桌面/移动响应式和敏感字段负向检查通过。' : '实现进行中。'}RequiredEvidenceLevel为CI_PASS；客户案例授权NOT_EXECUTED。`,
  },
]);

await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [
  {
    PageID: 'PAGE-025', ImplementationStatus: implemented ? 'IMPLEMENTED_M3_P074' : 'M3_P074_IN_PROGRESS',
    AcceptanceStatus: `P0-001_CI_PASS;P0-009_CI_PASS;P0-027_CI_PASS;P0-074_${evidenceStatus};M5_CMS_NOT_EXECUTED`,
    RouteTest: 'apps/portal-web/test/publicity-seo-boundary.test.mjs|apps/portal-web/test/seo-cache-boundary.test.mjs|tests/e2e/p0/p0-027-portal-publicity.spec.ts|tests/e2e/p0/p0-074-portal-home.spec.ts',
    Notes: 'Next.js首页为SSG/ISR；九段顺序、六个EXT-007一级分类、授权案例真实空态、版本化公告和企业注册/商务CTA已实现；不展示价格、精确库存或虚构客户证明。M5 CMS/正式案例授权未执行。',
  },
  {
    PageID: 'PAGE-030', ImplementationStatus: 'IMPLEMENTED_M3_P074',
    AcceptanceStatus: `P0-030_CI_PASS;P0-073_CI_PASS;P0-074_${evidenceStatus}`,
    RouteTest: 'apps/portal-web/test/community-procurement-boundary.test.mjs|tests/e2e/p0/p0-030-community-procurement-boundary.spec.ts|tests/e2e/p0/p0-073-portal-navigation.spec.ts|tests/e2e/p0/p0-074-portal-home.spec.ts',
    Notes: 'Next.js公开社区集采入口继续保持SSG/ISR和普通企业采购边界；首页九段中的社区集采说明提供注册/登录并明确持续开放，私有交易区禁止公共缓存。',
  },
  {
    PageID: 'PAGE-046', ImplementationStatus: 'IMPLEMENTED_M3_P074_ENTRY_ONLY',
    AcceptanceStatus: `P0-027_CI_PASS;P0-074_${evidenceStatus};P0-076_NOT_EXECUTED`,
    RouteTest: 'apps/portal-web/test/publicity-seo-boundary.test.mjs|tests/e2e/p0/p0-027-portal-publicity.spec.ts|tests/e2e/p0/p0-074-portal-home.spec.ts',
    Notes: '首页底部企业服务CTA已提供商务联系入口；联系我们页继续保持Next.js公开SSG/ISR。P076咨询表单、M5 CMS和正式内容发布未执行。',
  },
]);

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [
  {
    EvidenceID: 'EVD-073', CurrentStatus: 'CI_PASS', ExecutedAt: p073.mergedAt,
    CommitSHA: p073.merge, CIRunURL: `https://github.com/EasyStep-lee/flt1/actions/runs/${p073.mainRun}`,
    Executor: 'GITHUB_ACTIONS+CODEX', Freshness: 'MERGED_MAIN',
    FailureOrBlocker: '法律正式文本/staging/device/production未执行', RetestRequired: 'YES',
    Notes: `PR #119精确head ${p073.head} CI成功并合并；post-merge main run ${p073.mainRun}/job ${p073.mainJob}成功。`,
  },
  {
    EvidenceID: 'EVD-074', EvidenceType: 'AUTOMATED_PORTAL_HOME_ORDER_CONTENT_SECURITY_AND_RESPONSIVE',
    CurrentStatus: evidenceStatus,
    CommandOrProcedure: 'RED P0-074 Chromium 0/2；portal build；GREEN P0-074 Chromium 2/2；portal tests；related P0 Chromium；pnpm verify',
    Actual: implemented ? '首页九段顺序、固定入口、六个批准分类、无授权案例空态、版本化公告、桌面/移动响应式和公开缓存/敏感字段边界通过。' : '实现中。',
    Environment: 'LOCAL_WINDOWS_NODE22_NEXT_ISR_PLAYWRIGHT_CHROMIUM', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Next.js 16.2.12; Playwright Chromium',
    ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: pullRequestCi === 'CI_PASS' && pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}/checks` : '',
    ArtifactOrScreenshot: 'docs/contracts/m3/M3-P074-portal-home.md|artifacts/verification/M3-P074/portal-home.json|artifacts/verification/M3-P074/portal-home-desktop.png|artifacts/verification/M3-P074/portal-home-mobile.png',
    Executor: 'CODEX', Freshness: 'FRESH_LOCAL_WORKTREE',
    FailureOrBlocker: '授权客户案例、Draft PR精确head CI、staging/production未执行', RetestRequired: 'YES',
    Notes: '不宣称P075宣传子页、P076咨询表单、P077真实认证或M5 CMS完成；不进入P075。',
  },
]);

await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P073 PR #119合并且main run ${p073.mainRun}成功。M3-P074门户首页闭环为${evidenceStatus}；P075及M4以后锁定；授权案例/staging/device/production未执行。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
for (const negative of freeze.negativeTests) {
  if (negative.taskId === 'M3-P073') negative.executionStatus = 'CI_PASS';
  if (negative.taskId === 'M3-P074') negative.executionStatus = evidenceStatus;
}
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P074', nextAllowedTask: 'M3-P074',
  activeTaskCount: 1, lastCompletedTask: 'M3-P073', lastCompletedCommit: p073.merge,
  prohibitedUntilGate: [
    'M3-P074 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P075',
    'M3-GATE通过前M4及以后保持锁定；授权案例/staging/device/production未执行',
  ],
};
status.github = {
  ...status.github,
  pullRequest, pullRequestUrl: pullRequestUrl || null, pullRequestState,
  pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: pullRequestCi, runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: {
    scope: 'M3_P073_POST_MERGE_MAIN', status: 'CI_PASS', runId: p073.mainRun, jobId: p073.mainJob,
    runUrl: `https://github.com/EasyStep-lee/flt1/actions/runs/${p073.mainRun}`, headSha: p073.merge,
    event: 'push', completedAt: p073.mainCompletedAt,
  },
  currentTaskDelivery: {
    taskId: 'M3-P074', issue: 120, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/120',
    branch: 'codex/m3-portal-home', baseCommit: p073.merge, verifiedHead: commit,
    status: pullRequest ? 'DRAFT_PR_CI_PENDING' : implemented ? 'LOCAL_PASS_PENDING_DRAFT_PR' : 'IN_PROGRESS',
    localRedTest: 'RECORDED_FAIL_2_OF_2_MISSING_NINE_SECTION_HOME',
    localFocusedTest: implemented ? 'LOCAL_PASS_PORTAL_4_AND_RELATED_P0_18' : 'NOT_EXECUTED', localFullVerify: fullVerify,
    pullRequest, pullRequestState, exactHeadCi: pullRequestCi, review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED',
    mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'AUTHORIZED_CASES_STAGING_DEVICE_PRODUCTION', nextTaskUnlocked: false,
  },
  previousTaskDelivery: {
    taskId: 'M3-P073', issue: p073.issue, pullRequest: p073.pr,
    pullRequestUrl: `https://github.com/EasyStep-lee/flt1/pull/${p073.pr}`, exactHead: p073.head,
    mergeCommit: p073.merge, mainPostMergeCiRun: p073.mainRun, mainPostMergeCiJob: p073.mainJob, status: 'CI_PASS',
  },
  note: `M3-P073 merged-main CI_PASS；M3-P074门户首页闭环${evidenceStatus}；P075/M4以后锁定。`,
};
status.evidence = {
  local: implemented ? 'LOCAL_PASS_M3_P074' : 'NOT_EXECUTED_M3_P074',
  ci: pullRequestCi === 'CI_PASS' ? 'CI_PASS' : 'NOT_EXECUTED',
  staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
};
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P074');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'portal-home.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P074', p0: ['P0-074'], status: evidenceStatus, commit, updatedAt,
  baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  red: [{ command: 'pnpm exec playwright test --config playwright.p0.config.ts tests/e2e/p0/p0-074-portal-home.spec.ts', exitCode: 1, result: 'FAIL_2_OF_2', reason: '首页缺少九段行为标记与完整模块顺序；移动端无法定位目标模块' }],
  focused: implemented ? [
    { command: 'pnpm --filter @fulishe/portal-web lint && pnpm --filter @fulishe/portal-web typecheck && pnpm --filter @fulishe/portal-web build', result: 'PASS' },
    { command: 'pnpm exec playwright test --config playwright.p0.config.ts tests/e2e/p0/p0-074-portal-home.spec.ts', result: 'PASS_2_OF_2' },
    { command: 'pnpm --filter @fulishe/portal-web test', result: 'PASS_4_OF_4' },
    { command: 'related P0-001/009/027/030/073/074 Chromium', result: 'PASS_18_OF_18' },
  ] : [],
  fullVerify,
  invariants: {
    nineSectionsInRequiredOrder: true, publicStaticIsr: true, approvedCategoriesOnly: true,
    noPublicPricesOrExactInventory: true, authorizedCasesFailClosed: true,
    anonymousScenarioNotPresentedAsCustomerCase: true, noInventedSalesMetricsOrCountdown: true,
    singleMerchantBoundaryPreserved: true, noSupplierStorefront: true, desktopAndMobileResponsive: true,
  },
  boundaries: {
    migration: 'NONE', openapi: 'NONE', actualEnterpriseLogin: 'OUT_OF_SCOPE_P077',
    publicitySubpages: 'OUT_OF_SCOPE_P075', supplierAndWelfareForms: 'OUT_OF_SCOPE_P076',
    authorizedCustomerCases: 'NOT_EXECUTED', cms: 'OUT_OF_SCOPE_M5', staging: 'NOT_EXECUTED',
    device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
  },
  github: { issue: 120, pullRequest, pullRequestState, ciStatus: pullRequestCi },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P074_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
