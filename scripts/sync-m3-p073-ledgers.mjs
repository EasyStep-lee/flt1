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

const p062 = {
  issue: 116,
  pr: 117,
  head: 'da5dae7dbee7add9cfe6b86747dbd623c56cac03',
  merge: 'ae8545de7eb8502a56fa827b95092f472a8153a0',
  prRun: 32371633008,
  prJob: 96433316854,
  mainRun: 32434122906,
  mainJob: 96631713342,
  mergedAt: '2026-08-21T00:49:57Z',
  mainCompletedAt: '2026-08-21T01:02:22Z',
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
    TaskID: 'M3-P062', Status: 'DONE', EvidenceStatus: 'CI_PASS', CommitSHA: p062.merge,
    PullRequest: `https://github.com/EasyStep-lee/flt1/pull/${p062.pr}`, CI: 'CI_PASS', UpdatedAt: p062.mergedAt,
    Notes: `PR #117精确head ${p062.head}经run ${p062.prRun}/job ${p062.prJob}验证并按授权合并为${p062.merge}；post-merge main run ${p062.mainRun}/job ${p062.mainJob}成功。staging/device/production未执行。`,
  },
  {
    TaskID: 'M3-P073', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/118', Branch: 'codex/m3-portal-navigation',
    CommitSHA: commit, PullRequest: pullRequestUrl, CI: pullRequestCi, UpdatedAt: updatedAt,
    Notes: `公开桌面/移动导航覆盖八个固定入口；公开态只显示企业注册/登录，私有交易态显示货架/采购车/工作台；页脚含公司主体、脱敏手机和法律入口。${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁尚未通过。'}法律文本尚待授权法务审定；staging/production未执行。`,
  },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  {
    P0ID: 'P0-062', CurrentEvidenceStatus: 'CI_PASS', LastVerifiedCommit: p062.merge,
    Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: p062.mergedAt,
    EvidenceLink: `docs/contracts/m3/M3-P062-enterprise-multi-supplier-order.md|https://github.com/EasyStep-lee/flt1/pull/${p062.pr}|https://github.com/EasyStep-lee/flt1/actions/runs/${p062.mainRun}`,
    Notes: 'PR #117合并且post-merge main CI成功；staging/device/production未执行。',
  },
  {
    P0ID: 'P0-073', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'NEG-M3-P073-01|NEG-M3-P073-02|NEG-M3-P073-03|tests/e2e/p0/p0-073-portal-navigation.spec.ts|tests/contracts/m3-p073-portal-navigation.contract.test.mjs',
    ManualCaseID: 'N/A',
    NegativeChecks: '公开态不得显示采购车/工作台；私有交易页不得公共缓存或被索引；法律入口不得伪装为已完成法务审定',
    EvidenceLink: 'docs/contracts/m3/M3-P073-portal-navigation.md|artifacts/verification/M3-P073/portal-navigation.json|artifacts/verification/M3-P073/portal-navigation-desktop.png|artifacts/verification/M3-P073/portal-navigation-mobile.png',
    LastVerifiedCommit: commit, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: `${implemented ? '本地公开/私有导航、桌面/移动响应式、页脚主体与法律入口、noindex/private/no-store行为通过。' : '实现进行中。'}RequiredEvidenceLevel为CI_PASS；法律正式文本审定NOT_EXECUTED。`,
  },
]);

