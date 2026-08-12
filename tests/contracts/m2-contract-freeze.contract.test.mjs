import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
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
  'M2-000',
  'm2-contract-freeze.json',
);
const generatorPath = path.join(
  repositoryRoot,
  'scripts',
  'generate-m2-contract-freeze.mjs',
);

const expectedP0Ids = [
  'P0-006',
  'P0-007',
  'P0-008',
  'P0-009',
  'P0-010',
  'P0-011',
  'P0-012',
  'P0-013',
  'P0-014',
  'P0-015',
  'P0-016',
  'P0-017',
  'P0-018',
  'P0-019',
  'P0-021',
  'P0-061',
  'P0-063',
  'P0-071',
];

const expectedTaskIds = expectedP0Ids.map((p0Id) => `M2-P${p0Id.slice(3)}`);

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

const parseCsvText = (source) => {
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
  });
};

const readCsv = (relativePath) =>
  readFile(path.join(executionPackRoot, relativePath), 'utf8').then(parseCsvText);

const sort = (values) => [...values].sort((left, right) => left.localeCompare(right));

test('M2-000 freezes the exact stage scope without implementing a business slice', async () => {
  const freeze = JSON.parse(await readFile(freezePath, 'utf8'));

  assert.equal(freeze.schemaVersion, '1.0.0');
  assert.equal(freeze.taskId, 'M2-000');
  assert.equal(freeze.stage, 'M2');
  assert.equal(freeze.status, 'CONTRACT_FROZEN');
  assert.equal(freeze.implementationStatus, 'NOT_IMPLEMENTED');
  assert.equal(
    freeze.baseline.schemeSha256,
    '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  );
  assert.equal(freeze.baseline.m1GateMergeCommit, '162787ae1687116badf0972664005332220976f9');
  assert.equal(freeze.baseline.m1GateMainCiRun, '31295823535');
  assert.deepEqual(sort(freeze.scope.p0Ids), sort(expectedP0Ids));
  assert.deepEqual(sort(freeze.scope.businessTaskIds), sort(expectedTaskIds));
  assert.equal(freeze.scope.businessSliceStarted, false);
  assert.equal(freeze.scope.nextAllowedAfterMergeAndGreenCi, 'M2-P006');
  assert.deepEqual(freeze.scope.nonGoals, [
    'ORDERING',
    'PAYMENT',
    'WELFARE_CARD',
    'DELIVERY',
    'SETTLEMENT',
  ]);
});

test('all M2 ledgers are covered by codeable frozen contracts', async () => {
  const [freeze, fields, states, permissions, pages, apis] = await Promise.all([
    readFile(freezePath, 'utf8').then(JSON.parse),
    readCsv('05-字段字典初始版.csv'),
    readCsv('06-状态机总表.csv'),
    readCsv('07-权限与数据可见矩阵.csv'),
    readCsv('08-页面路由接口P0映射.csv'),
    readCsv('12-OpenAPI-DTO-错误码台账.csv'),
  ]);

  const m2Fields = fields.filter(({ Stage }) => Stage === 'M2');
  const frozenFields = freeze.fieldContract.entities.flatMap(({ entity, fields: rows }) =>
    rows.map((field) => ({ entity, ...field })),
  );
  assert.equal(m2Fields.length, 113);
  assert.equal(frozenFields.length, m2Fields.length);
  assert.deepEqual(
    sort(frozenFields.map(({ entity, name }) => `${entity}.${name}`)),
    sort(m2Fields.map(({ Entity, Field }) => `${Entity}.${Field}`)),
  );
  for (const field of frozenFields) {
    assert.match(field.type, /\S/u, `${field.entity}.${field.name} type missing`);
    assert.match(field.format, /\S/u, `${field.entity}.${field.name} format missing`);
    assert.equal(
      /待M阶段冻结|待切片细化|String\/UUID|Enum\/String/u.test(
        `${field.type}|${field.format}|${field.p0Ids.join(',')}`,
      ),
      false,
      `${field.entity}.${field.name} still contains a placeholder`,
    );
    assert.ok(field.p0Ids.length > 0, `${field.entity}.${field.name} has no P0 mapping`);
  }
  const fieldByKey = new Map(
    frozenFields.map((field) => [`${field.entity}.${field.name}`, field]),
  );
  assert.equal(fieldByKey.get('PriceChangeLog.priceType').type, 'Enum<PriceType>');
  assert.equal(fieldByKey.get('Sku.supplyPriceVersion').type, 'Int');
  assert.equal(fieldByKey.get('SupplierProduct.enterprisePackageMultiple').type, 'Int');
  assert.equal(fieldByKey.get('SupplierProductSku.initialStock').type, 'Int');

  const m2States = states.filter(({ Stage }) => Stage === 'M2');
  assert.equal(m2States.length, 11);
  assert.equal(freeze.stateContract.transitions.length, m2States.length);
  assert.equal(freeze.stateContract.illegalTransition.errorCode, 'STATE_TRANSITION_INVALID');
  assert.equal(freeze.stateContract.concurrency.mode, 'OPTIMISTIC_VERSION_AND_UNIQUE_KEY');

  const m2RoleCodes = permissions
    .filter(({ Stage }) => Stage === 'M2')
    .map(({ RoleCode }) => RoleCode);
  assert.deepEqual(sort(freeze.permissionContract.roleCodes), sort(m2RoleCodes));
  assert.equal(freeze.permissionContract.defaultDecision, 'DENY');
  assert.equal(freeze.permissionContract.session.activeFunctionalAccountLimit, 1);

  const m2PageIds = pages
    .filter(({ Stage }) => Stage === 'M2')
    .map(({ PageID }) => PageID);
  assert.deepEqual(sort(freeze.pageContract.pageIds), sort(m2PageIds));
  assert.equal(
    freeze.pageContract.pages.every(({ businessImplementationStatus }) =>
      businessImplementationStatus === 'NOT_IMPLEMENTED'),
    true,
  );

  const m2ApiIds = apis
    .filter(({ Stage }) => Stage === 'M2')
    .map(({ ContractID }) => ContractID);
  const taskRefinements = apis.filter(
    ({ Stage, ContractID }) =>
      Stage === 'M2' && !freeze.apiContract.contractIds.includes(ContractID),
  );
  assert.deepEqual(
    sort(freeze.apiContract.contractIds),
    sort(m2ApiIds.filter((contractId) => contractId !== 'API-090')),
  );
  assert.deepEqual(taskRefinements.map(({ ContractID }) => ContractID), ['API-090']);
  assert.match(taskRefinements[0].Notes, /M2-P008任务内契约细化/u);
  assert.equal(freeze.apiContract.commonResponse, 'ApiResponse<T>');
  assert.equal(freeze.apiContract.databaseEntityReturnedDirectly, false);
  assert.equal(freeze.apiContract.objectScopeCheckedBeforeLookupResult, true);
});

test('M2 high-risk boundaries have explicit negative behavior plans', async () => {
  const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
  const negatives = new Map(freeze.negativeTests.map((row) => [row.id, row]));

  assert.equal(freeze.slices.length, expectedP0Ids.length);
  assert.deepEqual(sort(freeze.slices.map(({ taskId }) => taskId)), sort(expectedTaskIds));
  for (const slice of freeze.slices) {
    assert.ok(
      Object.values(slice.contractRefs).flat().length > 0,
      `${slice.taskId} has no frozen contract reference`,
    );
    assert.ok(slice.negativeTestIds.length >= 3, `${slice.taskId} has fewer than 3 negatives`);
    for (const negativeTestId of slice.negativeTestIds) {
      const negative = negatives.get(negativeTestId);
      assert.ok(negative, `${slice.taskId} references missing ${negativeTestId}`);
      assert.equal(negative.taskId, slice.taskId);
      assert.equal(negative.p0Id, slice.p0Id);
      assert.equal(negative.executionStatus, 'NOT_EXECUTED');
      assert.match(negative.expected, /\S/u);
    }
  }

  const categoriesFor = (p0Id) =>
    freeze.negativeTests
      .filter((negative) => negative.p0Id === p0Id)
      .map(({ category }) => category);
  assert.ok(categoriesFor('P0-007').includes('DUAL_APPROVAL_GATE'));
  assert.ok(categoriesFor('P0-008').includes('PRODUCT_PAGE_PRICE_LEAK'));
  assert.ok(categoriesFor('P0-018').includes('REGULATED_DEFAULT_DENY'));
  assert.ok(categoriesFor('P0-019').includes('UNAPPROVED_SUPPLY_PRICE_EFFECT'));
  assert.ok(categoriesFor('P0-021').includes('SUPPLY_PRICE_RESPONSE_LEAK'));
  assert.ok(categoriesFor('P0-063').includes('CONCURRENT_LOST_UPDATE'));
  assert.ok(categoriesFor('P0-071').includes('SAME_NATURAL_PERSON_REVIEW'));
});

test('single merchant, price isolation, inventory truth, and human decisions stay explicit', async () => {
  const freeze = JSON.parse(await readFile(freezePath, 'utf8'));

  assert.equal(freeze.invariants.singleMerchant.customerCounterparty, 'COMPANY_ONLY');
  assert.equal(freeze.invariants.singleMerchant.supplierIsStore, false);
  assert.equal(freeze.invariants.catalog.supplierProductSellable, false);
  assert.equal(freeze.invariants.catalog.productSkuOwnedBy, 'COMPANY');
  assert.equal(freeze.invariants.supplyPrice.defaultPolicy, 'NEVER_RETURN');
  assert.deepEqual(freeze.invariants.supplyPrice.customerVisibility, []);
  assert.equal(freeze.invariants.inventory.uniqueBalancePerSku, true);
  assert.equal(freeze.invariants.inventory.duplicateChannelInventory, false);
  assert.equal(freeze.invariants.priceChange.supplyPriceRequiresApproval, true);
  assert.equal(freeze.invariants.priceChange.salePriceRequiresApproval, false);
  assert.equal(freeze.invariants.makerChecker.identityKey, 'identityType+identityId');
  assert.equal(freeze.invariants.makerChecker.superAdminBypass, false);

  assert.deepEqual(
    sort(freeze.humanDependencies.map(({ dependencyId }) => dependencyId)),
    ['EXT-007', 'EXT-008'],
  );
  assert.equal(freeze.humanDependencies.every(({ status }) => status === 'NOT_PROVIDED'), true);
  assert.equal(freeze.humanDependencies.every(({ guessedByCode }) => guessedByCode === false), true);
  assert.equal(freeze.humanDependencies.every(({ blocksContractFreeze }) =>
    blocksContractFreeze === false), true);
});

test('the deterministic generator rejects placeholders and forbidden product-page price exposure', async () => {
  execFileSync(process.execPath, [generatorPath, '--check'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'fulishe-m2-freeze-'));
  try {
    const fixturePath = path.join(temporaryRoot, 'm2-fields.json');
    const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
    const fields = freeze.fieldContract.entities.flatMap(({ entity, fields: rows }) =>
      rows.map((field) => ({ entity, ...field })),
    );
    fields.find(({ entity, name }) => entity === 'Sku' && name === 'status').format =
      '待M阶段冻结';
    await writeFile(fixturePath, `${JSON.stringify(fields, null, 2)}\n`, 'utf8');
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [generatorPath, '--validate-field-fixture', fixturePath],
          { cwd: repositoryRoot, encoding: 'utf8', stdio: 'pipe' },
        ),
      /M2_FIELD_PLACEHOLDER/u,
    );

    const exposurePath = path.join(temporaryRoot, 'm2-permissions.json');
    const permissions = freeze.permissionContract.roles.map((role) => ({ ...role }));
    permissions.find(({ roleCode }) => roleCode === 'SUPPLIER_PRODUCT').supplyPriceVisibility =
      'VISIBLE_OWN_ONLY';
    await writeFile(exposurePath, `${JSON.stringify(permissions, null, 2)}\n`, 'utf8');
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [generatorPath, '--validate-permission-fixture', exposurePath],
          { cwd: repositoryRoot, encoding: 'utf8', stdio: 'pipe' },
        ),
      /M2_PRODUCT_PAGE_SUPPLY_PRICE_EXPOSURE/u,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('machine control preserves the M2 freeze while later slices advance one gate at a time', async () => {
  const [tasks, stages, projectStatus] = await Promise.all([
    readCsv('03-任务台账.csv'),
    readCsv(path.join('data', '阶段门禁.csv')),
    readFile(path.join(executionPackRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
  ]);

  const m1Gate = tasks.find(({ TaskID }) => TaskID === 'M1-GATE');
  const m2000 = tasks.find(({ TaskID }) => TaskID === 'M2-000');
  const m2p006 = tasks.find(({ TaskID }) => TaskID === 'M2-P006');
  const m2p007 = tasks.find(({ TaskID }) => TaskID === 'M2-P007');
  const m2p008 = tasks.find(({ TaskID }) => TaskID === 'M2-P008');
  const m2p009 = tasks.find(({ TaskID }) => TaskID === 'M2-P009');
  const m2p010 = tasks.find(({ TaskID }) => TaskID === 'M2-P010');
  const m2p011 = tasks.find(({ TaskID }) => TaskID === 'M2-P011');
  const m2p012 = tasks.find(({ TaskID }) => TaskID === 'M2-P012');
  const m2p013 = tasks.find(({ TaskID }) => TaskID === 'M2-P013');
  const m2p014 = tasks.find(({ TaskID }) => TaskID === 'M2-P014');
  const m2p015 = tasks.find(({ TaskID }) => TaskID === 'M2-P015');
  const m2p016 = tasks.find(({ TaskID }) => TaskID === 'M2-P016');
  const m2p017 = tasks.find(({ TaskID }) => TaskID === 'M2-P017');
  const m2p018 = tasks.find(({ TaskID }) => TaskID === 'M2-P018');
  const m2p019 = tasks.find(({ TaskID }) => TaskID === 'M2-P019');
  const laterM2Tasks = tasks.filter(
    ({ Stage, TaskID }) =>
      Stage === 'M2' &&
      ![
        'M2-000',
        'M2-P006',
        'M2-P007',
        'M2-P008',
        'M2-P009',
        'M2-P010',
        'M2-P011',
        'M2-P012',
        'M2-P013',
        'M2-P014',
        'M2-P015',
        'M2-P016',
        'M2-P017',
        'M2-P018',
        'M2-P019',
      ].includes(
        TaskID,
      ),
  );
  assert.equal(m1Gate.Status, 'DONE');
  assert.equal(m1Gate.EvidenceStatus, 'CI_PASS');
  assert.equal(m1Gate.CI, 'CI_PASS');
  assert.equal(m2000.Status, 'DONE');
  assert.equal(m2000.EvidenceStatus, 'CI_PASS');
  assert.equal(m2000.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/35');
  assert.equal(m2000.Branch, 'codex/m2-contract-freeze');
  assert.equal(m2000.CI, 'CI_PASS');
  assert.equal(m2p006.Status, 'DONE');
  assert.equal(m2p006.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p006.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/37');
  assert.equal(m2p006.Branch, 'codex/m2-product-model');
  assert.equal(m2p006.CI, 'CI_PASS');
  assert.equal(m2p007.Status, 'DONE');
  assert.equal(m2p007.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p007.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/39');
  assert.equal(m2p007.Branch, 'codex/m2-product-approval');
  assert.equal(m2p007.CI, 'CI_PASS');
  assert.equal(m2p008.Status, 'DONE');
  assert.equal(m2p008.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p008.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/41');
  assert.equal(m2p008.Branch, 'codex/m2-supplier-pricing');
  assert.equal(m2p008.CI, 'CI_PASS');
  assert.equal(m2p009.Status, 'DONE');
  assert.equal(m2p009.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p009.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/43');
  assert.equal(m2p009.Branch, 'codex/m2-no-supplier-storefront');
  assert.equal(m2p009.CI, 'CI_PASS');
  assert.equal(m2p010.Status, 'DONE');
  assert.equal(m2p010.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p010.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/45');
  assert.equal(m2p010.Branch, 'codex/m2-more-from-supplier');
  assert.equal(m2p011.Status, 'DONE');
  assert.equal(m2p011.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p011.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/47');
  assert.equal(m2p011.Branch, 'codex/m2-category-tree');
  assert.equal(m2p011.CI, 'CI_PASS');
  assert.equal(m2p012.Status, 'DONE');
  assert.equal(m2p012.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p012.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/49');
  assert.equal(m2p012.Branch, 'codex/m2-category-template');
  assert.equal(m2p012.CI, 'CI_PASS');
  assert.equal(m2p013.Status, 'DONE');
  assert.equal(m2p013.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p013.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/51');
  assert.equal(m2p013.Branch, 'codex/m2-food-detail');
  assert.equal(m2p013.CI, 'CI_PASS');
  assert.equal(m2p014.Status, 'DONE');
  assert.equal(m2p014.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p014.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/53');
  assert.equal(m2p014.Branch, 'codex/m2-fresh-detail');
  assert.equal(m2p014.CI, 'CI_PASS');
  assert.equal(m2p015.Status, 'DONE');
  assert.equal(m2p015.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p015.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/55');
  assert.equal(m2p015.Branch, 'codex/m2-apparel-detail');
  assert.equal(m2p015.CI, 'CI_PASS');
  assert.equal(m2p016.Status, 'DONE');
  assert.equal(m2p016.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p016.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/57');
  assert.equal(m2p016.Branch, 'codex/m2-digital-detail');
  assert.equal(m2p016.CI, 'CI_PASS');
  assert.equal(m2p017.Status, 'DONE');
  assert.equal(m2p017.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p017.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/59');
  assert.equal(m2p017.Branch, 'codex/m2-gift-box-detail');
  assert.equal(m2p017.PullRequest, 'https://github.com/EasyStep-lee/flt1/pull/60');
  assert.equal(m2p017.CI, 'CI_PASS');
  assert.equal(m2p018.Status, 'DONE');
  assert.equal(m2p018.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p018.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/61');
  assert.equal(m2p018.Branch, 'codex/m2-regulated-default-deny');
  assert.equal(m2p018.CI, 'CI_PASS');
  assert.equal(m2p019.Status, 'IN_PROGRESS');
  assert.equal(m2p019.EvidenceStatus, 'LOCAL_PASS');
  assert.equal(m2p019.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/63');
  assert.equal(m2p019.Branch, 'codex/m2-tiered-price-change');
  assert.equal(m2p019.CI, 'NOT_EXECUTED');
  assert.equal(laterM2Tasks.every(({ Status }) => Status === 'NOT_STARTED'), true);

  const m1Stage = stages.find(({ Stage }) => Stage === 'M1');
  const m2Stage = stages.find(({ Stage }) => Stage === 'M2');
  const m3Stage = stages.find(({ Stage }) => Stage === 'M3');
  assert.equal(m1Stage.Status, 'GATE_PASSED');
  assert.equal(m1Stage.EvidenceStatus, 'CI_PASS');
  assert.equal(m2Stage.Status, 'IN_PROGRESS');
  assert.ok(['LOCAL_PASS', 'CI_PASS'].includes(m2Stage.EvidenceStatus));
  assert.equal(m3Stage.Status, 'LOCKED');

  assert.equal(projectStatus.execution.status, 'M2_IN_PROGRESS');
  assert.equal(projectStatus.execution.currentStage, 'M2');
  assert.equal(projectStatus.execution.currentTask, 'M2-P019');
  assert.equal(projectStatus.execution.nextAllowedTask, 'M2-P019');
  assert.equal(projectStatus.execution.activeTaskCount, 1);
  assert.equal(projectStatus.execution.lastCompletedTask, 'M2-P018');
  assert.equal(projectStatus.execution.lastPassedGate, 'M1-GATE');
  assert.equal(projectStatus.evidence.local, 'LOCAL_PASS');
  assert.ok(['NOT_EXECUTED', 'CI_PASS'].includes(projectStatus.evidence.ci));
});
