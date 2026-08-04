import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const executionPackRoot = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
);
const freezePath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M1-000',
  'm1-contract-freeze.json',
);
const planPath = path.join(
  repositoryRoot,
  'docs',
  'contracts',
  'm1',
  'M1-000-contract-freeze.md',
);
const fieldLedgerPath = path.join(executionPackRoot, '05-字段字典初始版.csv');
const stateLedgerPath = path.join(executionPackRoot, '06-状态机总表.csv');
const permissionLedgerPath = path.join(
  executionPackRoot,
  '07-权限与数据可见矩阵.csv',
);
const pageLedgerPath = path.join(executionPackRoot, '08-页面路由接口P0映射.csv');
const dependencyLedgerPath = path.join(
  executionPackRoot,
  '09-外部依赖与人工事项.csv',
);
const apiLedgerPath = path.join(
  executionPackRoot,
  '12-OpenAPI-DTO-错误码台账.csv',
);

const expectedP0Ids = [
  'P0-001',
  'P0-002',
  'P0-003',
  'P0-004',
  'P0-005',
  'P0-045',
  'P0-046',
  'P0-047',
  'P0-066',
  'P0-067',
  'P0-068',
  'P0-069',
  'P0-070',
  'P0-072',
];

const expectedTaskIds = expectedP0Ids.map((p0Id) =>
  `M1-P${p0Id.slice(3)}`,
);

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
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      values.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  assert.equal(quoted, false, 'unterminated quoted CSV field');
  values.push(current);
  return values;
};

const readCsv = async (filePath) => {
  const lines = (await readFile(filePath, 'utf8')).split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
  });
};

const sort = (values) => [...values].sort((left, right) => left.localeCompare(right));

