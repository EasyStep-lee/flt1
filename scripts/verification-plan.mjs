const immutableCommitPattern = /^[0-9a-f]{40}$/iu;
const bypassVariablePattern =
  /^(?:(?:VERIFY|CI)_SKIP(?:_|$)|SKIP_(?:VERIFY|CI)(?:_|$)|VERIFY_ONLY(?:_|$))/u;
const baseReferenceToken = '{VERIFY_BASE_REF}';

const pnpmStep = (id, script) =>
  Object.freeze({ id, runner: 'pnpm', arguments: [script] });
const nodeStep = (id, ...arguments_) =>
  Object.freeze({ id, runner: 'node', arguments: arguments_ });

export const verificationSteps = Object.freeze([
  pnpmStep('workspace', 'workspace:check'),
  pnpmStep('lint', 'lint'),
  pnpmStep('openapi-generate', 'openapi:generate'),
  pnpmStep('openapi-diff', 'openapi:diff'),
  pnpmStep('openapi-check', 'openapi:check'),
  nodeStep(
    'openapi-breaking',
    './scripts/check-openapi-breaking.mjs',
    '--base-ref',
    baseReferenceToken,
  ),
  pnpmStep('typecheck', 'typecheck'),
  pnpmStep('unit', 'test:unit'),
  pnpmStep('regression', 'test'),
  pnpmStep('api', 'test:api'),
  pnpmStep('e2e-foundation', 'test:e2e:foundation'),
  pnpmStep('e2e-p0', 'test:e2e:p0'),
  pnpmStep('prisma-validate', 'prisma:validate'),
  nodeStep(
    'migration-integrity',
    './scripts/check-prisma-migrations.mjs',
    '--base-ref',
    baseReferenceToken,
  ),
  pnpmStep('migration-rehearsal', 'prisma:migrate:dry-run'),
  pnpmStep('build', 'build'),
  pnpmStep('secrets', 'secrets:scan'),
]);

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== '';

export const assertNoVerificationBypass = (environment = process.env) => {
  const forbidden = Object.keys(environment)
    .filter(
      (name) =>
        bypassVariablePattern.test(name) && hasValue(environment[name]),
    )
    .sort();
  if (forbidden.length > 0) {
    throw new Error(`VERIFY_BYPASS_FORBIDDEN:${forbidden.join(',')}`);
  }
};

const readArgumentBaseRef = (arguments_) => {
  let baseRef;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument !== '--base-ref') {
      throw new Error(`VERIFY_ARGUMENT_UNSUPPORTED:${argument}`);
    }
    if (baseRef !== undefined) {
      throw new Error('VERIFY_BASE_REF_DUPLICATE');
    }
    const value = arguments_[index + 1];
    if (!hasValue(value)) {
      throw new Error('VERIFY_BASE_REF_MISSING');
    }
    baseRef = String(value).trim();
    index += 1;
  }
  return baseRef;
};

const normalizeBaseRef = (value) => {
  if (value === 'HEAD') return value;
  if (!immutableCommitPattern.test(value)) {
    throw new Error('VERIFY_BASE_REF_INVALID:expected HEAD or a 40-character commit SHA');
  }
  return value.toLowerCase();
};

export const resolveVerificationBaseRef = ({
  argv = process.argv.slice(2),
  env = process.env,
} = {}) => {
  assertNoVerificationBypass(env);
  const argumentValue = readArgumentBaseRef(argv);
  const environmentValue = hasValue(env.VERIFY_BASE_REF)
    ? String(env.VERIFY_BASE_REF).trim()
    : undefined;
  if (
    argumentValue !== undefined &&
    environmentValue !== undefined &&
    argumentValue !== environmentValue
  ) {
    throw new Error('VERIFY_BASE_REF_CONFLICT');
  }

  const isCi = ['1', 'true'].includes(String(env.CI ?? '').toLowerCase());
  const selected = argumentValue ?? environmentValue;
  if (selected === undefined) {
    if (isCi) throw new Error('VERIFY_BASE_REF_REQUIRED_IN_CI');
    return { value: 'HEAD', source: 'LOCAL_HEAD_FALLBACK' };
  }

  const normalized = normalizeBaseRef(selected);
  if (isCi && normalized === 'HEAD') {
    throw new Error('VERIFY_BASE_REF_REQUIRED_IN_CI');
  }
  return {
    value: normalized,
    source: argumentValue === undefined ? 'ENVIRONMENT' : 'ARGUMENT',
  };
};

export const materializeVerificationStep = (step, baseRef) => ({
  ...step,
  arguments: step.arguments.map((argument) =>
    argument === baseReferenceToken ? baseRef : argument,
  ),
});
