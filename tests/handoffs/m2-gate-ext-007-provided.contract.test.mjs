import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const receiptPath = path.join(
  root,
  'artifacts',
  'verification',
  'M2-GATE',
  'ext-007-category-compliance-confirmation.json',
);
const policyPath = path.join(
  root,
  'docs',
  'product',
  'm2',
  'ext-007-first-phase-category-policy.json',
);
const evidencePath = path.join(
  root,
  'artifacts',
  'verification',
  'M2-GATE',
  'm2-gate-preflight.json',
);
const handoffPath = path.join(
  root,
  'docs',
  'handoffs',
  '2026-08-13-M2-gate-ext-007-provided.md',
);

const parseCsvLine = (line) => {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else value += character;
  }
  assert.equal(quoted, false, 'unterminated CSV field');
  values.push(value);
  return values;
};

const parseCsv = (source) => {
  const lines = source.replace(/^\uFEFF/u, '').split(/\r?\n/u).filter(Boolean);
  const columns = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? '']));
  });
};

const readJson = (file) => readFile(file, 'utf8').then(JSON.parse);

test('EXT-007 receipt records the authorized source without copying sensitive or absolute-path data', async () => {
  const receipt = await readJson(receiptPath);

  assert.equal(receipt.schemaVersion, '1.0.0');
  assert.equal(receipt.dependencyId, 'EXT-007');
  assert.equal(receipt.status, 'CONFIRMED');
  assert.equal(
    receipt.confirmedBy.authorizedRole,
    'COMPANY_AUTHORIZED_BUSINESS_COMPLIANCE_REVIEWER',
  );
  assert.equal(receipt.confirmedBy.identityRef, null);
  assert.match(receipt.confirmedAt, /(?:Z|[+-]\d{2}:\d{2})$/u);
  assert.equal(
    receipt.source.fileName,
    '# EXT-007 福利商城首期商品分类与合规授权确认.md',
  );
  assert.equal(
    receipt.source.sha256,
    '5F6E2E51CDE12E7ED004064E6CD1DAA137359611C9C9AA4C6D192B8AA4B454CF',
  );
  assert.equal(receipt.source.sizeBytes, 12883);
  assert.equal(receipt.source.originalCommitted, false);
  assert.equal(receipt.source.containsSensitiveSource, false);
  assert.equal(JSON.stringify(receipt).includes('C:\\Users\\'), false);
  assert.equal(receipt.declarations.developmentDocumentsTakePrecedence, true);
  assert.equal(receipt.declarations.ext007OnlyFillsUndefinedBusinessInputs, true);
  assert.equal(receipt.declarations.noRuntimeBoundaryRedefined, true);
});

test('normalized first-phase policy preserves the approved category tree and locked development mappings', async () => {
  const policy = await readJson(policyPath);
  const leafPaths = policy.enabledCategoryTree.flatMap((rootCategory) =>
    rootCategory.children.flatMap((middleCategory) =>
      middleCategory.children.map((leaf) =>
        `${rootCategory.name}>${middleCategory.name}>${leaf}`,
      ),
    ),
  );

  assert.equal(policy.schemaVersion, '1.0.0');
  assert.equal(policy.policyId, 'EXT-007-V1.1-FIRST-PHASE');
  assert.deepEqual(
    policy.enabledCategoryTree.map(({ name }) => name),
    ['食品', '家居日用', '个护', '纸品', '家庭清洁', '文体办公'],
  );
  assert.equal(leafPaths.length, 91);
  assert.equal(new Set(leafPaths).size, 91);
  assert.equal(leafPaths.includes('食品>休闲零食>坚果炒货'), true);
  assert.equal(leafPaths.includes('家居日用>厨房用品>保温杯'), true);
  assert.equal(leafPaths.includes('文体办公>体育休闲>非电子休闲用品'), true);
  assert.equal(leafPaths.some((value) => /生鲜|酒类|电子产品|家用电器/u.test(value)), false);

  assert.equal(policy.restrictedCategories.includes('生鲜食品'), true);
  assert.equal(policy.restrictedCategories.includes('酒类'), true);
  assert.equal(policy.restrictedCategories.includes('医疗器械'), true);
  assert.equal(policy.restrictedCategories.includes('危险化学品'), true);
  assert.deepEqual(policy.developmentMappings.price, {
    sourceTerms: ['sale_price', 'market_price'],
    canonicalRule:
      'Do not add generic price fields; use existing supply, retail sale and enterprise sale price versions in integer cents.',
  });
  assert.equal(
    policy.developmentMappings.stock.canonicalRule,
    'Use the existing single InventoryBalance per SKU; do not add template stock fields.',
  );
  assert.equal(
    policy.developmentMappings.supplier.canonicalRule,
    'Derive supplierId from the verified session; never trust supplier_id from a client.',
  );
  assert.equal(
    policy.developmentMappings.restrictedStatus.canonicalRule,
    'Persist Category.status=DISABLED and require HIGH_RISK explicit RegulatedCategoryControl approval before enablement; REGULATED_DISABLED is not a new runtime enum.',
  );
  assert.deepEqual(policy.qualificationValidity.reminderDays, [30, 7]);
  assert.equal(policy.qualificationValidity.expiredRequiredQualificationBlocksSale, true);
  assert.equal(policy.shelfLifeRules.thresholdsConfigurable, true);
  assert.equal(policy.afterSales.qualityIssueAlwaysAccepted, true);
});

