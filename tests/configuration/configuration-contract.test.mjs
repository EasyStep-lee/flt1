import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const readJson = async (relativePath) =>
  JSON.parse(
    await readFile(path.join(repositoryRoot, relativePath), 'utf8'),
  );

test('workspace wires configuration validation and secret scan commands', async () => {
  const rootPackage = await readJson('package.json');
  const apiPackage = await readJson('apps/api/package.json');
  const configPackage = await readJson('packages/config/package.json');

  assert.equal(rootPackage.scripts['test:config'], 'pnpm --filter @fulishe/config build && pnpm --filter @fulishe/api build && node --test ./tests/configuration/*.test.mjs');
  assert.equal(rootPackage.scripts['config:check'], 'pnpm --filter @fulishe/config build && node --env-file=.env.example ./scripts/check-config.mjs');
  assert.equal(rootPackage.scripts['secrets:scan'], 'pnpm --filter @fulishe/config build && node ./scripts/scan-secrets.mjs --tracked');
  assert.equal(apiPackage.dependencies['@fulishe/config'], 'workspace:*');
  assert.match(
    apiPackage.scripts['test:infra'],
    /--env-file=\.\.\/\.\.\/\.env\.example --env-file-if-exists=\.\.\/\.\.\/\.env/u,
  );
  assert.match(
    apiPackage.scripts['test:infra:degraded'],
    /--env-file=\.\.\/\.\.\/\.env\.example --env-file-if-exists=\.\.\/\.\.\/\.env/u,
  );
  assert.equal(configPackage.name, '@fulishe/config');
});

test('API consumes the shared configuration and redaction boundary', async () => {
  const runtimeConfigSource = await readFile(
    path.join(repositoryRoot, 'apps/api/src/config/runtime-config.ts'),
    'utf8',
  );
  const loggerSource = await readFile(
    path.join(repositoryRoot, 'apps/api/src/logging/safe-json.logger.ts'),
    'utf8',
  );

  assert.match(runtimeConfigSource, /from '@fulishe\/config'/u);
  assert.match(loggerSource, /redactLogValue/u);
  assert.match(loggerSource, /from '@fulishe\/config'/u);
});

test('environment example identifies its layer and remains development-only', async () => {
  const example = await readFile(path.join(repositoryRoot, '.env.example'), 'utf8');

  assert.match(example, /^APP_ENV=development$/mu);
  assert.match(example, /development-only|dev_only/u);
  assert.doesNotMatch(example, /BEGIN (?:RSA |EC )?PRIVATE KEY/u);
});

test('secret management and rotation policy is documented without provider credentials', async () => {
  const policy = await readFile(
    path.join(repositoryRoot, 'docs/architecture/CONFIGURATION_AND_SECRETS.md'),
    'utf8',
  );

  assert.match(policy, /development.*test.*staging.*production/su);
  assert.match(policy, /轮换/u);
  assert.match(policy, /不得提交/u);
  assert.match(policy, /日志脱敏/u);
  assert.match(policy, /M0-008/u);
});