await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [{
  PageID: 'PAGE-030', ImplementationStatus: implemented ? 'IMPLEMENTED_M3_P073' : 'M3_P073_IN_PROGRESS',
  AcceptanceStatus: `P0-030_CI_PASS;P0-073_${evidenceStatus};P0-074_NOT_EXECUTED`,
  RouteTest: 'apps/portal-web/test/community-procurement-boundary.test.mjs|tests/e2e/p0/p0-030-community-procurement-boundary.spec.ts|tests/e2e/p0/p0-073-portal-navigation.spec.ts',
  Notes: 'Next.js公开SSG/ISR区域含八个固定导航、注册/登录动作、公司主体/脱敏手机/法律入口；私有企业交易布局含货架/采购车/工作台并另行保持noindex与禁止公共缓存。法律正式文本等待授权法务审定；P074未执行。',
}]);

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [
  {
    EvidenceID: 'EVD-062', CurrentStatus: 'CI_PASS', ExecutedAt: p062.mergedAt,
    CommitSHA: p062.merge, CIRunURL: `https://github.com/EasyStep-lee/flt1/actions/runs/${p062.mainRun}`,
    Executor: 'GITHUB_ACTIONS+CODEX', Freshness: 'MERGED_MAIN',
    FailureOrBlocker: 'staging/device/production未执行', RetestRequired: 'YES',
    Notes: `PR #117精确head ${p062.head} CI成功并合并；post-merge main run ${p062.mainRun}/job ${p062.mainJob}成功。`,
  },
  {
    EvidenceID: 'EVD-073', EvidenceType: 'AUTOMATED_PORTAL_NAVIGATION_AND_CACHE_BOUNDARY',
    CurrentStatus: evidenceStatus,
    CommandOrProcedure: 'RED P0-073 Chromium 0/2；GREEN portal lint/typecheck/build + P0-073 Chromium 2/2；contract tests；pnpm verify',
    Actual: implemented ? '八个公开入口、企业公开动作、私有货架/采购车/工作台、公司主体/脱敏手机/法律入口、桌面/移动响应式及私有缓存隔离自动化通过。' : '实现中。',
    Environment: 'LOCAL_WINDOWS_NODE22_PLAYWRIGHT_CHROMIUM', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Playwright Chromium',
    ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: pullRequestCi === 'CI_PASS' && pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}/checks` : '',
    ArtifactOrScreenshot: 'docs/contracts/m3/M3-P073-portal-navigation.md|artifacts/verification/M3-P073/portal-navigation.json|artifacts/verification/M3-P073/portal-navigation-desktop.png|artifacts/verification/M3-P073/portal-navigation-mobile.png',
    Executor: 'CODEX', Freshness: 'FRESH_LOCAL_WORKTREE',
    FailureOrBlocker: '法律正式文本待授权法务审定；Draft PR精确head CI、staging/production未执行', RetestRequired: 'YES',
    Notes: '不宣称P074首页闭环、P077真实登录或P080工作台订单完成；不进入P074。',
  },
]);

await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P062 PR #117合并且main run ${p062.mainRun}成功。M3-P073门户全站导航为${evidenceStatus}；P074及M4以后锁定；法律正式文本/staging/device/production未执行。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
for (const negative of freeze.negativeTests) {
  if (negative.taskId === 'M3-P062') negative.executionStatus = 'CI_PASS';
  if (negative.taskId === 'M3-P073') negative.executionStatus = evidenceStatus;
}
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P073', nextAllowedTask: 'M3-P073',
  activeTaskCount: 1, lastCompletedTask: 'M3-P062', lastCompletedCommit: p062.merge,
  prohibitedUntilGate: [
    'M3-P073 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P074',
    'M3-GATE通过前M4及以后保持锁定；staging/device/production未执行',
  ],
};
status.github = {
  ...status.github,
  pullRequest, pullRequestUrl: pullRequestUrl || null, pullRequestState,
  pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: pullRequestCi, runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: {
    scope: 'M3_P062_POST_MERGE_MAIN', status: 'CI_PASS', runId: p062.mainRun, jobId: p062.mainJob,
    runUrl: `https://github.com/EasyStep-lee/flt1/actions/runs/${p062.mainRun}`, headSha: p062.merge,
    event: 'push', completedAt: p062.mainCompletedAt,
  },
  currentTaskDelivery: {
    taskId: 'M3-P073', issue: 118, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/118',
    branch: 'codex/m3-portal-navigation', baseCommit: p062.merge, verifiedHead: commit,
    status: pullRequest ? 'DRAFT_PR_CI_PENDING' : implemented ? 'LOCAL_PASS_PENDING_DRAFT_PR' : 'IN_PROGRESS',
    localRedTest: 'RECORDED_FAIL_2_OF_2_MISSING_PUBLIC_AND_PRIVATE_NAVIGATION',
    localFocusedTest: implemented ? 'LOCAL_PASS_PORTAL_P0_2' : 'NOT_EXECUTED', localFullVerify: fullVerify,
    pullRequest, pullRequestState, exactHeadCi: pullRequestCi, review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED',
    mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'LEGAL_TEXT_STAGING_DEVICE_PRODUCTION', nextTaskUnlocked: false,
  },
  previousTaskDelivery: {
    taskId: 'M3-P062', issue: p062.issue, pullRequest: p062.pr,
    pullRequestUrl: `https://github.com/EasyStep-lee/flt1/pull/${p062.pr}`, exactHead: p062.head,
    mergeCommit: p062.merge, mainPostMergeCiRun: p062.mainRun, mainPostMergeCiJob: p062.mainJob, status: 'CI_PASS',
  },
  note: `M3-P062 merged-main CI_PASS；M3-P073门户全站导航${evidenceStatus}；P074/M4以后锁定。`,
};
status.evidence = {
  local: implemented ? 'LOCAL_PASS_M3_P073' : 'NOT_EXECUTED_M3_P073',
  ci: pullRequestCi === 'CI_PASS' ? 'CI_PASS' : 'NOT_EXECUTED',
  staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
};
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P073');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'portal-navigation.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P073', p0: ['P0-073'], status: evidenceStatus, commit, updatedAt,
  baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  red: [{ command: 'pnpm exec playwright test --config playwright.p0.config.ts tests/e2e/p0/p0-073-portal-navigation.spec.ts', exitCode: 1, result: 'FAIL_2_OF_2', reason: '公开导航缺福利卡入口；私有企业布局缺货架/采购车/工作台导航' }],
  focused: implemented ? [
    { command: 'pnpm --filter @fulishe/portal-web lint && pnpm --filter @fulishe/portal-web typecheck && pnpm --filter @fulishe/portal-web build', result: 'PASS' },
    { command: 'pnpm exec playwright test --config playwright.p0.config.ts tests/e2e/p0/p0-073-portal-navigation.spec.ts', result: 'PASS_2_OF_2' },
  ] : [],
  fullVerify,
  invariants: {
    publicNavigationHasEightEntries: true, publicHasRegisterAndLoginOnly: true,
    privateHasShelfCartWorkspace: true, publicDoesNotExposePrivateDestinations: true,
    privateNoindexAndNoStore: true, companySubjectAndMaskedMobileInFooter: true,
    legalEntriesRouteSuccessfully: true, legalApprovalNotFabricated: true,
  },
  boundaries: {
    migration: 'NONE', openapi: 'NONE', actualEnterpriseLogin: 'OUT_OF_SCOPE_P077',
    homeClosure: 'OUT_OF_SCOPE_P074', legalTextApproval: 'NOT_EXECUTED',
    staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
  },
  github: { issue: 118, pullRequest, pullRequestState, ciStatus: pullRequestCi },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P073_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
