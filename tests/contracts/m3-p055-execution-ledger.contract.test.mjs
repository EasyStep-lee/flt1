import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function parseCsv(source) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted && character === '"' && source[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\r' || character === '\n') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }

  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])));
}

test('API-104 execution ledger preserves consumer supply-price isolation and additional-contract traceability', async () => {
  const source = await readFile(
    new URL('../../福礼社Codex5.6开发执行包V1.1/12-OpenAPI-DTO-错误码台账.csv', import.meta.url),
    'utf8',
  );
  const api104 = parseCsv(source).find(({ ContractID }) => ContractID === 'API-104');

  assert.ok(api104);
  assert.match(api104.P0, /^P0-/u);
  assert.equal(api104.OpenAPIStatus, 'GENERATED');
  assert.equal(api104.DTOStatus, 'IMPLEMENTED');
  assert.equal(api104.ErrorCodeStatus, 'IMPLEMENTED');
  assert.match(api104.Notes, /任务内契约细化/u);
  assert.match(api104.SensitiveFieldPolicy, /^NEVER_RETURN/u);
  assert.match(api104.SensitiveFieldPolicy, /supplyPrice/u);
});
