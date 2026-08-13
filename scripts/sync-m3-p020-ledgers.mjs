import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = '2026-08-13T12:24:13.028Z';
const mergedM3ContractCommit = '05c87e058d86ab05dfaa09b6bb6d4341e7f45019';

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
  if (row.TaskID === 'M3-000') return { ...row, Status: 'DONE', EvidenceStatus: 'CI_PASS', CommitSHA: mergedM3ContractCommit, CI: 'CI_PASS', UpdatedAt: '2026-08-13T12:06:09Z', Notes: 'PR #76精确head 78eeade经授权转Ready并合并；merge commit 05c87e0；main CI run 31697763759成功，M3-P020已解锁。' };
  if (row.TaskID === 'M3-P020') return { ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS', Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/77', Branch: 'codex/m3-user-home', CommitSHA: 'PENDING_LOCAL_COMMIT', PullRequest: '', CI: 'NOT_EXECUTED', UpdatedAt: updatedAt, Notes: 'RED证据为公开货架404、首页构建产物缺失及TabBar错误；最小实现后API 3/3、小程序3/3、仓储5/5、P0 E2E 1/1通过。仅实现首页与GET /v1/catalog/products；无迁移；真机、CI、staging和production未执行。' };
  if (row.TaskID === 'M3-P022') return { ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: '仅在M3-P020精确head PR CI成功、人工合并且合并后main CI成功后解锁；当前禁止订单、库存预扣与资金实现。' };
  return null;
});
await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => row.P0ID === 'P0-020' ? {
  ...row,
  CurrentEvidenceStatus: 'LOCAL_PASS',
  AutomatedTestID: 'NEG-M3-P020-01|NEG-M3-P020-02|NEG-M3-P020-03|apps/api/test/supertest/consumer-home-catalog-api.test.mjs|apps/user-miniapp/test/home-build.test.mjs|tests/e2e/p0/p0-020-user-home.spec.ts',
  EvidenceLink: 'docs/handoffs/2026-08-13-M3-P020-user-home.md',
  LastVerifiedCommit: 'PENDING_LOCAL_COMMIT',
  Verifier: 'CODEX',
  VerifiedAt: updatedAt,
  Notes: 'LOCAL_PASS仅覆盖本地行为/API/P0模拟；微信开发者工具与真机未执行，CI须等待Draft PR精确head Actions。',
} : null);
await updateCsv('08-页面路由接口P0映射.csv', (row) => row.PageID === 'PAGE-049' ? {
  ...row,
  ImplementationStatus: 'IMPLEMENTED',
  AcceptanceStatus: 'LOCAL_PASS',
  RouteTest: 'apps/user-miniapp/test/home-build.test.mjs|tests/e2e/p0/p0-020-user-home.spec.ts',
  Notes: '首页通过生成契约与miniapp-kit适配器加载公开零售货架；固定四TabBar；不强制登录/定位；不含企业入口和供应价。微信真机仍NOT_EXECUTED。',
} : null);
await updateCsv('10-测试证据登记.csv', (row) => row.EvidenceID === 'EVD-020' ? {
  ...row,
  CurrentStatus: 'LOCAL_PASS',
  CommandOrProcedure: 'pnpm exec vitest run apps/api/test/supertest/consumer-home-catalog-api.test.mjs; node --test apps/user-miniapp/test/home-build.test.mjs apps/api/test/unit/public-catalog-prisma-repository.test.mjs; pnpm exec playwright test tests/e2e/p0/p0-020-user-home.spec.ts --config playwright.p0.config.ts; pnpm verify',
  Actual: 'RED: API 404、首页构建产物缺失、首路由/TabBar错误。GREEN: API 3/3、小程序3/3、仓储5/5、P0 E2E 1/1；全量pnpm verify待最终执行。',
  Environment: 'LOCAL_WINDOWS_NODE22_MOCK_EXTERNALS',
  ExecutedAt: updatedAt,
  CommitSHA: 'PENDING_LOCAL_COMMIT',
  ArtifactOrScreenshot: 'docs/handoffs/2026-08-13-M3-P020-user-home.md',
  Executor: 'CODEX',
  Freshness: 'FRESH_LOCAL',
  FailureOrBlocker: 'CI、微信开发者工具、真机、staging、production未执行',
  RetestRequired: 'YES',
  Notes: '不以参考图或源文件存在代替验收；真机状态保持NOT_EXECUTED。',
} : null);
await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => row.ContractID === 'API-029' ? {
  ...row,
  RequestDTO: 'ConsumerCatalogQueryDto',
  ResponseDTO: 'ConsumerCatalogPageResponseDto',
  CommonResponse: '显式白名单DTO；错误={statusCode,code,message,requestId}',
  ErrorCodes: 'REGION_UNAVAILABLE|VALIDATION_FAILED|PRODUCT_NOT_SALEABLE|SENSITIVE_FIELD_LEAK',
  OpenAPIStatus: 'GENERATED',
  DTOStatus: 'IMPLEMENTED',
  ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/consumer-home-catalog-api.test.mjs|apps/api/test/unit/public-catalog-prisma-repository.test.mjs|apps/user-miniapp/test/home-build.test.mjs|tests/e2e/p0/p0-020-user-home.spec.ts|packages/contracts/openapi.json',
  Owner: 'CODEX',
  Notes: 'M3-P020实现公开个人零售首页货架；无客户端companyId/supplierId/enterpriseId作用域；未选择配送区仅返回UNSELECTED，客户端regionCode拒绝；DTO不返回企业价、供应价、库存或内部字段。',
} : null);
await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? {
  ...row,
  Status: 'IN_PROGRESS',
  EvidenceStatus: 'LOCAL_PASS',
  Notes: 'M3-000已在main@05c87e0取得CI_PASS；M3-P020首页切片LOCAL_PASS，M3其余业务P0仍NOT_EXECUTED，阶段未通过。',
} : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS',
  currentStage: 'M3',
  currentTask: 'M3-P020',
  nextAllowedTask: 'M3-P020',
  activeTaskCount: 1,
  lastCompletedTask: 'M3-000',
  lastCompletedCommit: mergedM3ContractCommit,
  lastPassedGate: 'M2-GATE',
  prohibitedUntilGate: ['M3-P020合并且合并后main CI成功前不得开始M3-P022', 'M3业务切片必须按任务依赖逐项解锁'],
};
status.github = {
  ...status.github,
  pullRequest: null,
  pullRequestUrl: null,
  pullRequestState: 'NOT_CREATED',
  pullRequestMerged: false,
  mergeCommitSha: null,
  mergedAt: null,
  lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: { scope: 'M3_000_MAIN_POST_MERGE', status: 'CI_PASS', runId: 31697763759, jobId: 94439368381, runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31697763759', headSha: mergedM3ContractCommit, event: 'push', completedAt: '2026-08-13T12:06:09Z', firstAttempt: 'PASS' },
  currentTaskDelivery: { taskId: 'M3-P020', issue: 77, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/77', branch: 'codex/m3-user-home', baseCommit: mergedM3ContractCommit, implementationCommit: null, deliveryHead: null, status: 'LOCAL_PASS_PENDING_FULL_VERIFY_COMMIT_PR_CI_AND_MERGE', localFocusedTest: 'LOCAL_PASS_API_3_MINIAPP_3_REPOSITORY_5_P0_E2E_1', localFullVerify: 'NOT_EXECUTED', pullRequest: null, pullRequestState: 'NOT_CREATED', exactHeadCi: 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: null, nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-000', pullRequest: 76, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/76', exactHead: '78eeade32d868b32d544230d218a90ef9f259c01', mergeCommit: mergedM3ContractCommit, mainPostMergeCiRun: 31697763759, mainPostMergeCiJob: 94439368381, status: 'CI_PASS' },
  note: 'M3-000已在main取得CI_PASS。M3-P020仅本地通过；M3-P022及后续保持锁定。',
};
status.evidence = { local: 'LOCAL_PASS_M3_P020', ci: 'CI_PASS_M3_000_ONLY', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
