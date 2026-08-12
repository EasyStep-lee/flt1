import type { CategoryTemplateDefinition } from '../category-templates/category-template.policy.js';
import { SafeApiError } from '../http/api-error.js';
import {
  requestHash,
  requireIdempotencyKey,
  requireSupplierProductId,
  requireVersion,
} from '../supplier-products/supplier-product.policy.js';

export const regulatedCategoryRequestHash = requestHash;
export const requireRegulatedCategoryIdempotencyKey = requireIdempotencyKey;
export const requireRegulatedCategoryId = (value: unknown): string =>
  requireSupplierProductId(value, 'categoryId');

const body = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Body must be an object');
  }
  return value as Record<string, unknown>;
};

const code = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length < 4 || value.trim().length > 64) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'secondVerificationCode is invalid');
  }
  return value.trim();
};

const futureDateTime = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new SafeApiError(422, 'QUALIFICATION_REQUIRED', 'Qualification validity is required');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
    throw new SafeApiError(422, 'QUALIFICATION_REQUIRED', 'Qualification must be unexpired');
  }
  return parsed.toISOString();
};

const references = (value: unknown): readonly string[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    throw new SafeApiError(422, 'QUALIFICATION_REQUIRED', 'Company qualification is required');
  }
  const normalized = value.map((reference) => {
    if (
      typeof reference !== 'string' ||
      !reference.startsWith('object://company-qualification/') ||
      reference.length > 500
    ) {
      throw new SafeApiError(422, 'QUALIFICATION_REQUIRED', 'Company qualification is invalid');
    }
    return reference;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new SafeApiError(422, 'QUALIFICATION_REQUIRED', 'Company qualification is duplicated');
  }
  return normalized;
};

export interface RegulatedCategoryEnableInput {
  readonly expectedVersion: number;
  readonly companyQualificationReferences: readonly string[];
  readonly qualificationValidUntil: string;
  readonly secondVerificationCode: string;
}

export interface RegulatedCategoryDisableInput {
  readonly expectedVersion: number;
  readonly reason: string;
  readonly secondVerificationCode: string;
}

export const normalizeRegulatedCategoryEnable = (
  value: unknown,
): RegulatedCategoryEnableInput => {
  const input = body(value);
  const allowed = new Set([
    'companyQualificationReferences',
    'qualificationValidUntil',
    'secondVerificationCode',
    'version',
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new SafeApiError(403, 'FIELD_FORBIDDEN', 'Request contains forbidden fields');
  }
  return {
    expectedVersion: requireVersion(input.version),
    companyQualificationReferences: references(input.companyQualificationReferences),
    qualificationValidUntil: futureDateTime(input.qualificationValidUntil),
    secondVerificationCode: code(input.secondVerificationCode),
  };
};

export const normalizeRegulatedCategoryDisable = (
  value: unknown,
): RegulatedCategoryDisableInput => {
  const input = body(value);
  const allowed = new Set(['reason', 'secondVerificationCode', 'version']);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new SafeApiError(403, 'FIELD_FORBIDDEN', 'Request contains forbidden fields');
  }
  if (typeof input.reason !== 'string' || input.reason.trim().length < 2 || input.reason.trim().length > 500) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'reason is invalid');
  }
  return {
    expectedVersion: requireVersion(input.version),
    reason: input.reason.trim(),
    secondVerificationCode: code(input.secondVerificationCode),
  };
};

export const assertRegulatedTemplateCompliant = (
  template: CategoryTemplateDefinition,
): void => {
  if (template.regulatoryMode !== 'HIGH_RISK') {
    throw new SafeApiError(422, 'CATEGORY_TEMPLATE_INVALID', 'Published high-risk template is required');
  }
  const requiredQualifications = template.qualificationRules.rules.filter(
    ({ required, expiryRequired }) => required && expiryRequired,
  );
  const moduleKinds = new Set(template.detailModules.modules.map(({ kind }) => kind));
  if (
    requiredQualifications.length < 1 ||
    !moduleKinds.has('NOTICE') ||
    !moduleKinds.has('QUALIFICATIONS')
  ) {
    throw new SafeApiError(
      422,
      'CATEGORY_TEMPLATE_INVALID',
      'High-risk template requires expiring qualifications and fixed disclosure modules',
    );
  }
};
