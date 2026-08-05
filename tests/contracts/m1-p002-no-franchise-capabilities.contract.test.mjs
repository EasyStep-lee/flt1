import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  evaluateNoFranchiseCapabilities,
  scanNoFranchiseRepository,
} from '../../scripts/check-no-franchise-capabilities.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

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
      } else if (character === '"') quoted = false;
      else current += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      values.push(current);
      current = '';
    } else current += character;
  }
  values.push(current);
  return values;
};

const readCsv = async (relativePath) => {
  const source = await readFile(path.join(packRoot, relativePath), 'utf8');
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((column, index) => [column, values[index] ?? '']));
  });
};

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

test('M1-P002 remains bound to merged PR 9 and its main CI', async () => {
  const [tasks, p0Rows, evidence] = await Promise.all([
    readCsv('03-任务台账.csv'),
    readCsv('04-P0-1至P0-119验收矩阵.csv'),
    readFile(
      path.join(
        repositoryRoot,
        'artifacts',
        'verification',
        'M1-P002',
        'no-franchise-capabilities.json',
      ),
      'utf8',
    ).then(JSON.parse),
  ]);
  const m1p002 = tasks.find(({ TaskID }) => TaskID === 'M1-P002');
  const p0 = p0Rows.find(({ P0ID }) => P0ID === 'P0-002');

  assert.equal(m1p002?.Status, 'DONE');
  assert.equal(m1p002?.EvidenceStatus, 'CI_PASS');
  assert.equal(
    m1p002?.CommitSHA,
    'fb3c7a5e311d4472778eb63f9ef7351182ddc010',
  );
  assert.equal(m1p002?.PullRequest, '9');
  assert.equal(m1p002?.CI, 'CI_PASS');
  assert.equal(p0?.CurrentEvidenceStatus, 'CI_PASS');
  assert.equal(evidence.result, 'CI_PASS');
  assert.equal(evidence.fullVerification.stepsPassed, 17);
  assert.equal(evidence.github.pullRequest, 9);
  assert.equal(evidence.github.mainPostMergeCi.status, 'CI_PASS');
  assert.equal(
    evidence.sourceState.mergeCommit,
    '6f0adf8f69ceff30ff5834d6d5377cd2d2d9fd46',
  );
  assert.equal(evidence.github.mainPostMergeCi.runId, 30986393602);
});
