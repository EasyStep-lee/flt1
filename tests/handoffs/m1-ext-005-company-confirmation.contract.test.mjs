import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const validatorPath = path.join(
  repositoryRoot,
  'scripts',
  'verify-ext-005-company-confirmation.mjs',
);
const schemaPath = path.join(
  repositoryRoot,
  'docs',
  'contracts',
  'm1',
  'ext-005-company-confirmation.schema.json',
);
const templatePath = path.join(
  repositoryRoot,
  'docs',
  'templates',
  'ext-005-company-confirmation.template.json',
);
const runbookPath = path.join(
  repositoryRoot,
  'docs',
  'runbooks',
  'm1-ext-005-company-confirmation.md',
);
const evidencePath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M1-GATE',
  'ext-005-confirmation-contract.json',
);
const handoffPath = path.join(
  repositoryRoot,
  'docs',
  'handoffs',
  '2026-08-08-M1-gate-ext-005-confirmation-contract.md',
);

const loadValidator = async () => import(pathToFileURL(validatorPath));

const validConfirmation = () => ({
  schemaVersion: '1.0.0',
  dependencyId: 'EXT-005',
  status: 'CONFIRMED',
  confirmationId: 'EXT-005-20260808-A01',
  confirmedAt: '2026-08-08T15:00:00+08:00',
  confirmedBy: {
    authorizedRole: 'COMPANY_AUTHORIZED_REVIEWER',
    identityRef: 'identity://controlled/reviewer-a01',
  },
  customerFacing: {
    legalName: '江苏福礼团供应链科技有限公司',
    displayName: '福礼社',
    customerService: {
      channel: 'PHONE',
      redactedDisplay: '400-***-****',
    },
    invoiceTitle: '江苏福礼团供应链科技有限公司',
  },
  controlledEvidence: {
    businessLicenseRef: 'vault://controlled/ext-005/license-a01',
    customerServiceRef: 'vault://controlled/ext-005/service-a01',
    invoiceProfileRef: 'vault://controlled/ext-005/invoice-a01',
  },
  declarations: {
    businessLicenseReviewed: true,
    customerFacingNameApproved: true,
    customerServiceApproved: true,
    invoiceProfileApproved: true,
    noSensitiveSourceCommitted: true,
  },
});

test('EXT-005 accepts only the minimal redacted confirmation receipt', async () => {
  const { summarizeExt005Confirmation, validateExt005Confirmation } =
    await loadValidator();
  const confirmation = validConfirmation();

  assert.deepEqual(validateExt005Confirmation(confirmation), {
    ok: true,
    errors: [],
  });
  assert.deepEqual(summarizeExt005Confirmation(confirmation), {
    schemaVersion: '1.0.0',
    dependencyId: 'EXT-005',
    status: 'CONFIRMED',
    confirmationId: 'EXT-005-20260808-A01',
    confirmedAt: '2026-08-08T15:00:00+08:00',
    legalName: '江苏福礼团供应链科技有限公司',
  });
});

test('EXT-005 rejects wrong scope, missing approval and sensitive payloads', async () => {
  const { validateExt005Confirmation } = await loadValidator();
  const cases = [
    {
      mutate: (receipt) => {
        receipt.dependencyId = 'EXT-006';
      },
      code: 'DEPENDENCY_ID_INVALID',
    },
    {
      mutate: (receipt) => {
        receipt.customerFacing.legalName = '另一家公司';
      },
      code: 'LEGAL_NAME_INVALID',
    },
    {
      mutate: (receipt) => {
        receipt.confirmedAt = '2026-08-08T15:00:00';
      },
      code: 'CONFIRMED_AT_INVALID',
    },
    {
      mutate: (receipt) => {
        receipt.confirmedBy.identityRef = 'reviewer@example.com';
      },
      code: 'IDENTITY_REF_INVALID',
    },
    {
      mutate: (receipt) => {
        receipt.customerFacing.customerService.redactedDisplay = '13800138000';
      },
      code: 'CUSTOMER_SERVICE_NOT_REDACTED',
    },
    {
      mutate: (receipt) => {
        receipt.controlledEvidence.businessLicenseRef =
          'file:///C:/sensitive/license.png';
      },
      code: 'CONTROLLED_REFERENCE_INVALID',
    },
    {
      mutate: (receipt) => {
        receipt.declarations.invoiceProfileApproved = false;
      },
      code: 'DECLARATION_NOT_CONFIRMED',
    },
    {
      mutate: (receipt) => {
        receipt.customerFacing.creditCode = '91320000123456789X';
      },
      code: 'UNEXPECTED_FIELD',
    },
    {
      mutate: (receipt) => {
        receipt.rawDocument = 'data:image/png;base64,SECRET';
      },
      code: 'UNEXPECTED_FIELD',
    },
  ];

  for (const { code, mutate } of cases) {
    const receipt = validConfirmation();
    mutate(receipt);
    const result = validateExt005Confirmation(receipt);
    assert.equal(result.ok, false, code);
    assert.equal(
      result.errors.some((error) => error.code === code),
      true,
      `${code}: ${JSON.stringify(result.errors)}`,
    );
    assert.equal(
      JSON.stringify(result.errors).includes('91320000123456789X'),
      false,
    );
    assert.equal(JSON.stringify(result.errors).includes('SECRET'), false);
  }
});

