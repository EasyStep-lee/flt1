export const CONFIGURATION_LAYERS = Object.freeze([
  'development',
  'test',
  'staging',
  'production',
] as const);

export type DeploymentEnvironment = (typeof CONFIGURATION_LAYERS)[number];
export type NodeEnvironment = 'development' | 'test' | 'production';

export interface ConfigurationFieldSchema {
  readonly required: boolean;
  readonly secret: boolean;
  readonly description: string;
}

const field = (
  required: boolean,
  secret: boolean,
  description: string,
): ConfigurationFieldSchema => Object.freeze({ required, secret, description });

const supplierSessionCredentialField =
  'SUPPLIER_AUTH_SESSION_SIGNING_KEY' as const;

export const API_RUNTIME_SCHEMA = Object.freeze({
  NODE_ENV: field(false, false, 'Node runtime mode'),
  APP_ENV: field(false, false, 'Deployment environment layer'),
  API_HOST: field(false, false, 'API bind host'),
  API_PORT: field(false, false, 'API bind port'),
  PORTAL_PUBLIC_ORIGIN: field(false, false, 'Allowed public portal origin'),
  DATABASE_URL: field(true, true, 'MySQL connection URL'),
  REDIS_URL: field(true, true, 'Redis connection URL'),
  [supplierSessionCredentialField]: field(
    false,
    true,
    'Supplier portal session signing key',
  ),
  BULLMQ_PREFIX: field(false, false, 'BullMQ key prefix'),
  INFRA_CONNECT_TIMEOUT_MS: field(false, false, 'Dependency connection timeout'),
  INFRA_HEALTH_TIMEOUT_MS: field(false, false, 'Health probe timeout'),
  INFRA_MAX_RETRIES: field(false, false, 'Maximum dependency retries'),
  INFRA_RETRY_BASE_DELAY_MS: field(false, false, 'Initial retry delay'),
  INFRA_RETRY_MAX_DELAY_MS: field(false, false, 'Maximum retry delay'),
});

export type ConfigurationErrorCode =
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'CONFIG_UNSAFE';

export class ConfigurationError extends Error {
  readonly fields: readonly string[];

  constructor(
    readonly code: ConfigurationErrorCode,
    message: string,
    fields: readonly string[],
  ) {
    super(message);
    this.name = 'ConfigurationError';
    this.fields = Object.freeze([...fields]);
  }
}

export interface ApiRuntimeConfig {
  readonly nodeEnvironment: NodeEnvironment;
  readonly deploymentEnvironment: DeploymentEnvironment;
  readonly apiHost: string;
  readonly apiPort: number;
  readonly portalPublicOrigin: string;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly supplierAuthSessionSigningKey: string;
  readonly queuePrefix: string;
  readonly connectTimeoutMs: number;
  readonly healthProbeTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
}

type Environment = Readonly<Record<string, string | undefined>>;

const DEFAULTS = Object.freeze({
  apiHost: '127.0.0.1',
  apiPort: 3_000,
  portalPublicOrigin: 'https://fulishe.example.invalid',
  queuePrefix: 'fulishe',
  connectTimeoutMs: 3_000,
  healthProbeTimeoutMs: 1_500,
  maxRetries: 3,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 1_000,
});

const throwInvalid = (fieldName: string, requirement: string): never => {
  throw new ConfigurationError(
    'CONFIG_INVALID',
    `${fieldName} ${requirement}`,
    [fieldName],
  );
};

const parseNodeEnvironment = (environment: Environment): NodeEnvironment => {
  const value = environment.NODE_ENV?.trim() || 'development';
  if (value !== 'development' && value !== 'test' && value !== 'production') {
    return throwInvalid('NODE_ENV', 'must be development, test or production');
  }
  return value;
};

