import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readText = (...segments) =>
  readFileSync(path.join(repoRoot, ...segments), 'utf8');
const readJson = (...segments) => JSON.parse(readText(...segments));

test('workspace freezes exact OpenAPI toolchain versions and quality commands', () => {
  const root = readJson('package.json');
  assert.equal(root.devDependencies['openapi-typescript'], '7.13.0');
  assert.equal(root.devDependencies.tsx, '4.23.5');
  assert.equal(
    root.pnpm.overrides['@nestjs/swagger@11.4.6>js-yaml'],
    '5.2.2',
  );
  assert.match(root.scripts['openapi:generate'], /scripts\/generate-openapi\.ts/u);
  assert.match(root.scripts['openapi:check'], /check-openapi-generated\.mjs/u);
  assert.match(root.scripts['openapi:breaking'], /check-openapi-breaking\.mjs/u);
  assert.match(root.scripts['test:openapi'], /tests\/openapi/u);

  const api = readJson('apps', 'api', 'package.json');
  assert.equal(api.dependencies['@nestjs/swagger'], '11.4.6');
});

test('all Web applications share the openapi-fetch client package', () => {
  const clientManifest = readJson('packages', 'web-api-client', 'package.json');
  assert.equal(clientManifest.name, '@fulishe/web-api-client');
  assert.equal(clientManifest.dependencies['@fulishe/contracts'], 'workspace:*');
  assert.equal(clientManifest.dependencies['openapi-fetch'], '0.17.0');

  const clientSource = readText('packages', 'web-api-client', 'src', 'index.ts');
  assert.match(clientSource, /createClient<paths>/u);
  assert.match(clientSource, /from 'openapi-fetch'/u);
  assert.match(clientSource, /from '@fulishe\/contracts'/u);

  for (const appName of ['company-admin', 'supplier-portal', 'portal-web']) {
    const manifest = readJson('apps', appName, 'package.json');
    assert.equal(manifest.dependencies['@fulishe/web-api-client'], 'workspace:*');
    const source = readText('apps', appName, 'src', 'api-client.ts');
    assert.match(source, /from '@fulishe\/web-api-client'/u);
    assert.doesNotMatch(source, /from 'openapi-fetch'/u);
    assert.doesNotMatch(source, /\bfetch\s*\(/u);
  }
});

test('both mini-programs reuse generated types through the single wx.request adapter', () => {
  const contractManifest = readJson('packages', 'contracts', 'package.json');
  assert.equal(contractManifest.name, '@fulishe/contracts');
  const contractSource = readText('packages', 'contracts', 'src', 'miniapp-contracts.ts');
  assert.match(contractSource, /import type \{ operations \} from '\.\.\/types\.js'/u);
  assert.match(contractSource, /health\.getLiveness/u);
  assert.match(contractSource, /health\.getReadiness/u);

  for (const appName of ['user-miniapp', 'runner-miniapp']) {
    const manifest = readJson('apps', appName, 'package.json');
    assert.equal(manifest.dependencies['@fulishe/contracts'], 'workspace:*');
    const adapter = readText('apps', appName, 'src', 'request-adapter.ts');
    assert.match(adapter, /FoundationMiniappContracts/u);
    assert.match(adapter, /from '@fulishe\/contracts'/u);
    assert.match(adapter, /from '@fulishe\/miniapp-kit'/u);
    assert.doesNotMatch(adapter, /M0-008 will replace/u);
    assert.doesNotMatch(adapter, /\bfetch\s*\(/u);
    assert.doesNotMatch(adapter, /\bwx\s*\.\s*request\s*\(/u);
  }
});

test('controller response contracts are DTO allowlists and never Prisma entities', () => {
  const controller = readText('apps', 'api', 'src', 'health', 'health.controller.ts');
  assert.match(controller, /@ApiOkResponse\(\{\s*type: HealthLivenessDto/u);
  assert.match(controller, /@ApiOkResponse\(\{\s*type: HealthReadinessDto/u);
  assert.doesNotMatch(controller, /@fulishe\/db|Prisma/u);

  const dtoSources = [
    readText('apps', 'api', 'src', 'health', 'health.dto.ts'),
    readText('apps', 'api', 'src', 'http', 'api-error.dto.ts'),
  ].join('\n');
  assert.doesNotMatch(
    dtoSources,
    /approvedSupplyPrice|grossMargin|supplierPayable|supplyPrice/u,
  );
});
