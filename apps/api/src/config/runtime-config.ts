import { DEFAULT_FOUNDATION_POLICY } from '../infrastructure/foundation-policy.js';

export const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');

export type RuntimeEnvironment = 'development' | 'test' | 'production';

export interface RuntimeConfig {
  readonly nodeEnvironment: RuntimeEnvironment;
  readonly apiHost: string;
  readonly apiPort: number;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly queuePrefix: string;
  readonly connectTimeoutMs: number;
  readonly healthProbeTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
}

export class RuntimeConfigError extends Error {
  constructor(
    public readonly code: 'CONFIG_MISSING' | 'CONFIG_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'RuntimeConfigError';
  }
}

type Environment = Readonly<Record<string, string | undefined>>;

const required = (environment: Environment, name: string): string => {
  const value = environment[name]?.trim();
  if (!value) {
    throw new RuntimeConfigError('CONFIG_MISSING', `Missing required environment variable: ${name}`);
  }
  return value;
};

const parseUrl = (
  environment: Environment,
  name: string,
  allowedProtocols: readonly string[],
): string => {
  const value = required(environment, name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RuntimeConfigError('CONFIG_INVALID', `${name} must be a valid URL`);
  }

  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new RuntimeConfigError(
      'CONFIG_INVALID',
      `${name} uses an unsupported protocol`,
    );
  }
  return value;
};

const parseInteger = (
  environment: Environment,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const raw = environment[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RuntimeConfigError(
      'CONFIG_INVALID',
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
};

const parseEnvironment = (environment: Environment): RuntimeEnvironment => {
  const value = environment.NODE_ENV?.trim() ?? 'development';
  if (value !== 'development' && value !== 'test' && value !== 'production') {
    throw new RuntimeConfigError(
      'CONFIG_INVALID',
      'NODE_ENV must be development, test or production',
    );
  }
  return value;
};

export const loadRuntimeConfig = (environment: Environment): RuntimeConfig => {
  const missing = ['DATABASE_URL', 'REDIS_URL'].filter(
    (name) => !environment[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new RuntimeConfigError(
      'CONFIG_MISSING',
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const queuePrefix = environment.BULLMQ_PREFIX?.trim() || 'fulishe';
  if (!/^[a-z][a-z0-9_-]{1,31}$/i.test(queuePrefix)) {
    throw new RuntimeConfigError(
      'CONFIG_INVALID',
      'BULLMQ_PREFIX must contain 2-32 letters, numbers, underscores or hyphens',
    );
  }

  return Object.freeze({
    nodeEnvironment: parseEnvironment(environment),
    apiHost: environment.API_HOST?.trim() || '127.0.0.1',
    apiPort: parseInteger(environment, 'API_PORT', 3_000, 1, 65_535),
    databaseUrl: parseUrl(environment, 'DATABASE_URL', ['mysql:']),
    redisUrl: parseUrl(environment, 'REDIS_URL', ['redis:', 'rediss:']),
    queuePrefix,
    connectTimeoutMs: parseInteger(
      environment,
      'INFRA_CONNECT_TIMEOUT_MS',
      DEFAULT_FOUNDATION_POLICY.connectTimeoutMs,
      100,
      30_000,
    ),
    healthProbeTimeoutMs: parseInteger(
      environment,
      'INFRA_HEALTH_TIMEOUT_MS',
      DEFAULT_FOUNDATION_POLICY.healthProbeTimeoutMs,
      10,
      10_000,
    ),
    maxRetries: parseInteger(
      environment,
      'INFRA_MAX_RETRIES',
      DEFAULT_FOUNDATION_POLICY.maxRetries,
      0,
      10,
    ),
    retryBaseDelayMs: parseInteger(
      environment,
      'INFRA_RETRY_BASE_DELAY_MS',
      DEFAULT_FOUNDATION_POLICY.retryBaseDelayMs,
      10,
      10_000,
    ),
    retryMaxDelayMs: parseInteger(
      environment,
      'INFRA_RETRY_MAX_DELAY_MS',
      DEFAULT_FOUNDATION_POLICY.retryMaxDelayMs,
      10,
      30_000,
    ),
  });
};
