import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  scanSecretFiles,
  scanSecretText,
} from '../../packages/config/dist/secret-scanner.js';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

test('secret scanner detects credential assignments, provider tokens and private keys', () => {
  const providerToken = ['gh', 'p_', 'a'.repeat(36)].join('');
  const privateKey = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const source = [
    `WECHAT_APP_SECRET=${'a1'.repeat(16)}`,
    `GITHUB_TOKEN=${providerToken}`,
    privateKey,
  ].join('\n');

  const findings = scanSecretText(source, 'unsafe.env');

  assert.deepEqual(
    new Set(findings.map((finding) => finding.ruleId)),
    new Set(['credential-assignment', 'github-token', 'private-key']),
  );
  assert.ok(findings.every((finding) => !finding.excerpt.includes(providerToken)));
  assert.ok(findings.every((finding) => !finding.excerpt.includes('a1'.repeat(16))));
});

test('documented placeholders and environment references are allowed', () => {
  const source = [
    'MYSQL_PASSWORD=fulishe_mysql_dev_only',
    'WECHAT_APP_SECRET=replace_with_runtime_secret',
    'DATABASE_URL=${DATABASE_URL:?inject at runtime}',
    'API_HOST=127.0.0.1',
  ].join('\n');

  assert.deepEqual(scanSecretText(source, '.env.example'), []);
});

test('file scan returns only relative paths and never secret values', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fulishe-secret-scan-'));
  const unsafePath = path.join(directory, '.env');
  const safePath = path.join(directory, 'safe.txt');
  const secretValue = ['sk-', 'live-', 'b'.repeat(32)].join('');

  try {
    await writeFile(unsafePath, `PAYMENT_SECRET=${secretValue}\n`, 'utf8');
    await writeFile(safePath, 'PAYMENT_SECRET=replace_with_runtime_secret\n', 'utf8');

    const findings = await scanSecretFiles([unsafePath, safePath], {
      rootDirectory: directory,
    });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].path, '.env');
    assert.doesNotMatch(JSON.stringify(findings), new RegExp(secretValue));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('repository tracks only the approved environment example', () => {
  const tracked = execFileSync(
    'git',
    ['ls-files', '--', '.env', '.env.*'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);

  assert.deepEqual(tracked, ['.env.example']);
});

test('repository secret scan command passes without reading untracked user assets', () => {
  const output = execFileSync(
    process.execPath,
    ['./scripts/scan-secrets.mjs', '--tracked'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );

  assert.match(output, /secret scan passed/i);
});
