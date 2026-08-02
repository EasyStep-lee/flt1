export const REDACTION_MARKER = '[REDACTED]' as const;

const exactSensitiveKeys = new Set([
  'authorization',
  'proxyauthorization',
  'cookie',
  'setcookie',
  'databaseurl',
  'redisurl',
  'connectionstring',
  'welfarecardcode',
  'cardcode',
  'cardsecret',
]);

const sensitiveKeySuffix =
  /(?:password|passwd|secret|token|privatekey|apikey|apiv3key|signingkey|encryptionkey)$/u;

const normalizeKey = (key: string): string =>
  key.replace(/[^a-z0-9]/giu, '').toLowerCase();

export const isSensitiveLogKey = (key: string): boolean => {
  const normalized = normalizeKey(key);
  return exactSensitiveKeys.has(normalized) || sensitiveKeySuffix.test(normalized);
};

const assignmentPattern =
  /((?:["']?)(?:authorization|proxy-authorization|cookie|set-cookie|database_url|redis_url|connection_string|password|passwd|secret|token|private_key|api_key|api_v3_key|signing_key|encryption_key|welfare_card_code|card_code|card_secret)(?:["']?)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/giu;

export const redactText = (value: string): string =>
  value
    .replace(
      /(\b[a-z][a-z0-9+.-]*:\/\/)[^@\s/]+@/giu,
      `$1${REDACTION_MARKER}@`,
    )
    .replace(
      /(\b(?:authorization|proxy-authorization)\s*[:=]\s*(?:bearer|basic)\s+)[^\s,;]+/giu,
      `$1${REDACTION_MARKER}`,
    )
    .replace(assignmentPattern, `$1${REDACTION_MARKER}`);

const redactObject = (
  value: object,
  seen: WeakSet<object>,
): unknown => {
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      ...(value.stack ? { stack: redactText(value.stack) } : {}),
    };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactLogValue(entry, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = isSensitiveLogKey(key)
      ? REDACTION_MARKER
      : redactLogValue(entry, seen);
  }
  return output;
};

export const redactLogValue = (
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown => {
  if (typeof value === 'string') {
    return redactText(value);
  }
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'symbol' || typeof value === 'function') {
    return redactText(String(value));
  }
  return redactObject(value, seen);
};
