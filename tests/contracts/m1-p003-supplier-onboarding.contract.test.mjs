import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else current += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      values.push(current);
      current = '';
    } else current += character;
  }
  values.push(current);
  return values;
};

const readCsv = async (relativePath) => {
  const source = await readFile(path.join(packRoot, relativePath), 'utf8');
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((column, index) => [column, values[index] ?? '']));
  });
};

test('M1-P003 keeps the frozen API, role and page scope without transaction capabilities', async () => {
  const [contract, controllerRegistry, apiErrors, supplierPage, companyPage] =
    await Promise.all([
      readFile(path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P003-supplier-onboarding.md'), 'utf8'),
      readFile(path.join(repositoryRoot, 'apps', 'api', 'src', 'openapi', 'openapi-controller.registry.ts'), 'utf8'),
      readFile(path.join(repositoryRoot, 'apps', 'api', 'src', 'http', 'api-error.ts'), 'utf8'),
      readFile(path.join(repositoryRoot, 'apps', 'supplier-portal', 'src', 'app.tsx'), 'utf8'),
      readFile(path.join(repositoryRoot, 'apps', 'company-admin', 'src', 'app.tsx'), 'utf8'),
    ]);

  assert.match(contract, /P0-003/u);
  assert.match(contract, /生产.*默认.*拒绝/su);
  assert.match(controllerRegistry, /SupplierRegistrationController/u);
  assert.match(controllerRegistry, /SupplierSelfServiceController/u);
  assert.match(controllerRegistry, /CompanySupplierOnboardingController/u);
  for (const code of [
    'SUPPLIER_DUPLICATE',
    'VALIDATION_FAILED',
    'VERSION_CONFLICT',
    'STATE_TRANSITION_INVALID',
    'APPROVAL_VERSION_CONFLICT',
  ]) {
    assert.match(apiErrors, new RegExp(code, 'u'));
  }
  assert.match(supplierPage, /supplier\/register/u);
  assert.match(supplierPage, /DRAFT|草稿/u);
  assert.match(supplierPage, /PENDING_REVIEW|待审核/u);
  assert.match(supplierPage, /CORRECTION_REQUIRED|待补正/u);
  assert.match(supplierPage, /ACTIVE|已启用/u);
  assert.match(companyPage, /supplier-ops/u);
  assert.match(companyPage, /COMPANY_SUPPLIER_OPS/u);
  assert.doesNotMatch(`${supplierPage}\n${companyPage}`, /供应价|毛利|供应商应付/u);
});

test('M1-P003 generated OpenAPI retains its five frozen onboarding operations', async () => {
  const openapi = JSON.parse(
    await readFile(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
  );
  const operations = [
    ['post', '/v1/suppliers/registrations'],
    ['patch', '/v1/supplier/me'],
    ['post', '/v1/supplier/me/submit-review'],
    ['get', '/v1/company/suppliers'],
    ['post', '/v1/company/suppliers/{supplierId}/review'],
  ];

  for (const [method, route] of operations) {
    assert.ok(openapi.paths[route]?.[method], `${method.toUpperCase()} ${route}`);
  }
  assert.doesNotMatch(JSON.stringify(openapi.paths), /franchise|storefront|direct-payment/iu);
});

test('M1-P003 retains its local evidence after PR and main CI closure', async () => {
  const [
    tasks,
    p0Rows,
    pages,
    evidenceRows,
    migrations,
    apis,
    state,
    evidence,
    rehearsal,
  ] = await Promise.all([
    readCsv('03-任务台账.csv'),
    readCsv('04-P0-1至P0-119验收矩阵.csv'),
    readCsv('08-页面路由接口P0映射.csv'),
    readCsv('10-测试证据登记.csv'),
    readCsv('11-数据库迁移台账.csv'),
    readCsv('12-OpenAPI-DTO-错误码台账.csv'),
    readFile(path.join(packRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
    readFile(
      path.join(repositoryRoot, 'artifacts', 'verification', 'M1-P003', 'supplier-onboarding.json'),
      'utf8',
    ).then(JSON.parse),
    readFile(
      path.join(repositoryRoot, 'artifacts', 'verification', 'M1-P003', 'prisma-migration-rehearsal.json'),
      'utf8',
    ).then(JSON.parse),
  ]);

  const active = tasks.filter(({ Status }) => Status === 'IN_PROGRESS');
  const m1p003 = tasks.find(({ TaskID }) => TaskID === 'M1-P003');
  const m1p004 = tasks.find(({ TaskID }) => TaskID === 'M1-P004');
  const m2p008 = tasks.find(({ TaskID }) => TaskID === 'M2-P008');
  const p0 = p0Rows.find(({ P0ID }) => P0ID === 'P0-003');
  const evidenceRow = evidenceRows.find(({ EvidenceID }) => EvidenceID === 'EVD-003');
  const migration = migrations.find(({ MigrationID }) => MigrationID === 'MIG-004');
  const mappedPages = pages.filter(({ PageID }) => ['PAGE-004', 'PAGE-013'].includes(PageID));
  const operationKeys = new Set([
    'POST /v1/suppliers/registrations',
    'PATCH /v1/supplier/me',
    'POST /v1/supplier/me/submit-review',
    'GET /v1/company/suppliers',
    'POST /v1/company/suppliers/{supplierId}/review',
  ]);
  const mappedApis = apis.filter(({ Method, Path }) => operationKeys.has(`${Method} ${Path}`));

  assert.ok(active.length <= 1);
  assert.equal(m1p003?.Status, 'DONE');
  assert.equal(m1p003?.EvidenceStatus, 'CI_PASS');
  assert.equal(m1p003?.CommitSHA, 'd7067a59f1bc66680121d9e2b38e04cb3083dee2');
  assert.equal(m1p003?.PullRequest, '10');
  assert.equal(m1p003?.CI, 'CI_PASS');
  assert.equal(m1p004?.Status, 'DONE');
  assert.equal(m1p004?.EvidenceStatus, 'CI_PASS');
  assert.equal(p0?.CurrentEvidenceStatus, 'CI_PASS');
  assert.equal(p0?.EvidenceLink, 'artifacts/verification/M1-P003/supplier-onboarding.json');
  assert.equal(evidenceRow?.CurrentStatus, 'CI_PASS');
  assert.equal(migration?.Status, 'APPLIED_LOCAL');
  assert.equal(mappedPages.length, 2);
  assert.equal(
    mappedPages.find(({ PageID }) => PageID === 'PAGE-004')?.ImplementationStatus,
    'IMPLEMENTED',
  );
  assert.equal(
    mappedPages.find(({ PageID }) => PageID === 'PAGE-013')?.ImplementationStatus,
    'IMPLEMENTED',
  );
  assert.equal(mappedApis.length, 5);
  assert.ok(mappedApis.every(({ OpenAPIStatus }) => OpenAPIStatus === 'GENERATED'));
  assert.ok(mappedApis.every(({ DTOStatus }) => DTOStatus === 'IMPLEMENTED'));

  assert.equal(evidence.result, 'LOCAL_PASS');
  assert.equal(evidence.fullVerification.commit, 'b34c427304131e856148db132b5fbecdf4da2e0f');
  assert.equal(evidence.fullVerification.stepsPassed, 17);
  assert.deepEqual(evidence.negativeTests.map(({ status }) => status), [
    'PASS',
    'PASS',
    'PASS',
    'PASS',
  ]);
  assert.equal(rehearsal.status, 'LOCAL_PASS');
  assert.equal(rehearsal.git.commit, 'b34c427304131e856148db132b5fbecdf4da2e0f');
  assert.equal(rehearsal.productRehearsal.supplierOnboarding.onboardingTableCount, 4);
  assert.equal(rehearsal.cleanup.errors.length, 0);

  assert.equal(state.execution.currentStage, 'M2');
  assert.equal(state.execution.currentTask, state.execution.nextAllowedTask);
  assert.equal(state.execution.currentTask, 'M2-P017');
  assert.equal(state.execution.activeTaskCount, active.length);
  assert.equal(state.execution.lastCompletedTask, 'M2-P016');
  assert.equal(state.execution.lastPassedGate, 'M1-GATE');
  assert.equal(state.github.repository, 'EasyStep-lee/flt1');
  assert.equal(state.github.currentTaskDelivery.taskId, 'M2-P017');
  assert.ok(['LOCAL_PASS', 'CI_PASS'].includes(state.github.currentTaskDelivery.status));
  assert.equal(state.github.previousTaskDelivery.taskId, 'M2-P016');
  assert.equal(state.github.previousTaskDelivery.pullRequest, 58);
  assert.match(m2p008?.Status, /^(?:IN_PROGRESS|DONE)$/u);
  assert.match(state.evidence.local, /^(?:NOT_EXECUTED|LOCAL_PASS)$/u);
  assert.ok(['NOT_EXECUTED', 'CI_PASS'].includes(state.evidence.ci));
});
