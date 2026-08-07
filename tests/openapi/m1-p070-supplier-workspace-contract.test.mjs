import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const spec = JSON.parse(
  readFileSync(path.join(root, 'packages', 'contracts', 'openapi.json'), 'utf8'),
);

const forbidden = new Set([
  'supplierId',
  'functionalAccountId',
  'identityId',
  'sessionToken',
  'supplyPrice',
  'supplyPriceSnapshot',
  'supplierPayable',
  'grossMargin',
  'bankAccount',
]);

const findForbiddenKeys = (value, location = '$') => {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findForbiddenKeys(entry, `${location}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) => [
    ...(forbidden.has(key) ? [`${location}.${key}`] : []),
    ...findForbiddenKeys(entry, `${location}.${key}`),
  ]);
};

test('API-084/API-085 expose supplier functional workspace contracts', () => {
  const current = spec.paths['/v1/supplier-auth/workspace/current']?.get;
  const page = spec.paths['/v1/supplier-auth/workspace/page']?.get;
  assert.ok(current, 'API-084 current supplier workspace is missing');
  assert.ok(page, 'API-085 supplier workspace page is missing');
  assert.equal(current.operationId, 'supplierauth.currentWorkspace');
  assert.equal(page.operationId, 'supplierauth.workspacePage');
  assert.equal(current['x-fulishe-contract-id'], 'API-084');
  assert.equal(page['x-fulishe-contract-id'], 'API-085');
  assert.equal(current['x-fulishe-response-dto'], 'SupplierWorkspaceResponseDto');
  assert.equal(page['x-fulishe-response-dto'], 'SupplierWorkspacePageResponseDto');
  assert.deepEqual(current.security, [{ supplierFunctionalSession: [] }]);
  assert.deepEqual(page.security, [{ supplierFunctionalSession: [] }]);
});

test('supplier workspace DTOs are explicit non-leaking response whitelists', () => {
  const schemas = spec.components.schemas;
  for (const name of [
    'SupplierWorkspaceMenuItemDto',
    'SupplierWorkspaceResponseDto',
    'SupplierWorkspacePageFiltersDto',
    'SupplierWorkspacePageSummaryDto',
    'SupplierWorkspaceModuleItemDto',
    'SupplierWorkspaceModuleDetailDto',
    'SupplierWorkspaceModuleTimelineEventDto',
    'SupplierWorkspacePageResponseDto',
  ]) {
    assert.ok(schemas[name], `${name} is missing`);
    assert.deepEqual(findForbiddenKeys(schemas[name]), [], `${name} leaks a forbidden key`);
  }
  assert.deepEqual(Object.keys(schemas.SupplierWorkspaceResponseDto.properties), [
    'accountTypeCode',
    'accountTypeName',
    'menuItems',
    'pageId',
    'workspaceRoute',
  ]);
});