test('EXT-007 historical evidence remains valid after exact-head merge unlocks M3-000', async () => {
  const [externals, tasks, stages, state, evidence, handoff] = await Promise.all([
    readFile(path.join(pack, '09-外部依赖与人工事项.csv'), 'utf8').then(parseCsv),
    readFile(path.join(pack, '03-任务台账.csv'), 'utf8').then(parseCsv),
    readFile(path.join(pack, 'data', '阶段门禁.csv'), 'utf8').then(parseCsv),
    readJson(path.join(pack, '16-项目状态.json')),
    readJson(evidencePath),
    readFile(handoffPath, 'utf8'),
  ]);
  const ext007 = externals.find(({ DependencyID }) => DependencyID === 'EXT-007');
  const gate = tasks.find(({ TaskID }) => TaskID === 'M2-GATE');
  const m2 = stages.find(({ Stage }) => Stage === 'M2');
  const m3 = stages.find(({ Stage }) => Stage === 'M3');

  assert.equal(ext007.CurrentStatus, 'PROVIDED');
  assert.equal(
    ext007.EvidenceLink,
    'artifacts/verification/M2-GATE/ext-007-category-compliance-confirmation.json',
  );
  assert.equal(
    ext007.ApprovedBy,
    'COMPANY_AUTHORIZED_BUSINESS_COMPLIANCE_REVIEWER',
  );
  assert.equal(gate.Status, 'DONE');
  assert.equal(gate.EvidenceStatus, 'CI_PASS');
  assert.equal(gate.CI, 'CI_PASS');
  assert.equal(m2.Status, 'GATE_PASSED');
  assert.equal(m2.EvidenceStatus, 'CI_PASS');
  assert.equal(m3.Status, 'IN_PROGRESS');
  assert.equal(m3.EvidenceStatus, 'LOCAL_PASS');
  assert.equal(state.execution.status, 'M3_IN_PROGRESS');
  assert.equal(state.execution.currentTask, 'M3-000');
  assert.equal(state.execution.nextAllowedTask, 'M3-000');
  assert.equal(state.execution.activeTaskCount, 1);
  assert.equal(state.execution.lastPassedGate, 'M2-GATE');

  assert.equal(evidence.externalItems.EXT007.status, 'PROVIDED');
  assert.equal(evidence.externalItems.EXT007.blocksStage, false);
  assert.deepEqual(evidence.blockers, []);
  assert.equal(evidence.decision.stagePassed, false);
  assert.equal(evidence.decision.conclusion, 'PENDING_EXACT_HEAD_CI_AND_MERGE');
  assert.equal(evidence.decision.nextAllowedTask, 'M2-GATE');
  assert.equal(evidence.decision.m3Unlocked, false);
  assert.match(handoff, /阶段结论：`IN_PROGRESS`/u);
  assert.match(handoff, /EXT-007.*PROVIDED/u);
  assert.match(handoff, /PENDING_EXACT_HEAD_CI_AND_MERGE/u);
  assert.match(handoff, /M3.*锁定/u);
  assert.doesNotMatch(handoff, /阶段结论：`PASS`/u);
});
