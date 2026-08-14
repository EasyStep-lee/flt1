import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = '2026-08-14T07:25:12Z';
const p023Head = '1d16a0a9399ac095ca3d524f1c6f1a154aa142f7';
const p023Merge = 'fa8439fe9926f4bd8ee690f922e2531aa2eff57b';
const implementationCommit = 'de2fc200998956b7dd6f8e9800fa8bef67c6cccc';
const verifiedHead = '28718604e5f36b77845856f3cbb354af34b9971e';

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

const updateCsv = async (relativePath, update, append = []) => {
  const filePath = path.join(pack, relativePath);
  const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  const headers = parseLine(lines[0]);
  const output = [lines[0]];
  const existingFirstValues = new Set();
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const values = parseLine(line);
    existingFirstValues.add(values[0] ?? '');
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const result = update({ ...row });
    output.push(result === null ? line : headers.map((header) => encode(result[header])).join(','));
  }
  for (const row of append) {
    if (!existingFirstValues.has(String(row[headers[0]] ?? ''))) {
      output.push(headers.map((header) => encode(row[header])).join(','));
    }
  }
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await updateCsv('03-任务台账.csv', (row) => {
  if (row.TaskID === 'M3-P023') return {
    ...row,
    Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/81',
    Branch: 'codex/m3-inventory-reservation', CommitSHA: p023Head,
    PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/82', CI: 'CI_PASS',
    UpdatedAt: '2026-08-14T05:18:54Z',
    Notes: 'PR #82精确head 1d16a0a经授权转Ready并合并；merge fa8439f；post-merge main Actions run 31772198473/job 94680259802成功。库存子切片在main完成；P0-023整体仍等待福利卡冻结/释放。',
  };
  if (row.TaskID === 'M3-P024') return {
    ...row,
    Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/83',
    Branch: 'codex/m3-payment-idempotency', CommitSHA: verifiedHead, PullRequest: '', CI: 'NOT_EXECUTED',
    UpdatedAt: updatedAt,
    Notes: 'RED：API构建通过但预支付端点404。GREEN：Prisma仓储3/3、API4/4、迁移1/1、P0 E2E1/1；MySQL空库/升级/恢复dry-run通过；OpenAPI确定生成；pnpm verify 17/17退出码0。仅纯微信订单；福利卡账本、真实微信、staging/真机/production保持NOT_EXECUTED。',
  };
  if (row.TaskID === 'M3-P025') return {
    ...row,
    Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P024 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.P0ID === 'P0-023') return {
    ...row,
    CurrentEvidenceStatus: 'NOT_EXECUTED', LastVerifiedCommit: p023Merge,
    Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-14T05:18:54Z',
    EvidenceLink: 'docs/contracts/m3/M3-P023-inventory-reservation.md|https://github.com/EasyStep-lee/flt1/actions/runs/31772198473',
    Notes: '库存原子预扣/确认准备子行为已在main取得CI_PASS；福利卡冻结准确释放尚未实现，P0整项保持NOT_EXECUTED。',
  };
  if (row.P0ID === 'P0-024') return {
    ...row,
    CurrentEvidenceStatus: 'NOT_EXECUTED',
    AutomatedTestID: 'NEG-M3-P024-01|NEG-M3-P024-02|NEG-M3-P024-03|apps/api/test/unit/prisma-payment-repository.test.mjs|apps/api/test/supertest/payment-idempotency-api.test.mjs|tests/e2e/p0/p0-024-payment-idempotency.spec.ts',
    EvidenceLink: 'docs/contracts/m3/M3-P024-payment-idempotency.md|packages/db/prisma/migrations/20260814053000_m3_payment_idempotency/migration.sql|packages/contracts/openapi.json',
    LastVerifiedCommit: verifiedHead, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: '本地Mock子行为LOCAL_PASS：纯微信订单重复/并发回调只确认一次订单、共享库存、履约和outbox，且不创建配送对象。福利卡扣减维度尚无账本，真实微信/staging/真机/production未执行，RequiredEvidenceLevel为STAGING_PASS，因此P0整项保持NOT_EXECUTED。',
  };
  return null;
});

