import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const legalName = '江苏福礼团供应链科技有限公司';
const schemaVersion = '1.1.0';
const dependencyId = 'EXT-005';
const confirmedStatus = 'CONFIRMED';
const authorizedRole = 'COMPANY_AUTHORIZED_REVIEWER';

const exactKeys = Object.freeze({
  root: [
    'schemaVersion',
    'dependencyId',
    'status',
    'confirmationId',
    'confirmedAt',
    'confirmedBy',
    'customerFacing',
    'controlledEvidence',
    'declarations',
  ],
  confirmedBy: ['authorizedRole', 'identityRef'],
  customerFacing: [
    'legalName',
    'displayName',
    'customerService',
    'invoiceTitle',
  ],
  customerService: ['channel', 'redactedDisplay'],
  controlledEvidence: ['businessLicense', 'customerService', 'invoiceProfile'],
  controlledEvidenceItem: [
    'storageStatus',
    'referenceStatus',
    'reference',
  ],
  declarations: [
    'businessLicenseReviewed',
    'customerFacingNameApproved',
    'customerServiceApproved',
    'invoiceProfileApproved',
    'noSensitiveSourceCommitted',
  ],
});

const confirmationIdPattern = /^EXT-005-[A-Z0-9][A-Z0-9._-]{5,63}$/u;
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;
const identityReferencePattern =
  /^identity:\/\/controlled\/[A-Za-z0-9][A-Za-z0-9._/-]{5,127}$/u;
const controlledReferencePattern =
  /^(?:vault|dms|object):\/\/controlled\/[A-Za-z0-9][A-Za-z0-9._/-]{5,255}$/u;
const contactChannels = new Set(['PHONE', 'EMAIL', 'WECHAT', 'OTHER']);
const controlledStorageStatus = 'CONTROLLED_STORAGE_CONFIRMED';
const controlledReferenceStatuses = new Set([
  'REFERENCE_PROVIDED',
  'NO_INTERNAL_IDENTIFIER',
]);
const fullMobilePattern = /(?:^|\D)1[3-9]\d{9}(?:\D|$)/u;
const fullEmailPattern =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu;
const forbiddenValuePatterns = [
  /-----BEGIN [A-Z ]+-----/u,
  /data:(?:image|application)\//iu,
  /REPLACE_(?:WITH|ME)/u,
];

const isPlainObject = (value) =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const addError = (errors, code, field) => {
  errors.push(Object.freeze({ code, field }));
};

const checkExactObject = (value, field, keys, errors) => {
  if (!isPlainObject(value)) {
    addError(errors, 'OBJECT_REQUIRED', field);
    return false;
  }

  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addError(errors, 'UNEXPECTED_FIELD', `${field}.${key}`);
    }
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) {
      addError(errors, 'REQUIRED_FIELD_MISSING', `${field}.${key}`);
    }
  }
  return true;
};

const checkString = (value, field, errors, { min = 1, max = 128 } = {}) => {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    addError(errors, 'STRING_INVALID', field);
    return false;
  }
  return true;
};

const scanForbiddenValues = (value, field, errors) => {
  if (typeof value === 'string') {
    if (
      value.includes('\u0000') ||
      forbiddenValuePatterns.some((pattern) => pattern.test(value))
    ) {
      addError(errors, 'SENSITIVE_OR_PLACEHOLDER_VALUE_FORBIDDEN', field);
    }
    return;
  }
  if (Array.isArray(value)) {
    addError(errors, 'ARRAY_FORBIDDEN', field);
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      scanForbiddenValues(child, `${field}.${key}`, errors);
    }
  }
};

