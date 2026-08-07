import assert from 'node:assert/strict';
import test from 'node:test';

import {
  API_RUNTIME_SCHEMA,
  CONFIGURATION_LAYERS,
  ConfigurationError,
  loadApiRuntimeConfig,
  redactLogValue,
  redactText,
} from '../../packages/config/dist/index.js';

const signingKeyField = ['SUPPLIER_AUTH_SESSION_SIGNING', 'KEY'].join('_');

const validEnvironment = () => ({
  NODE_ENV: 'test',
  APP_ENV: 'test',
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  DATABASE_URL:
    'mysql://fulishe:unit-test-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:unit-test-only@127.0.0.1:6379/0',
  BULLMQ_PREFIX: 'fulishe',
  [signingKeyField]: 'unit-test-only-' + 'x'.repeat(32),
});

const productionCredential = () =>
  ['S7rong', 'M007', 'Fixture', '9'.repeat(24)].join('');

const productionSigningKey = () =>
  ['Pr0duction', 'Session', 'Signing', 'K3y', '9'.repeat(24)].join('');

test('configuration schema freezes all four deployment layers and secret fields', () => {
  assert.deepEqual(CONFIGURATION_LAYERS, [
    'development',
    'test',
    'staging',
    'production',
  ]);
  assert.equal(API_RUNTIME_SCHEMA.DATABASE_URL.secret, true);
  assert.equal(API_RUNTIME_SCHEMA.REDIS_URL.secret, true);
  assert.equal(API_RUNTIME_SCHEMA[signingKeyField].secret, true);
  assert.equal(API_RUNTIME_SCHEMA.API_PORT.secret, false);
});

test('configuration parser distinguishes staging deployment from Node production mode', () => {
  const environment = validEnvironment();
  environment.NODE_ENV = 'production';
  environment.APP_ENV = 'staging';
  environment.API_HOST = '10.20.30.40';
  const credential = productionCredential();
  environment.DATABASE_URL =
    `mysql://service-account:${credential}@mysql.internal:3306/fulishe`;
  environment.REDIS_URL =
    `rediss://:${credential}@redis.internal:6380/0`;
  environment[signingKeyField] = productionSigningKey();

  const config = loadApiRuntimeConfig(environment);

  assert.equal(config.nodeEnvironment, 'production');
  assert.equal(config.deploymentEnvironment, 'staging');
  assert.equal(config.apiHost, '10.20.30.40');
  assert.ok(Object.isFrozen(config));
});

test('configuration parser aggregates missing variables without leaking supplied values', () => {
  const environment = validEnvironment();
  delete environment.DATABASE_URL;
  delete environment.REDIS_URL;
  environment.MYSQL_PASSWORD = 'must-never-appear';

  assert.throws(
    () => loadApiRuntimeConfig(environment),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.code, 'CONFIG_MISSING');
      assert.deepEqual(error.fields, ['DATABASE_URL', 'REDIS_URL']);
      assert.match(error.message, /DATABASE_URL/);
      assert.match(error.message, /REDIS_URL/);
      assert.doesNotMatch(error.message, /must-never-appear/);
      return true;
    },
  );
});

test('staging and production reject local endpoints and documented development credentials', () => {
  const environment = validEnvironment();
  environment.NODE_ENV = 'production';
  environment.APP_ENV = 'production';
  environment.DATABASE_URL =
    'mysql://fulishe:fulishe_mysql_dev_only@127.0.0.1:3306/fulishe';
  environment.REDIS_URL =
    'redis://:fulishe_redis_dev_only@127.0.0.1:6379/0';
  environment[signingKeyField] = productionSigningKey();

  assert.throws(
    () => loadApiRuntimeConfig(environment),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.code, 'CONFIG_UNSAFE');
      assert.ok(error.fields.includes('DATABASE_URL'));
      assert.ok(error.fields.includes('REDIS_URL'));
      assert.doesNotMatch(error.message, /fulishe_mysql_dev_only/);
      assert.doesNotMatch(error.message, /fulishe_redis_dev_only/);
      return true;
    },
  );
});

test('production permits a wildcard API bind but rejects the full IPv4 loopback range for dependencies', () => {
  const environment = validEnvironment();
  environment.NODE_ENV = 'production';
  environment.APP_ENV = 'production';
  environment.API_HOST = '0.0.0.0';
  const credential = productionCredential();
  environment.DATABASE_URL =
    `mysql://service-account:${credential}@mysql.internal:3306/fulishe`;
  environment.REDIS_URL =
    `rediss://:${credential}@redis.internal:6380/0`;
  environment[signingKeyField] = productionSigningKey();

  assert.equal(loadApiRuntimeConfig(environment).apiHost, '0.0.0.0');

  environment.DATABASE_URL =
    `mysql://service-account:${credential}@127.9.8.7:3306/fulishe`;
  assert.throws(
    () => loadApiRuntimeConfig(environment),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.code, 'CONFIG_UNSAFE');
      assert.ok(error.fields.includes('DATABASE_URL'));
      return true;
    },
  );
});

