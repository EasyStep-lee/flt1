import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

test('M1-P005 generated OpenAPI implements API-013 and API-014 with response allowlists', async () => {
  const openapi = JSON.parse(
    await readFile(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
  );
  const pathItem = openapi.paths['/v1/{ownerType}/functional-accounts'];
  assert.ok(pathItem?.get);
  assert.ok(pathItem?.post);
  assert.equal(pathItem.get.operationId, 'functionalAccounts.list');
  assert.equal(pathItem.post.operationId, 'functionalAccounts.create');
  assert.ok(pathItem.post.responses['428']);
  assert.ok(
    pathItem.post.parameters.some(
      (parameter) => parameter.in === 'header' && parameter.name === 'Idempotency-Key',
    ),
  );

  const responseSchema = JSON.stringify(
    openapi.components.schemas.FunctionalAccountResponseDto,
  );
  for (const field of [
    'id',
    'displayName',
    'accountTypeCode',
    'accountTypeName',
    'workspaceRoute',
    'status',
    'expiresAt',
    'lastLoginAt',
  ]) {
    assert.match(responseSchema, new RegExp(field, 'u'));
  }
  assert.doesNotMatch(
    responseSchema,
    /supplierId|companyId|identityId|mobile|email|supplyPrice|margin/iu,
  );
});

test('M1-P005 portal keeps PAGE-016 and PAGE-024 while P070 adds the fixed workspace gate', async () => {
  const [appSource, workspaceSource] = await Promise.all([
    readFile(
      path.join(repositoryRoot, 'apps', 'supplier-portal', 'src', 'app.tsx'),
      'utf8',
    ),
    readFile(
      path.join(
        repositoryRoot,
        'apps',
        'supplier-portal',
        'src',
        'supplier-workspace-pages.tsx',
      ),
      'utf8',
    ),
  ]);
  assert.match(workspaceSource, /data-page-id=\{workspace\.pageId\}/u);
  assert.match(workspaceSource, /PAGE-016|SUPPLIER_ACCOUNT_ADMIN/u);
  assert.match(appSource, /data-page-id="PAGE-024"/u);
  assert.match(appSource, /\/supplier\/workspaces\/account-admin\/accounts/u);
  assert.match(appSource, /SECOND_VERIFICATION_REQUIRED/u);
  assert.doesNotMatch(`${appSource}\n${workspaceSource}`, /毛利|供应商应付/u);
});

test('M1-P005 implementation contract names every frozen negative check', async () => {
  const contract = await readFile(
    path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P005-functional-accounts.md'),
    'utf8',
  );
  for (const marker of [
    'NEG-M1-005-01',
    'NEG-M1-005-02',
    'NEG-M1-005-03',
    'NEG-M1-005-04',
  ]) {
    assert.match(contract, new RegExp(marker, 'u'));
  }
  assert.match(contract, /M1-P069/u);
  assert.match(contract, /M1-P070/u);
});

test('M1-P005 evidence and ledgers stop at the local verified boundary', async () => {
  const [evidence, state, taskLedger, p0Ledger, apiLedger, pageLedger] =
    await Promise.all([
      readFile(
        path.join(
          repositoryRoot,
          'artifacts',
          'verification',
          'M1-P005',
          'supplier-functional-accounts.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(
        path.join(
          repositoryRoot,
          '福礼社Codex5.6开发执行包V1.1',
          '16-项目状态.json',
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

  assert.equal(evidence.result, 'LOCAL_PASS');
  assert.equal(
    evidence.sourceState.verifiedImplementationHead,
    'f62db171bfd792a60b46b96d6cf04b28d3898399',
  );
  assert.equal(evidence.github.pullRequest, 'NOT_EXECUTED');
  assert.equal(evidence.evidenceBoundary.ci, 'NOT_EXECUTED');
  assert.equal(evidence.fullVerification.stepsPassed, 17);
  assert.equal(
    evidence.fullVerification.commit,
    'f62db171bfd792a60b46b96d6cf04b28d3898399',
  );
  assert.equal(state.execution.currentStage, 'M2');
  assert.equal(state.execution.currentTask, state.execution.nextAllowedTask);
  assert.equal(state.execution.lastCompletedTask, 'M2-P063');
  assert.equal(state.execution.currentTask, 'M2-P071');
  assert.equal(state.execution.activeTaskCount, 1);
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M2-P071.*M2-GATE/u);
  assert.match(taskLedger, /M1-P005[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M1-GATE[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0Ledger, /P0-005[^\r\n]*CI_PASS/u);
  assert.match(apiLedger, /API-013[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);
  assert.match(apiLedger, /API-014[^\r\n]*SECOND_VERIFICATION_REQUIRED[^\r\n]*GENERATED/u);
  assert.match(pageLedger, /PAGE-016[^\r\n]*IMPLEMENTED[^\r\n]*LOCAL_PASS/u);
  assert.match(pageLedger, /PAGE-024[^\r\n]*IMPLEMENTED[^\r\n]*LOCAL_PASS/u);
});
