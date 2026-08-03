import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const OASDIFF_VERSION = '1.17.0';
const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const assets = Object.freeze({
  'darwin-arm64': {
    name: 'oasdiff_1.17.0_darwin_all.tar.gz',
    sha256: '1a07d8166349aa9c2fc402a849caad86206a2747952030b6d775da945704a2e8',
  },
  'darwin-x64': {
    name: 'oasdiff_1.17.0_darwin_all.tar.gz',
    sha256: '1a07d8166349aa9c2fc402a849caad86206a2747952030b6d775da945704a2e8',
  },
  'linux-arm64': {
    name: 'oasdiff_1.17.0_linux_arm64.tar.gz',
    sha256: '6af37f76983a8813f27d591a5b9fe4df8106fb512194831b3d7c5ed6a185312b',
  },
  'linux-x64': {
    name: 'oasdiff_1.17.0_linux_amd64.tar.gz',
    sha256: 'cddb4763e66d6012cd4e70d41c7f742eee23db30bcdc8d64ef36b183bc6c1e97',
  },
  'win32-arm64': {
    name: 'oasdiff_1.17.0_windows_arm64.tar.gz',
    sha256: 'd71b5e6fc746199003a6dfdc5ed874e1df471e0ec974cee3d024f57b2d96de7e',
  },
  'win32-x64': {
    name: 'oasdiff_1.17.0_windows_amd64.tar.gz',
    sha256: 'c45e73b11622be9572ed5b16a467a9956157315223cbd22e51b00aae725b64f9',
  },
});

const readOption = (name) => {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  const value = process.argv[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value`);
  }
  return value;
};

const sha256 = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');

const findExecutable = (directory) => {
  for (const entry of readdirSync(directory)) {
    const candidate = path.join(directory, entry);
    if (statSync(candidate).isDirectory()) {
      const nested = findExecutable(candidate);
      if (nested) {
        return nested;
      }
    } else if (entry === 'oasdiff' || entry === 'oasdiff.exe') {
      return candidate;
    }
  }
  return undefined;
};

const ensureOasdiff = async (cacheDirectory) => {
  const assetKey = `${process.platform}-${process.arch}`;
  const asset = assets[assetKey];
  if (!asset) {
    throw new Error(`OASDIFF_PLATFORM_UNSUPPORTED: ${assetKey}`);
  }

  const versionDirectory = path.join(cacheDirectory, OASDIFF_VERSION, assetKey);
  const archivePath = path.join(versionDirectory, asset.name);
  const extractDirectory = path.join(versionDirectory, 'bin');
  mkdirSync(versionDirectory, { recursive: true });

  if (existsSync(archivePath) && sha256(archivePath) !== asset.sha256) {
    unlinkSync(archivePath);
  }
  if (!existsSync(archivePath)) {
    const url = `https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF_VERSION}/${asset.name}`;
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`OASDIFF_DOWNLOAD_FAILED: HTTP ${response.status}`);
    }
    writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
  }
  if (sha256(archivePath) !== asset.sha256) {
    throw new Error('OASDIFF_ARCHIVE_HASH_MISMATCH');
  }

  let executable = existsSync(extractDirectory)
    ? findExecutable(extractDirectory)
    : undefined;
  if (!executable) {
    mkdirSync(extractDirectory, { recursive: true });
    const extraction = spawnSync(
      'tar',
      ['-xzf', archivePath, '-C', extractDirectory],
      { encoding: 'utf8' },
    );
    if (extraction.status !== 0) {
      throw new Error(`OASDIFF_EXTRACTION_FAILED: ${extraction.stderr.trim()}`);
    }
    executable = findExecutable(extractDirectory);
  }
  if (!executable) {
    throw new Error('OASDIFF_EXECUTABLE_MISSING');
  }
  if (process.platform !== 'win32') {
    chmodSync(executable, 0o755);
  }

  const versionResult = spawnSync(executable, ['--version'], { encoding: 'utf8' });
  const versionOutput = `${versionResult.stdout ?? ''}\n${versionResult.stderr ?? ''}`;
  if (versionResult.status !== 0 || !new RegExp(`\\b${OASDIFF_VERSION.replaceAll('.', '\\.') }\\b`, 'u').test(versionOutput)) {
    throw new Error('OASDIFF_VERSION_MISMATCH');
  }
  return { assetName: asset.name, executable };
};

const main = async () => {
  const base = readOption('--base');
  const baseRef = readOption('--base-ref');
  if (Boolean(base) === Boolean(baseRef)) {
    throw new Error('OASDIFF_BASE_REQUIRED: provide exactly one of --base or --base-ref');
  }
  const revision = path.resolve(
    repoRoot,
    readOption('--revision') ?? 'packages/contracts/openapi.json',
  );
  const cacheDirectory = path.resolve(
    repoRoot,
    readOption('--cache-dir') ?? '.cache/oasdiff',
  );

  let baseline = base ? path.resolve(repoRoot, base) : undefined;
  let baselineTemporary;
  if (baseRef) {
    const shown = spawnSync(
      'git',
      ['show', `${baseRef}:packages/contracts/openapi.json`],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    if (shown.status !== 0) {
      throw new Error('OASDIFF_BASE_REF_UNAVAILABLE');
    }
    baselineTemporary = path.join(cacheDirectory, `base-${createHash('sha256').update(baseRef).digest('hex')}.json`);
    mkdirSync(path.dirname(baselineTemporary), { recursive: true });
    writeFileSync(baselineTemporary, shown.stdout, 'utf8');
    baseline = baselineTemporary;
  }
  if (!baseline || !existsSync(baseline) || !existsSync(revision)) {
    throw new Error('OASDIFF_SPEC_MISSING');
  }

  const tool = await ensureOasdiff(cacheDirectory);
  process.stdout.write(`oasdiff ${OASDIFF_VERSION} verified: ${tool.assetName}\n`);
  const result = spawnSync(
    tool.executable,
    [
      'breaking',
      baseline,
      revision,
      '--fail-on',
      'ERR',
      '--format',
      'text',
      '--color',
      'never',
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  process.exitCode = result.status ?? 1;
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'OASDIFF_GATE_FAILED'}\n`);
  process.exitCode = 1;
});
