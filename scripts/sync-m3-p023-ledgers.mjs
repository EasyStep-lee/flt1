import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = '2026-08-14T03:50:33.734Z';
const implementationCommit = 'f11bc6272c1a8b5371315cfce2f6e0de892eeeac';
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
  if (row.TaskID === 'M3-P023') return { ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS', Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/81', Branch: 'codex/m3-inventory-reservation', CommitSHA: implementationCommit, PullRequest: '', CI: 'NOT_EXECUTED', UpdatedAt: updatedAt, Notes: 'RED证明库存未变化、缺货仍建单、释放缺失及API 500；GREEN仓储5/5、API5/5、P0 E2E1/1；pnpm verify 17/17。跨供应商同事务全有或全无预扣；并发不超卖；明确失败/超时幂等释放；UNKNOWN不释放。' };
  if (row.TaskID === 'M3-P024') return { ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: '仅在M3-P023精确head PR CI成功、人工合并且合并后main CI成功后解锁；当前禁止福利卡与支付实现。' };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.P0ID === 'P0-022') return { ...row, CurrentEvidenceStatus: 'CI_PASS', LastVerifiedCommit: m3p022Merge, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-14T02:39:45Z', EvidenceLink: 'https://github.com/EasyStep-lee/flt1/pull/80|https://github.com/EasyStep-lee/flt1/actions/runs/31763921395', Notes: 'PR #80 exact-head CI通过并经授权合并；main@7cfde37 post-merge run 31763921395成功。' };
  if (row.P0ID === 'P0-023') return { ...row, CurrentEvidenceStatus: 'NOT_EXECUTED', AutomatedTestID: 'NEG-M3-P023-01|NEG-M3-P023-02|NEG-M3-P023-03|apps/api/test/unit/prisma-order-repository.test.mjs|apps/api/test/supertest/cross-supplier-order-api.test.mjs|tests/e2e/p0/p0-023-inventory-reservation.spec.ts', EvidenceLink: 'docs/contracts/m3/M3-P023-inventory-reservation.md', LastVerifiedCommit: implementationCommit, Verifier: 'CODEX', VerifiedAt: updatedAt, Notes: '库存子行为LOCAL_PASS：覆盖跨供应商原子预扣、缺货整单回滚、并发不超卖、重复订单不二次占用、明确超时幂等释放及UNKNOWN禁止释放。P0-023还要求福利卡冻结准确释放；该资金子行为尚未实现，因此P0整项保持NOT_EXECUTED。CI/staging/真机/production未执行。' };
  return null;
});

