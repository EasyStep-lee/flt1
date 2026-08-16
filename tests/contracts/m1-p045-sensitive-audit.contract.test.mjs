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

test('M1-P045 evidence remains valid after the project advances', async () => {
  const [state, evidence, taskLedger, p0Ledger, apiLedger, pageLedger] =
    await Promise.all([
      readFile(
        path.join(
          repositoryRoot,
          '福礼社Codex5.6开发执行包V1.1',
          '16-项目状态.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(
        path.join(
          repositoryRoot,
          'artifacts',
          'verification',
          'M1-P045',
          'sensitive-audit.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(
        path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1', '03-任务台账.csv'),
        'utf8',
      ),
      readFile(
        path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1', '04-P0-1至P0-119验收矩阵.csv'),
        'utf8',
      ),
      readFile(
        path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1', '12-OpenAPI-DTO-错误码台账.csv'),
        'utf8',
      ),
      readFile(
        path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1', '08-页面路由接口P0映射.csv'),
        'utf8',
      ),
    ]);

  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.greenEvidence.fullVerify, 'PASS_17_OF_17');
  assert.equal(state.execution.status, 'M3_IN_PROGRESS');
  assert.equal(state.execution.lastCompletedTask, 'M3-P031');
  assert.equal(state.execution.currentTask, state.execution.nextAllowedTask);
  assert.equal(state.execution.currentTask, 'M3-P051');
  assert.equal(state.execution.activeTaskCount, 1);
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M3-P051.*M3-P052/u);
  assert.match(taskLedger, /M1-P045[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M1-GATE[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0Ledger, /P0-045[^\r\n]*CI_PASS/u);
  assert.match(apiLedger, /API-015[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);
  assert.match(pageLedger, /PAGE-012[^\r\n]*IMPLEMENTED[^\r\n]*LOCAL_PASS/u);
});
