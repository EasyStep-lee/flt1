import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectMigrationIntegrity } from './check-prisma-migrations.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const composePath = path.join(repositoryRoot, 'compose.yaml');
const productSchemaPath = path.join(
  repositoryRoot,
  'packages',
  'db',
  'prisma',
  'schema.prisma',
);
const productMigrationRoot = path.join(
  repositoryRoot,
  'packages',
  'db',
  'prisma',
  'migrations',
);
const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const rehearsalDatabasePattern = /^fulishe_m0_010_[a-z0-9_]{6,48}$/u;
const rehearsalUserPattern = /^flt_m0_[a-f0-9]{12}$/u;
const temporaryRootPrefix = path.join(tmpdir(), 'fulishe-m0-010-');

const baselineMigrationName = '20260802000000_m0_rehearsal_baseline';
const forwardMigrationName = '20260802000100_m0_rehearsal_forward_fix';
const probeTable = 'm0_migration_rehearsal_probe';

const rehearsalSchema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model M0MigrationRehearsalProbe {
  id            Int    @id
  payload       String @db.VarChar(64)
  forwardMarker String @default("forward-fixed") @map("forward_marker") @db.VarChar(32)

  @@map("m0_migration_rehearsal_probe")
}
`;

const baselineMigrationSql = `CREATE TABLE \`m0_migration_rehearsal_probe\` (
  \`id\` INTEGER NOT NULL,
  \`payload\` VARCHAR(64) NOT NULL,
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`;

const forwardMigrationSql = `ALTER TABLE \`m0_migration_rehearsal_probe\`
  ADD COLUMN \`forward_marker\` VARCHAR(32) NOT NULL DEFAULT 'forward-fixed';
`;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const redact = (value, secrets = []) => {
  let output = String(value ?? '');
  for (const secret of secrets.filter(Boolean)) {
    output = output.split(secret).join('<redacted>');
  }
  return output;
};

const runCommand = (
  command,
  arguments_,
  {
    cwd = repositoryRoot,
    env = process.env,
    input,
    label,
    secrets = [],
    shell = false,
  } = {},
) => {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: 'utf8',
    env,
    input,
    maxBuffer: 32 * 1024 * 1024,
    shell,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${label ?? command} failed (${result.status})\nstdout:\n${redact(result.stdout, secrets)}\nstderr:\n${redact(result.stderr, secrets)}`,
    );
  }
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

const runCompose = (arguments_, options = {}) =>
  runCommand('docker', ['compose', '-f', composePath, ...arguments_], {
    label: `docker compose ${arguments_.join(' ')}`,
    ...options,
  });

const listComposeServices = (additionalArguments = []) => {
  const { stdout } = runCompose(['ps', ...additionalArguments, '--services']);
  return new Set(stdout.split(/\r?\n/u).filter(Boolean));
};

const runRootMysql = (sql, database, additionalSecrets = []) => {
  const shellScript = database
    ? 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --protocol=socket --user=root --default-character-set=utf8mb4 --batch --skip-column-names --raw "$1"'
    : 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --protocol=socket --user=root --default-character-set=utf8mb4 --batch --skip-column-names --raw';
  const arguments_ = [
    'exec',
    '-T',
    'mysql',
    'sh',
    '-lc',
    shellScript,
    'sh',
  ];
  if (database) arguments_.push(database);
  return runCompose(arguments_, {
    input: sql,
    secrets: [sql, ...additionalSecrets],
  }).stdout.trim();
};

const createLogicalBackup = (database) => {
  const shellScript =
    'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysqldump --protocol=socket --user=root --single-transaction --skip-lock-tables --routines --events --triggers --set-gtid-purged=OFF --no-tablespaces --skip-comments --skip-dump-date "$1"';
  return runCompose(
    ['exec', '-T', 'mysql', 'sh', '-lc', shellScript, 'sh', database],
    { secrets: [database] },
  ).stdout;
};

const assertSafeDatabaseName = (database, configuredDatabase) => {
  if (
    !rehearsalDatabasePattern.test(database) ||
    database === configuredDatabase
  ) {
    throw new Error(`UNSAFE_REHEARSAL_DATABASE_NAME:${database}`);
  }
};

const assertSafeUserName = (user) => {
  if (!rehearsalUserPattern.test(user)) {
    throw new Error(`UNSAFE_REHEARSAL_USER_NAME:${user}`);
  }
};

const databaseUrl = ({ user, password, port, database }) => {
  const url = new URL('mysql://127.0.0.1');
  url.username = user;
  url.password = password;
  url.port = String(port);
  url.pathname = `/${database}`;
  url.searchParams.set('connect_timeout', '5');
  url.searchParams.set('pool_timeout', '5');
  return url.toString();
};

const runPrisma = (arguments_, url, label, secrets) =>
  runCommand(
    pnpmExecutable,
    ['--filter', '@fulishe/db', 'exec', 'prisma', ...arguments_],
    {
      env: { ...process.env, DATABASE_URL: url },
      label,
      secrets: [url, ...secrets],
      shell: process.platform === 'win32',
    },
  );

const parseProbeState = (output) => {
  const values = output.split(/\r?\n/u);
  if (values.length !== 4) {
    throw new Error(`REHEARSAL_PROBE_OUTPUT_INVALID:${output}`);
  }
  return {
    appliedMigrations: Number(values[0]),
    payload: values[1],
    forwardColumnCount: Number(values[2]),
    forwardMarker: values[3],
  };
};

const readProbeState = (database) =>
  parseProbeState(
    runRootMysql(
      `SELECT COUNT(*) FROM \`_prisma_migrations\` WHERE \`finished_at\` IS NOT NULL AND \`rolled_back_at\` IS NULL;
SELECT \`payload\` FROM \`${probeTable}\` WHERE \`id\` = 1;
SELECT COUNT(*) FROM \`information_schema\`.\`columns\` WHERE \`table_schema\` = DATABASE() AND \`table_name\` = '${probeTable}' AND \`column_name\` = 'forward_marker';
SELECT COALESCE(MAX(\`forward_marker\`), '<absent>') FROM \`${probeTable}\` WHERE \`id\` = 1;
`,
      database,
    ),
  );