const parseDeploymentEnvironment = (
  environment: Environment,
  nodeEnvironment: NodeEnvironment,
): DeploymentEnvironment => {
  const value = environment.APP_ENV?.trim() || nodeEnvironment;
  if (!CONFIGURATION_LAYERS.some((candidate) => candidate === value)) {
    return throwInvalid(
      'APP_ENV',
      'must be development, test, staging or production',
    );
  }
  return value as DeploymentEnvironment;
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
    return throwInvalid(
      name,
      `must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
};

const parseUrl = (
  environment: Environment,
  name: string,
  allowedProtocols: readonly string[],
): { readonly raw: string; readonly parsed: URL } => {
  const raw = environment[name]?.trim();
  if (!raw) {
    throw new ConfigurationError(
      'CONFIG_MISSING',
      `Missing required environment variable: ${name}`,
      [name],
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return throwInvalid(name, 'must be a valid URL');
  }
  if (!allowedProtocols.includes(parsed.protocol)) {
    return throwInvalid(name, 'uses an unsupported protocol');
  }
  return { raw, parsed };
};

const parseSupplierSessionCredential = (
  environment: Environment,
  deploymentEnvironment: DeploymentEnvironment,
): string => {
  const raw = environment[supplierSessionCredentialField]?.trim();
  if (!raw) {
    if (
      deploymentEnvironment === 'development' ||
      deploymentEnvironment === 'test'
    ) {
      const marker =
        deploymentEnvironment === 'test' ? 'unit-test-only' : 'development-only';
      return `${marker}-${'x'.repeat(32)}`;
    }
    throw new ConfigurationError(
      'CONFIG_MISSING',
      `Missing required environment variable: ${supplierSessionCredentialField}`,
      [supplierSessionCredentialField],
    );
  }
  if (!/^[A-Za-z0-9_-]{43,128}$/u.test(raw)) {
    return throwInvalid(
      supplierSessionCredentialField,
      'must contain 43-128 base64url characters',
    );
  }
  return raw;
};

const normalizeHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/^\[|\]$/gu, '');

const isLoopbackHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    /^127(?:\.\d{1,3}){3}$/u.test(normalized)
  );
};

const isLocalDependencyHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  return (
    isLoopbackHostname(normalized) ||
    normalized === '0.0.0.0' ||
    normalized === '::'
  );
};

const developmentCredentialMarkers = [
  'dev_only',
  'development-only',
  'unit-test-only',
  'runtime-injected',
  'must-not-appear',
  'must-never-appear',
  'replace_with',
  'replace-with',
  'changeme',
];

const decode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const containsDevelopmentCredential = (value: string): boolean => {
  const normalized = decode(value).toLowerCase();
  return developmentCredentialMarkers.some((marker) => normalized.includes(marker));
};

const validateRemoteEnvironment = (
  nodeEnvironment: NodeEnvironment,
  deploymentEnvironment: DeploymentEnvironment,
  apiHost: string,
  databaseUrl: URL,
  redisUrl: URL,
  supplierSessionCredential: string,
): void => {
  if (deploymentEnvironment === 'development' || deploymentEnvironment === 'test') {
    return;
  }

  const unsafe = new Set<string>();
  if (nodeEnvironment !== 'production') {
    unsafe.add('NODE_ENV');
    unsafe.add('APP_ENV');
  }
  if (isLoopbackHostname(apiHost)) {
    unsafe.add('API_HOST');
  }
  if (containsDevelopmentCredential(supplierSessionCredential)) {
    unsafe.add(supplierSessionCredentialField);
  }

  for (const [name, url, requireUsername] of [
    ['DATABASE_URL', databaseUrl, true],
    ['REDIS_URL', redisUrl, false],
  ] as const) {
    if (isLocalDependencyHostname(url.hostname)) {
      unsafe.add(name);
    }
    if ((requireUsername && !url.username) || !url.password) {
      unsafe.add(name);
    }
    if (
      containsDevelopmentCredential(url.username) ||
      containsDevelopmentCredential(url.password)
    ) {
      unsafe.add(name);
    }
  }

  if (unsafe.size > 0) {
    const fields = [...unsafe].sort();
    throw new ConfigurationError(
      'CONFIG_UNSAFE',
      `Unsafe ${deploymentEnvironment} configuration: ${fields.join(', ')}`,
      fields,
    );
  }
};

export const loadApiRuntimeConfig = (
  environment: Environment,
): ApiRuntimeConfig => {
  const missing = (['DATABASE_URL', 'REDIS_URL'] as const).filter(
    (name) => !environment[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new ConfigurationError(
      'CONFIG_MISSING',
      `Missing required environment variables: ${missing.join(', ')}`,
      missing,
    );
  }

  const nodeEnvironment = parseNodeEnvironment(environment);
  const deploymentEnvironment = parseDeploymentEnvironment(
    environment,
    nodeEnvironment,
  );
  const apiHost = environment.API_HOST?.trim() || DEFAULTS.apiHost;
  if (/\s/u.test(apiHost)) {
    return throwInvalid('API_HOST', 'must not contain whitespace');
  }

  const portalPublicOrigin = environment.PORTAL_PUBLIC_ORIGIN?.trim() || DEFAULTS.portalPublicOrigin;
  let parsedPortalOrigin: URL;
  try {
    parsedPortalOrigin = new URL(portalPublicOrigin);
  } catch {
    return throwInvalid('PORTAL_PUBLIC_ORIGIN', 'must be a valid origin URL');
  }
  const localPortalOrigin =
    parsedPortalOrigin.protocol === 'http:' && isLoopbackHostname(parsedPortalOrigin.hostname);
  if (
    (parsedPortalOrigin.protocol !== 'https:' && !localPortalOrigin) ||
    parsedPortalOrigin.username ||
    parsedPortalOrigin.password ||
    parsedPortalOrigin.pathname !== '/' ||
    parsedPortalOrigin.search ||
    parsedPortalOrigin.hash
  ) {
    return throwInvalid('PORTAL_PUBLIC_ORIGIN', 'must be an HTTPS origin without path or credentials');
  }

  const database = parseUrl(environment, 'DATABASE_URL', ['mysql:']);
  const redis = parseUrl(environment, 'REDIS_URL', ['redis:', 'rediss:']);
  const supplierAuthSessionSigningKey = parseSupplierSessionCredential(
    environment,
    deploymentEnvironment,
  );
  validateRemoteEnvironment(
    nodeEnvironment,
    deploymentEnvironment,
    apiHost,
    database.parsed,
    redis.parsed,
    supplierAuthSessionSigningKey,
  );

  const queuePrefix = environment.BULLMQ_PREFIX?.trim() || DEFAULTS.queuePrefix;
  if (!/^[a-z][a-z0-9_-]{1,31}$/iu.test(queuePrefix)) {
    return throwInvalid(
      'BULLMQ_PREFIX',
      'must contain 2-32 letters, numbers, underscores or hyphens',
    );
  }

  return Object.freeze({
    nodeEnvironment,
    deploymentEnvironment,
    apiHost,
    apiPort: parseInteger(
      environment,
      'API_PORT',
      DEFAULTS.apiPort,
      1,
      65_535,
    ),
    portalPublicOrigin: parsedPortalOrigin.origin,
    databaseUrl: database.raw,
    redisUrl: redis.raw,
    supplierAuthSessionSigningKey,
    queuePrefix,
    connectTimeoutMs: parseInteger(
      environment,
      'INFRA_CONNECT_TIMEOUT_MS',
      DEFAULTS.connectTimeoutMs,
      100,
      30_000,
    ),
    healthProbeTimeoutMs: parseInteger(
      environment,
      'INFRA_HEALTH_TIMEOUT_MS',
      DEFAULTS.healthProbeTimeoutMs,
      10,
      10_000,
    ),
    maxRetries: parseInteger(
      environment,
      'INFRA_MAX_RETRIES',
      DEFAULTS.maxRetries,
      0,
      10,
    ),
    retryBaseDelayMs: parseInteger(
      environment,
      'INFRA_RETRY_BASE_DELAY_MS',
      DEFAULTS.retryBaseDelayMs,
      10,
      10_000,
    ),
    retryMaxDelayMs: parseInteger(
      environment,
      'INFRA_RETRY_MAX_DELAY_MS',
      DEFAULTS.retryMaxDelayMs,
      10,
      30_000,
    ),
  });
};
