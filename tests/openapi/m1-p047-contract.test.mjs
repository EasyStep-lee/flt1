import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const executionPackRoot = path.join(
  repoRoot,
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
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(current);
  return values;
};

const readLedgerRows = () => {
  const source = readFileSync(
    path.join(executionPackRoot, '12-OpenAPI-DTO-错误码台账.csv'),
    'utf8',
  );
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
  });
};

const implementedM1ContractIds = new Set([
  'API-005',
  'API-008',
  'API-009',
  'API-010',
  'API-011',
  'API-012',
  'API-013',
  'API-014',
  'API-015',
]);

const schemaName = (schema) => schema?.$ref?.split('/').at(-1);

test('M1-P047 generated operations expose permission, DTO, idempotency and error contracts', () => {
  const spec = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
  );
  const rows = readLedgerRows()
    .filter(({ ContractID }) => implementedM1ContractIds.has(ContractID))
    .sort((left, right) => left.ContractID.localeCompare(right.ContractID));

  assert.equal(rows.length, implementedM1ContractIds.size);
  assert.deepEqual(spec.components.securitySchemes.functionalSession, {
    description: 'Server-bound functional account session; clients cannot select owner scope',
    in: 'cookie',
    name: 'fulishe_session',
    type: 'apiKey',
  });

  for (const row of rows) {
    const operation = spec.paths[row.Path]?.[row.Method.toLowerCase()];
    assert.ok(operation, `${row.ContractID} generated operation is missing`);
    assert.equal(operation['x-fulishe-contract-id'], row.ContractID);
    assert.equal(operation['x-fulishe-actor'], row.Actor);
    assert.equal(operation['x-fulishe-request-dto'], row.RequestDTO);
    assert.equal(operation['x-fulishe-response-dto'], row.ResponseDTO);
    assert.equal(operation['x-fulishe-idempotency'], row.Idempotency);
    assert.equal(
      operation['x-fulishe-response-policy'],
      'NEVER_RETURN_INTERNAL_PRICING',
    );
    assert.deepEqual(
      operation['x-fulishe-error-codes'],
      row.ErrorCodes.split('|'),
    );

    assert.deepEqual(
      operation.security,
      row.Actor === 'PUBLIC' ? [] : [{ functionalSession: [] }],
    );
    const idempotencyHeaders = (operation.parameters ?? []).filter(
      (parameter) =>
        parameter.in === 'header' && parameter.name === 'Idempotency-Key',
    );
    assert.equal(
      idempotencyHeaders.length,
      row.Idempotency === 'Idempotency-Key' ? 1 : 0,
      `${row.ContractID} idempotency header does not match the ledger`,
    );

    const successSchemas = Object.entries(operation.responses)
      .filter(([status]) => /^2\d\d$/u.test(status))
      .map(([, response]) => response.content?.['application/json']?.schema)
      .filter(Boolean);
    assert.equal(successSchemas.length, 1, `${row.ContractID} needs one success DTO`);
    assert.equal(schemaName(successSchemas[0]), row.ResponseDTO);

    const errorEnum = spec.components.schemas.ApiErrorResponseDto.properties.code.enum;
    for (const code of operation['x-fulishe-error-codes']) {
      assert.ok(errorEnum.includes(code), `${row.ContractID} has unknown error code ${code}`);
    }
    for (const [status, response] of Object.entries(operation.responses)) {
      if (/^2\d\d$/u.test(status)) continue;
      assert.equal(
        schemaName(response.content?.['application/json']?.schema),
        'ApiErrorResponseDto',
        `${row.ContractID} ${status} must use the safe error DTO`,
      );
    }
  }
});
