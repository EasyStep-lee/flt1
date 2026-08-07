import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const forbidden =
  /companyId|functionalAccountId|identityId|sessionToken|supplyPrice|supplierPayable|grossMargin|bankAccount/iu;

test('API-083 exposes a server-bound company workspace page catalog whitelist', async () => {
  const spec = JSON.parse(
    await readFile(
      path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'),
      'utf8',
    ),
  );
  const operation = spec.paths['/v1/company-auth/workspace/page'].get;
  assert.equal(operation['x-fulishe-contract-id'], 'API-083');
  assert.equal(operation['x-fulishe-actor'], 'COMPANY_FUNCTIONAL_ACCOUNT');
  assert.deepEqual(operation['x-fulishe-error-codes'], [
    'AUTHENTICATION_REQUIRED',
    'AUTH_SESSION_REVOKED',
    'WORKSPACE_FORBIDDEN',
    'DATA_SCOPE_FORBIDDEN',
    'WORKSPACE_MODULE_NOT_FOUND',
    'VALIDATION_FAILED',
  ]);
  assert.deepEqual(operation.security, [{ companyFunctionalSession: [] }]);

  const queryParameters = new Map(
    operation.parameters.map((parameter) => [parameter.name, parameter]),
  );
  assert.deepEqual([...queryParameters.keys()].sort(), [
    'availability',
    'keyword',
    'moduleKey',
    'route',
  ]);
  assert.equal(queryParameters.get('route').required, true);
  assert.deepEqual(queryParameters.get('availability').schema.enum, [
    'ALL',
    'AVAILABLE',
    'DEFERRED',
  ]);

  const schema = spec.components.schemas.CompanyWorkspacePageResponseDto;
  assert.deepEqual([...schema.required].sort(), [
    'accountTypeCode',
    'accountTypeName',
    'filters',
    'items',
    'pageId',
    'selectedModule',
    'summary',
    'workspaceRoute',
  ].sort());
  assert.doesNotMatch(JSON.stringify(schema), forbidden);

  for (const name of [
    'CompanyWorkspacePageFiltersDto',
    'CompanyWorkspacePageSummaryDto',
    'CompanyWorkspaceModuleItemDto',
    'CompanyWorkspaceModuleDetailDto',
    'CompanyWorkspaceModuleTimelineEventDto',
  ]) {
    assert.ok(spec.components.schemas[name], `${name} missing`);
    assert.doesNotMatch(JSON.stringify(spec.components.schemas[name]), forbidden);
  }
});
