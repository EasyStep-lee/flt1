import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = '2026-08-14T04:27:31Z';
const implementationCommit = 'f11bc6272c1a8b5371315cfce2f6e0de892eeeac';
const codeHead = 'c2fec070cbeb47f3b556240236ec54fd7c82b2f0';
const m3p022Head = 'c0b97a7235b452f833c05d6e7aeba313d4332eb7';
const m3p022Merge = '7cfde37b1e7946ee8241fbf9d08151850ec39838';

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
  if (row.TaskID === 'M3-P022') return { ...row, Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/79', Branch: 'codex/m3-cross-supplier-orders', CommitSHA: m3p022Head, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/80', CI: 'CI_PASS', UpdatedAt: '2026-08-14T02:39:45Z', Notes: 'PR #80精确head c0b97a7经授权转Ready并合并；merge 7cfde37；post-merge main Actions run 31763921395成功。' };
  if (row.TaskID === 'M3-P023') return { ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS', Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/81', Branch: 'codex/m3-inventory-reservation', CommitSHA: codeHead, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/82', CI: 'CI_PASS', UpdatedAt: updatedAt, Notes: 'RED证明库存未变化、缺货仍建单、释放缺失及API 500；GREEN仓储5/5、API5/5、P0 E2E1/1；本地pnpm verify 17/17。PR #82首次head d5c9caf因干净CI缺dist失败；修复加载时序后code head c2fec07 run 31769514599成功。等待人工合并与post-merge main CI。' };
  if (row.TaskID === 'M3-P024') return { ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: '仅在M3-P023精确head PR CI成功、人工合并且合并后main CI成功后解锁；当前禁止福利卡与支付实现。' };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.P0ID === 'P0-022') return { ...row, CurrentEvidenceStatus: 'CI_PASS', LastVerifiedCommit: m3p022Merge, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-14T02:39:45Z', EvidenceLink: 'https://github.com/EasyStep-lee/flt1/pull/80|https://github.com/EasyStep-lee/flt1/actions/runs/31763921395', Notes: 'PR #80 exact-head CI通过并经授权合并；main@7cfde37 post-merge run 31763921395成功。' };
  if (row.P0ID === 'P0-023') return { ...row, CurrentEvidenceStatus: 'NOT_EXECUTED', AutomatedTestID: 'NEG-M3-P023-01|NEG-M3-P023-02|NEG-M3-P023-03|apps/api/test/unit/prisma-order-repository.test.mjs|apps/api/test/supertest/cross-supplier-order-api.test.mjs|tests/e2e/p0/p0-023-inventory-reservation.spec.ts', EvidenceLink: 'docs/contracts/m3/M3-P023-inventory-reservation.md|https://github.com/EasyStep-lee/flt1/actions/runs/31769514599', LastVerifiedCommit: codeHead, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: updatedAt, Notes: '库存子行为CI_PASS：覆盖跨供应商原子预扣、缺货整单回滚、并发不超卖、重复订单不二次占用、明确超时幂等释放及UNKNOWN禁止释放。P0-023还要求福利卡冻结准确释放；该资金子行为尚未实现，因此P0整项保持NOT_EXECUTED。staging/真机/production未执行。' };
  return null;
});