await updateCsv('10-测试证据登记.csv', (row) => {
  if (row.EvidenceID === 'EVD-023') return {
    ...row,
    CurrentStatus: 'CI_PASS', ExecutedAt: '2026-08-14T05:18:54Z', CommitSHA: p023Merge,
    CIRunURL: 'https://github.com/EasyStep-lee/flt1/actions/runs/31772198473', Freshness: 'FRESH_MAIN_POST_MERGE',
    FailureOrBlocker: '福利卡冻结/释放、staging、真机、production未执行',
    Notes: 'PR #82已合并；main@fa8439f post-merge CI成功。',
  };
  if (row.EvidenceID === 'EVD-024') return {
    ...row,
    CurrentStatus: 'LOCAL_PASS',
    CommandOrProcedure: 'RED focused API；GREEN Prisma仓储3/3、Supertest 4/4、迁移契约1/1、P0 E2E1/1；prisma validate/migrate dry-run；OpenAPI generate/check/oasdiff；pnpm verify 17/17',
    Actual: '重复同通知、不同通知ID同交易号及并发通知只有一次订单PAID、reserved转sold、履约激活和BUYER_ORDER_PAID_V1 outbox；错误签名、金额、归属和幂等冲突无副作用；无真实微信调用。',
    Environment: 'LOCAL_WINDOWS_NODE22_DOCKER_MYSQL84+DETERMINISTIC_WECHAT_ADAPTER',
    ExecutedAt: updatedAt, CommitSHA: verifiedHead, CIRunURL: '',
    ArtifactOrScreenshot: 'docs/contracts/m3/M3-P024-payment-idempotency.md|artifacts/test-results/verification/pnpm-verify.json',
    Executor: 'CODEX', Freshness: 'FRESH_LOCAL_WORKTREE',
    FailureOrBlocker: 'PR/CI/人工合并/post-merge main CI未执行；福利卡账本未实现；真实微信商户配置、staging、真机、production为BLOCKED_EXTERNAL/NOT_EXECUTED',
    RetestRequired: 'YES',
    Notes: 'Mock不能升级为真实资金或STAGING_PASS；P0-024整体保持NOT_EXECUTED；M3-P025锁定。',
  };
  return null;
});

