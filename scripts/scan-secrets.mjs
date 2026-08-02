import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { scanSecretFiles } from '../packages/config/dist/secret-scanner.js';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
if (!process.argv.includes('--tracked')) {
  process.stderr.write('Usage: node scripts/scan-secrets.mjs --tracked\n');
  process.exitCode = 2;
} else {
  const trackedOutput = execFileSync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  const relativePaths = trackedOutput.split('\0').filter(Boolean);
  const absolutePaths = relativePaths.map((relativePath) =>
    path.join(repositoryRoot, relativePath),
  );
  const findings = await scanSecretFiles(absolutePaths, {
    rootDirectory: repositoryRoot,
  });

  if (findings.length > 0) {
    process.stderr.write(`Secret scan failed: ${findings.length} finding(s)\n`);
    for (const finding of findings) {
      process.stderr.write(
        `${finding.path}:${finding.line}:${finding.column} ${finding.ruleId} ${finding.excerpt}\n`,
      );
    }
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Secret scan passed: ${relativePaths.length} tracked file(s) checked\n`,
    );
  }
}
