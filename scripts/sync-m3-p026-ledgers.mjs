import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = process.env.M3_P026_UPDATED_AT ?? new Date().toISOString();
const commit = process.env.M3_P026_COMMIT ?? 'LOCAL_WORKTREE';
const pullRequest = process.env.M3_P026_PR ?? '';
const ciRun = process.env.M3_P026_CI_RUN ?? '';
const ciJob = process.env.M3_P026_CI_JOB ?? '';
const ciStatus = ciRun ? 'CI_PASS' : 'NOT_EXECUTED';
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

const updateCsv = async (relativePath, update, append = [], keyFields = []) => {
  const filePath = path.join(pack, relativePath);
  const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  const headers = parseLine(lines[0]);
  const output = [lines[0]];
  const keys = new Set();
  const rowKey = (row) => keyFields.length > 0
    ? keyFields.map((field) => row[field] ?? '').join('\u0000')
    : String(row[headers[0]] ?? '');
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const values = parseLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const result = update({ ...row });
    const finalRow = result === null ? row : result;
    keys.add(rowKey(finalRow));
    output.push(result === null ? line : headers.map((header) => encode(result[header])).join(','));
  }
  for (const row of append) {
    if (keys.has(rowKey(row))) continue;
    output.push(headers.map((header) => encode(row[header])).join(','));
    keys.add(rowKey(row));
  }
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await updateCsv('03-任务台账.csv', (row) => {
  if (row.TaskID === 'M3-P025') return {
    ...row,
    Status: 'DONE', EvidenceStatus: 'CI_PASS', CommitSHA: 'cd4b9ea32499793ea947bb646778db307a9c4acd', CI: 'CI_PASS',
    UpdatedAt: '2026-08-14T11:24:04Z',
    Notes: 'PR #86精确head cd4b9ea经授权转Ready并合并；merge c4ab850；post-merge main Actions run 31796060635/job 94753324144成功。自动化子行为在main完成；福利卡真实发行记账与真实微信/银行/staging仍未执行，P0-025整体保持NOT_EXECUTED。',
  };
  if (row.TaskID === 'M3-P026') return {
    ...row,
    Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/87', Branch: 'codex/m3-structured-refund',
    CommitSHA: commit, PullRequest: pullRequestUrl, CI: ciStatus, UpdatedAt: updatedAt,
    Notes: `RED：API-043实际404，3/3失败。GREEN：退款API、原支付分配、并发认领、未知结果恢复、迁移/OpenAPI、公司订单客服页面与P0 E2E通过；pnpm verify通过。福利卡真实账本、真实微信退款、staging/真机/production未执行，P0-026整体保持NOT_EXECUTED。${ciRun ? ` Draft PR精确head ${commit.slice(0, 7)} Actions run ${ciRun}/job ${ciJob}成功。` : ' 等待Draft PR与CI。'}`,
  };
  if (row.TaskID === 'M3-P027') return {
    ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P026 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.P0ID === 'P0-025') return {
    ...row, CurrentEvidenceStatus: 'NOT_EXECUTED', LastVerifiedCommit: 'c4ab850ef7d6f6693376097350e2d0ddc27c6755',
    Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-14T11:34:03Z',
    EvidenceLink: 'docs/contracts/m3/M3-P025-company-unified-checkout.md|https://github.com/EasyStep-lee/flt1/actions/runs/31796060635',
    Notes: 'PR #86已合并且main post-merge CI成功；自动化子行为为CI_PASS。福利卡真实发行记账、真实微信/银行与staging未执行，P0整项保持NOT_EXECUTED。',
  };
  if (row.P0ID === 'P0-026') return {
    ...row,
    CurrentEvidenceStatus: 'NOT_EXECUTED',
    AutomatedTestID: 'apps/api/test/unit/refund-allocation-policy.test.mjs|apps/api/test/unit/refund-workspace-policy.test.mjs|apps/api/test/supertest/original-structure-refund-api.test.mjs|tests/migrations/m3-p026-original-structure-refund-migration.contract.test.mjs|tests/openapi/m3-p026-original-structure-refund.contract.test.mjs|tests/e2e/p0/p0-026-original-structure-refund.spec.ts|tests/e2e/p0/p0-026-refund-company-page.spec.ts',
    EvidenceLink: `docs/contracts/m3/M3-P026-original-structure-refund.md|packages/db/prisma/migrations/20260814123000_m3_original_structure_refund/migration.sql|packages/contracts/openapi.json${pullRequestUrl ? `|${pullRequestUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
    LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
    Notes: '自动化子行为LOCAL_PASS：福利卡/微信按原支付分配、累计不超额、原账户/原交易目标及微信原交易总额、同自然人禁自退、幂等/并发、前置失败关闭、未知结果不重发、资金/库存/对账影响追加。真实福利卡账本、真实微信退款及required STAGING_PASS未执行，P0整项保持NOT_EXECUTED。',
  };
  return null;
});

await updateCsv('10-测试证据登记.csv', (row) => row.EvidenceID === 'EVD-026' ? {
  ...row,
  CurrentStatus: ciRun ? 'CI_PASS' : 'LOCAL_PASS',
  CommandOrProcedure: 'RED refund Supertest 3/3预期201/401/202实际404；GREEN focused unit/API/migration/OpenAPI/P0 E2E；prisma validate/migrate dry-run；pnpm verify 17/17',
  Actual: '服务端读取已批准退款快照和原OrderPaymentAllocation，按累计比例确定福利卡/微信金额；同自然人禁自退；通道乐观认领防并发重复；UNKNOWN不重发；追加FINANCIAL/INVENTORY/RECONCILIATION影响。',
  Environment: 'LOCAL_WINDOWS_NODE22_DOCKER_MYSQL84+DETERMINISTIC_WELFARE_AND_WECHAT_REFUND_ADAPTERS',
  ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P026-original-structure-refund.md|artifacts/test-results/verification/pnpm-verify.json',
  Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_WORKTREE',
  FailureOrBlocker: '真实福利卡账本适配器、真实微信退款、staging、真机、production未执行；M5售后审批工作流不在本切片',
  RetestRequired: 'YES',
  Notes: 'Mock仅证明自动化契约，不能升级为真实资金或STAGING_PASS；P0-026整体保持NOT_EXECUTED。',
} : null);

const migrationRow = {
  MigrationID: 'MIG-013', Stage: 'M3', PlannedName: '20260814123000_m3_original_structure_refund', DependsOn: 'MIG-012B',
  Objects: 'RefundAuthorization/RefundTransaction/RefundTransactionEvent/RefundImpactRecord',
  Purpose: '消费已批准退款快照，按原福利卡/微信支付结构退款并追加资金、库存、对账影响',
  ForwardSteps: '新增退款授权/交易/事件/影响表；金额/check/唯一键/FK；事件和影响记录不可变触发器；不创建M5售后审批流程',
  BackwardOrRecovery: '未发布时回退提交并重建开发库；已发布后不回改迁移，应用版本回退并使用向前修复迁移',
  DataBackfill: '无存量回填；只消费后续由M5或受控导入创建的APPROVED退款授权快照',
  Verification: 'prisma validate；空库/升级/恢复dry-run；schema drift；金额/check/唯一键/FK/不可变触发器；并发与幂等测试',
  BackupRequired: 'YES', Status: 'LOCAL_PASS', AppliedLocalAt: updatedAt, AppliedStagingAt: '', AppliedProductionAt: '', CommitSHA: commit,
  EvidenceLink: 'packages/db/prisma/migrations/20260814123000_m3_original_structure_refund/migration.sql|tests/migrations/m3-p026-original-structure-refund-migration.contract.test.mjs',
  Notes: 'MySQL演练empty=2/upgrade=2/restore=2/product=28/cleanup=PASS；staging/production未应用。',
};
await updateCsv('11-数据库迁移台账.csv', (row) => row.MigrationID === migrationRow.MigrationID ? { ...row, ...migrationRow } : null, [migrationRow]);

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => row.ContractID === 'API-043' ? {
  ...row,
  RequestDTO: 'RefundCreateRequestDto', ResponseDTO: 'RefundResponseDto',
  CommonResponse: '显式白名单DTO；错误={statusCode,code,message,requestId}',
  ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCESS_DENIED|FIELD_FORBIDDEN|VALIDATION_FAILED|IDEMPOTENCY_KEY_REQUIRED|REFUND_AUTHORIZATION_NOT_FOUND|REFUND_ALLOCATION_INVALID|REFUND_DUPLICATE|REFUND_OVERPAID|REFUND_STATE_CONFLICT|REFUND_CHANNEL_REJECTED|SAME_NATURAL_PERSON_REVIEW_FORBIDDEN',
  OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/original-structure-refund-api.test.mjs|tests/openapi/m3-p026-original-structure-refund.contract.test.mjs|tests/e2e/p0/p0-026-original-structure-refund.spec.ts|packages/contracts/openapi.json',
  Notes: '请求仅authorizationVersion/reason；退款金额、原福利卡账户与原微信交易从服务端快照派生。相同自然人禁止发起；UNKNOWN不重复外呼；private/no-store、noindex。',
} : null);

