import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = process.env.M3_P030_UPDATED_AT ?? new Date().toISOString();
const commit = process.env.M3_P030_COMMIT ?? 'LOCAL_WORKTREE';
const pullRequest = process.env.M3_P030_PR ?? '';
const ciRun = process.env.M3_P030_CI_RUN ?? '';
const ciJob = process.env.M3_P030_CI_JOB ?? '';
const fullVerify = process.env.M3_P030_FULL_VERIFY ?? 'NOT_EXECUTED';
const evidenceStatus = ciRun ? 'CI_PASS' : 'LOCAL_PASS';
const prUrl = pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}` : '';
const ciUrl = ciRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${ciRun}` : '';

const p029Head = '393a7e94b20f3ffe8f71ce3fbe71f717c11f80be';
const p029Merge = '4e164abe7bc343fdc977998982649e124caf6d90';
const p029MainRun = '31882132719';
const p029MainJob = '95006093704';

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
  if (row.TaskID === 'M3-P029') return {
    ...row,
    Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/93',
    Branch: 'codex/m3-enterprise-procurement', CommitSHA: p029Head,
    PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/94', CI: 'CI_PASS',
    UpdatedAt: '2026-08-15T11:39:39Z',
    Notes: `PR #94精确head ${p029Head.slice(0, 7)}经授权合并；main merge ${p029Merge}，post-merge Actions run ${p029MainRun}/job ${p029MainJob}成功。P0-029完整配送、收货、售后、发票和真实资金仍NOT_EXECUTED；M3-P030已解锁。`,
  };
  if (row.TaskID === 'M3-P030') return {
    ...row,
    Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/95',
    Branch: 'codex/m3-community-procurement-boundary', CommitSHA: commit,
    PullRequest: prUrl, CI: ciRun ? 'CI_PASS' : 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `RED：生产构建后GET /enterprise-procurement实际404；移动导航首页坐标-72.5px。GREEN：PAGE-030静态ISR入口、metadata/canonical/JSON-LD、注册/登录/货架入口、无活动模型、私有缓存隔离、桌面/移动响应式通过；${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁待记录。'}${ciRun ? ` Draft PR精确head ${commit.slice(0, 7)} Actions run ${ciRun}/job ${ciJob}成功。` : ' 等待Draft PR与CI。'}`,
  };
  if (row.TaskID === 'M3-P031') return {
    ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P030 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.P0ID === 'P0-029') return {
    ...row,
    CurrentEvidenceStatus: 'NOT_EXECUTED',
    EvidenceLink: `PARTIAL:docs/contracts/m3/M3-P029-unified-enterprise-procurement.md|artifacts/verification/M3-P029/unified-enterprise-procurement.json|https://github.com/EasyStep-lee/flt1/pull/94|https://github.com/EasyStep-lee/flt1/actions/runs/${p029MainRun}`,
    LastVerifiedCommit: p029Merge, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-15T11:39:39Z',
    Notes: 'M3-P029企业主订单与付款路由技术切片已合并且main CI通过；完整门户页面、企业配送、收货、售后、发票及真实资金仍未执行，故P0-029整体保持NOT_EXECUTED。',
  };
  if (row.P0ID === 'P0-030') return {
    ...row,
    CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'apps/portal-web/test/community-procurement-boundary.test.mjs|tests/contracts/m3-p030-community-procurement-boundary.contract.test.mjs|tests/e2e/p0/p0-030-community-procurement-boundary.spec.ts|tests/e2e/p0/p0-027-portal-publicity.spec.ts',
    ManualCaseID: 'N/A',
    NegativeChecks: '公开入口不含指定社区、活动时段、成团/团长交互；Prisma/OpenAPI无活动或企业内部工作流字段；供应价与内部经营字段不返回；私有企业路由不进入sitemap且noindex/private/no-store',
    EvidenceLink: `docs/contracts/m3/M3-P030-community-procurement-boundary.md|artifacts/verification/M3-P030/community-procurement-boundary.json|artifacts/verification/M3-P030/community-procurement-desktop.png|artifacts/verification/M3-P030/community-procurement-mobile.png${prUrl ? `|${prUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
    LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
    Notes: '公开入口为5分钟ISR静态HTML；认证后交易能力继续使用动态noindex/private/no-store路由。本切片无迁移、业务API或活动模型；staging/production未执行。',
  };
  return null;
});

await updateCsv('08-页面路由接口P0映射.csv', (row) => row.PageID === 'PAGE-030' ? {
  ...row,
  ImplementationStatus: 'IMPLEMENTED_M3_P030_PUBLIC_ISR_ENTRY',
  AcceptanceStatus: `P0-030_${evidenceStatus};STAGING_PRODUCTION_NOT_EXECUTED`,
  RouteTest: 'apps/portal-web/test/community-procurement-boundary.test.mjs|tests/e2e/p0/p0-030-community-procurement-boundary.spec.ts',
  Notes: 'Next.js App Router静态生成并5分钟ISR；服务端HTML、metadata/canonical/JSON-LD、sitemap、桌面/移动响应式、企业注册/登录/货架入口和活动模型禁止边界已实现。交易页保持noindex/private/no-store；CMS按slug失效由M5继续。',
} : null);

