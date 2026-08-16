import { createHash } from 'node:crypto';

import { SafeApiError } from '../http/api-error.js';
import type { WelfareClaimMode, WelfareFundingType, WelfareProgramRecord } from './welfare-card.repository.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const programFields = new Set(['name', 'fundingType', 'scopeType', 'scopeRules', 'canPayDeliveryFee', 'refundPolicy']);
const batchFields = new Set(['enterpriseCustomerId', 'batchNo', 'totalAmount', 'unitAmount', 'issueCount', 'claimMode', 'agreementVersion']);
const fundingTypes = new Set<WelfareFundingType>(['ENTERPRISE_GRANT', 'COMPANY_GIFT', 'PHYSICAL_CARD_OR_CODE']);
const scopeTypes = new Set<WelfareProgramRecord['scopeType']>(['ALL_PRODUCTS', 'CATEGORY', 'PRODUCT', 'SKU']);
const claimModes = new Set<WelfareClaimMode>(['ENTERPRISE_ASSIGNED', 'COMPANY_ASSIGNED', 'PHYSICAL_CARD_OR_CODE']);

const requireObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SafeApiError(422, 'VALIDATION_FAILED', '请求体必须是对象');
  return value as Record<string, unknown>;
};
const rejectUnknown = (body: Record<string, unknown>, fields: ReadonlySet<string>): void => {
  if (Object.keys(body).some((field) => !fields.has(field))) throw new SafeApiError(422, 'FIELD_FORBIDDEN', '禁止传入归属字段或未知字段');
};
const text = (value: unknown, min: number, max: number, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) throw new SafeApiError(422, 'VALIDATION_FAILED', `${label}格式无效`);
  return normalized;
};
export const requireWelfareId = (value: unknown): string => {
  if (typeof value !== 'string' || !uuid.test(value)) throw new SafeApiError(422, 'VALIDATION_FAILED', '福利卡资源编号无效');
  return value;
};
export const requireWelfareIdempotencyKey = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 128) throw new SafeApiError(428, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key 必填');
  return value;
};

export const normalizeProgram = (value: unknown) => {
  const body = requireObject(value);
  rejectUnknown(body, programFields);
  if (body.fundingType === 'PERSONAL_RECHARGE') throw new SafeApiError(422, 'PERSONAL_RECHARGE_FORBIDDEN', '永久禁止个人现金充值');
  if (typeof body.fundingType !== 'string' || !fundingTypes.has(body.fundingType as WelfareFundingType)) throw new SafeApiError(422, 'WELFARE_FUNDING_SOURCE_INVALID', '福利卡资金来源不在固定白名单');
  if (typeof body.scopeType !== 'string' || !scopeTypes.has(body.scopeType as WelfareProgramRecord['scopeType'])) throw new SafeApiError(422, 'VALIDATION_FAILED', '适用范围类型无效');
  const rules = requireObject(body.scopeRules);
  if (Object.keys(rules).some((field) => !['schemaVersion', 'includedIds', 'excludedIds'].includes(field)) || rules.schemaVersion !== 1 || !Array.isArray(rules.includedIds) || !Array.isArray(rules.excludedIds)) throw new SafeApiError(422, 'VALIDATION_FAILED', '适用范围规则无效');
  const ids = [...rules.includedIds, ...rules.excludedIds];
  if (ids.some((id) => typeof id !== 'string' || !uuid.test(id))) throw new SafeApiError(422, 'VALIDATION_FAILED', '适用范围资源编号无效');
  if (ids.length > 1000 || new Set(ids).size !== ids.length) throw new SafeApiError(422, 'VALIDATION_FAILED', '适用范围资源编号重复或超过上限');
  if (body.scopeType === 'ALL_PRODUCTS' && ids.length > 0) throw new SafeApiError(422, 'VALIDATION_FAILED', '全商品范围不能附带资源编号');
  if (typeof body.canPayDeliveryFee !== 'boolean') throw new SafeApiError(422, 'VALIDATION_FAILED', '配送费适用标记无效');
  return {
    name: text(body.name, 2, 191, '计划名称'),
    fundingType: body.fundingType as WelfareFundingType,
    scopeType: body.scopeType as WelfareProgramRecord['scopeType'],
    scopeRules: { schemaVersion: 1 as const, includedIds: [...rules.includedIds] as string[], excludedIds: [...rules.excludedIds] as string[] },
    canPayDeliveryFee: body.canPayDeliveryFee,
    refundPolicy: text(body.refundPolicy, 2, 500, '退款规则'),
  };
};

export const normalizeBatch = (value: unknown, fundingType: WelfareFundingType) => {
  const body = requireObject(value);
  rejectUnknown(body, batchFields);
  const enterpriseCustomerId = body.enterpriseCustomerId === undefined || body.enterpriseCustomerId === null ? null : requireWelfareId(body.enterpriseCustomerId);
  if (fundingType === 'ENTERPRISE_GRANT' && !enterpriseCustomerId) throw new SafeApiError(422, 'VALIDATION_FAILED', '企业福利发放必须关联企业客户');
  if (fundingType !== 'ENTERPRISE_GRANT' && enterpriseCustomerId) throw new SafeApiError(422, 'FIELD_FORBIDDEN', '非企业福利发放不得关联企业客户');
  for (const field of ['totalAmount', 'unitAmount', 'issueCount', 'agreementVersion'] as const) {
    if (!Number.isSafeInteger(body[field]) || (body[field] as number) < 1 || (body[field] as number) > 2_147_483_647) throw new SafeApiError(422, 'VALIDATION_FAILED', `${field}必须是数据库可存储的正整数`);
  }
  const calculatedTotal = (body.unitAmount as number) * (body.issueCount as number);
  if (!Number.isSafeInteger(calculatedTotal) || calculatedTotal !== body.totalAmount) throw new SafeApiError(422, 'WELFARE_BATCH_AMOUNT_MISMATCH', '批次总额必须等于单份金额乘以发行数量');
  const expectedMode: Record<WelfareFundingType, WelfareClaimMode> = {
    ENTERPRISE_GRANT: 'ENTERPRISE_ASSIGNED', COMPANY_GIFT: 'COMPANY_ASSIGNED', PHYSICAL_CARD_OR_CODE: 'PHYSICAL_CARD_OR_CODE',
  };
  if (typeof body.claimMode !== 'string' || !claimModes.has(body.claimMode as WelfareClaimMode) || body.claimMode !== expectedMode[fundingType]) throw new SafeApiError(422, 'WELFARE_CLAIM_MODE_INVALID', '领取方式与资金来源不匹配');
  return {
    enterpriseCustomerId,
    batchNo: text(body.batchNo, 2, 64, '批次号'),
    totalAmount: body.totalAmount as number,
    unitAmount: body.unitAmount as number,
    issueCount: body.issueCount as number,
    claimMode: body.claimMode as WelfareClaimMode,
    agreementVersion: body.agreementVersion as number,
  };
};

export const welfareRequestHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
