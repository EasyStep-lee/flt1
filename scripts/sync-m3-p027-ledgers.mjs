import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = process.env.M3_P027_UPDATED_AT ?? new Date().toISOString();
const commit = process.env.M3_P027_COMMIT ?? 'LOCAL_WORKTREE';
const pullRequest = process.env.M3_P027_PR ?? '';
const ciRun = process.env.M3_P027_CI_RUN ?? '';
const ciJob = process.env.M3_P027_CI_JOB ?? '';
const ciStatus = ciRun ? 'CI_PASS' : 'LOCAL_PASS';
const pullRequestUrl = pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}` : '';
const ciUrl = ciRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${ciRun}` : '';

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
  if (row.TaskID === 'M3-P027') return {
    ...row,
    Status: 'IN_PROGRESS', EvidenceStatus: ciStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/89', Branch: 'codex/m3-portal-publicity',
    CommitSHA: commit, PullRequest: pullRequestUrl, CI: ciRun ? 'CI_PASS' : 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `RED：公开宣传路由实际404，P0-027行为测试失败。GREEN：首页、关于、能力、匿名场景、供应商合作、公告、联系共9个静态/SSG路由，唯一metadata/canonical/JSON-LD、sitemap/robots、脱敏客服、供应价防泄露及响应式P0 E2E通过；pnpm verify 17/17通过。${ciRun ? `Draft PR精确head ${commit.slice(0, 7)} Actions run ${ciRun}/job ${ciJob}成功。` : '等待Draft PR与CI。'} M5 CMS/API-075至API-078和真实域名/备案未进入。`,
  };
  if (row.TaskID === 'M3-P028') return {
    ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P027 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => row.P0ID === 'P0-027' ? {
  ...row,
  CurrentEvidenceStatus: ciStatus,
  AutomatedTestID: 'apps/portal-web/test/publicity-seo-boundary.test.mjs|tests/e2e/p0/p0-027-portal-publicity.spec.ts|tests/e2e/p0/p0-001-single-merchant.spec.ts|tests/e2e/p0/p0-009-no-supplier-storefront.spec.ts',
  ManualCaseID: 'N/A',
  NegativeChecks: '未授权slug返回404；公开响应不含供应价/完整客服手机；sitemap不含企业私有路由；robots禁止抓取登录交易区',
  EvidenceLink: `docs/contracts/m3/M3-P027-portal-publicity.md|artifacts/verification/M3-P027/portal-publicity.json${pullRequestUrl ? `|${pullRequestUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
  LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
  Notes: '9个公开路由静态生成或SSG并以5分钟ISR更新；独立标题、canonical、Open Graph、JSON-LD、sitemap/robots、脱敏客服和供应价防泄露均有行为证据。M5 CMS、真实域名/DNS/TLS/ICP和正式客户素材不在本切片。',
} : null);

await updateCsv('10-测试证据登记.csv', (row) => row.EvidenceID === 'EVD-027' ? {
  ...row,
  CurrentStatus: ciStatus,
  CommandOrProcedure: 'RED pnpm --filter @fulishe/portal-web test:publicity；GREEN portal lint/typecheck/build/test:publicity；P0-027/P0-001/P0-009 Playwright；prisma validate/migrate dry-run；OpenAPI generate/check；pnpm verify 17/17',
  Actual: '9个公开路由返回200且服务端HTML可抓取；静态/SSG构建、唯一SEO元数据、JSON-LD、sitemap/robots、供应商跨应用入口、未知slug 404、公开字段白名单和响应式行为通过。',
  Environment: 'LOCAL_WINDOWS_NODE22_NEXTJS16_PLAYWRIGHT_CHROMIUM+STATIC_CONTENT',
  AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Next.js 16.2.12; Playwright Chromium',
  ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P027-portal-publicity.md|artifacts/verification/M3-P027/portal-publicity.json|artifacts/test-results/verification/pnpm-verify.json',
  Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_WORKTREE',
  FailureOrBlocker: '真实域名/DNS/TLS/ICP备案、正式客户案例/新闻素材和M5 CMS发布链路未执行',
  RetestRequired: ciRun ? 'NO_FOR_CURRENT_PR_HEAD' : 'YES',
  Notes: '公开展示名与脱敏客服来自EXT-005；匿名能力场景明确不构成客户背书；不以Mock或静态资产升级为真实域名/生产证据。',
} : null);

const publicityPages = new Set(['PAGE-025', 'PAGE-026', 'PAGE-027', 'PAGE-028', 'PAGE-029', 'PAGE-043', 'PAGE-044', 'PAGE-045', 'PAGE-046']);
const publicityPageContractNotes = new Map([
  ['PAGE-025', 'Next.js App Router；P0-001主体与P0-009无供应商店铺责任边界已实现；M3-P027公开宣传基线已实现并保持SSG/ISR；M3采购能力与P0-074仍未实现。'],
  ['PAGE-026', 'Next.js App Router；可抓取服务端HTML；唯一metadata/canonical/structured data；进入sitemap；CMS按slug触发ISR失效'],
  ['PAGE-027', 'Next.js App Router；可抓取服务端HTML；唯一metadata/canonical/structured data；进入sitemap；CMS按slug触发ISR失效'],
  ['PAGE-028', 'Next.js App Router；可抓取服务端HTML；唯一metadata/canonical/structured data；进入sitemap；CMS按slug触发ISR失效'],
  ['PAGE-029', 'Next.js App Router；可抓取服务端HTML；唯一metadata/canonical/structured data；进入sitemap；CMS按slug触发ISR失效'],
  ['PAGE-043', 'Next.js App Router；可抓取服务端HTML；唯一metadata/canonical/structured data；进入sitemap；CMS按slug触发ISR失效'],
  ['PAGE-044', 'Next.js App Router；可抓取服务端HTML；唯一metadata/canonical/structured data；进入sitemap；CMS按slug触发ISR失效'],
  ['PAGE-045', 'Next.js App Router；可抓取服务端HTML；唯一metadata/canonical/structured data；进入sitemap；CMS按slug触发ISR失效'],
  ['PAGE-046', 'Next.js App Router；可抓取服务端HTML；唯一metadata/canonical/structured data；进入sitemap；CMS按slug触发ISR失效'],
]);
await updateCsv('08-页面路由接口P0映射.csv', (row) => {
  if (!publicityPages.has(row.PageID)) return null;
  const p0Values = new Set(row.P0.split(',').filter(Boolean));
  p0Values.add('P0-027');
  return {
    ...row,
    P0: [...p0Values].join(','),
    ImplementationStatus: 'IMPLEMENTED_M3_P027_STATIC_BASELINE',
    AcceptanceStatus: `P0-027_${ciStatus};M5_CMS_NOT_EXECUTED`,
    RouteTest: 'apps/portal-web/test/publicity-seo-boundary.test.mjs|tests/e2e/p0/p0-027-portal-publicity.spec.ts',
    Notes: `${publicityPageContractNotes.get(row.PageID)}；M3-P027静态宣传基线已实现：服务端HTML、5分钟ISR、唯一metadata/canonical/Open Graph/JSON-LD、sitemap/robots、响应式及公开字段白名单。M5 PortalContent/CMS/API-075至API-078、真实域名/备案和正式素材仍NOT_EXECUTED。`,
  };
});

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? {
  ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS',
  Notes: `M3-P026由PR #88合并且main run 31856335920成功。M3-P027门户宣传自动化子行为${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；真实域名/备案、M5 CMS和production未执行。M3-P028及后续锁定。`,
} : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P027', nextAllowedTask: 'M3-P027', activeTaskCount: 1,
  lastCompletedTask: 'M3-P026', lastCompletedCommit: 'bf017ad3f06e602394b9087213877984b51789f0', lastPassedGate: 'M2-GATE',
  prohibitedUntilGate: [
    'M3-P027 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P028',
    'M5 CMS/API-075至API-078、真实域名/备案、M4及后续保持锁定',
  ],
};
status.github = {
  ...status.github,
  pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: pullRequestUrl || null,
  pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false,
  mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun
    ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt }
    : { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: ciRun
    ? { scope: 'M3_P027_PR_HEAD', status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, event: 'pull_request', completedAt: updatedAt }
    : status.github.latestCi,
  currentTaskDelivery: {
    taskId: 'M3-P027', issue: 89, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/89', branch: 'codex/m3-portal-publicity',
    baseCommit: 'bf017ad3f06e602394b9087213877984b51789f0', verifiedHead: commit,
    status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR',
    localRedTest: 'PUBLIC_ABOUT_EXPECTED_200_ACTUAL_404', localFocusedTest: 'LOCAL_PASS_PUBLICITY_NODE_AND_12_P0_E2E',
    localFullVerify: 'PASS_17_OF_17', pullRequest: pullRequest ? Number(pullRequest) : null,
    pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED',
    review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED',
    blockingExternalItem: 'REAL_DOMAIN_DNS_TLS_ICP_AND_AUTHORIZED_CUSTOMER_CONTENT', nextTaskUnlocked: false,
  },
  previousTaskDelivery: {
    taskId: 'M3-P026', pullRequest: 88, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/88',
    exactHead: '5aecd0fd8ab4a6bb4e6c4533da9403e90bb22ad0', mergeCommit: 'bf017ad3f06e602394b9087213877984b51789f0',
    mainPostMergeCiRun: 31856335920, mainPostMergeCiJob: 94941699332, status: 'CI_PASS',
  },
  note: `M3-P027公开宣传与SEO自动化子行为${ciRun ? 'Draft PR精确head CI_PASS' : 'LOCAL_PASS'}；真实域名/备案、正式客户素材及M5 CMS未执行；M3-P028锁定。`,
};
status.evidence = {
  local: 'LOCAL_PASS_M3_P027_FULL_VERIFY', ci: ciRun ? `CI_PASS_M3_P027_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED',
  staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
};
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const manifestPath = path.join(pack, 'manifest.json');
const workbookPath = path.join(pack, '17-福礼社Codex5.6执行总控工作簿.xlsx');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.workbook = {
  status: 'VERIFIED',
  sha256: createHash('sha256').update(await readFile(workbookPath)).digest('hex').toUpperCase(),
  currentTaskMirror: {
    taskId: 'M3-P027',
    status: 'NOT_EXECUTED_TOOL_MARKER_UNAVAILABLE',
    sourceLedgers: 'CSV_AND_JSON_UPDATED',
    reason: 'Spreadsheet skill mandatory artifact-operation marker is unavailable in the installed runtime; workbook bytes were not changed.',
    checkedAt: updatedAt,
  },
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P027_LEDGERS_SYNCED:${commit}:${ciStatus}\n`);
