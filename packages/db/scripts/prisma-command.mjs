import { spawnSync } from 'node:child_process';

const supportedCommands = new Set(['generate', 'validate']);
const command = process.argv[2];

if (!supportedCommands.has(command)) {
  throw new Error(`Unsupported Prisma foundation command: ${command ?? '<missing>'}`);
}

const placeholderDatabaseUrl =
  'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5';
const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(
  executable,
  ['exec', 'prisma', command, '--schema', './prisma/schema.prisma'],
  {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? placeholderDatabaseUrl,
    },
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