await updateCsv('10-测试证据登记.csv', (row) => {
  if (row.EvidenceID === 'EVD-022') return { ...row, CurrentStatus: 'CI_PASS', ExecutedAt: '2026-08-14T02:39:45Z', CommitSHA: m3p022Merge, CIRunURL: 'https://github.com/EasyStep-lee/flt1/actions/runs/31763921395', Freshness: 'FRESH_MAIN_POST_MERGE', FailureOrBlocker: 'staging、真机、production未执行', Notes: 'PR #80已合并；main@7cfde37 post-merge CI成功。' };
  if (row.EvidenceID === 'EVD-023') return { ...row, CurrentStatus: 'LOCAL_PASS', CommandOrProcedure: 'node --test apps/api/test/unit/prisma-order-repository.test.mjs；focused API 5/5；P0 E2E 1/1；API模块unit 69/69、contract 192/192；迁移演练；pnpm verify', Actual: 'RED: 库存未预扣、缺货仍建单、释放方法不存在、API返回500。GREEN: 原子预扣/整单回滚/并发/释放/UNKNOWN失败关闭全部通过；首次迁移演练因容器停止失败，infra恢复后重跑通过；首次全量因P0测试严格类型失败，第二次因历史游标与工作簿哈希失败，修复后第三次17/17通过。', Environment: 'LOCAL_WINDOWS_NODE22_DOCKER_MYSQL84_MOCK_EXTERNALS', ExecutedAt: updatedAt, CommitSHA: implementationCommit, ArtifactOrScreenshot: 'docs/contracts/m3/M3-P023-inventory-reservation.md|artifacts/test-results/verification/pnpm-verify.json', Executor: 'CODEX', Freshness: 'FRESH_LOCAL', FailureOrBlocker: 'CI、staging、真机、production未执行；福利卡冻结未进入本切片', RetestRequired: 'YES', Notes: 'Mock不升级为外部证据；支付UNKNOWN禁止释放；M3-P024保持锁定。' };
  return null;
});

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  if (row.ContractID !== 'API-036' && row.ContractID !== 'API-048') return null;
  return { ...row, ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCESS_DENIED|FIELD_FORBIDDEN|VALIDATION_FAILED|PRODUCT_NOT_SALEABLE|IDEMPOTENCY_KEY_REQUIRED|IDEMPOTENCY_CONFLICT|INVENTORY_INSUFFICIENT|INVENTORY_RESERVATION_CONFLICT', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED', ContractTest: 'apps/api/test/supertest/cross-supplier-order-api.test.mjs|apps/api/test/unit/prisma-order-repository.test.mjs|tests/e2e/p0/p0-023-inventory-reservation.spec.ts|packages/contracts/openapi.json', Owner: 'CODEX', Notes: `${row.ContractID === 'API-036' ? '个人' : '企业'}订单创建在同一Serializable事务预扣全部共享SKU库存；缺货/并发冲突返回稳定409且不部分写入；响应白名单不返回库存内部字段或供应价。` };
});

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? { ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS', Notes: 'M3-P022已在main@7cfde37取得post-merge CI_PASS；M3-P023库存原子预扣focused与pnpm verify 17/17均LOCAL_PASS，等待Draft PR精确head CI与人工合并；M3-P024及后续锁定。' } : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P023', nextAllowedTask: 'M3-P023', activeTaskCount: 1, lastCompletedTask: 'M3-P022', lastCompletedCommit: m3p022Merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P023合并且合并后main CI成功前不得开始M3-P024', 'M3-P024及福利卡、支付、配送切片保持锁定'] };
status.github = { ...status.github, pullRequest: null, pullRequestUrl: null, pullRequestState: 'NOT_CREATED', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null, pullRequestCi: { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null }, latestCi: { scope: 'M3_P022_MAIN_POST_MERGE', status: 'CI_PASS', runId: 31763921395, jobId: 94655792805, runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31763921395', headSha: m3p022Merge, event: 'push', completedAt: '2026-08-14T02:39:45Z', firstAttempt: 'PASS' }, currentTaskDelivery: { taskId: 'M3-P023', issue: 81, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/81', branch: 'codex/m3-inventory-reservation', baseCommit: m3p022Merge, implementationCommit, deliveryHead: null, status: 'LOCAL_PASS_PENDING_PR_CI_AND_MERGE', localFocusedTest: 'LOCAL_PASS_REPOSITORY_5_API_5_P0_E2E_1', localFullVerify: 'LOCAL_PASS_17_OF_17_2026-08-14T03:50:33.734Z', pullRequest: null, pullRequestState: 'NOT_CREATED', exactHeadCi: 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: null, nextTaskUnlocked: false }, previousTaskDelivery: { taskId: 'M3-P022', pullRequest: 80, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/80', exactHead: m3p022Head, mergeCommit: m3p022Merge, mainPostMergeCiRun: 31763921395, mainPostMergeCiJob: 94655792805, status: 'CI_PASS' }, note: 'M3-P022已在main取得CI_PASS。M3-P023库存子行为focused与pnpm verify 17/17本地通过；P0整项仍因福利卡冻结未实现保持NOT_EXECUTED；M3-P024及后续保持锁定。' };
status.evidence = { local: 'LOCAL_PASS_M3_P023', ci: 'CI_PASS_M3_P022_ONLY', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
