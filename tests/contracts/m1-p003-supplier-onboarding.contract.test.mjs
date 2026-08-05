import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

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

test('M1-P003 generated OpenAPI exposes only the five frozen onboarding operations', async () => {
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
  assert.equal(openapi.paths['/v1/supplier/me']?.get, undefined);
  assert.doesNotMatch(JSON.stringify(openapi.paths), /franchise|storefront|direct-payment/iu);
});
