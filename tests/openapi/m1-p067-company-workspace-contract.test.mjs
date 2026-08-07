import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');

test('API-082 exposes only the current fixed company workspace DTO', async () => {
  const spec = JSON.parse(
    await readFile(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
  );
  const operation = spec.paths['/v1/company-auth/workspace/current'].get;
  assert.equal(operation['x-fulishe-contract-id'], 'API-082');
  assert.equal(operation['x-fulishe-actor'], 'COMPANY_FUNCTIONAL_ACCOUNT');
  assert.deepEqual(operation['x-fulishe-error-codes'], [
    'AUTHENTICATION_REQUIRED',
    'AUTH_SESSION_REVOKED',
    'WORKSPACE_FORBIDDEN',
    'VALIDATION_FAILED',
  ]);
  assert.deepEqual(operation.security, [{ companyFunctionalSession: [] }]);
  assert.deepEqual(spec.components.securitySchemes.companyFunctionalSession, {
    description: 'Secure HttpOnly company functional account session',
    in: 'cookie',
    name: '__Host-fulishe-company-admin',
    type: 'apiKey',
  });

  const schema = spec.components.schemas.CompanyWorkspaceResponseDto;
  assert.deepEqual([...schema.required].sort(), [
    'accountTypeCode',
    'accountTypeName',
    'menuItems',
    'pageId',
    'workspaceRoute',
  ].sort());
  const serialized = JSON.stringify(schema);
  assert.doesNotMatch(serialized, /companyId|identityId|sessionToken|supplyPrice/iu);
});