test('EXT-005 CLI emits only a safe summary and never echoes rejected values', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'flt1-ext-005-'));
  const validPath = path.join(fixtureRoot, 'valid.json');
  const invalidPath = path.join(fixtureRoot, 'invalid.json');
  const invalid = validConfirmation();
  invalid.customerFacing.customerService.redactedDisplay = '13800138000';

  try {
    await Promise.all([
      writeFile(validPath, JSON.stringify(validConfirmation()), 'utf8'),
      writeFile(invalidPath, JSON.stringify(invalid), 'utf8'),
    ]);

    const accepted = spawnSync(
      process.execPath,
      [validatorPath, '--input', validPath],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(accepted.stdout, /^EXT005_CONFIRMATION_OK:/u);
    assert.match(accepted.stdout, /EXT-005-20260808-A01/u);
    assert.doesNotMatch(accepted.stdout, /vault:\/\//u);
    assert.doesNotMatch(accepted.stdout, /400-/u);

    const rejected = spawnSync(
      process.execPath,
      [validatorPath, '--input', invalidPath],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /CUSTOMER_SERVICE_NOT_REDACTED/u);
    assert.doesNotMatch(rejected.stderr, /13800138000/u);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('EXT-005 schema and operator template cannot masquerade as evidence', async () => {
  const { validateExt005Confirmation } = await loadValidator();
  const [schema, template, runbook] = await Promise.all([
    readFile(schemaPath, 'utf8').then(JSON.parse),
    readFile(templatePath, 'utf8').then(JSON.parse),
    readFile(runbookPath, 'utf8'),
  ]);

  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.dependencyId.const, 'EXT-005');
  assert.deepEqual(schema.properties.status.const, 'CONFIRMED');
  assert.equal(validateExt005Confirmation(template).ok, false);
  assert.match(runbook, /不要.*完整.*营业执照/u);
  assert.match(runbook, /BlocksFormalAcceptance=YES/u);
  assert.match(runbook, /M2.*继续锁定/u);
  assert.match(runbook, /Draft PR #34/u);
});

test('EXT-005 contract evidence preserves the failed environment retry and blocked stage', async () => {
  const [evidence, handoff] = await Promise.all([
    readFile(evidencePath, 'utf8').then(JSON.parse),
    readFile(handoffPath, 'utf8'),
  ]);

  assert.equal(evidence.schemaVersion, '1.0.0');
  assert.equal(evidence.taskId, 'M1-GATE-EXT005-CONTRACT');
  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.stageConclusion, 'BLOCKED_EXTERNAL');
  assert.equal(evidence.externalEvidence.dependencyId, 'EXT-005');
  assert.equal(evidence.externalEvidence.status, 'NOT_PROVIDED');
  assert.equal(evidence.externalEvidence.templateIsEvidence, false);
  assert.equal(evidence.tdd.red.testsFailed, 4);
  assert.equal(evidence.tdd.red.exitCode, 1);
  assert.equal(evidence.tdd.green.testsPassed, 4);
  assert.equal(evidence.tdd.green.exitCode, 0);
  assert.equal(evidence.verification.handoff.testsPassed, 20);
  assert.equal(evidence.verification.m1Contract.testsPassed, 37);
  assert.equal(evidence.verification.firstFullRun.status, 'FAIL');
  assert.equal(
    evidence.verification.firstFullRun.failureCode,
    'DOCKER_ENGINE_UNAVAILABLE',
  );
  assert.equal(evidence.verification.migrationRetry.status, 'PASS');
  assert.equal(evidence.verification.finalFullRun.status, 'PASS_17_OF_17');
  assert.equal(evidence.verification.finalFullRun.p0E2ePassed, 24);
  assert.equal(evidence.verification.finalFullRun.productMigrations, 11);
  assert.equal(evidence.verification.finalFullRun.secretScanTrackedFiles, 515);
  assert.equal(evidence.verification.postEvidenceSecretScan.status, 'PASS');
  assert.equal(
    evidence.verification.postEvidenceSecretScan.trackedFiles,
    522,
  );
  assert.equal(evidence.decision.stagePassed, false);
  assert.equal(evidence.decision.m2Unlocked, false);
  assert.equal(evidence.decision.nextAllowedTask, 'M1-GATE');

  assert.match(handoff, /阶段结论：`BLOCKED_EXTERNAL`/u);
  assert.match(handoff, /DOCKER_ENGINE_UNAVAILABLE/u);
  assert.match(handoff, /17\/17/u);
  assert.match(handoff, /EXT-005.*NOT_PROVIDED/u);
  assert.match(handoff, /模板.*不是.*证据/u);
  assert.match(handoff, /M2.*锁定/u);
  assert.doesNotMatch(handoff, /阶段结论：`PASS`/u);
});