await updateCsv('10-测试证据登记.csv', (row) => {
  if (row.EvidenceID === 'EVD-022') return { ...row, CurrentStatus: 'CI_PASS', ExecutedAt: '2026-08-14T02:39:45Z', CommitSHA: m3p022Merge, CIRunURL: 'https://github.com/EasyStep-lee/flt1/actions/runs/31763921395', Freshness: 'FRESH_MAIN_POST_MERGE', FailureOrBlocker: 'staging、真机、production未执行', Notes: 'PR #80已合并；main@7cfde37 post-merge CI成功。' };
  if (row.EvidenceID === 'EVD-023') return { ...row, CurrentStatus: 'CI_PASS', CommandOrProcedure: 'focused仓储5/5、API5/5、P0 E2E1/1；本地pnpm verify 17/17；GitHub Actions verify', Actual: 'RED行为已保留。GREEN本地完整通过；PR #82首次head d5c9caf在干净CI typecheck因dist静态导入失败，改为P0构建后的延迟运行时导入；code head c2fec07 Actions run 31769514599/job 94672373547成功。', Environment: 'LOCAL_WINDOWS_NODE22_DOCKER_MYSQL84+GITHUB_ACTIONS_UBUNTU_NODE22_MOCK_EXTERNALS', ExecutedAt: updatedAt, CommitSHA: codeHead, CIRunURL: 'https://github.com/EasyStep-lee/flt1/actions/runs/31769514599', ArtifactOrScreenshot: 'docs/contracts/m3/M3-P023-inventory-reservation.md|artifacts/test-results/verification/pnpm-verify.json', Executor: 'CODEX+GITHUB_ACTIONS', Freshness: 'FRESH_PR_CODE_HEAD', FailureOrBlocker: '人工合并、post-merge main CI、staging、真机、production未执行；福利卡冻结未进入本切片', RetestRequired: 'YES', Notes: '最终证据提交仍须新CI；Mock不升级为外部证据；支付UNKNOWN禁止释放；M3-P024保持锁定。' };
  return null;
});

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  if (row.ContractID !== 'API-036' && row.ContractID !== 'API-048') return null;
  return { ...row, ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCESS_DENIED|FIELD_FORBIDDEN|VALIDATION_FAILED|PRODUCT_NOT_SALEABLE|IDEMPOTENCY_KEY_REQUIRED|IDEMPOTENCY_CONFLICT|INVENTORY_INSUFFICIENT|INVENTORY_RESERVATION_CONFLICT', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED', ContractTest: 'apps/api/test/supertest/cross-supplier-order-api.test.mjs|apps/api/test/unit/prisma-order-repository.test.mjs|tests/e2e/p0/p0-023-inventory-reservation.spec.ts|packages/contracts/openapi.json', Owner: 'CODEX', Notes: `${row.ContractID === 'API-036' ? '个人' : '企业'}订单创建在同一Serializable事务预扣全部共享SKU库存；缺货/并发冲突返回稳定409且不部分写入；响应白名单不返回库存内部字段或供应价。` };
});

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? { ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS', Notes: 'M3-P022已在main@7cfde37取得post-merge CI_PASS；M3-P023库存原子预扣code head c2fec07 Actions run 31769514599成功，PR #82保持Draft并等待人工合并；M3-P024及后续锁定。' } : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P023', nextAllowedTask: 'M3-P023', activeTaskCount: 1, lastCompletedTask: 'M3-P022', lastCompletedCommit: m3p022Merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P023合并且合并后main CI成功前不得开始M3-P024', 'M3-P024及福利卡、支付、配送切片保持锁定'] };
status.github = { ...status.github, pullRequest: 82, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/82', pullRequestState: 'DRAFT', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: codeHead, pullRequestCi: { status: 'CI_PASS', runId: 31769514599, jobId: 94672373547, runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31769514599', headSha: codeHead, completedAt: updatedAt }, latestCi: { scope: 'M3_P023_PR_CODE_HEAD', status: 'CI_PASS', runId: 31769514599, jobId: 94672373547, runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31769514599', headSha: codeHead, event: 'pull_request', completedAt: updatedAt, firstAttempt: 'FAIL_RUN_31768384279_DIST_IMPORT_THEN_PASS' }, currentTaskDelivery: { taskId: 'M3-P023', issue: 81, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/81', branch: 'codex/m3-inventory-reservation', baseCommit: m3p022Merge, implementationCommit, deliveryHead: codeHead, status: 'CI_PASS_PENDING_HUMAN_MERGE', localFocusedTest: 'LOCAL_PASS_REPOSITORY_5_API_5_P0_E2E_1', localFullVerify: 'LOCAL_PASS_17_OF_17_2026-08-14T04:18:55Z', pullRequest: 82, pullRequestState: 'DRAFT', exactHeadCi: 'CI_PASS_RUN_31769514599', review: 'NO_COMMENTS_OR_REVIEWS_AT_CODE_HEAD', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: null, nextTaskUnlocked: false }, previousTaskDelivery: { taskId: 'M3-P022', pullRequest: 80, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/80', exactHead: m3p022Head, mergeCommit: m3p022Merge, mainPostMergeCiRun: 31763921395, mainPostMergeCiJob: 94655792805, status: 'CI_PASS' }, note: 'M3-P022已在main取得CI_PASS。M3-P023库存子行为code head c2fec07取得CI_PASS；P0整项仍因福利卡冻结未实现保持NOT_EXECUTED；PR #82保持Draft，M3-P024及后续保持锁定。' };
status.evidence = { local: 'LOCAL_PASS_M3_P023', ci: 'CI_PASS_M3_P023_CODE_HEAD', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
