import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const policyId = 'NO_SUPPLIER_STOREFRONT_CAPABILITIES';
const excludedDirectories = new Set([
  '.git',
  '.next',
  'coverage',
  'dist',
  'node_modules',
]);
const applicationRouteExtension = /\.(?:js|jsx|json|ts|tsx|wxml)$/u;
const customerStorefrontRoutePattern =
  /(?:^|\/)(?:suppliers?\/[^/?#]+\/)?(?:storefront|shop|store)(?=$|[/?#-])/iu;
const publicSchemaPattern =
  /(?:Public|Catalog|Consumer|Customer|Enterprise).*(?:Dto|Query|Request|Response)$/iu;
const forbiddenModelPattern =
  /^(?:SupplierStorefront|SupplierStoreDecoration|SupplierPaymentAccount|SupplierDirectSettlement|SupplierStoreCart|SupplierStoreCoupon)$/iu;

const forbiddenPropertyCategories = new Map([
  ['storefrontid', 'SUPPLIER_STOREFRONT'],
  ['supplierstorefrontid', 'SUPPLIER_STOREFRONT'],
  ['supplierstoredecorationid', 'SUPPLIER_STOREFRONT'],
  ['supplierpaymentaccountid', 'SUPPLIER_DIRECT_PAYMENT'],
  ['supplierpayeeid', 'SUPPLIER_DIRECT_PAYMENT'],
  ['supplierdirectsettlementid', 'SUPPLIER_DIRECT_PAYMENT'],
  ['storecartid', 'SUPPLIER_STORE_CART'],
  ['supplierstorecartid', 'SUPPLIER_STORE_CART'],
  ['storecouponownerid', 'SUPPLIER_STORE_CART'],
  ['supplierstorecouponid', 'SUPPLIER_STORE_CART'],
]);

const normalizeKey = (key) => key.replaceAll(/[^a-z0-9]/giu, '').toLowerCase();

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
  if (customerStorefrontRoutePattern.test(value)) {
    addViolation(violations, {
      category: 'SUPPLIER_STOREFRONT',
      code: 'FORBIDDEN_CAPABILITY',
      source,
      value,
    });
  }
};

const inspectSchemaProperties = (violations, schema, source, pathPrefix = '') => {
  if (!schema || typeof schema !== 'object') return;
  for (const [propertyName, propertySchema] of Object.entries(
    schema.properties ?? {},
  )) {
    const category = forbiddenPropertyCategories.get(normalizeKey(propertyName));
    const propertyPath = pathPrefix
      ? `${pathPrefix}.${propertyName}`
      : propertyName;
    if (category) {
      addViolation(violations, {
        category,
        code: 'FORBIDDEN_CAPABILITY',
        source,
        value: propertyPath,
      });
    }
    inspectSchemaProperties(violations, propertySchema, source, propertyPath);
    if (propertySchema && typeof propertySchema === 'object') {
      inspectSchemaProperties(
        violations,
        propertySchema.items,
        source,
        propertyPath,
      );
    }
  }
};

const inspectPrismaSchema = (violations, entry) => {
  const { source, value } = asSourceEntry(entry, 'schema.prisma');
  for (const match of value.matchAll(/\bmodel\s+([A-Za-z][A-Za-z0-9_]*)/gu)) {
    if (forbiddenModelPattern.test(match[1])) {
      addViolation(violations, {
        category: 'SUPPLIER_STOREFRONT',
        code: 'FORBIDDEN_CAPABILITY',
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
    const entityName = match[1]
      .split('_')
      .filter(Boolean)
      .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
      .join('');
    if (forbiddenModelPattern.test(entityName)) {
      addViolation(violations, {
        category: 'SUPPLIER_STOREFRONT',
        code: 'FORBIDDEN_CAPABILITY',
        source,
        value: match[1],
      });
    }
  }
};

export const evaluateNoSupplierStorefront = ({
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
  for (const [name, schema] of Object.entries(
    openApiDocument.components?.schemas ?? {},
  )) {
    if (publicSchemaPattern.test(name)) {
      inspectSchemaProperties(violations, schema, `openapi:schema:${name}`);
    }
    if (forbiddenModelPattern.test(name)) {
      addViolation(violations, {
        category: 'SUPPLIER_STOREFRONT',
        code: 'FORBIDDEN_CAPABILITY',
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

const extractApplicationRoutes = (sourceEntries) => {
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

export const scanNoSupplierStorefrontRepository = async (repositoryRoot) => {
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
  const routes = extractApplicationRoutes(applicationSources);
  const evaluation = evaluateNoSupplierStorefront({
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
  const result = await scanNoSupplierStorefrontRepository(repositoryRoot);
  if (result.status === 'PASS') {
    process.stdout.write(
      `NO_SUPPLIER_STOREFRONT_OK:schemas=${result.checked.schemaFiles}:migrations=${result.checked.migrationFiles}:openapiPaths=${result.checked.openApiPaths}:routeFiles=${result.checked.applicationRouteFiles}\n`,
    );
  } else {
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 1;
  }
}