test('production rejects documented runtime-placeholder credentials even on remote hosts', () => {
  const environment = validEnvironment();
  const credential = productionCredential();
  environment.NODE_ENV = 'production';
  environment.APP_ENV = 'production';
  environment.API_HOST = '0.0.0.0';
  environment.DATABASE_URL =
    'mysql://service-account:runtime-injected-value@mysql.internal:3306/fulishe';
  environment.REDIS_URL =
    `rediss://:${credential}@redis.internal:6380/0`;
  environment[signingKeyField] = productionSigningKey();

  assert.throws(
    () => loadApiRuntimeConfig(environment),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.code, 'CONFIG_UNSAFE');
      assert.deepEqual(error.fields, ['DATABASE_URL']);
      assert.doesNotMatch(error.message, /runtime-injected-value/);
      return true;
    },
  );
});

test('staging and production require a strong supplier session signing key', () => {
  const environment = validEnvironment();
  const credential = productionCredential();
  environment.NODE_ENV = 'production';
  environment.APP_ENV = 'production';
  environment.API_HOST = '0.0.0.0';
  environment.DATABASE_URL =
    `mysql://service-account:${credential}@mysql.internal:3306/fulishe`;
  environment.REDIS_URL =
    `rediss://:${credential}@redis.internal:6380/0`;
  delete environment[signingKeyField];

  assert.throws(
    () => loadApiRuntimeConfig(environment),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.code, 'CONFIG_MISSING');
      assert.deepEqual(error.fields, [signingKeyField]);
      return true;
    },
  );

  environment[signingKeyField] = 'development-only-' + 'x'.repeat(32);
  assert.throws(
    () => loadApiRuntimeConfig(environment),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.code, 'CONFIG_UNSAFE');
      assert.ok(error.fields.includes(signingKeyField));
      assert.doesNotMatch(error.message, /development-only/u);
      return true;
    },
  );
});

test('supplier session signing key rejects short or non-base64url values', () => {
  const environment = validEnvironment();
  environment[signingKeyField] = 'too-short';

  assert.throws(
    () => loadApiRuntimeConfig(environment),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.code, 'CONFIG_INVALID');
      assert.deepEqual(error.fields, [signingKeyField]);
      return true;
    },
  );

  environment[signingKeyField] = 'x'.repeat(42) + '!';
  assert.throws(
    () => loadApiRuntimeConfig(environment),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.code, 'CONFIG_INVALID');
      assert.deepEqual(error.fields, [signingKeyField]);
      return true;
    },
  );
});

test('structured redaction is recursive, immutable and case-insensitive', () => {
  const input = {
    event: 'request.failed',
    headers: {
      Authorization: 'Bearer must-never-appear',
      cookie: 'session=must-never-appear',
      'x-request-id': 'safe-request-id',
    },
    account: {
      password: 'must-never-appear',
      apiV3Key: 'must-never-appear',
      welfareCardCode: 'must-never-appear',
      displayName: '可以保留',
    },
    attempts: [{ token: 'must-never-appear', status: 'failed' }],
    endpoint: 'redis://:must-never-appear@redis.internal:6379/0',
  };

  const output = redactLogValue(input);
  const serialized = JSON.stringify(output);

  assert.doesNotMatch(serialized, /must-never-appear/);
  assert.match(serialized, /safe-request-id/);
  assert.match(serialized, /可以保留/);
  assert.equal(input.account.password, 'must-never-appear');

  const configOutput = redactLogValue(loadApiRuntimeConfig(validEnvironment()));
  assert.equal(configOutput.supplierAuthSessionSigningKey, '[REDACTED]');
});

test('text redaction removes credentials, assignments and bearer values', () => {
  const value = [
    'DATABASE_URL=mysql://user:must-never-appear@db.internal:3306/fulishe',
    'Authorization: Bearer must-never-appear',
    'WECHAT_APP_SECRET=must-never-appear',
  ].join(' ');

  const redacted = redactText(value);

  assert.doesNotMatch(redacted, /must-never-appear/);
  assert.match(redacted, /\[REDACTED\]/);
});
