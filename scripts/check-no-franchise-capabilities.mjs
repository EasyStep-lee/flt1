import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const policyId = 'NO_FRANCHISEE_CAPABILITIES';
const excludedDirectories = new Set([
  '.git',
  '.next',
  'coverage',
  'dist',
  'node_modules',
]);
const applicationRouteExtension = /\.(?:js|jsx|json|ts|tsx|wxml)$/u;
const franchiseRoutePattern =
  /(?:^|[/_-])(?:franchise(?:e)?s?|franchise[-_/]?contracts?|jiameng)(?=$|[/_?&#-])/iu;
const regionalRevenueSharePattern =
  /(?:^|[/_-])(?:regional[-_/]?(?:revenue[-_/]?shares?|split[-_/]?settlements?)|quyu[-_/]?fenzhang)(?=$|[/_?&#-])/iu;
const forbiddenEntityPattern =
  /^(?:Franchisee|FranchiseContract|RegionalAgent|RegionalMerchant|RegionalRevenueShare)$/iu;

const asSourceEntry = (entry, fallbackSource) =>
  typeof entry === 'string'
    ? { source: fallbackSource, value: entry }
    : { source: entry.source ?? fallbackSource, value: entry.value ?? '' };

const addViolation = (violations, violation) => {
  const key = [
    violation.category,
    violation.code,
    violation.source,
    violation.value,
  ].join('\0');
  if (!violations.some((candidate) => candidate.key === key)) {
    violations.push({ key, ...violation });
  }
};

const inspectRoute = (violations, entry) => {
  const { source, value } = asSourceEntry(entry, 'application-route');
  if (regionalRevenueSharePattern.test(value)) {
    addViolation(violations, {
      category: 'REGIONAL_REVENUE_SHARE',
      code: 'FORBIDDEN_CAPABILITY',
      source,
      value,
    });
  } else if (franchiseRoutePattern.test(value)) {
    addViolation(violations, {
      category: 'FRANCHISEE_ROUTE',
      code: 'FORBIDDEN_CAPABILITY',
      source,
      value,
    });
  }
};

const inspectPrismaSchema = (violations, entry) => {
  const { source, value } = asSourceEntry(entry, 'schema.prisma');
  for (const match of value.matchAll(/\bmodel\s+([A-Za-z][A-Za-z0-9_]*)/gu)) {
    if (forbiddenEntityPattern.test(match[1])) {
      addViolation(violations, {
        category: 'FRANCHISEE_ENTITY',
        code: 'FORBIDDEN_ENTITY',
        source,
        value: match[1],
      });
    }
  }
};

const inspectMigration = (violations, entry) => {
  const { source, value } = asSourceEntry(entry, 'migration.sql');
  for (const match of value.matchAll(
    /\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`?([A-Za-z][A-Za-z0-9_]*)`?/giu,
  )) {
    const table = match[1];
    if (regionalRevenueSharePattern.test(table)) {
      addViolation(violations, {
        category: 'REGIONAL_REVENUE_SHARE',
        code: 'FORBIDDEN_CAPABILITY',
        source,
        value: table,
      });
      continue;
    }
    const entityName = table
      .split('_')
      .filter(Boolean)
      .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
      .join('');
    if (forbiddenEntityPattern.test(entityName)) {
      addViolation(violations, {
        category: 'FRANCHISEE_ENTITY',
        code: 'FORBIDDEN_ENTITY',
        source,
        value: table,
      });
    }
  }
};

export const evaluateNoFranchiseCapabilities = ({
  routes = [],
  prismaSchema = '',
  prismaSchemas = [],
  migrations = [],
  openApiDocument = {},
} = {}) => {
  const violations = [];
  for (const route of routes) inspectRoute(violations, route);
  for (const route of Object.keys(openApiDocument.paths ?? {})) {
    inspectRoute(violations, { source: 'openapi:path', value: route });
  }
  for (const name of Object.keys(openApiDocument.components?.schemas ?? {})) {
    if (forbiddenEntityPattern.test(name)) {
      addViolation(violations, {
        category: 'FRANCHISEE_ENTITY',
        code: 'FORBIDDEN_ENTITY',
        source: 'openapi:schema',
        value: name,
      });
    }
  }
  if (prismaSchema) inspectPrismaSchema(violations, prismaSchema);
  for (const schema of prismaSchemas) inspectPrismaSchema(violations, schema);
  for (const migration of migrations) inspectMigration(violations, migration);

  return {
    policyId,
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    violations: violations.map(({ category, code, source, value }) => ({
      category,
      code,
      source,
      value,
    })),
  };
};

const collectFiles = async (directory, predicate) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) {
        files.push(...(await collectFiles(entryPath, predicate)));
      }
    } else if (predicate(entryPath)) {
      files.push(entryPath);
    }
  }
  return files.sort();
};

