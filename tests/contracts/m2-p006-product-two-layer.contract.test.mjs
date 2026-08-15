import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const executionPackRoot = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
);

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      values.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  assert.equal(quoted, false, 'unterminated quoted CSV field');
  values.push(current);
  return values;
};

const readCsv = async (relativePath) => {
  const source = await readFile(path.join(executionPackRoot, relativePath), 'utf8');
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
  });
};

test('M2-P006 persists the supplier submission and company sellable layers separately', async () => {
  const [schema, migration] = await Promise.all([
    readFile(path.join(repositoryRoot, 'packages/db/prisma/schema.prisma'), 'utf8'),
    readFile(
      path.join(
        repositoryRoot,
        'packages/db/prisma/migrations/20260809074000_m2_product_two_layer_model/migration.sql',
      ),
      'utf8',
    ),
  ]);

  for (const model of ['SupplierProduct', 'SupplierProductSku', 'Product', 'Sku']) {
    assert.match(schema, new RegExp(`model ${model} \\{`, 'u'));
  }
  assert.match(migration, /UNIQUE INDEX `product_supplier_product_key` \(`supplier_product_id`\)/u);
  assert.match(migration, /UNIQUE INDEX `sku_supplier_product_sku_key` \(`supplier_product_sku_id`\)/u);
  assert.match(migration, /supplier_product_status_history_immutable_update/u);
  assert.match(migration, /supplier_product_status_history_immutable_delete/u);
});

test('M2-P006 OpenAPI keeps ownership and every price field out of supplier product responses', async () => {
  const openapi = JSON.parse(
    await readFile(path.join(repositoryRoot, 'packages/contracts/openapi.json'), 'utf8'),
  );

  assert.ok(openapi.paths['/v1/supplier/products']?.post);
  assert.ok(openapi.paths['/v1/supplier/products/{supplierProductId}']?.patch);
  assert.ok(
    openapi.paths['/v1/supplier/products/{supplierProductId}/submit-material']?.post,
  );

  const responseProperties =
    openapi.components.schemas.SupplierProductResponseDto.properties;
  for (const forbidden of [
    'supplierId',
    'companyId',
    'functionalAccountId',
    'supplyPrice',
    'requestedSupplyPrice',
    'retailSalePrice',
    'enterpriseSalePrice',
  ]) {
    assert.equal(responseProperties[forbidden], undefined, forbidden);
  }
  const skuProperties =
    openapi.components.schemas.SupplierProductSkuResponseDto.properties;
  assert.equal(
    Object.keys(skuProperties).some((key) => /price/iu.test(key)),
    false,
  );
});

test('M2-P006 and M2-P007 retain merged-main evidence after M2-P008 starts locally', async () => {
  const [tasks, p0Rows, stages, projectStatus, contract, handoff] = await Promise.all([
    readCsv('03-任务台账.csv'),
    readCsv('04-P0-1至P0-119验收矩阵.csv'),
    readCsv(path.join('data', '阶段门禁.csv')),
    readFile(path.join(executionPackRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
    readFile(
      path.join(repositoryRoot, 'docs/contracts/m2/M2-P006-product-two-layer.md'),
      'utf8',
    ),
    readFile(
      path.join(repositoryRoot, 'docs/handoffs/2026-08-09-M2-P006-product-two-layer.md'),
      'utf8',
    ),
  ]);

  const m2p006 = tasks.find(({ TaskID }) => TaskID === 'M2-P006');
  const m2p007 = tasks.find(({ TaskID }) => TaskID === 'M2-P007');
  const p0006 = p0Rows.find(({ P0ID }) => P0ID === 'P0-006');
  const m2 = stages.find(({ Stage }) => Stage === 'M2');

  assert.equal(m2p006.Status, 'DONE');
  assert.equal(m2p006.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p006.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/37');
  assert.equal(m2p006.Branch, 'codex/m2-product-model');
  assert.equal(m2p006.CI, 'CI_PASS');
  assert.equal(m2p007.Status, 'DONE');
  assert.equal(m2p007.EvidenceStatus, 'CI_PASS');
  assert.equal(p0006.CurrentEvidenceStatus, 'CI_PASS');
  assert.equal(m2.Status, 'GATE_PASSED');
  assert.equal(m2.EvidenceStatus, 'CI_PASS');

  assert.equal(projectStatus.execution.status, 'M3_IN_PROGRESS');
  assert.equal(projectStatus.execution.currentTask, 'M3-P030');
  assert.equal(projectStatus.execution.nextAllowedTask, projectStatus.execution.currentTask);
  assert.equal(projectStatus.execution.lastCompletedTask, 'M3-P029');
  assert.equal(projectStatus.execution.activeTaskCount, 1);
  assert.equal(
    projectStatus.github.currentTaskDelivery.taskId,
    projectStatus.execution.currentTask,
  );
  assert.ok(
    projectStatus.github.currentTaskDelivery.pullRequest === null ||
      Number.isInteger(projectStatus.github.currentTaskDelivery.pullRequest),
  );
  assert.ok(
    ['NOT_CREATED', 'DRAFT'].includes(projectStatus.github.currentTaskDelivery.pullRequestState),
  );
  assert.ok(
    projectStatus.github.currentTaskDelivery.exactHeadCi === 'NOT_EXECUTED' ||
      projectStatus.github.currentTaskDelivery.exactHeadCi.startsWith('CI_PASS_RUN_'),
  );
  assert.equal(projectStatus.github.currentTaskDelivery.merge, 'NOT_EXECUTED');
  assert.equal(projectStatus.github.currentTaskDelivery.mainPostMergeCi, 'NOT_EXECUTED');
  assert.equal(
    projectStatus.github.currentTaskDelivery.blockingExternalItem,
    'REAL_DOMAIN_DNS_TLS_ICP_M5_CMS_STAGING_PRODUCTION',
  );
  assert.equal(projectStatus.github.currentTaskDelivery.nextTaskUnlocked, false);
  assert.match(projectStatus.evidence.ci, /^(?:NOT_EXECUTED|CI_PASS_M3_P030_HEAD_[0-9a-f]{7})$/u);

  for (const evidence of [contract, handoff]) {
    assert.match(evidence, /P0-006/u);
    assert.match(evidence, /LOCAL_PASS/u);
    assert.match(evidence, /M2-P007/u);
    assert.match(evidence, /NOT_EXECUTED/u);
  }
});