const paymentMigrationRow = {
  MigrationID: 'MIG-012A', Stage: 'M3', PlannedName: '20260814053000_m3_payment_idempotency', DependsOn: 'MIG-012',
  Objects: 'PaymentTransaction/PaymentAttempt/OrderPaymentAllocation/PaymentNotification/PaymentOutbox/BuyerOrderEvent',
  Purpose: '微信预支付与回调幂等；支付成功原子确认订单、履约、共享库存与稳定outbox',
  ForwardSteps: '新增支付唯一键与追加通知；扩展BuyerOrderEvent；不创建配送或福利卡账本',
  BackwardOrRecovery: '未发布时回退提交并重建开发库；已发布后不回改迁移，应用版本回退并以向前修复迁移处理',
  DataBackfill: '无存量回填；只为新支付命令写入',
  Verification: 'prisma validate；空库/升级/恢复dry-run；schema drift；唯一键/金额/check/不可变触发器；focused并发测试',
  BackupRequired: 'YES', Status: 'LOCAL_PASS', AppliedLocalAt: updatedAt, AppliedStagingAt: '', AppliedProductionAt: '', CommitSHA: verifiedHead,
  EvidenceLink: 'packages/db/prisma/migrations/20260814053000_m3_payment_idempotency/migration.sql|tests/migrations/m3-p024-payment-idempotency-migration.contract.test.mjs',
  Notes: 'MySQL演练empty=2/upgrade=2/restore=2/product=26/cleanup=PASS；staging/production未应用。',
};
await updateCsv(
  '11-数据库迁移台账.csv',
  (row) => row.MigrationID === paymentMigrationRow.MigrationID
    ? { ...row, ...paymentMigrationRow }
    : null,
  [paymentMigrationRow],
);

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  if (row.ContractID === 'API-041') return {
    ...row,
    ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCESS_DENIED|ORDER_NOT_FOUND|FIELD_FORBIDDEN|VALIDATION_FAILED|IDEMPOTENCY_KEY_REQUIRED|PAYMENT_IDEMPOTENCY_CONFLICT|PAYMENT_STATE_INVALID|PAYMENT_CONCURRENT_CONFLICT|EXTERNAL_SERVICE_UNAVAILABLE',
    OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
    ContractTest: 'apps/api/test/supertest/payment-idempotency-api.test.mjs|tests/e2e/p0/p0-024-payment-idempotency.spec.ts|packages/contracts/openapi.json',
    Notes: '订单归属与金额由服务端派生；只允许WECHAT_PAY；响应private/no-store与noindex；无真实商户适配器时503失败关闭。',
  };
  if (row.ContractID === 'API-042') return {
    ...row,
    ErrorCodes: 'EXTERNAL_SERVICE_UNAVAILABLE|PAYMENT_NOTIFICATION_INVALID|PAYMENT_IDENTITY_MISMATCH|PAYMENT_TRANSACTION_NOT_FOUND|PAYMENT_AMOUNT_MISMATCH|PAYMENT_STATE_INVALID|PAYMENT_TRANSACTION_CONFLICT|PAYMENT_CONCURRENT_CONFLICT',
    Idempotency: 'notificationId+wechatTransactionId+outTradeNo',
    OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
    ContractTest: 'apps/api/test/unit/prisma-payment-repository.test.mjs|apps/api/test/supertest/payment-idempotency-api.test.mjs|tests/e2e/p0/p0-024-payment-idempotency.spec.ts|packages/contracts/openapi.json',
    Notes: '适配器验证签名/身份并解密后才进入Serializable事务；首个成功通知原子确认订单、共享库存、履约与outbox；重复通知无副作用。',
  };
  return null;
});

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? {
  ...row,
  Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS',
  Notes: 'M3-P023已在main@fa8439f取得post-merge CI_PASS；M3-P024纯微信支付幂等本地focused及pnpm verify 17/17通过，PR/CI尚未创建；P0-024整体因福利卡和真实微信/staging保持NOT_EXECUTED；M3-P025及后续锁定。',
} : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P024', nextAllowedTask: 'M3-P024', activeTaskCount: 1,
  lastCompletedTask: 'M3-P023', lastCompletedCommit: p023Merge, lastPassedGate: 'M2-GATE',
  prohibitedUntilGate: [
    'M3-P024 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P025',
    '福利卡、退款、门户后续切片及M4配送保持锁定',
  ],
};
status.github = {
  ...status.github,
  pullRequest: null, pullRequestUrl: null, pullRequestState: 'NOT_CREATED', pullRequestMerged: false,
  mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: {
    scope: 'M3_P023_MAIN_POST_MERGE', status: 'CI_PASS', runId: 31772198473, jobId: 94680259802,
    runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31772198473', headSha: p023Merge,
    event: 'push', completedAt: '2026-08-14T05:18:54Z',
  },
  currentTaskDelivery: {
    taskId: 'M3-P024', issue: 83, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/83',
    branch: 'codex/m3-payment-idempotency', baseCommit: p023Merge, implementationCommit, deliveryHead: verifiedHead,
    status: 'LOCAL_PASS_PR_NOT_CREATED', localRedTest: 'API_BUILD_0_EXPECTED_201_ACTUAL_404',
    localFocusedTest: 'LOCAL_PASS_REPOSITORY_3_API_4_MIGRATION_1_P0_E2E_1',
    localFullVerify: 'PASS_17_OF_17_HEAD_2871860', pullRequest: null, pullRequestState: 'NOT_CREATED', exactHeadCi: 'NOT_EXECUTED',
    review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED',
    blockingExternalItem: 'REAL_WECHAT_MERCHANT_CONFIGURATION_AND_STAGING', nextTaskUnlocked: false,
  },
  previousTaskDelivery: {
    taskId: 'M3-P023', pullRequest: 82, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/82',
    exactHead: p023Head, mergeCommit: p023Merge, mainPostMergeCiRun: 31772198473,
    mainPostMergeCiJob: 94680259802, status: 'CI_PASS',
  },
  note: 'M3-P023已在main完成。M3-P024纯微信支付幂等本地focused及pnpm verify 17/17通过；福利卡账本及真实微信证据未进入本切片，P0-024整体保持NOT_EXECUTED；M3-P025锁定。',
};
status.evidence = {
  local: 'LOCAL_PASS_M3_P024_FULL_VERIFY', ci: 'CI_PASS_M3_P023_MAIN',
  staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
};
status.counts = { ...status.counts, migrations: 24 };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
