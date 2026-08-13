import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const artifactPath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const updatedAt = '2026-08-13T10:00:00Z';
const mergeCommit = '6cbe9460109c3b0ed5eb4ba307eec4c2cb5d23d9';

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
const encode = (value) => /[",\r\n]/u.test(String(value ?? '')) ? `"${String(value ?? '').replaceAll('"', '""')}"` : String(value ?? '');
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

const freeze = JSON.parse(await readFile(artifactPath, 'utf8'));
const fields = new Map(freeze.fieldContract.entities.flatMap(({ entity, fields: rows }) => rows.map((row) => [`${entity}.${row.name}`, row])));
const negatives = new Map(freeze.scope.p0Ids.map((p0Id) => [p0Id, freeze.negativeTests.filter((row) => row.p0Id === p0Id)]));

await updateCsv('05-字段字典初始版.csv', (row) => {
  if (row.Stage !== 'M3') return null;
  const frozen = fields.get(`${row.Entity}.${row.Field}`);
  if (!frozen) throw new Error(`M3_FIELD_NOT_FROZEN:${row.Entity}.${row.Field}`);
  row.SuggestedType = frozen.type;
  row.UnitOrFormat = frozen.format;
  row.Validation = frozen.validation;
  row.P0 = frozen.p0Ids.join(',');
  row.Status = 'FROZEN_M3_000';
  return row;
});
await updateCsv('06-状态机总表.csv', (row) => row.Stage === 'M3' ? { ...row, Status: 'FROZEN_M3_000' } : null);
await updateCsv('07-权限与数据可见矩阵.csv', (row) => row.Stage === 'M3' ? { ...row, Status: 'FROZEN_M3_000' } : null);
await updateCsv('08-页面路由接口P0映射.csv', (row) => {
  if (row.Stage !== 'M3') return null;
  const note = 'M3-000仅冻结页面/接口/缓存契约，业务页面仍NOT_IMPLEMENTED/NOT_EXECUTED';
  if (!row.Notes.includes(note)) row.Notes = `${row.Notes}；${note}`;
  return row;
});
await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.Stage !== 'M3') return null;
  const planned = negatives.get(row.P0ID);
  if (!planned) throw new Error(`M3_NEGATIVE_PLAN_MISSING:${row.P0ID}`);
  row.AutomatedTestID = planned.map(({ id }) => id).join('|');
  row.NegativeChecks = [...new Set(planned.map(({ category }) => category))].join('；');
  row.EvidenceLink = 'artifacts/verification/M3-000/m3-contract-freeze.json#negativeTests';
  row.Notes = 'M3-000仅冻结失败行为与测试ID；业务切片未实现，当前证据保持NOT_EXECUTED';
  return row;
});
await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  if (row.Stage !== 'M3') return null;
  row.ContractTest = 'FREEZE:tests/contracts/m3-contract-freeze.contract.test.mjs;RUNTIME:TO_BE_CREATED';
  row.Owner = 'CODEX';
  row.Notes = 'M3-000已冻结DTO白名单、错误码、权限、幂等、资金与缓存边界；OpenAPI运行时仍为PLANNED/NOT_IMPLEMENTED';
  return row;
});
await updateCsv('11-数据库迁移台账.csv', (row) => {
  if (row.Stage !== 'M3') return null;
  row.Status = 'PLANNED';
  row.EvidenceLink = 'artifacts/verification/M3-000/m3-contract-freeze.json#migrationContract';
  row.Notes = 'M3-000仅冻结迁移目的、顺序与回滚；未创建或应用任何M3迁移';
  return row;
});
await updateCsv('03-任务台账.csv', (row) => {
  if (row.TaskID === 'M2-GATE') return { ...row, Status: 'DONE', EvidenceStatus: 'CI_PASS', CommitSHA: mergeCommit, CI: 'CI_PASS', UpdatedAt: '2026-08-13T09:36:39Z', Notes: 'PR #74按授权精确head 5c00e74转Ready并合并；merge commit 6cbe946；main CI run 31686758134在该提交成功，M2-GATE PASS。' };
  if (row.TaskID === 'M3-000') return { ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS', Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/75', Branch: 'codex/m3-contract-freeze', CommitSHA: 'PENDING_LOCAL_COMMIT', PullRequest: '', CI: 'NOT_EXECUTED', UpdatedAt: '2026-08-13T10:42:11.925Z', Notes: '232字段、34状态转换、6职能、页面/API/P0与高风险失败行为已冻结；focused 4/4、合同回归87/87及pnpm verify 17/17通过；未实现M3业务、未创建迁移；等待提交、Draft PR精确head CI与人工合并。' };
  if (row.TaskID === 'M3-P020') return { ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: '仅在M3-000合并且合并后main CI成功后解锁；当前不得开始。' };
  return null;
});
await updateCsv(path.join('data', '阶段门禁.csv'), (row) => {
  if (row.Stage === 'M2') return { ...row, Status: 'GATE_PASSED', EvidenceStatus: 'CI_PASS', ApprovedBy: '@EasyStep-lee', ApprovedAt: '2026-08-13T09:28:36Z', Notes: 'PR #74精确head 5c00e74授权合并为6cbe946；main CI run 31686758134成功；M2-GATE PASS。' };
  if (row.Stage === 'M3') return { ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS', Notes: 'M3-000契约冻结本地通过；45项业务P0仍NOT_EXECUTED，M3-P020须等本切片合并后main CI成功才解锁。' };
  return null;
});
await updateCsv('10-测试证据登记.csv', (row) => {
  if (row.EvidenceID !== 'EVD-M2-GATE') return null;
  return { ...row, CurrentStatus: 'CI_PASS', Actual: 'PR #74按精确head授权合并；合并后main@6cbe946 CI run 31686758134成功。', ExecutedAt: '2026-08-13T09:36:39Z', CommitSHA: mergeCommit, CIRunURL: 'https://github.com/EasyStep-lee/flt1/actions/runs/31686758134', Freshness: 'FRESH_MAIN_POST_MERGE', FailureOrBlocker: '', RetestRequired: 'NO', Notes: 'M2-GATE在main合并提交6cbe946取得CI_PASS；M3-000已解锁。' };
});

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-000', nextAllowedTask: 'M3-000', activeTaskCount: 1, lastCompletedTask: 'M2-GATE', lastCompletedCommit: mergeCommit, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-000合并且合并后main CI成功前不得开始M3-P020', 'M3业务切片必须按任务依赖逐项解锁'], persistentRestrictions: ['M3-GATE通过前M4及以后阶段保持LOCKED/NOT_EXECUTED', '真实支付/退款', '生产部署/迁移', '直接修改或推送main'] };
status.github = { ...status.github, pullRequest: null, pullRequestUrl: null, pullRequestState: 'NOT_CREATED', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null, pullRequestCi: { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null }, latestCi: { scope: 'M2_GATE_MAIN_POST_MERGE', status: 'CI_PASS', runId: 31686758134, jobId: 94404518581, runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31686758134', headSha: mergeCommit, event: 'push', completedAt: '2026-08-13T09:36:39Z', firstAttempt: 'PASS' }, currentTaskDelivery: { taskId: 'M3-000', issue: 75, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/75', branch: 'codex/m3-contract-freeze', baseCommit: mergeCommit, implementationCommit: null, deliveryHead: null, status: 'LOCAL_PASS_PENDING_COMMIT_PR_CI_AND_MERGE', localFocusedTest: 'LOCAL_PASS_4_OF_4', localFullVerify: 'LOCAL_PASS_17_OF_17_AT_2026-08-13T10:42:11.925Z', pullRequest: null, pullRequestState: 'NOT_CREATED', exactHeadCi: 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: null, m3Unlocked: false, nextTaskUnlocked: false }, previousTaskDelivery: { taskId: 'M2-GATE', pullRequest: 74, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/74', exactHead: '5c00e74d2d0f4bd6a7368f368a01e19a4425e68e', mergeCommit, mainPostMergeCiRun: 31686758134, mainPostMergeCiJob: 94404518581, status: 'CI_PASS' }, note: 'M2-GATE已在main取得CI_PASS。M3-000仅冻结契约，45项M3业务P0仍NOT_EXECUTED。' };
status.evidence = { local: 'LOCAL_PASS', ci: 'CI_PASS_M2_GATE_ONLY', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