const relativeSource = (repositoryRoot, filePath) =>
  path.relative(repositoryRoot, filePath).replaceAll(path.sep, '/');

const readSourceEntries = async (repositoryRoot, files) =>
  Promise.all(
    files.map(async (filePath) => ({
      source: relativeSource(repositoryRoot, filePath),
      value: await readFile(filePath, 'utf8'),
    })),
  );

const extractApplicationRoutes = (repositoryRoot, sourceEntries) => {
  const routes = [];
  for (const entry of sourceEntries) {
    const normalizedSource = entry.source.replaceAll('\\', '/');
    const nextPage = normalizedSource.match(
      /^apps\/portal-web\/src\/app\/(.*)\/page\.(?:js|jsx|ts|tsx)$/u,
    );
    if (nextPage) {
      const segments = nextPage[1]
        .split('/')
        .filter((segment) => segment && !/^\(.*\)$/u.test(segment));
      routes.push({
        source: `${entry.source}:next-page`,
        value: `/${segments.join('/')}`,
      });
    } else if (/^apps\/portal-web\/src\/app\/page\./u.test(normalizedSource)) {
      routes.push({ source: `${entry.source}:next-page`, value: '/' });
    }

    for (const match of entry.value.matchAll(
      /["'`]((?:\/|pages\/)[^"'`\s]*)["'`]/gu,
    )) {
      routes.push({
        source: `${entry.source}:route-literal`,
        value: match[1].startsWith('/') ? match[1] : `/${match[1]}`,
      });
    }
  }
  return routes;
};

export const scanNoFranchiseRepository = async (repositoryRoot) => {
  const prismaFiles = await collectFiles(
    path.join(repositoryRoot, 'packages', 'db', 'prisma'),
    (filePath) => filePath.endsWith('.prisma'),
  );
  const migrationFiles = await collectFiles(
    path.join(repositoryRoot, 'packages', 'db', 'prisma', 'migrations'),
    (filePath) => path.basename(filePath) === 'migration.sql',
  );
  const applicationRouteFiles = await collectFiles(
    path.join(repositoryRoot, 'apps'),
    (filePath) => applicationRouteExtension.test(filePath),
  );
  const [prismaSchemas, migrations, applicationSources, openApiSource] =
    await Promise.all([
      readSourceEntries(repositoryRoot, prismaFiles),
      readSourceEntries(repositoryRoot, migrationFiles),
      readSourceEntries(repositoryRoot, applicationRouteFiles),
      readFile(
        path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'),
        'utf8',
      ),
    ]);
  const openApiDocument = JSON.parse(openApiSource);
  const routes = extractApplicationRoutes(repositoryRoot, applicationSources);
  const evaluation = evaluateNoFranchiseCapabilities({
    routes,
    prismaSchemas,
    migrations,
    openApiDocument,
  });

  return {
    ...evaluation,
    checked: {
      schemaFiles: prismaFiles.length,
      migrationFiles: migrationFiles.length,
      openApiPaths: Object.keys(openApiDocument.paths ?? {}).length,
      applicationRouteFiles: applicationRouteFiles.length,
      discoveredRoutes: routes.length,
    },
  };
};

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
  const result = await scanNoFranchiseRepository(repositoryRoot);
  if (result.status === 'PASS') {
    process.stdout.write(
      `NO_FRANCHISE_CAPABILITIES_OK:schemas=${result.checked.schemaFiles}:migrations=${result.checked.migrationFiles}:openapiPaths=${result.checked.openApiPaths}:routeFiles=${result.checked.applicationRouteFiles}\n`,
    );
  } else {
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 1;
  }
}