test('M1-000 freezes the exact M1 scope without implementing a business slice', async () => {
  const freeze = JSON.parse(await readFile(freezePath, 'utf8'));

  assert.equal(freeze.schemaVersion, '1.0.0');
  assert.equal(freeze.taskId, 'M1-000');
  assert.equal(freeze.stage, 'M1');
  assert.equal(freeze.status, 'CONTRACT_FROZEN');
  assert.equal(freeze.implementationStatus, 'NOT_IMPLEMENTED');
  assert.equal(
    freeze.baseline.schemeSha256,
    '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  );
  assert.deepEqual(sort(freeze.scope.p0Ids), sort(expectedP0Ids));
  assert.deepEqual(sort(freeze.scope.businessTaskIds), sort(expectedTaskIds));
  assert.equal(freeze.scope.businessSliceStarted, false);
  assert.deepEqual(freeze.scope.nonGoals, [
    'PRODUCT_TRADING',
    'PAYMENT',
    'DELIVERY',
    'SETTLEMENT',
  ]);
});

test('all M1 ledger rows are covered by codeable frozen contracts', async () => {
  const [freeze, fields, states, permissions, pages, apis] = await Promise.all([
    readFile(freezePath, 'utf8').then(JSON.parse),
    readCsv(fieldLedgerPath),
    readCsv(stateLedgerPath),
    readCsv(permissionLedgerPath),
    readCsv(pageLedgerPath),
    readCsv(apiLedgerPath),
  ]);

  const m1Fields = fields.filter(({ Stage }) => Stage === 'M1');
  const frozenFields = freeze.fieldContract.entities.flatMap(({ entity, fields: rows }) =>
    rows.map((field) => ({ entity, ...field })),
  );
  assert.equal(m1Fields.length, 109);
  assert.equal(frozenFields.length, m1Fields.length);
  assert.deepEqual(
    sort(frozenFields.map(({ entity, name }) => `${entity}.${name}`)),
    sort(m1Fields.map(({ Entity, Field }) => `${Entity}.${Field}`)),
  );
  for (const field of frozenFields) {
    assert.match(field.type, /\S/u, `${field.entity}.${field.name} type missing`);
    assert.match(field.format, /\S/u, `${field.entity}.${field.name} format missing`);
    assert.equal(
      /待M阶段冻结|待切片细化/u.test(`${field.type}|${field.format}`),
      false,
      `${field.entity}.${field.name} still contains a placeholder`,
    );
    assert.ok(field.p0Ids.length > 0, `${field.entity}.${field.name} has no P0 mapping`);
  }
  const frozenFieldByKey = new Map(
    frozenFields.map((field) => [`${field.entity}.${field.name}`, field]),
  );
  assert.equal(frozenFieldByKey.get('Supplier.pickupLat').type, 'Decimal(10,7)');
  assert.equal(
    frozenFieldByKey.get('Supplier.settlementAccountMasked').type,
    'String(128)',
  );
  assert.equal(
    frozenFieldByKey.get('LoginAudit.loginAccountHash').type,
    'String(64)',
  );

  const m1States = states.filter(({ Stage }) => Stage === 'M1');
  assert.equal(m1States.length, 15);
  assert.equal(freeze.stateContract.transitions.length, m1States.length);
  assert.equal(freeze.stateContract.illegalTransition.errorCode, 'STATE_TRANSITION_INVALID');
  assert.equal(freeze.stateContract.concurrency.mode, 'OPTIMISTIC_VERSION_AND_UNIQUE_KEY');

  const requiredRoleCodes = permissions
    .filter(({ P0 }) => /P0-067|P0-070/u.test(P0))
    .map(({ RoleCode }) => RoleCode);
  assert.deepEqual(sort(freeze.permissionContract.roleCodes), sort(requiredRoleCodes));
  assert.equal(freeze.permissionContract.session.activeFunctionalAccountLimit, 1);
  assert.equal(freeze.permissionContract.defaultDecision, 'DENY');

  const requiredPageIds = pages
    .filter(({ P0 }) => /P0-066|P0-067|P0-068|P0-069|P0-070/u.test(P0))
    .map(({ PageID }) => PageID);
  assert.deepEqual(sort(freeze.pageContract.pageIds), sort(requiredPageIds));
  assert.equal(
    freeze.pageContract.authRoutes.companyAccountSelection,
    '/company-admin/account-select',
  );
  assert.equal(
    freeze.pageContract.authRoutes.supplierAccountSelection,
    '/supplier/account-select',
  );
  const pageById = new Map(
    freeze.pageContract.pages.map((page) => [page.pageId, page]),
  );
  assert.equal(pageById.get('PAGE-002').route, '/company-admin/account-select');
  assert.equal(pageById.get('PAGE-015').route, '/supplier/account-select');
  assert.deepEqual(pageById.get('PAGE-015').p0Ids, ['P0-069']);

  const m1ApiIds = apis
    .filter(({ Stage }) => Stage === 'M1')
    .map(({ ContractID }) => ContractID);
  assert.deepEqual(sort(freeze.apiContract.contractIds), sort(m1ApiIds));
  assert.equal(freeze.apiContract.commonResponse, 'ApiResponse<T>');
  assert.equal(freeze.apiContract.objectScopeCheckedBeforeLookupResult, true);
  assert.equal(freeze.apiContract.databaseEntityReturnedDirectly, false);
});

test('the committed freeze is byte-bound to every source ledger', async () => {
  const freeze = JSON.parse(await readFile(freezePath, 'utf8'));

  for (const [ledgerName, source] of Object.entries(freeze.sourceLedgers)) {
    const bytes = await readFile(path.join(repositoryRoot, source.path));
    const actualSha = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    assert.equal(actualSha, source.sha256, `${ledgerName} changed without regenerating M1 freeze`);
  }
});

test('every M1 P0 slice has explicit traceability and negative tests', async () => {
  const freeze = JSON.parse(await readFile(freezePath, 'utf8'));

  assert.equal(freeze.slices.length, expectedP0Ids.length);
  assert.deepEqual(sort(freeze.slices.map(({ p0Id }) => p0Id)), sort(expectedP0Ids));
  assert.deepEqual(sort(freeze.slices.map(({ taskId }) => taskId)), sort(expectedTaskIds));

  const negativeTests = new Map(
    freeze.negativeTests.map((negativeTest) => [negativeTest.id, negativeTest]),
  );
  assert.ok(negativeTests.size >= expectedP0Ids.length * 3);
  for (const slice of freeze.slices) {
    const referenceCount = Object.values(slice.contractRefs).flat().length;
    assert.ok(referenceCount > 0, `${slice.taskId} has no frozen contract reference`);
    assert.ok(slice.negativeTestIds.length >= 3, `${slice.taskId} has fewer than 3 negatives`);
    for (const testId of slice.negativeTestIds) {
      const negativeTest = negativeTests.get(testId);
      assert.ok(negativeTest, `${slice.taskId} references missing ${testId}`);
      assert.equal(negativeTest.taskId, slice.taskId);
      assert.equal(negativeTest.p0Id, slice.p0Id);
      assert.match(negativeTest.expected, /\S/u);
    }
  }

  const p004Categories = freeze.negativeTests
    .filter(({ p0Id }) => p0Id === 'P0-004')
    .map(({ category }) => category);
  assert.ok(p004Categories.includes('OBJECT_SCOPE'));
  assert.ok(p004Categories.includes('SERVER_BOUND_SUPPLIER'));

  const p047Categories = freeze.negativeTests
    .filter(({ p0Id }) => p0Id === 'P0-047')
    .map(({ category }) => category);
  assert.ok(p047Categories.includes('RESPONSE_WHITELIST'));
  assert.ok(p047Categories.includes('DETERMINISTIC_OPENAPI'));
  assert.ok(p047Categories.includes('MINIAPP_TRANSPORT'));

  const p072Categories = freeze.negativeTests
    .filter(({ p0Id }) => p0Id === 'P0-072')
    .map(({ category }) => category);
  assert.ok(p072Categories.includes('NATURAL_IDENTITY_SEPARATION'));
  assert.ok(p072Categories.includes('SUPER_ADMIN_BYPASS'));
  assert.ok(p072Categories.includes('CONCURRENT_REVIEW'));
});

test('supply price, single-merchant, and human-decision boundaries stay explicit', async () => {
  const [freeze, dependencies, plan] = await Promise.all([
    readFile(freezePath, 'utf8').then(JSON.parse),
    readCsv(dependencyLedgerPath),
    readFile(planPath, 'utf8'),
  ]);

  assert.equal(freeze.invariants.singleMerchant.customerCounterparty, 'COMPANY_ONLY');
  assert.equal(freeze.invariants.singleMerchant.supplierIsStore, false);
  assert.deepEqual(freeze.invariants.singleMerchant.forbiddenCapabilities, [
    'FRANCHISEE_REGISTRATION',
    'REGIONAL_REVENUE_SHARE',
    'SUPPLIER_STOREFRONT',
    'SUPPLIER_DIRECT_PAYMENT',
  ]);
  assert.deepEqual(freeze.invariants.supplyPrice.customerVisibility, []);
  assert.equal(freeze.invariants.supplyPrice.defaultPolicy, 'NEVER_RETURN');
  assert.equal(freeze.invariants.makerChecker.identityKey, 'identityType+identityId');
  assert.equal(freeze.invariants.makerChecker.superAdminBypass, false);

  const forbiddenPublicFields = new Set(freeze.apiContract.forbiddenPublicFields);
  for (const field of [
    'supplyPrice',
    'approvedSupplyPrice',
    'supplyPriceSnapshot',
    'supplierPayable',
    'grossMargin',
  ]) {
    assert.equal(forbiddenPublicFields.has(field), true, `missing forbidden field ${field}`);
  }

  const expectedDependencyIds = dependencies
    .filter(({ EarliestStage }) => EarliestStage === 'M1')
    .map(({ DependencyID }) => DependencyID);
  assert.deepEqual(
    sort(freeze.humanDependencies.map(({ dependencyId }) => dependencyId)),
    sort(expectedDependencyIds),
  );
  assert.equal(freeze.humanDependencies.every(({ status }) => status === 'NOT_PROVIDED'), true);
  assert.match(plan, /^# M1-000 字段、状态机、权限与接口契约冻结/u);
  assert.match(plan, /未实现任何M1业务切片/u);
  assert.match(plan, /EXT-005/u);
  assert.match(plan, /EXT-006/u);
  assert.match(plan, /M1-P001/u);
});
