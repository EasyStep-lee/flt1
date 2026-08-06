import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

test('M1-P045 generated OpenAPI implements API-015 with a response allowlist', async () => {
  const openapi = JSON.parse(
    await readFile(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
  );
  const operation = openapi.paths['/v1/audit/events']?.get;
  assert.equal(operation?.operationId, 'auditEvents.list');
  assert.match(JSON.stringify(openapi.components.schemas.AuditEventResponseDto), /actorType[\s\S]*actorId[\s\S]*action[\s\S]*beforeSnapshot[\s\S]*afterSnapshot[\s\S]*requestId/u);
  assert.doesNotMatch(
    JSON.stringify(openapi.components.schemas.AuditEventResponseDto),
    /"ip"|mobile|email|bankAccount|supplyPrice|supplierPayable|margin/iu,
  );
});

test('M1-P045 maps PAGE-012 to the company audit-only workspace', async () => {
  const source = await readFile(
    path.join(repositoryRoot, 'apps', 'company-admin', 'src', 'app.tsx'),
    'utf8',
  );
  assert.match(source, /data-page-id="PAGE-012"/u);
  assert.match(source, /data-role="COMPANY_AUDIT"/u);
  assert.match(source, /\/company-admin\/workspaces\/audit/u);
  assert.match(source, /\/v1\/audit\/events/u);
  assert.doesNotMatch(source, /供应价|供应商应付|银行账号/u);
});

test('M1-P045 contract freezes all four negative tests and later action codes', async () => {
  const contract = await readFile(
    path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P045-sensitive-audit.md'),
    'utf8',
  );
  for (const marker of [
    'NEG-M1-045-01',
    'NEG-M1-045-02',
    'NEG-M1-045-03',
    'NEG-M1-045-04',
    'refund.approved',
    'product.force_unpublished',
    'supplier.bank_account.changed',
    'supplier.payment.marked',
  ]) {
    assert.match(contract, new RegExp(marker.replaceAll('.', '\\.'), 'u'));
  }
});