await updateCsv('10-测试证据登记.csv', (row) => {
  if (row.EvidenceID === 'EVD-029') return {
    ...row,
    CurrentStatus: 'CI_PASS', ExecutedAt: '2026-08-15T11:39:39Z', CommitSHA: p029Head,
    CIRunURL: `https://github.com/EasyStep-lee/flt1/actions/runs/${p029MainRun}`,
    Executor: 'GITHUB_ACTIONS+CODEX', Freshness: 'MERGED_HEAD_AND_MAIN_POST_MERGE',
    RetestRequired: 'NO_FOR_MERGED_TECHNICAL_SLICE',
    Notes: 'PR #94与post-merge main CI通过；完整P0-029仍受配送、收货、售后、发票和真实资金缺口约束。',
  };
  if (row.EvidenceID === 'EVD-030') return {
    ...row,
    CurrentStatus: evidenceStatus,
    CommandOrProcedure: 'RED生产构建+HTTP路由1/1；RED移动导航坐标；GREEN portal lint/typecheck/build/test 4/4、P0 focused 12/12、活动字段契约1/1、pnpm verify 17/17',
    Actual: 'PAGE-030返回静态ISR服务端HTML；固定普通企业采购边界、SEO、受控入口、供应价防泄露、私有路由缓存隔离及桌面/移动响应式通过；无迁移/API。',
    Environment: 'LOCAL_WINDOWS_NODE22_NEXTJS16_PLAYWRIGHT_CHROMIUM',
    AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Next.js 16.2.12; Playwright Chromium',
    ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl,
    ArtifactOrScreenshot: 'docs/contracts/m3/M3-P030-community-procurement-boundary.md|artifacts/verification/M3-P030/community-procurement-boundary.json|artifacts/verification/M3-P030/community-procurement-desktop.png|artifacts/verification/M3-P030/community-procurement-mobile.png|artifacts/test-results/verification/pnpm-verify.json',
    Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_COMMIT',
    FailureOrBlocker: '真实域名/DNS/TLS/ICP备案、staging/production与M5 CMS发布链路未执行',
    RetestRequired: ciRun ? 'NO_FOR_CURRENT_PR_HEAD' : 'YES',
    Notes: '页面技术证据不替代真实域名、备案、CMS或生产验收；M3-P031保持锁定。',
  };
  return null;
});

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? {
  ...row,
  Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS',
  Notes: `M3-P029由PR #94合并且main run ${p029MainRun}成功。M3-P030社区集采边界${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；真实域名/备案、M5 CMS、staging/production未执行。M3-P031及后续锁定。`,
} : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P030', nextAllowedTask: 'M3-P030', activeTaskCount: 1,
  lastCompletedTask: 'M3-P029', lastCompletedCommit: p029Merge, lastPassedGate: 'M2-GATE',
  prohibitedUntilGate: [
    'M3-P030 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P031',
    'M5 CMS、真实域名/备案、M4及后续保持锁定',
  ],
};
status.github = {
  ...status.github,
  pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: prUrl || null,
  pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false,
  mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun
    ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt }
    : { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  currentTaskDelivery: {
    taskId: 'M3-P030', issue: 95, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/95',
    branch: 'codex/m3-community-procurement-boundary', baseCommit: p029Merge, verifiedHead: commit,
    status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR',
    localRedTest: 'PUBLIC_ENTRY_EXPECTED_200_ACTUAL_404;MOBILE_HOME_LINK_X_NEGATIVE_72_5',
    localFocusedTest: 'LOCAL_PASS_PORTAL_4_P0_FOCUSED_12_CONTRACT_1', localFullVerify: fullVerify,
    pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED',
    exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED',
    review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED',
    blockingExternalItem: 'REAL_DOMAIN_DNS_TLS_ICP_M5_CMS_STAGING_PRODUCTION', nextTaskUnlocked: false,
  },
  previousTaskDelivery: {
    taskId: 'M3-P029', pullRequest: 94, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/94',
    exactHead: p029Head, mergeCommit: p029Merge, mainPostMergeCiRun: Number(p029MainRun),
    mainPostMergeCiJob: Number(p029MainJob), status: 'CI_PASS',
  },
  note: `M3-P030社区集采边界${ciRun ? 'Draft PR精确head CI_PASS' : 'LOCAL_PASS'}；真实域名/备案、M5 CMS、staging/production未执行；M3-P031锁定。`,
};
status.evidence = {
  local: fullVerify === 'PASS_17_OF_17' ? 'LOCAL_PASS_M3_P030_FULL_VERIFY' : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED',
  ci: ciRun ? `CI_PASS_M3_P030_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED',
  staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
};
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P030_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
