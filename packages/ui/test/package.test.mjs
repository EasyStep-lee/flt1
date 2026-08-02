import assert from 'node:assert/strict';
import test from 'node:test';

import { ShellFrame, foundationTheme } from '../dist/index.js';

test('shared UI package exports presentation-only shell primitives', () => {
  assert.equal(typeof ShellFrame, 'function');
  assert.equal(foundationTheme.colorPrimary, '#0f766e');
  assert.equal(Object.hasOwn(foundationTheme, 'permissions'), false);
});
