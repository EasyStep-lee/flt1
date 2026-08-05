import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  evaluateNoFranchiseCapabilities,
  scanNoFranchiseRepository,
} from '../../scripts/check-no-franchise-capabilities.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

const categoryAndCode = ({ category, code }) => ({ category, code });

test('NEG-M1-002-01 detects a franchisee registration or admin route', () => {
  const result = evaluateNoFranchiseCapabilities({
    routes: ['/supplier/register', '/franchisee/register'],
  });

  assert.deepEqual(result.violations.map(categoryAndCode), [
    { category: 'FRANCHISEE_ROUTE', code: 'FORBIDDEN_CAPABILITY' },
  ]);
});

test('NEG-M1-002-02 detects a regional revenue-share capability', () => {
  const result = evaluateNoFranchiseCapabilities({
    routes: ['/v1/regional-revenue-shares'],
  });

  assert.deepEqual(result.violations.map(categoryAndCode), [
    { category: 'REGIONAL_REVENUE_SHARE', code: 'FORBIDDEN_CAPABILITY' },
  ]);
});

test('NEG-M1-002-03 detects a forbidden Prisma entity', () => {
  const result = evaluateNoFranchiseCapabilities({
    prismaSchema: 'model Franchisee {\n  id String @id\n}',
  });

  assert.deepEqual(result.violations.map(categoryAndCode), [
    { category: 'FRANCHISEE_ENTITY', code: 'FORBIDDEN_ENTITY' },
  ]);
});

test('P0-002 repository scan covers schema, migrations, OpenAPI and UI routes', async () => {
  const result = await scanNoFranchiseRepository(repositoryRoot);

  assert.equal(result.policyId, 'NO_FRANCHISEE_CAPABILITIES');
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.violations, []);
  assert.ok(result.checked.schemaFiles >= 1);
  assert.ok(result.checked.migrationFiles >= 1);
  assert.ok(result.checked.openApiPaths >= 1);
  assert.ok(result.checked.applicationRouteFiles >= 1);
});