export const validateExt005Confirmation = (value) => {
  const errors = [];

  if (!checkExactObject(value, '$', exactKeys.root, errors)) {
    return { ok: false, errors };
  }
  scanForbiddenValues(value, '$', errors);

  if (value.schemaVersion !== schemaVersion) {
    addError(errors, 'SCHEMA_VERSION_INVALID', '$.schemaVersion');
  }
  if (value.dependencyId !== dependencyId) {
    addError(errors, 'DEPENDENCY_ID_INVALID', '$.dependencyId');
  }
  if (value.status !== confirmedStatus) {
    addError(errors, 'STATUS_INVALID', '$.status');
  }
  if (
    !checkString(value.confirmationId, '$.confirmationId', errors, {
      max: 72,
    }) ||
    !confirmationIdPattern.test(value.confirmationId)
  ) {
    addError(errors, 'CONFIRMATION_ID_INVALID', '$.confirmationId');
  }
  if (
    !checkString(value.confirmedAt, '$.confirmedAt', errors, { max: 35 }) ||
    !timestampPattern.test(value.confirmedAt) ||
    !Number.isFinite(Date.parse(value.confirmedAt))
  ) {
    addError(errors, 'CONFIRMED_AT_INVALID', '$.confirmedAt');
  }

  if (
    checkExactObject(
      value.confirmedBy,
      '$.confirmedBy',
      exactKeys.confirmedBy,
      errors,
    )
  ) {
    if (value.confirmedBy.authorizedRole !== authorizedRole) {
      addError(
        errors,
        'AUTHORIZED_ROLE_INVALID',
        '$.confirmedBy.authorizedRole',
      );
    }
    if (
      !checkString(
        value.confirmedBy.identityRef,
        '$.confirmedBy.identityRef',
        errors,
        { max: 150 },
      ) ||
      !identityReferencePattern.test(value.confirmedBy.identityRef)
    ) {
      addError(errors, 'IDENTITY_REF_INVALID', '$.confirmedBy.identityRef');
    }
  }

  if (
    checkExactObject(
      value.customerFacing,
      '$.customerFacing',
      exactKeys.customerFacing,
      errors,
    )
  ) {
    if (value.customerFacing.legalName !== legalName) {
      addError(errors, 'LEGAL_NAME_INVALID', '$.customerFacing.legalName');
    }
    checkString(
      value.customerFacing.displayName,
      '$.customerFacing.displayName',
      errors,
      { max: 80 },
    );
    if (value.customerFacing.invoiceTitle !== legalName) {
      addError(
        errors,
        'INVOICE_TITLE_INVALID',
        '$.customerFacing.invoiceTitle',
      );
    }

    if (
      checkExactObject(
        value.customerFacing.customerService,
        '$.customerFacing.customerService',
        exactKeys.customerService,
        errors,
      )
    ) {
      const service = value.customerFacing.customerService;
      if (!contactChannels.has(service.channel)) {
        addError(
          errors,
          'CUSTOMER_SERVICE_CHANNEL_INVALID',
          '$.customerFacing.customerService.channel',
        );
      }
      const displayValid = checkString(
        service.redactedDisplay,
        '$.customerFacing.customerService.redactedDisplay',
        errors,
        { max: 96 },
      );
      if (
        !displayValid ||
        !service.redactedDisplay.includes('*') ||
        fullMobilePattern.test(service.redactedDisplay) ||
        fullEmailPattern.test(service.redactedDisplay)
      ) {
        addError(
          errors,
          'CUSTOMER_SERVICE_NOT_REDACTED',
          '$.customerFacing.customerService.redactedDisplay',
        );
      }
    }
  }

  if (
    checkExactObject(
      value.controlledEvidence,
      '$.controlledEvidence',
      exactKeys.controlledEvidence,
      errors,
    )
  ) {
    for (const key of exactKeys.controlledEvidence) {
      const field = `$.controlledEvidence.${key}`;
      const item = value.controlledEvidence[key];
      if (
        !checkExactObject(
          item,
          field,
          exactKeys.controlledEvidenceItem,
          errors,
        )
      ) {
        continue;
      }
      if (item.storageStatus !== controlledStorageStatus) {
        addError(errors, 'CONTROLLED_STORAGE_NOT_CONFIRMED', `${field}.storageStatus`);
      }
      if (!controlledReferenceStatuses.has(item.referenceStatus)) {
        addError(
          errors,
          'CONTROLLED_REFERENCE_STATUS_INVALID',
          `${field}.referenceStatus`,
        );
        continue;
      }
      if (item.referenceStatus === 'NO_INTERNAL_IDENTIFIER') {
        if (item.reference !== null) {
          addError(
            errors,
            'UNEXPECTED_CONTROLLED_REFERENCE',
            `${field}.reference`,
          );
        }
        continue;
      }
      if (
        !checkString(item.reference, `${field}.reference`, errors, {
          max: 280,
        }) ||
        !controlledReferencePattern.test(item.reference)
      ) {
        addError(
          errors,
          'CONTROLLED_REFERENCE_INVALID',
          `${field}.reference`,
        );
      }
    }
  }

  if (
    checkExactObject(
      value.declarations,
      '$.declarations',
      exactKeys.declarations,
      errors,
    )
  ) {
    for (const key of exactKeys.declarations) {
      if (value.declarations[key] !== true) {
        addError(
          errors,
          'DECLARATION_NOT_CONFIRMED',
          `$.declarations.${key}`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
};

export const summarizeExt005Confirmation = (value) => {
  const result = validateExt005Confirmation(value);
  if (!result.ok) {
    const error = new Error('EXT005_CONFIRMATION_INVALID');
    error.codes = [...new Set(result.errors.map(({ code }) => code))];
    throw error;
  }

  return Object.freeze({
    schemaVersion: value.schemaVersion,
    dependencyId: value.dependencyId,
    status: value.status,
    confirmationId: value.confirmationId,
    confirmedAt: value.confirmedAt,
    legalName: value.customerFacing.legalName,
  });
};

const parseInputPath = (argv) => {
  const index = argv.indexOf('--input');
  if (index === -1 || !argv[index + 1] || argv[index + 1].startsWith('--')) {
    return null;
  }
  return path.resolve(argv[index + 1]);
};

const runCli = async () => {
  const inputPath = parseInputPath(process.argv.slice(2));
  if (inputPath === null) {
    console.error('EXT005_CONFIRMATION_USAGE_ERROR:INPUT_REQUIRED');
    process.exitCode = 2;
    return;
  }

  let confirmation;
  try {
    confirmation = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch (error) {
    const code = error instanceof SyntaxError ? 'INVALID_JSON' : 'INPUT_UNREADABLE';
    console.error(`EXT005_CONFIRMATION_${code}`);
    process.exitCode = 1;
    return;
  }

  const result = validateExt005Confirmation(confirmation);
  if (!result.ok) {
    const codes = [...new Set(result.errors.map(({ code }) => code))].sort();
    console.error(`EXT005_CONFIRMATION_INVALID:${codes.join(',')}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `EXT005_CONFIRMATION_OK:${JSON.stringify(
      summarizeExt005Confirmation(confirmation),
    )}`,
  );
};

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(modulePath)) {
  await runCli();
}
