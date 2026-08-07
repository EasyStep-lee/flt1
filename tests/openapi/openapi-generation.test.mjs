import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const pnpm = 'pnpm';
const specPath = path.join(repoRoot, 'packages', 'contracts', 'openapi.json');
const typesPath = path.join(repoRoot, 'packages', 'contracts', 'types.ts');
const rootPackagePath = path.join(repoRoot, 'package.json');

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32',
    ...options,
  });

const assertSuccess = (result, label) => {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
};

const forbiddenResponseFields = new Set([
  'approvedSupplyPrice',
  'grossMargin',
  'grossMarginRate',
  'supplierPayable',
  'supplierPayableAmount',
  'supplyPrice',
  'supplyPriceSnapshot',
]);

const findForbiddenKeys = (value, location = '$') => {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      findForbiddenKeys(entry, `${location}[${index}]`),
    );
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value).flatMap(([key, entry]) => {
    const current = `${location}.${key}`;
    const match = forbiddenResponseFields.has(key) ? [current] : [];
    return [...match, ...findForbiddenKeys(entry, current)];
  });
};

test('openapi:generate builds runtime contracts before loading API sources', () => {
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
  const script = rootPackage.scripts?.['openapi:generate'];
  assert.equal(typeof script, 'string');

  const contractsBuild = 'pnpm --filter @fulishe/contracts build';
  const generator = 'tsx --tsconfig ./apps/api/tsconfig.json ./scripts/generate-openapi.ts';
  const contractsBuildIndex = script.indexOf(contractsBuild);
  const generatorIndex = script.indexOf(generator);

  assert.notEqual(
    contractsBuildIndex,
    -1,
    'clean environments must build @fulishe/contracts before OpenAPI generation',
  );
  assert.notEqual(generatorIndex, -1, 'the deterministic OpenAPI generator must remain enabled');
  assert.ok(
    contractsBuildIndex < generatorIndex,
    '@fulishe/contracts must be built before API source modules are loaded',
  );
});

test('NEG-M1-047-02 OpenAPI generation is byte-stable and ignores runtime infrastructure configuration', () => {
  const hostileRuntimeEnvironment = {
    ...process.env,
    APP_ENV: 'production',
    DATABASE_URL: 'not-a-runtime-url',
    NODE_ENV: 'production',
    REDIS_URL: 'not-a-runtime-url',
  };
  const first = run(pnpm, ['openapi:generate'], {
    env: hostileRuntimeEnvironment,
  });
  assertSuccess(first, 'first openapi:generate');
  const firstSpec = readFileSync(specPath);
  const firstTypes = readFileSync(typesPath);

  const second = run(pnpm, ['openapi:generate'], {
    env: hostileRuntimeEnvironment,
  });
  assertSuccess(second, 'second openapi:generate');
  assert.deepEqual(readFileSync(specPath), firstSpec);
  assert.deepEqual(readFileSync(typesPath), firstTypes);
  assert.equal(firstSpec.includes(Buffer.from('\r\n')), false, 'spec must use LF');
  assert.equal(firstTypes.includes(Buffer.from('\r\n')), false, 'types must use LF');
});