const fieldSpec = {
  RefundAuthorization: [
    ['id','String(36)','UUID','INTERNAL'], ['companyId','String(36)','session scope UUID','SENSITIVE'], ['orderId','String(36)','UUID','INTERNAL'], ['orderItemId','String(36)','UUID','INTERNAL'],
    ['approvedAmount','Int','integer cents; >0','FINANCIAL'], ['approvedByIdentityType','String(64)','natural-person identity type','SENSITIVE'], ['approvedByIdentityId','String(36)','natural-person identity id','SENSITIVE'],
    ['status','Enum<RefundAuthorizationStatus>','APPROVED|CONSUMED|REVOKED','FINANCIAL'], ['version','Int','integer; >0','INTERNAL'], ['approvedAt','DateTime(3)','UTC','INTERNAL'], ['consumedAt','DateTime(3)?','UTC nullable','INTERNAL'], ['createdAt','DateTime(3)','UTC','INTERNAL'],
  ],
  RefundTransaction: [
    ['afterSaleId','String(36)','approved authorization UUID','INTERNAL'], ['requestHash','String(64)','SHA-256 hex','INTERNAL'], ['welfareChannelStatus','Enum<RefundChannelStatus>','NOT_REQUIRED|PENDING|PROCESSING|SUCCEEDED|FAILED|UNKNOWN','FINANCIAL'], ['wechatChannelStatus','Enum<RefundChannelStatus>','NOT_REQUIRED|PENDING|PROCESSING|SUCCEEDED|FAILED|UNKNOWN','FINANCIAL'], ['version','Int','integer; >=0','INTERNAL'], ['createdAt','DateTime(3)','UTC','INTERNAL'], ['updatedAt','DateTime(3)','UTC','INTERNAL'],
  ],
  RefundTransactionEvent: [
    ['id','String(36)','UUID','INTERNAL'], ['refundTransactionId','String(36)','UUID','INTERNAL'], ['fromStatus','Enum<RefundTransactionStatus>?','nullable state','INTERNAL'], ['toStatus','Enum<RefundTransactionStatus>','state','INTERNAL'], ['event','String(64)','domain event','INTERNAL'], ['version','Int','integer; >=1','INTERNAL'], ['snapshot','Json','immutable event snapshot','SENSITIVE'], ['actorType','String(64)','actor type','SENSITIVE'], ['actorId','String(36)','actor id','SENSITIVE'], ['requestId','String(128)','request trace id','SENSITIVE'], ['occurredAt','DateTime(3)','UTC','INTERNAL'],
  ],
  RefundImpactRecord: [
    ['id','String(36)','UUID','INTERNAL'], ['refundTransactionId','String(36)','UUID','INTERNAL'], ['impactType','Enum<RefundImpactType>','FINANCIAL|INVENTORY|RECONCILIATION','FINANCIAL'], ['status','Enum<RefundImpactStatus>','PENDING|APPLIED','FINANCIAL'], ['payload','Json','append-only impact snapshot','SENSITIVE'], ['createdAt','DateTime(3)','UTC','INTERNAL'], ['appliedAt','DateTime(3)?','UTC nullable','INTERNAL'],
  ],
};
const fieldRows = Object.entries(fieldSpec).flatMap(([entity, fields]) => fields.map(([field, type, format, sensitivity], index) => ({
  Entity: entity, Field: field, RawDefinition: field, Position: String(index + 1), SuggestedType: type, Required: format.includes('nullable') ? 'NO' : 'YES',
  UnitOrFormat: format, Sensitivity: sensitivity, Visibility: '公司订单客服/财务/审计按独立职能和company scope；对应买家仅经后续白名单查询',
  ForbiddenExposure: '供应商/其他买家/公开DTO不可见；不得返回供应价或内部支付配置',
  Validation: 'verified session scope; integer cents; DTO whitelist; optimistic version; idempotency',
  HistoryRule: entity.endsWith('Event') || entity.endsWith('Record') ? '只追加；数据库触发器禁止UPDATE/DELETE' : '版本化/追加事件；禁止覆盖历史快照',
  Stage: 'M3', P0: 'P0-026,P0-058,P0-096', Source: '综合方案§9退款与资金守恒', Status: 'IMPLEMENTED_M3_P026',
})));
await updateCsv('05-字段字典初始版.csv', () => null, fieldRows, ['Entity', 'Field']);