const readBaselineProbeState = (database) => {
  const output = runRootMysql(
    `SELECT COUNT(*) FROM \`_prisma_migrations\` WHERE \`finished_at\` IS NOT NULL AND \`rolled_back_at\` IS NULL;
SELECT \`payload\` FROM \`${probeTable}\` WHERE \`id\` = 1;
SELECT COUNT(*) FROM \`information_schema\`.\`columns\` WHERE \`table_schema\` = DATABASE() AND \`table_name\` = '${probeTable}' AND \`column_name\` = 'forward_marker';
`,
    database,
  );
  const values = output.split(/\r?\n/u);
  if (values.length !== 3) {
    throw new Error(`REHEARSAL_BASELINE_PROBE_OUTPUT_INVALID:${output}`);
  }
  return {
    appliedMigrations: Number(values[0]),
    payload: values[1],
    forwardColumnCount: Number(values[2]),
  };
};

const assertState = (condition, code) => {
  if (!condition) throw new Error(code);
};

const expectRootMysqlFailure = (
  sql,
  database,
  failureCode,
  additionalSecrets = [],
) => {
  let rejected = false;
  try {
    runRootMysql(sql, database, additionalSecrets);
  } catch {
    rejected = true;
  }
  assertState(rejected, failureCode);
};

const readProductCompanyState = (database) => {
  const output = runRootMysql(
    `SELECT COUNT(*) FROM \`_prisma_migrations\` WHERE \`finished_at\` IS NOT NULL AND \`rolled_back_at\` IS NULL;
SELECT COUNT(*) FROM \`company\`;
SELECT COALESCE(MAX(CONCAT(\`legal_name\`, '|', \`platform_name\`)), '<absent>') FROM \`company\`;
SELECT COUNT(*) FROM \`information_schema\`.\`table_constraints\` WHERE \`constraint_schema\` = DATABASE() AND \`table_name\` = 'company' AND \`constraint_type\` = 'CHECK';
SELECT COUNT(*) FROM \`information_schema\`.\`statistics\` WHERE \`table_schema\` = DATABASE() AND \`table_name\` = 'company' AND \`index_name\` IN ('company_legal_name_key', 'company_platform_name_key') AND \`non_unique\` = 0;
SELECT COUNT(*) FROM \`supplier\`;
SELECT COALESCE(MAX(CONCAT(\`status\`, '|', \`version\`)), '<absent>|0') FROM \`supplier\`;
SELECT COUNT(*) FROM \`information_schema\`.\`tables\` WHERE \`table_schema\` = DATABASE() AND \`table_name\` IN ('supplier', 'approval_task', 'supplier_status_history', 'supplier_onboarding_command');
SELECT COUNT(*) FROM \`information_schema\`.\`statistics\` WHERE \`table_schema\` = DATABASE() AND \`table_name\` = 'supplier' AND \`index_name\` = 'supplier_credit_code_key' AND \`non_unique\` = 0;
SELECT COUNT(*) FROM \`information_schema\`.\`referential_constraints\` WHERE \`constraint_schema\` = DATABASE() AND \`constraint_name\` IN ('supplier_company_id_fkey', 'supplier_status_history_supplier_id_fkey');
SELECT COUNT(*) FROM \`approval_task\`;
SELECT COUNT(*) FROM \`supplier_status_history\`;
SELECT COUNT(*) FROM \`functional_account_type\` WHERE \`owner_type\` = 'SUPPLIER' AND \`status\` = 'ACTIVE';
SELECT COUNT(DISTINCT \`workspace_route\`) FROM \`functional_account_type\` WHERE \`owner_type\` = 'SUPPLIER' AND \`status\` = 'ACTIVE';
SELECT COUNT(*) FROM \`information_schema\`.\`tables\` WHERE \`table_schema\` = DATABASE() AND \`table_name\` IN ('functional_account_type', 'supplier_user', 'functional_account', 'functional_account_status_history', 'functional_account_command');
SELECT COUNT(*) FROM \`information_schema\`.\`referential_constraints\` WHERE \`constraint_schema\` = DATABASE() AND \`constraint_name\` IN ('supplier_user_supplier_id_fkey', 'functional_account_supplier_id_fkey', 'functional_account_identity_id_fkey', 'functional_account_account_type_id_fkey', 'functional_account_history_account_id_fkey');
`,
    database,
  );
  const values = output.split(/\r?\n/u);
  if (values.length !== 16) {
    throw new Error(`PRODUCT_COMPANY_PROBE_OUTPUT_INVALID:${output}`);
  }
  const [legalName, platformName] = values[2].split('|');
  const [supplierStatus, supplierVersion] = values[6].split('|');
  return {
    appliedMigrations: Number(values[0]),
    companyRowCount: Number(values[1]),
    legalName,
    platformName,
    checkConstraintCount: Number(values[3]),
    uniqueIdentityIndexCount: Number(values[4]),
    supplierRowCount: Number(values[5]),
    supplierStatus,
    supplierVersion: Number(supplierVersion),
    onboardingTableCount: Number(values[7]),
    uniqueCreditIndexCount: Number(values[8]),
    ownershipForeignKeyCount: Number(values[9]),
    approvalTaskCount: Number(values[10]),
    statusHistoryCount: Number(values[11]),
    activeSupplierAccountTypeCount: Number(values[12]),
    uniqueSupplierWorkspaceRouteCount: Number(values[13]),
    functionalAccountTableCount: Number(values[14]),
    functionalAccountForeignKeyCount: Number(values[15]),
  };
};

