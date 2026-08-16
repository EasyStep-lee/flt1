import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = process.env.M3_P051_UPDATED_AT ?? new Date().toISOString();
const commit = process.env.M3_P051_COMMIT ?? 'LOCAL_WORKTREE';
const pullRequest = process.env.M3_P051_PR ?? '';
const ciRun = process.env.M3_P051_CI_RUN ?? '';
const ciJob = process.env.M3_P051_CI_JOB ?? '';
const fullVerify = process.env.M3_P051_FULL_VERIFY ?? 'NOT_EXECUTED';
const evidenceStatus = ciRun ? 'CI_PASS' : 'LOCAL_PASS';
const prUrl = pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}` : '';
const ciUrl = ciRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${ciRun}` : '';
const p031Head = 'dd508240b42e815e6acbda3510d0e40a44a7b353';
const p031Merge = '5c0f09b37c1ddff91dd01816b09fed35464d9bb4';
const p031MainRun = '31924136232';
const p031MainJob = '95108905798';

const parseLine = (line) => {
  const values = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value); value = ''; }
    else value += character;
  }
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(value); return values;
};
const encode = (value) => /[",\r\n]/u.test(String(value ?? '')) ? `"${String(value ?? '').replaceAll('"', '""')}"` : String(value ?? '');
const updateCsv = async (relativePath, update, append = []) => {
  const filePath = path.join(pack, relativePath); const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n'; const lines = source.split(/\r?\n/u); const headers = parseLine(lines[0]);
  const output = [lines[0]]; const seen = new Set();
  for (const line of lines.slice(1)) {
    if (!line) continue; const values = parseLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const result = update({ ...row }); if (result?.__key) seen.add(result.__key);
    const finalRow = result === null ? row : result; output.push(headers.map((header) => encode(finalRow[header])).join(','));
  }
  for (const row of append.filter((candidate) => !seen.has(candidate.__key))) output.push(headers.map((header) => encode(row[header])).join(','));
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await updateCsv('03-任务台账.csv', (row) => {
  if (row.TaskID === 'M3-P031') return { ...row, Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/97', Branch: 'codex/m3-supplier-fulfillment-preparation', CommitSHA: p031Head, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/98', CI: 'CI_PASS', UpdatedAt: '2026-08-16T03:23:42Z', Notes: `PR #98精确head ${p031Head.slice(0, 7)}经授权合并；main merge ${p031Merge}，post-merge Actions run ${p031MainRun}/job ${p031MainJob}成功。M4配送、staging/device/production仍未执行。` };
  if (row.TaskID === 'M3-P051') return { ...row, Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/99', Branch: 'codex/m3-welfare-plan-batches', CommitSHA: commit, PullRequest: prUrl, CI: ciRun ? 'CI_PASS' : 'NOT_EXECUTED', UpdatedAt: updatedAt, Notes: `RED：API 3/3因404、迁移ENOENT、PAGE-008业务面板缺失。GREEN：计划/批次DRAFT创建、三类资金来源白名单、个人充值永久禁止、金额守恒、领取方式、幂等、公司职能/归属/DTO白名单和不可变历史通过；${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁待记录。'} EXT-012真实发行合规资料仍BLOCKED_EXTERNAL。${ciRun ? ` Draft PR精确head ${commit.slice(0, 7)} Actions run ${ciRun}/job ${ciJob}成功。` : ''}` };
  if (row.TaskID === 'M3-P052') return { ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: 'M3-P051 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。' };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => row.P0ID === 'P0-051' ? { ...row,
  CurrentEvidenceStatus: evidenceStatus,
  AutomatedTestID: 'apps/api/test/supertest/welfare-card-programs-api.test.mjs|tests/migrations/m3-p051-welfare-card-programs-migration.contract.test.mjs|tests/e2e/p0/p0-051-welfare-card-programs-batches.spec.ts',
  ManualCaseID: 'EXT-012_BLOCKED_EXTERNAL',
  NegativeChecks: '客户端companyId/归属字段拒绝且零写；PERSONAL_RECHARGE与第四类资金来源拒绝；错误职能拒绝；同幂等键异体冲突；金额不守恒与领取方式不匹配零写；DTO不含归属/企业客户/供应商/秘密字段',
  EvidenceLink: `docs/contracts/m3/M3-P051-welfare-card-programs-batches.md|packages/db/prisma/migrations/20260816040000_m3_welfare_card_programs_batches/migration.sql|artifacts/verification/M3-P051/welfare-card-programs-batches-page.png${prUrl ? `|${prUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
  LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
  Notes: 'M3-P051自动化技术子行为通过；计划/批次仅DRAFT。EXT-012真实计划、协议、法务财务口径、发行/激活、staging/device/production均未执行，P0正式业务验收不得越级。',
} : null);

await updateCsv('05-字段字典初始版.csv', (row) => {
  if (!['WelfareCardProgram', 'WelfareCardBatch'].includes(row.Entity)) return null;
  const updated = { ...row, Status: 'IMPLEMENTED_M3_P051' };
  if (row.Entity === 'WelfareCardProgram' && row.Field === 'issuerType') return { ...updated, SuggestedType: 'Enum<WelfareCardProgramIssuerType>', UnitOrFormat: 'COMPANY', Validation: 'server-fixed COMPANY; client field forbidden' };
  if (row.Entity === 'WelfareCardBatch' && row.Field === 'enterpriseCustomerId') return { ...updated, Required: 'CONDITIONAL', Validation: 'required for ENTERPRISE_GRANT; forbidden for COMPANY_GIFT and PHYSICAL_CARD_OR_CODE; company ownership and ACTIVE status verified' };
  if (row.Entity === 'WelfareCardBatch' && row.Field === 'claimMode') return { ...updated, UnitOrFormat: 'ENTERPRISE_ASSIGNED|COMPANY_ASSIGNED|PHYSICAL_CARD_OR_CODE', Validation: 'must match program fundingType' };
  if (row.Entity === 'WelfareCardBatch' && ['totalAmount', 'unitAmount'].includes(row.Field)) return { ...updated, UnitOrFormat: 'integer cents; >0', Validation: 'unitAmount * issueCount = totalAmount; safe integers only' };
  return updated;
});

const stateRows = [
  { __key: 'WelfareCardProgram:CREATE_DRAFT', StateMachine: 'WelfareCardProgram', Stage: 'M3', CurrentState: 'NONE', Event: 'CREATE_DRAFT', NextState: 'DRAFT', AllowedActor: 'COMPANY_WELFARE_CARD', Guard: '三类资金来源白名单；服务端归属；适用范围schema有效', SideEffect: '创建计划并追加PROGRAM_CREATED历史', Idempotency: 'companyId+Idempotency-Key', IllegalTransition: '返回409 DUPLICATE_OR_STATE_CONFLICT或422；零写入', ConcurrencyControl: '唯一键/串行事务', History: 'WelfareCardProgramHistory只追加且触发器禁止更新删除', P0: 'P0-051', Status: 'IMPLEMENTED_M3_P051' },
  { __key: 'WelfareCardBatch:CREATE_DRAFT', StateMachine: 'WelfareCardBatch', Stage: 'M3', CurrentState: 'NONE', Event: 'CREATE_DRAFT', NextState: 'DRAFT', AllowedActor: 'COMPANY_WELFARE_CARD', Guard: '计划归属当前公司；资金来源与领取方式匹配；unitAmount*issueCount=totalAmount', SideEffect: '创建批次并追加BATCH_CREATED历史', Idempotency: 'companyId+Idempotency-Key', IllegalTransition: '返回409/422；零写入', ConcurrencyControl: 'companyId+batchNo唯一键/串行事务', History: 'WelfareCardBatchHistory只追加且触发器禁止更新删除', P0: 'P0-051', Status: 'IMPLEMENTED_M3_P051' },
];
await updateCsv('06-状态机总表.csv', (row) => {
  const key = `${row.StateMachine}:${row.Event}`; const candidate = stateRows.find((entry) => entry.__key === key);
  return candidate ? { ...candidate } : null;
}, stateRows);

await updateCsv('08-页面路由接口P0映射.csv', (row) => row.PageID === 'PAGE-008' ? { ...row,
  ImplementationStatus: 'IMPLEMENTED_M3_P051_PROGRAMS_BATCHES',
  AcceptanceStatus: `P0-067_CI_PASS;P0-068_CI_PASS;P0-051_${evidenceStatus};P0-059_NOT_EXECUTED;EXT-012_BLOCKED_EXTERNAL`,
  RouteTest: 'tests/e2e/p0/p0-051-welfare-card-programs-batches.spec.ts|tests/e2e/p0/p0-067-company-workspaces.spec.ts|tests/e2e/p0/p0-068-company-workspace-completeness.spec.ts',
  Notes: '固定COMPANY_WELFARE_CARD独立页面；计划与批次列表、创建入口、加载/空态/错误和DRAFT边界已实现。账户/账本/真实发行仍未实现；EXT-012保持外部门禁。',
} : null);

await updateCsv('10-测试证据登记.csv', (row) => row.EvidenceID === 'EVD-051' ? { ...row,
  CurrentStatus: evidenceStatus,
  CommandOrProcedure: 'RED API 3/3=404、迁移ENOENT、PAGE-008面板缺失；GREEN API 3/3、迁移1/1、PAGE-008 Chromium 1/1；pnpm verify 17/17',
  Actual: '三类资金来源、个人充值永久禁止、DRAFT状态、金额守恒、领取方式、幂等冲突、职能/归属隔离、DTO白名单与不可变历史通过。',
  Environment: 'LOCAL_WINDOWS_DOCKER_MYSQL_CHROMIUM', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; MySQL 8.4.11; Playwright Chromium',
  ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P051-welfare-card-programs-batches.md|artifacts/verification/M3-P051/welfare-card-programs-batches-page.png|artifacts/test-results/verification/pnpm-verify.json',
  Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_COMMIT',
  FailureOrBlocker: 'EXT-012真实计划/协议/法务财务口径和发行批准未提供；真实发行/激活、staging/device/production未执行', RetestRequired: ciRun ? 'NO_FOR_CURRENT_PR_HEAD' : 'YES',
  Notes: '自动化技术证据不替代真实发行合规审批；本切片未创建账户、卡码、账本、支付或充值能力。',
} : null);

await updateCsv('11-数据库迁移台账.csv', (row) => row.MigrationID === 'MIG-014' ? { ...row,
  PlannedName: '20260816040000_m3_welfare_card_programs_batches',
  Objects: 'WelfareCardProgram/WelfareCardBatch/ProgramHistory/BatchHistory/WelfareCardCommand',
  Purpose: '福利卡计划与DRAFT批次；账户/卡码/账本由后续切片新增迁移',
  ForwardSteps: '创建公司归属计划、金额守恒批次、幂等命令和不可变历史；不创建个人充值、账户、卡码或账本',
  DataBackfill: 'NONE_NEW_TABLES_ONLY', Verification: 'Prisma validate；空库/升级/恢复/product drift dry-run；资金来源仅三类且无PERSONAL_RECHARGE；金额守恒/唯一键/历史不可变契约',
  Status: 'CREATED_LOCAL_REHEARSED_M3_P051', AppliedLocalAt: updatedAt, CommitSHA: commit,
  EvidenceLink: 'packages/db/prisma/migrations/20260816040000_m3_welfare_card_programs_batches/migration.sql|tests/migrations/m3-p051-welfare-card-programs-migration.contract.test.mjs',
  Notes: '仅P0-051计划与批次；后续账户/卡码/账本必须使用新增向前迁移。staging/production未应用。',
} : null);

const apiRows = [
  { __key: 'API-101', ContractID: 'API-101', Stage: 'M3', Domain: 'company-welfare-card', Method: 'GET', Path: '/v1/company/welfare-card/programs', Actor: 'COMPANY_WELFARE_CARD', RequestDTO: 'None', ResponseDTO: 'WelfareProgramPageResponseDto', CommonResponse: '显式白名单DTO', ErrorCodes: 'AUTHENTICATION_REQUIRED|WORKSPACE_FORBIDDEN', Idempotency: 'NONE', SensitiveFieldPolicy: 'COMPANY_SESSION_DERIVED; never return companyId/enterpriseCustomerId/identityId/functionalAccountId/supplier fields', MoneyRule: 'integer cents only', P0: 'P0-051', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED', ContractTest: 'apps/api/test/supertest/welfare-card-programs-api.test.mjs|packages/contracts/openapi.json', Owner: 'CODEX', Notes: '任务内契约细化：private,no-store,noindex；仅当前公司福利卡职能。' },
  { __key: 'API-102', ContractID: 'API-102', Stage: 'M3', Domain: 'company-welfare-card', Method: 'POST', Path: '/v1/company/welfare-card/programs', Actor: 'COMPANY_WELFARE_CARD', RequestDTO: 'CreateWelfareProgramRequestDto', ResponseDTO: 'WelfareProgramResponseDto', CommonResponse: '显式白名单DTO', ErrorCodes: 'FIELD_FORBIDDEN|PERSONAL_RECHARGE_FORBIDDEN|WELFARE_FUNDING_SOURCE_INVALID|IDEMPOTENCY_KEY_REQUIRED|IDEMPOTENCY_CONFLICT|DUPLICATE_OR_STATE_CONFLICT', Idempotency: 'Idempotency-Key', SensitiveFieldPolicy: 'companyId/issuer/actor从会话及服务端派生；未知字段拒绝', MoneyRule: 'N/A', P0: 'P0-051', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED', ContractTest: 'apps/api/test/supertest/welfare-card-programs-api.test.mjs|packages/contracts/openapi.json', Owner: 'CODEX', Notes: '任务内契约细化：资金来源仅三类；创建DRAFT并追加历史。' },
  { __key: 'API-103', ContractID: 'API-103', Stage: 'M3', Domain: 'company-welfare-card', Method: 'POST', Path: '/v1/company/welfare-card/programs/{programId}/batches', Actor: 'COMPANY_WELFARE_CARD', RequestDTO: 'CreateWelfareBatchRequestDto', ResponseDTO: 'WelfareBatchResponseDto', CommonResponse: '显式白名单DTO', ErrorCodes: 'WELFARE_PROGRAM_NOT_FOUND|WELFARE_BATCH_AMOUNT_MISMATCH|WELFARE_CLAIM_MODE_INVALID|IDEMPOTENCY_KEY_REQUIRED|IDEMPOTENCY_CONFLICT|DUPLICATE_OR_STATE_CONFLICT', Idempotency: 'Idempotency-Key', SensitiveFieldPolicy: 'company scope before lookup；response omits enterpriseCustomerId and all owner fields', MoneyRule: 'unitAmount*issueCount=totalAmount; safe positive integer cents', P0: 'P0-051', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED', ContractTest: 'apps/api/test/supertest/welfare-card-programs-api.test.mjs|packages/contracts/openapi.json', Owner: 'CODEX', Notes: '任务内契约细化：领取方式必须匹配计划资金来源；创建DRAFT并追加历史。' },
];
await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  const candidate = apiRows.find((entry) => entry.ContractID === row.ContractID); return candidate ? { ...candidate } : null;
}, apiRows);

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? { ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS', Notes: `M3-P031由PR #98合并且main run ${p031MainRun}成功。M3-P051福利卡计划与批次${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；EXT-012及真实发行、staging/device/production未执行；M3-P052及后续锁定。` } : null);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
for (const page of freeze.pageContract?.pages ?? []) if (page.pageId === 'PAGE-008') page.implementationStatus = 'IMPLEMENTED_M3_P051_PROGRAMS_BATCHES';
for (const test of freeze.negativeTests ?? []) if (String(test.id ?? '').startsWith('NEG-M3-P051-')) test.executionStatus = evidenceStatus;
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json'); const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P051', nextAllowedTask: 'M3-P051', activeTaskCount: 1, lastCompletedTask: 'M3-P031', lastCompletedCommit: p031Merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P051 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P052', '真实福利卡发行须EXT-012人工合规批准；M4及后续保持锁定'] };
status.github = { ...status.github, pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: prUrl || null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt } : { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  currentTaskDelivery: { taskId: 'M3-P051', issue: 99, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/99', branch: 'codex/m3-welfare-plan-batches', baseCommit: p031Merge, verifiedHead: commit, status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR', localRedTest: 'API_3_OF_3_HTTP_404;MIGRATION_ENOENT;PAGE_008_PANEL_MISSING', localFocusedTest: 'LOCAL_PASS_API_3_MIGRATION_1_PAGE_1', localFullVerify: fullVerify, pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'EXT-012_WELFARE_LEGAL_FINANCE_REAL_ISSUANCE', nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P031', pullRequest: 98, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/98', exactHead: p031Head, mergeCommit: p031Merge, mainPostMergeCiRun: Number(p031MainRun), mainPostMergeCiJob: Number(p031MainJob), status: 'CI_PASS' },
  note: `M3-P051福利卡计划与批次${ciRun ? 'Draft PR精确head CI_PASS' : 'LOCAL_PASS'}；EXT-012与真实发行、staging/device/production未执行；M3-P052锁定。` };
status.evidence = { local: fullVerify === 'PASS_17_OF_17' ? 'LOCAL_PASS_M3_P051_FULL_VERIFY' : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED', ci: ciRun ? `CI_PASS_M3_P051_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
status.counts = { ...status.counts, apiContracts: 103 };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
process.stdout.write(`M3_P051_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