await updateCsv('06-状态机总表.csv', (row) => {
  if (row.StateMachine !== 'RefundTransaction') return null;
  if (row.Event === 'FAIL_CONFIRMED') return { ...row, Status: 'FROZEN_M3_000' };
  return { ...row, Status: 'IMPLEMENTED_M3_P026' };
});

await updateCsv('07-权限与数据可见矩阵.csv', (row) => row.RoleCode === 'COMPANY_ORDER_SERVICE' ? {
  ...row,
  ReadScope: '个人/企业订单、已批准退款授权与售后必要字段', WriteScope: '消费已批准退款授权、发起原结构退款、备注与责任协同',
  ApprovalAuthority: '仅发起已由另一自然人批准的退款；无自审权限',
  ForbiddenActions: '不得登记付款、改供应价、提交退款金额/目标账户、越权解密或消费本人批准的退款授权',
  SecondVerification: '退款批准人与发起人按identityType+identityId隔离',
  Stage: 'M3,M5', P0: 'P0-026,P0-038,P0-045,P0-067,P0-068,P0-096', Status: 'IMPLEMENTED_M3_P026_PARTIAL',
} : null);

await updateCsv('08-页面路由接口P0映射.csv', (row) => row.PageID === 'PAGE-007' ? {
  ...row,
  P0: 'P0-026,P0-038,P0-067,P0-068', APIGroup: 'company-admin;API-043',
  ImplementationStatus: 'IMPLEMENTED_M3_P026_PARTIAL', AcceptanceStatus: 'P0-026_LOCAL_PASS;P0-067_CI_PASS;P0-068_CI_PASS;P0-038_NOT_EXECUTED',
  RouteTest: 'tests/e2e/p0/p0-026-refund-company-page.spec.ts;tests/e2e/p0/p0-067-company-workspaces.spec.ts;tests/e2e/p0/p0-068-company-workspace-completeness.spec.ts',
  Notes: 'M3仅实现消费已批准授权的退款发起表单及duplicate/unknown状态；金额/账户/支付交易不可输入。M5售后受理、责任归因和审批工作流仍DEFERRED。',
} : null);

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? {
  ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS',
  Notes: `M3-P025由PR #86合并且main run 31796060635成功。M3-P026原支付结构退款自动化子行为${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；真实福利卡账本、微信退款与staging未执行，P0-026整体NOT_EXECUTED。M3-P027及后续锁定。`,
} : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P026', nextAllowedTask: 'M3-P026', activeTaskCount: 1,
  lastCompletedTask: 'M3-P025', lastCompletedCommit: 'c4ab850ef7d6f6693376097350e2d0ddc27c6755', lastPassedGate: 'M2-GATE',
  prohibitedUntilGate: [
    'M3-P026 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P027',
    '真实福利卡账本、真实微信退款、staging/真机/production证据不得伪造；M4及后续保持锁定',
  ],
};
status.github = {
  ...status.github,
  pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: pullRequestUrl || null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false,
  mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt } : { status: 'NOT_EXECUTED' },
  latestCi: ciRun ? { scope: 'M3_P026_PR_HEAD', status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, event: 'pull_request', completedAt: updatedAt } : { scope: 'M3_P025_POST_MERGE_MAIN', status: 'CI_PASS', runId: 31796060635, jobId: 94753324144, runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31796060635', headSha: 'c4ab850ef7d6f6693376097350e2d0ddc27c6755', event: 'push', completedAt: '2026-08-14T11:34:03Z' },
  currentTaskDelivery: {
    taskId: 'M3-P026', issue: 87, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/87', branch: 'codex/m3-structured-refund',
    baseCommit: 'c4ab850ef7d6f6693376097350e2d0ddc27c6755', verifiedHead: commit, status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR',
    localRedTest: 'API_043_EXPECTED_201_401_202_ACTUAL_404_3_OF_3', localFocusedTest: 'LOCAL_PASS_UNIT_API_MIGRATION_OPENAPI_P0_E2E',
    localFullVerify: 'PASS_17_OF_17', pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED',
    exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED',
    blockingExternalItem: 'REAL_WELFARE_LEDGER_WECHAT_REFUND_AND_STAGING_EVIDENCE', nextTaskUnlocked: false,
  },
  previousTaskDelivery: {
    taskId: 'M3-P025', pullRequest: 86, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/86', exactHead: 'cd4b9ea32499793ea947bb646778db307a9c4acd',
    mergeCommit: 'c4ab850ef7d6f6693376097350e2d0ddc27c6755', mainPostMergeCiRun: 31796060635, mainPostMergeCiJob: 94753324144, status: 'CI_PASS',
  },
  note: `M3-P026原支付结构退款自动化子行为${ciRun ? 'Draft PR精确head CI_PASS' : 'LOCAL_PASS'}；真实福利卡账本、真实微信退款及STAGING_PASS未执行，P0-026整体NOT_EXECUTED；M3-P027锁定。`,
};
status.evidence = { local: 'LOCAL_PASS_M3_P026_FULL_VERIFY', ci: ciRun ? `CI_PASS_M3_P026_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };

const countCsvRows = async (relativePath) => (await readFile(path.join(pack, relativePath), 'utf8')).split(/\r?\n/u).filter(Boolean).length - 1;
status.counts = {
  ...status.counts,
  fields: await countCsvRows('05-字段字典初始版.csv'),
  stateTransitions: await countCsvRows('06-状态机总表.csv'),
  migrations: await countCsvRows('11-数据库迁移台账.csv'),
};
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const manifestPath = path.join(pack, 'manifest.json');
const workbookPath = path.join(pack, '17-福礼社Codex5.6执行总控工作簿.xlsx');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.counts = {
  ...manifest.counts,
  fields: await countCsvRows('05-字段字典初始版.csv'),
  stateTransitions: await countCsvRows('06-状态机总表.csv'),
  migrations: await countCsvRows('11-数据库迁移台账.csv'),
};
manifest.workbook = {
  status: 'VERIFIED',
  sha256: createHash('sha256').update(await readFile(workbookPath)).digest('hex').toUpperCase(),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P026_LEDGERS_SYNCED:${commit}:${ciStatus}\n`);