test('generated contract exposes health, merchant identity, supplier onboarding and functional account APIs', () => {
  const generated = run(pnpm, ['openapi:generate']);
  assertSuccess(generated, 'openapi:generate');

  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  assert.equal(spec.openapi, '3.0.0');
  assert.deepEqual(Object.keys(spec.paths), [
    '/health/live',
    '/health/ready',
    '/v1/audit/events',
    '/v1/company-auth/login',
    '/v1/company-auth/workspace/current',
    '/v1/company-auth/workspace/page',
    '/v1/company-auth/workspaces/{accountId}/select',
    '/v1/company/suppliers',
    '/v1/company/suppliers/{supplierId}/review',
    '/v1/public/merchant-profile',
    '/v1/supplier/me',
    '/v1/supplier/me/submit-review',
    '/v1/suppliers/registrations',
    '/v1/{ownerType}/functional-accounts',
  ]);
  assert.equal(spec.paths['/health/live'].get.operationId, 'health.getLiveness');
  assert.equal(spec.paths['/health/ready'].get.operationId, 'health.getReadiness');
  assert.equal(
    spec.paths['/v1/public/merchant-profile'].get.operationId,
    'publicMerchant.getProfile',
  );
  assert.equal(
    spec.paths['/v1/company-auth/workspace/current'].get.operationId,
    'companyauth.currentWorkspace',
  );
  assert.equal(
    spec.paths['/v1/company-auth/workspace/page'].get.operationId,
    'companyauth.workspacePage',
  );
  assert.equal(
    spec.paths['/v1/company/suppliers'].get.operationId,
    'companySupplierOnboarding.list',
  );
  assert.equal(
    spec.paths['/v1/company/suppliers/{supplierId}/review'].post.operationId,
    'companySupplierOnboarding.review',
  );
  assert.equal(
    spec.paths['/v1/supplier/me'].patch.operationId,
    'supplierOnboarding.patchOwnProfile',
  );
  assert.equal(
    spec.paths['/v1/supplier/me/submit-review'].post.operationId,
    'supplierOnboarding.submitOwnProfile',
  );
  assert.equal(
    spec.paths['/v1/suppliers/registrations'].post.operationId,
    'supplierRegistration.create',
  );
  assert.equal(
    spec.paths['/v1/{ownerType}/functional-accounts'].get.operationId,
    'functionalAccounts.list',
  );
  assert.equal(
    spec.paths['/v1/{ownerType}/functional-accounts'].post.operationId,
    'functionalAccounts.create',
  );
  assert.deepEqual(
    Object.keys(spec.components.schemas),
    [
      'ApiErrorResponseDto',
      'ApprovalTaskResponseDto',
      'AuditEventPageResponseDto',
      'AuditEventResponseDto',
      'AuditQueryDto',
      'CompanyLoginRequestDto',
      'CompanyWorkspaceMenuItemDto',
      'CompanyWorkspaceModuleDetailDto',
      'CompanyWorkspaceModuleItemDto',
      'CompanyWorkspaceModuleTimelineEventDto',
      'CompanyWorkspacePageFiltersDto',
      'CompanyWorkspacePageResponseDto',
      'CompanyWorkspacePageSummaryDto',
      'CompanyWorkspaceResponseDto',
      'CreateFunctionalAccountRequestDto',
      'FoundationDependencyCheckDto',
      'FunctionalAccountPageResponseDto',
      'FunctionalAccountQueryDto',
      'FunctionalAccountResponseDto',
      'HealthLivenessDto',
      'HealthReadinessChecksDto',
      'HealthReadinessDto',
      'PublicMerchantProfileQuery',
      'PublicMerchantProfileResponse',
      'PublicMerchantSubjectsDto',
      'SelectWorkspaceRequestDto',
      'SessionResponseDto',
      'SubmitReviewRequestDto',
      'SupplierPageResponseDto',
      'SupplierProfilePatchRequestDto',
      'SupplierProfileResponseDto',
      'SupplierQualificationSnapshotDto',
      'SupplierQualificationSummaryDto',
      'SupplierQueryDto',
      'SupplierRegistrationRequestDto',
      'SupplierRegistrationResponseDto',
      'SupplierResponseDto',
      'SupplierReviewRequestDto',
      'WorkspaceChoiceDto',
      'WorkspaceChoiceResponseDto',
    ],
  );
  assert.deepEqual(
    Object.keys(
      spec.components.schemas.PublicMerchantProfileResponse.properties,
    ),
    ['legalName', 'platformName', 'subjects'],
  );
  assert.deepEqual(
    Object.keys(spec.components.schemas.PublicMerchantSubjectsDto.properties),
    ['paymentPayee', 'refundOperator', 'seller'],
  );
  assert.deepEqual(findForbiddenKeys(spec), []);

  const generatedTypes = readFileSync(typesPath, 'utf8');
  assert.match(generatedTypes, /export interface paths/u);
  assert.match(generatedTypes, /"health\.getLiveness"/u);
  assert.match(generatedTypes, /"publicMerchant\.getProfile"/u);
  assert.match(generatedTypes, /"supplierRegistration\.create"/u);
  assert.match(generatedTypes, /"supplierOnboarding\.submitOwnProfile"/u);
  assert.match(generatedTypes, /"companySupplierOnboarding\.review"/u);
  assert.match(generatedTypes, /"functionalAccounts\.create"/u);
  assert.match(generatedTypes, /"companyauth\.login"/u);
  assert.match(generatedTypes, /"companyauth\.selectWorkspace"/u);
  assert.match(generatedTypes, /ApiErrorResponseDto/u);
  assert.doesNotMatch(
    generatedTypes,
    /approvedSupplyPrice|grossMargin|supplierPayable|supplyPrice/u,
  );
});

test('openapi:check detects spec drift without rewriting the expected files', () => {
  const generated = run(pnpm, ['openapi:generate']);
  assertSuccess(generated, 'openapi:generate');

  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'fulishe-openapi-drift-'));
  const expectedSpec = path.join(fixtureRoot, 'openapi.json');
  const expectedTypes = path.join(fixtureRoot, 'types.ts');
  const mutated = JSON.parse(readFileSync(specPath, 'utf8'));
  mutated.info.title = 'unauthorized contract drift';
  writeFileSync(expectedSpec, `${JSON.stringify(mutated, null, 2)}\n`, 'utf8');
  writeFileSync(expectedTypes, readFileSync(typesPath));

  const drift = run('node', [
    './scripts/check-openapi-generated.mjs',
    '--expected-openapi',
    expectedSpec,
    '--expected-types',
    expectedTypes,
  ]);
  assert.notEqual(drift.status, 0);
  assert.match(`${drift.stdout}\n${drift.stderr}`, /OPENAPI_SPEC_DRIFT/u);
  assert.equal(JSON.parse(readFileSync(expectedSpec, 'utf8')).info.title, 'unauthorized contract drift');

  const clean = run(pnpm, ['openapi:check']);
  assertSuccess(clean, 'openapi:check');
});
