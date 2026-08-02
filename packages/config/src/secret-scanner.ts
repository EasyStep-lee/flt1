import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type SecretRuleId =
  | 'credential-assignment'
  | 'credential-url'
  | 'github-token'
  | 'private-key';

export interface SecretFinding {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly ruleId: SecretRuleId;
  readonly message: string;
  readonly excerpt: '[REDACTED]';
}

export interface SecretScanOptions {
  readonly rootDirectory: string;
  readonly maximumFileBytes?: number;
}

const SAFE_VALUE_MARKERS = [
  'dev_only',
  'development-only',
  'test-only',
  'unit-test-only',
  'runtime-injected',
  'must-not-appear',
  'must-not-escape',
  'must-never-appear',
  'replace_with',
  'replace-with',
  'placeholder',
  'example.invalid',
];

const isEphemeralCiFixture = (value: string, filePath: string): boolean =>
  value.trim().replace(/^['"]|['"]$/gu, '').toLowerCase() === 'root' &&
  /(?:^|\/)github-bootstrap\/\.github\/workflows\/ci\.yml$/u.test(
    filePath.replaceAll('\\', '/'),
  );

const isSafeDocumentedValue = (value: string, filePath: string): boolean => {
  const normalized = value.trim().replace(/^['"]|['"]$/gu, '').toLowerCase();
  return (
    normalized.startsWith('${') ||
    normalized.startsWith('$$') ||
    normalized.startsWith('$env:') ||
    normalized.startsWith('process.env.') ||
    SAFE_VALUE_MARKERS.some((marker) => normalized.includes(marker)) ||
    isEphemeralCiFixture(value, filePath)
  );
};

const ruleMessages: Readonly<Record<SecretRuleId, string>> = Object.freeze({
  'credential-assignment': 'Potential credential assigned in source',
  'credential-url': 'Potential credential embedded in a connection URL',
  'github-token': 'Potential GitHub access token',
  'private-key': 'Potential private key material',
});

const makeFinding = (
  filePath: string,
  line: number,
  column: number,
  ruleId: SecretRuleId,
): SecretFinding => ({
  path: filePath,
  line,
  column,
  ruleId,
  message: ruleMessages[ruleId],
  excerpt: '[REDACTED]',
});

const environmentCredentialAssignment =
  /\b([A-Z][A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|API_V3_KEY|PRIVATE_KEY|ENCRYPTION_KEY|SIGNING_KEY)[A-Z0-9_]*)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s#,;]+)/gu;
const sourceCredentialLiteral =
  /\b(?:password|passwd|secret|token|clientSecret|apiKey|apiV3Key|privateKey|signingKey|encryptionKey)\s*[:=]\s*("[^"]*"|'[^']*')/giu;
const credentialUrl =
  /\b(?:mysql|redis|rediss|postgres|postgresql|mongodb|mongodb\+srv):\/\/([^@\s/]+)@/giu;
const githubToken = /\bgh[pousr]_[A-Za-z0-9]{20,255}\b/gu;
const privateKey = /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/gu;

export const scanSecretText = (
  source: string,
  filePath: string,
): readonly SecretFinding[] => {
  const findings: SecretFinding[] = [];
  const seen = new Set<string>();
  const lines = source.split(/\r?\n/u);

  const add = (line: number, column: number, ruleId: SecretRuleId): void => {
    const key = `${line}:${column}:${ruleId}`;
    if (!seen.has(key)) {
      seen.add(key);
      findings.push(makeFinding(filePath, line, column, ruleId));
    }
  };

  for (const [index, line] of lines.entries()) {
    environmentCredentialAssignment.lastIndex = 0;
    for (const match of line.matchAll(environmentCredentialAssignment)) {
      const value = match[2] ?? '';
      if (!isSafeDocumentedValue(value, filePath)) {
        add(index + 1, (match.index ?? 0) + 1, 'credential-assignment');
      }
    }

    sourceCredentialLiteral.lastIndex = 0;
    for (const match of line.matchAll(sourceCredentialLiteral)) {
      const value = match[1] ?? '';
      if (!isSafeDocumentedValue(value, filePath)) {
        add(index + 1, (match.index ?? 0) + 1, 'credential-assignment');
      }
    }

    credentialUrl.lastIndex = 0;
    for (const match of line.matchAll(credentialUrl)) {
      const userInfo = match[1] ?? '';
      const password = userInfo.includes(':')
        ? userInfo.slice(userInfo.indexOf(':') + 1)
        : '';
      const looksLikeDetectorPattern = ['[', ']', '\\', '^'].some((character) =>
        userInfo.includes(character),
      );
      if (
        password &&
        !looksLikeDetectorPattern &&
        !isSafeDocumentedValue(password, filePath)
      ) {
        add(index + 1, (match.index ?? 0) + 1, 'credential-url');
      }
    }

    githubToken.lastIndex = 0;
    for (const match of line.matchAll(githubToken)) {
      add(index + 1, (match.index ?? 0) + 1, 'github-token');
    }

    privateKey.lastIndex = 0;
    for (const match of line.matchAll(privateKey)) {
      add(index + 1, (match.index ?? 0) + 1, 'private-key');
    }
  }

  return findings;
};

export const scanSecretFiles = async (
  filePaths: readonly string[],
  options: SecretScanOptions,
): Promise<readonly SecretFinding[]> => {
  const findings: SecretFinding[] = [];
  const maximumFileBytes = options.maximumFileBytes ?? 5 * 1024 * 1024;

  for (const filePath of filePaths) {
    const contents = await readFile(filePath);
    if (contents.length > maximumFileBytes || contents.includes(0)) {
      continue;
    }
    const relativePath = path
      .relative(options.rootDirectory, filePath)
      .replaceAll(path.sep, '/');
    findings.push(...scanSecretText(contents.toString('utf8'), relativePath));
  }

  return findings;
};
