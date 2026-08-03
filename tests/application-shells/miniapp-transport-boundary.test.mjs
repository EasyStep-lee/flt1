import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function sourceFiles(directory) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...sourceFiles(fullPath));
    } else if (/\.(?:ts|tsx|js|mjs)$/u.test(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

test('both mini-programs depend on the single miniapp-kit transport package', () => {
  for (const appName of ['user-miniapp', 'runner-miniapp']) {
    const manifest = JSON.parse(
      readFileSync(path.join(repoRoot, 'apps', appName, 'package.json'), 'utf8'),
    );
    assert.equal(manifest.dependencies?.['@fulishe/miniapp-kit'], 'workspace:*');
    const adapterSource = readFileSync(
      path.join(repoRoot, 'apps', appName, 'src', 'request-adapter.ts'),
      'utf8',
    );
    assert.match(adapterSource, /from '@fulishe\/miniapp-kit'/u);
    assert.match(adapterSource, /from '@fulishe\/contracts'/u);
    assert.match(adapterSource, /FoundationMiniappContracts/u);
    assert.doesNotMatch(adapterSource, /M0-008 will replace/u);
  }
});

test('mini-program application source cannot call wx.request or browser fetch directly', () => {
  for (const appName of ['user-miniapp', 'runner-miniapp']) {
    const files = sourceFiles(path.join(repoRoot, 'apps', appName, 'src'));
    const combined = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    assert.doesNotMatch(combined, /\bwx\s*\.\s*request\s*\(/u, `${appName}:DIRECT_WX_REQUEST`);
    assert.doesNotMatch(combined, /\bfetch\s*\(/u, `${appName}:BROWSER_FETCH_FORBIDDEN`);
  }
});

test('miniapp-kit owns one injected runtime request call and no browser fetch fallback', () => {
  const packageRoot = path.join(repoRoot, 'packages', 'miniapp-kit');
  const manifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.name, '@fulishe/miniapp-kit');
  const sources = sourceFiles(path.join(packageRoot, 'src'));
  const combined = sources.map((file) => readFileSync(file, 'utf8')).join('\n');
  assert.equal((combined.match(/runtime\.request(?:<[^>]+>)?\s*\(/gu) ?? []).length, 1);
  assert.doesNotMatch(combined, /\bfetch\s*\(/u);
});

test('user and runner mini-program session namespaces are distinct', () => {
  const namespaces = ['user-miniapp', 'runner-miniapp'].map((appName) => {
    const source = readFileSync(path.join(repoRoot, 'apps', appName, 'src', 'app.ts'), 'utf8');
    const match = source.match(/sessionNamespace:\s*'([^']+)'/u);
    assert.ok(match, `${appName}:SESSION_NAMESPACE_MISSING`);
    return match[1];
  });
  assert.notEqual(namespaces[0], namespaces[1]);
});
