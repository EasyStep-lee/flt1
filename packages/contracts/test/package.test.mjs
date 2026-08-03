import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('generated contract package contains OpenAPI and TypeScript artifacts', () => {
  const spec = JSON.parse(
    readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'),
  );
  const types = readFileSync(new URL('../types.ts', import.meta.url), 'utf8');
  assert.equal(spec.openapi, '3.0.0');
  assert.match(types, /export interface paths/u);
});