const writeMigration = async (migrationRoot, name, sql) => {
  const directory = path.join(migrationRoot, name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'migration.sql'), sql, 'utf8');
};

const countProductMigrationSql = async () => {
  const entries = await readdir(productMigrationRoot, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const migrationPath = path.join(
      productMigrationRoot,
      entry.name,
      'migration.sql',
    );
    try {
      if ((await stat(migrationPath)).isFile()) count += 1;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return count;
};

const gitCommit = () =>
  runCommand('git', ['rev-parse', 'HEAD'], { label: 'git rev-parse HEAD' })
    .stdout.trim();

const parseArguments = (arguments_) => {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--report') {
      options.report = arguments_[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    throw new Error(`MIGRATION_REHEARSAL_ARGUMENT_UNSUPPORTED:${argument}`);
  }

  if (options.report !== undefined) {
    if (!options.report) throw new Error('MIGRATION_REHEARSAL_REPORT_PATH_MISSING');
    const reportPath = path.resolve(repositoryRoot, options.report);
    const allowedScopes = new Map([
      [
        path.join(repositoryRoot, 'artifacts', 'verification', 'M0-010'),
        'M0-010',
      ],
      [
        path.join(repositoryRoot, 'artifacts', 'verification', 'M1-P001'),
        'M1-P001',
      ],
      [
        path.join(repositoryRoot, 'artifacts', 'verification', 'M1-P003'),
        'M1-P003',
      ],
      [
        path.join(repositoryRoot, 'artifacts', 'verification', 'M1-P005'),
        'M1-P005',
      ],
    ]);
    const reportScope = [...allowedScopes.entries()].find(([allowedRoot]) => {
      const relative = path.relative(allowedRoot, reportPath);
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    });
    if (!reportScope) {
      throw new Error(
        'MIGRATION_REHEARSAL_REPORT_PATH_OUTSIDE_VERIFICATION_SCOPE',
      );
    }
    options.reportPath = reportPath;
    options.reportTaskId = reportScope[1];
  }
  return options;
};

const options = parseArguments(process.argv.slice(2));
const runToken = `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
const databaseNames = {
  empty: `fulishe_m0_010_${runToken}_empty`,
  upgrade: `fulishe_m0_010_${runToken}_upgrade`,
  restore: `fulishe_m0_010_${runToken}_restore`,
  product: `fulishe_m0_010_${runToken}_product`,
};
const rehearsalUser = `flt_m0_${randomBytes(6).toString('hex')}`;
const rehearsalPassword = randomBytes(24).toString('hex');
const secrets = [rehearsalPassword];
const createdDatabases = new Set();
let userCreated = false;
let temporaryRoot;
let initialRunningServices;
let initialExistingServices;
let mysqlReady = false;
let mysqlStartAttempted = false;
let temporaryFilesRemoved = false;
let mysqlPriorRunningStateRestored = false;
let report;
let executionError;
const cleanupErrors = [];

try {
  assertSafeUserName(rehearsalUser);
  initialRunningServices = listComposeServices(['--status', 'running']);
  initialExistingServices = listComposeServices(['--all']);
  if (!initialRunningServices.has('mysql')) {
    mysqlStartAttempted = true;
    runCompose(['up', '-d', '--wait', 'mysql']);
  }
  mysqlReady = true;

  const composeConfiguration = JSON.parse(
    runCompose(['config', '--format', 'json']).stdout,
  );
  const mysqlConfiguration = composeConfiguration.services?.mysql;
  const mysqlPort = mysqlConfiguration?.ports?.[0];
  const configuredDatabase = mysqlConfiguration?.environment?.MYSQL_DATABASE;
  assertState(mysqlConfiguration !== undefined, 'MYSQL_COMPOSE_SERVICE_MISSING');
  assertState(
    mysqlPort?.host_ip === '127.0.0.1',
    `MYSQL_REHEARSAL_REQUIRES_LOOPBACK:${mysqlPort?.host_ip ?? '<missing>'}`,
  );
  assertState(
    /^\d+$/u.test(String(mysqlPort?.published ?? '')),
    'MYSQL_REHEARSAL_PORT_INVALID',
  );
  assertState(
    typeof configuredDatabase === 'string' && configuredDatabase.length > 0,
    'MYSQL_CONFIGURED_DATABASE_MISSING',
  );
  for (const database of Object.values(databaseNames)) {
    assertSafeDatabaseName(database, configuredDatabase);
  }

  const collisions = Number(
    runRootMysql(
      `SELECT (SELECT COUNT(*) FROM \`mysql\`.\`user\` WHERE \`User\` = '${rehearsalUser}') + (SELECT COUNT(*) FROM \`information_schema\`.\`schemata\` WHERE \`schema_name\` IN ('${databaseNames.empty}', '${databaseNames.upgrade}', '${databaseNames.restore}', '${databaseNames.product}'));\n`,
    ),
  );
  assertState(collisions === 0, 'MIGRATION_REHEARSAL_RESOURCE_COLLISION');

  runRootMysql(
    `CREATE USER '${rehearsalUser}'@'%' IDENTIFIED WITH caching_sha2_password BY '${rehearsalPassword}';\n`,
    undefined,
    [rehearsalPassword],
  );
  userCreated = true;
  for (const database of Object.values(databaseNames)) {
    runRootMysql(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;\n`,
    );
    createdDatabases.add(database);
    runRootMysql(
      `GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${rehearsalUser}'@'%';\n`,
    );
  }

  temporaryRoot = await mkdtemp(temporaryRootPrefix);
  const rehearsalSchemaPath = path.join(temporaryRoot, 'schema.prisma');
  const rehearsalMigrationRoot = path.join(temporaryRoot, 'migrations');
  await mkdir(rehearsalMigrationRoot, { recursive: true });
  await writeFile(rehearsalSchemaPath, rehearsalSchema, 'utf8');
  await writeMigration(
    rehearsalMigrationRoot,
    baselineMigrationName,
    baselineMigrationSql,
  );

  const urls = Object.fromEntries(
    Object.entries(databaseNames).map(([name, database]) => [
      name,
      databaseUrl({
        user: rehearsalUser,
        password: rehearsalPassword,
        port: mysqlPort.published,
        database,
      }),
    ]),
  );
  secrets.push(...Object.values(urls));
  const schemaHashBefore = sha256(await readFile(productSchemaPath));
  const productMigrationCountBefore = await countProductMigrationSql();
  const migrationIntegrity = await inspectMigrationIntegrity({
    repositoryRoot,
    baseRef: 'HEAD',
  });

  runPrisma(
    ['validate', '--schema', productSchemaPath],
    urls.upgrade,
    'product prisma validate',
    secrets,
  );
  runPrisma(
    ['validate', '--schema', rehearsalSchemaPath],
    urls.upgrade,
    'rehearsal prisma validate',
    secrets,
  );

  runPrisma(
    ['migrate', 'deploy', '--schema', productSchemaPath],
    urls.product,
    'product database full-chain deploy',
    secrets,
  );
  const productEmptyState = readProductCompanyState(databaseNames.product);
  assertState(
    productEmptyState.appliedMigrations === productMigrationCountBefore &&
      productEmptyState.companyRowCount === 0 &&
      productEmptyState.checkConstraintCount === 2 &&
      productEmptyState.uniqueIdentityIndexCount === 2 &&
      productEmptyState.supplierRowCount === 0 &&
      productEmptyState.onboardingTableCount === 4 &&
      productEmptyState.uniqueCreditIndexCount === 1 &&
      productEmptyState.ownershipForeignKeyCount === 2 &&
      productEmptyState.approvalTaskCount === 0 &&
      productEmptyState.statusHistoryCount === 0,
    'PRODUCT_COMPANY_SCHEMA_STATE_INVALID',
  );

  const canonicalCompanyId = '00000000-0000-4000-8000-000000000001';
  const secondCompanyId = '00000000-0000-4000-8000-000000000002';
  const invalidCompanyId = '00000000-0000-4000-8000-000000000003';
  const temporaryWechatPayConfigRef =
    'test-ref://m1-p001/company-wechat-pay';
  runRootMysql(
    `INSERT INTO \`company\` (\`id\`, \`legal_name\`, \`platform_name\`, \`wechat_pay_config_ref\`, \`status\`, \`updated_at\`) VALUES ('${canonicalCompanyId}', '江苏福礼团供应链科技有限公司', '福礼社', '${temporaryWechatPayConfigRef}', 'ACTIVE', CURRENT_TIMESTAMP(3));\n`,
    databaseNames.product,
    [temporaryWechatPayConfigRef],
  );
  expectRootMysqlFailure(
    `INSERT INTO \`company\` (\`id\`, \`legal_name\`, \`platform_name\`, \`wechat_pay_config_ref\`, \`status\`, \`updated_at\`) VALUES ('${secondCompanyId}', '江苏福礼团供应链科技有限公司', '福礼社', '${temporaryWechatPayConfigRef}', 'ACTIVE', CURRENT_TIMESTAMP(3));\n`,
    databaseNames.product,
    'SINGLE_MERCHANT_SECOND_ROW_ACCEPTED',
    [temporaryWechatPayConfigRef],
  );
  expectRootMysqlFailure(
    `INSERT INTO \`company\` (\`id\`, \`legal_name\`, \`platform_name\`, \`wechat_pay_config_ref\`, \`status\`, \`updated_at\`) VALUES ('${invalidCompanyId}', '错误交易主体', '福礼社', '${temporaryWechatPayConfigRef}', 'ACTIVE', CURRENT_TIMESTAMP(3));\n`,
    databaseNames.product,
    'SINGLE_MERCHANT_FIXED_NAME_NOT_ENFORCED',
    [temporaryWechatPayConfigRef],
  );
  const canonicalSupplierId = '10000000-0000-4000-8000-000000000001';
  const duplicateSupplierId = '10000000-0000-4000-8000-000000000002';
  const applicantIdentityId = '20000000-0000-4000-8000-000000000001';
  const approvalTaskId = '30000000-0000-4000-8000-000000000001';
  const registrationHistoryId = '40000000-0000-4000-8000-000000000001';
  const submissionHistoryId = '40000000-0000-4000-8000-000000000002';
  const duplicateHistoryId = '40000000-0000-4000-8000-000000000003';
  const creditCode = '91320100MA1ABC2D3X';
  runRootMysql(
    `INSERT INTO \`supplier\` (\`id\`, \`company_id\`, \`legal_name\`, \`credit_code\`, \`status\`, \`pickup_address\`, \`pickup_lat\`, \`pickup_lng\`, \`qualification_snapshot\`, \`version\`, \`updated_at\`) VALUES ('${canonicalSupplierId}', '${canonicalCompanyId}', '迁移演练供应商', '${creditCode}', 'DRAFT', '迁移演练取货点', 32.0415447, 118.7699941, JSON_OBJECT('schemaVersion', '1.0', 'files', JSON_ARRAY('object://supplier-qualification/rehearsal-license')), 0, CURRENT_TIMESTAMP(3));
INSERT INTO \`supplier_status_history\` (\`id\`, \`supplier_id\`, \`from_status\`, \`to_status\`, \`event\`, \`actor_identity_id\`, \`version\`) VALUES ('${registrationHistoryId}', '${canonicalSupplierId}', NULL, 'DRAFT', 'REGISTER', NULL, 0);
UPDATE \`supplier\` SET \`status\` = 'PENDING_REVIEW', \`submitted_at\` = CURRENT_TIMESTAMP(3), \`version\` = 1, \`updated_at\` = CURRENT_TIMESTAMP(3) WHERE \`id\` = '${canonicalSupplierId}' AND \`version\` = 0;
INSERT INTO \`approval_task\` (\`id\`, \`approval_type\`, \`object_type\`, \`object_id\`, \`applicant_type\`, \`applicant_id\`, \`status\`, \`assigned_account_type_code\`, \`version\`, \`updated_at\`) VALUES ('${approvalTaskId}', 'SUPPLIER_ONBOARDING', 'SUPPLIER', '${canonicalSupplierId}', 'SUPPLIER_USER', '${applicantIdentityId}', 'PENDING', 'COMPANY_SUPPLIER_OPS', 1, CURRENT_TIMESTAMP(3));
INSERT INTO \`supplier_status_history\` (\`id\`, \`supplier_id\`, \`from_status\`, \`to_status\`, \`event\`, \`actor_identity_id\`, \`version\`) VALUES ('${submissionHistoryId}', '${canonicalSupplierId}', 'DRAFT', 'PENDING_REVIEW', 'SUBMIT', '${applicantIdentityId}', 1);
`,
    databaseNames.product,
  );
  expectRootMysqlFailure(
    `INSERT INTO \`supplier\` (\`id\`, \`company_id\`, \`legal_name\`, \`credit_code\`, \`status\`, \`qualification_snapshot\`, \`version\`, \`updated_at\`) VALUES ('${duplicateSupplierId}', '${canonicalCompanyId}', '重复代码供应商', '${creditCode}', 'DRAFT', JSON_OBJECT('schemaVersion', '1.0', 'files', JSON_ARRAY()), 0, CURRENT_TIMESTAMP(3));
`,
    databaseNames.product,
    'SUPPLIER_DUPLICATE_CREDIT_CODE_ACCEPTED',
  );
  expectRootMysqlFailure(
    `INSERT INTO \`supplier_status_history\` (\`id\`, \`supplier_id\`, \`from_status\`, \`to_status\`, \`event\`, \`actor_identity_id\`, \`version\`) VALUES ('${duplicateHistoryId}', '${canonicalSupplierId}', 'DRAFT', 'PENDING_REVIEW', 'SUBMIT', '${applicantIdentityId}', 1);
`,
    databaseNames.product,
    'SUPPLIER_HISTORY_VERSION_DUPLICATE_ACCEPTED',
  );
  const productPopulatedState = readProductCompanyState(databaseNames.product);
  assertState(
    productPopulatedState.appliedMigrations === productMigrationCountBefore &&
      productPopulatedState.companyRowCount === 1 &&
      productPopulatedState.legalName === '江苏福礼团供应链科技有限公司' &&
      productPopulatedState.platformName === '福礼社' &&
      productPopulatedState.supplierRowCount === 1 &&
      productPopulatedState.supplierStatus === 'PENDING_REVIEW' &&
      productPopulatedState.supplierVersion === 1 &&
      productPopulatedState.approvalTaskCount === 1 &&
      productPopulatedState.statusHistoryCount === 2 &&
      productPopulatedState.activeSupplierAccountTypeCount === 8 &&
      productPopulatedState.uniqueSupplierWorkspaceRouteCount === 8 &&
      productPopulatedState.functionalAccountTableCount === 5 &&
      productPopulatedState.functionalAccountForeignKeyCount === 5,
    'PRODUCT_SINGLE_MERCHANT_STATE_INVALID',
  );

  runPrisma(
    ['migrate', 'deploy', '--schema', rehearsalSchemaPath],
    urls.upgrade,
    'upgrade baseline deploy',
    secrets,
  );
  runRootMysql(
    `INSERT INTO \`${probeTable}\` (\`id\`, \`payload\`) VALUES (1, 'baseline-preserved');\n`,
    databaseNames.upgrade,
  );
  const upgradeBaseline = readBaselineProbeState(databaseNames.upgrade);
  assertState(
    upgradeBaseline.appliedMigrations === 1 &&
      upgradeBaseline.payload === 'baseline-preserved' &&
      upgradeBaseline.forwardColumnCount === 0,
    'UPGRADE_BASELINE_STATE_INVALID',
  );

  const logicalBackup = createLogicalBackup(databaseNames.upgrade);
  assertState(logicalBackup.length > 0, 'LOGICAL_BACKUP_EMPTY');
  const backup = {
    bytes: Buffer.byteLength(logicalBackup),
    sha256: sha256(logicalBackup),
    migrationCount: upgradeBaseline.appliedMigrations,
  };

  await writeMigration(
    rehearsalMigrationRoot,
    forwardMigrationName,
    forwardMigrationSql,
  );
  runPrisma(
    ['migrate', 'deploy', '--schema', rehearsalSchemaPath],
    urls.upgrade,
    'upgrade forward deploy',
    secrets,
  );
  const upgradeForward = readProbeState(databaseNames.upgrade);
  assertState(
    upgradeForward.appliedMigrations === 2 &&
      upgradeForward.payload === 'baseline-preserved' &&
      upgradeForward.forwardColumnCount === 1 &&
      upgradeForward.forwardMarker === 'forward-fixed',
    'UPGRADE_FORWARD_STATE_INVALID',
  );

  runPrisma(
    ['migrate', 'deploy', '--schema', rehearsalSchemaPath],
    urls.empty,
    'empty database full-chain deploy',
    secrets,
  );
  runRootMysql(
    `INSERT INTO \`${probeTable}\` (\`id\`, \`payload\`) VALUES (1, 'empty-path');\n`,
    databaseNames.empty,
  );
  const emptyPath = readProbeState(databaseNames.empty);
  assertState(
    emptyPath.appliedMigrations === 2 &&
      emptyPath.payload === 'empty-path' &&
      emptyPath.forwardColumnCount === 1 &&
      emptyPath.forwardMarker === 'forward-fixed',
    'EMPTY_DATABASE_PATH_INVALID',
  );

  runRootMysql(logicalBackup, databaseNames.restore);
  const restoredBaseline = readBaselineProbeState(databaseNames.restore);
  assertState(
    restoredBaseline.appliedMigrations === 1 &&
      restoredBaseline.payload === 'baseline-preserved' &&
      restoredBaseline.forwardColumnCount === 0,
    'BACKUP_RESTORE_BASELINE_INVALID',
  );
  runPrisma(
    ['migrate', 'deploy', '--schema', rehearsalSchemaPath],
    urls.restore,
    'restored database forward deploy',
    secrets,
  );
  const restoredForward = readProbeState(databaseNames.restore);
  assertState(
    restoredForward.appliedMigrations === 2 &&
      restoredForward.payload === 'baseline-preserved' &&
      restoredForward.forwardColumnCount === 1 &&
      restoredForward.forwardMarker === 'forward-fixed',
    'BACKUP_RESTORE_FORWARD_STATE_INVALID',
  );

  for (const name of ['empty', 'upgrade', 'restore']) {
    const url = urls[name];
    runPrisma(
      ['migrate', 'status', '--schema', rehearsalSchemaPath],
      url,
      `${name} migration status`,
      secrets,
    );
    runPrisma(
      [
        'migrate',
        'diff',
        '--from-schema-datasource',
        rehearsalSchemaPath,
        '--to-schema-datamodel',
        rehearsalSchemaPath,
        '--exit-code',
      ],
      url,
      `${name} schema drift check`,
      secrets,
    );
  }

  runPrisma(
    ['migrate', 'status', '--schema', productSchemaPath],
    urls.product,
    'product migration status',
    secrets,
  );
  runPrisma(
    [
      'migrate',
      'diff',
      '--from-schema-datasource',
      productSchemaPath,
      '--to-schema-datamodel',
      productSchemaPath,
      '--exit-code',
    ],
    urls.product,
    'product schema drift check',
    secrets,
  );
  runPrisma(
    ['migrate', 'deploy', '--schema', productSchemaPath],
    urls.product,
    'product database idempotent redeploy',
    secrets,
  );

  runPrisma(
    ['migrate', 'deploy', '--schema', rehearsalSchemaPath],
    urls.restore,
    'restored database idempotent redeploy',
    secrets,
  );
  const schemaHashAfter = sha256(await readFile(productSchemaPath));
  const productMigrationCountAfter = await countProductMigrationSql();
  assertState(schemaHashAfter === schemaHashBefore, 'PRODUCT_SCHEMA_MUTATED');
  assertState(
    productMigrationCountAfter === productMigrationCountBefore,
    'PRODUCT_MIGRATION_CHAIN_MUTATED',
  );

  report = {
    schemaVersion: 1,
    taskId: options.reportTaskId ?? 'M0-010',
    generatedAt: new Date().toISOString(),
    status: 'LOCAL_PASS',
    git: { commit: gitCommit() },
    runtime: {
      node: process.version,
      dockerServer: runCommand(
        'docker',
        ['version', '--format', '{{.Server.Version}}'],
        { label: 'docker server version' },
      ).stdout.trim(),
      mysql: runCompose([
        'exec',
        '-T',
        'mysql',
        'mysql',
        '--version',
      ]).stdout.trim(),
      prisma: runCommand(
        pnpmExecutable,
        ['--filter', '@fulishe/db', 'exec', 'prisma', '--version'],
        {
          label: 'prisma version',
          shell: process.platform === 'win32',
        },
      ).stdout.trim(),
    },
    productBoundary: {
      schemaSha256Before: schemaHashBefore,
      schemaSha256After: schemaHashAfter,
      productMigrationSqlBefore: productMigrationCountBefore,
      productMigrationSqlAfter: productMigrationCountAfter,
      configuredDatabaseTargeted: false,
      productSchemaMutated: false,
    },
    migrationIntegrity,
    rehearsal: {
      fixtureOnly: true,
      baselineMigration: baselineMigrationName,
      forwardFixMigration: forwardMigrationName,
      emptyPath,
      upgradePath: {
        before: upgradeBaseline,
        after: upgradeForward,
        payloadPreserved: true,
      },
      backupRestore: {
        backup,
        restoredBeforeForwardFix: restoredBaseline,
        restoredAfterForwardFix: restoredForward,
        payloadPreserved: true,
      },
      finalSchemaDrift: 'NONE',
      idempotentRedeploy: 'PASS',
    },
    productRehearsal: {
      taskId: 'M1-P005',
      migrationCount: productPopulatedState.appliedMigrations,
      companyRowCount: productPopulatedState.companyRowCount,
      fixedIdentity: {
        legalName: productPopulatedState.legalName,
        platformName: productPopulatedState.platformName,
      },
      constraints: {
        checkConstraintCount: productPopulatedState.checkConstraintCount,
        uniqueIdentityIndexCount:
          productPopulatedState.uniqueIdentityIndexCount,
      },
      secondMerchantRejected: true,
      invalidLegalNameRejected: true,
      supplierOnboarding: {
        supplierRowCount: productPopulatedState.supplierRowCount,
        supplierStatus: productPopulatedState.supplierStatus,
        supplierVersion: productPopulatedState.supplierVersion,
        approvalTaskCount: productPopulatedState.approvalTaskCount,
        statusHistoryCount: productPopulatedState.statusHistoryCount,
        onboardingTableCount: productPopulatedState.onboardingTableCount,
        uniqueCreditIndexCount: productPopulatedState.uniqueCreditIndexCount,
        ownershipForeignKeyCount:
          productPopulatedState.ownershipForeignKeyCount,
        duplicateCreditCodeRejected: true,
        duplicateHistoryVersionRejected: true,
      },
      supplierFunctionalAccounts: {
        activeAccountTypeCount:
          productPopulatedState.activeSupplierAccountTypeCount,
        uniqueWorkspaceRouteCount:
          productPopulatedState.uniqueSupplierWorkspaceRouteCount,
        tableCount: productPopulatedState.functionalAccountTableCount,
        ownershipForeignKeyCount:
          productPopulatedState.functionalAccountForeignKeyCount,
      },
      finalSchemaDrift: 'NONE',
      idempotentRedeploy: 'PASS',
    },
    evidenceBoundary: {
      localDockerMySql: 'LOCAL_PASS',
      ci: 'NOT_EXECUTED',
      staging: 'NOT_EXECUTED',
      productionMigration: 'HUMAN_ONLY_NOT_EXECUTED',
      productionDisasterRecovery: 'NOT_EXECUTED',
    },
  };
} catch (error) {
  executionError = error;
} finally {
  if (mysqlReady) {
    for (const database of [...createdDatabases].reverse()) {
      try {
        assertSafeDatabaseName(database, '__configured_database_guard__');
        runRootMysql(`DROP DATABASE IF EXISTS \`${database}\`;\n`);
        createdDatabases.delete(database);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (userCreated) {
      try {
        assertSafeUserName(rehearsalUser);
        runRootMysql(`DROP USER IF EXISTS '${rehearsalUser}'@'%';\n`);
        userCreated = false;
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }

  if (temporaryRoot !== undefined) {
    try {
      const resolvedTemporaryRoot = path.resolve(temporaryRoot);
      if (!resolvedTemporaryRoot.startsWith(path.resolve(temporaryRootPrefix))) {
        cleanupErrors.push(
          new Error(`UNSAFE_TEMPORARY_ROOT:${resolvedTemporaryRoot}`),
        );
      } else {
        await rm(resolvedTemporaryRoot, { recursive: true, force: true });
        temporaryFilesRemoved = true;
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (
    initialRunningServices !== undefined &&
    !initialRunningServices.has('mysql')
  ) {
    try {
      if (initialExistingServices?.has('mysql')) {
        runCompose(['stop', 'mysql']);
      } else {
        runCompose(['rm', '--stop', '--force', 'mysql']);
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (initialRunningServices !== undefined) {
    try {
      mysqlPriorRunningStateRestored =
        initialRunningServices.has('mysql') ===
        listComposeServices(['--status', 'running']).has('mysql');
    } catch (error) {
      cleanupErrors.push(error);
    }
  } else {
    mysqlPriorRunningStateRestored = !mysqlStartAttempted;
  }
}

if (report !== undefined) {
  report.cleanup = {
    disposableDatabasesDropped: createdDatabases.size === 0,
    disposableUserDropped: !userCreated,
    temporaryFilesRemoved,
    mysqlPriorRunningStateRestored,
    errors: cleanupErrors.map((error) =>
      redact(error instanceof Error ? error.message : String(error), secrets),
    ),
  };
}

if (executionError !== undefined || cleanupErrors.length > 0) {
  const messages = [];
  if (executionError !== undefined) {
    messages.push(
      redact(
        executionError instanceof Error
          ? executionError.stack ?? executionError.message
          : String(executionError),
        secrets,
      ),
    );
  }
  messages.push(
    ...cleanupErrors.map((error) =>
      redact(error instanceof Error ? error.message : String(error), secrets),
    ),
  );
  throw new Error(messages.join('\n'));
}

if (options.reportPath !== undefined) {
  await mkdir(path.dirname(options.reportPath), { recursive: true });
  await writeFile(
    options.reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `PRISMA_MIGRATION_REHEARSAL_OK:empty=${report.rehearsal.emptyPath.appliedMigrations}:upgrade=${report.rehearsal.upgradePath.after.appliedMigrations}:restore=${report.rehearsal.backupRestore.restoredAfterForwardFix.appliedMigrations}:product=${report.productRehearsal.migrationCount}:cleanup=${report.cleanup.errors.length === 0 ? 'PASS' : 'FAIL'}`,
  );
}
