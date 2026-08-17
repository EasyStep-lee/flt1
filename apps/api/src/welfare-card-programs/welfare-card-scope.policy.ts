export type WelfareScopeType = 'ALL_PRODUCTS' | 'CATEGORY' | 'PRODUCT' | 'SKU' | 'COMPOSITE';

export interface WelfareScopeRulesV1 {
  readonly schemaVersion: 1;
  readonly includedIds: readonly string[];
  readonly excludedIds: readonly string[];
}

export interface WelfareScopeRulesV2 {
  readonly schemaVersion: 2;
  readonly categoryIncludedIds: readonly string[];
  readonly productIncludedIds: readonly string[];
  readonly skuIncludedIds: readonly string[];
  readonly categoryExcludedIds: readonly string[];
  readonly productExcludedIds: readonly string[];
  readonly skuExcludedIds: readonly string[];
}

export type WelfareScopeRules = Readonly<WelfareScopeRulesV1 | WelfareScopeRulesV2>;
export type WelfareLineEligibilityReason =
  | 'ALL_PRODUCTS'
  | 'DEFAULT_INCLUDED'
  | 'CATEGORY_INCLUDED'
  | 'PRODUCT_INCLUDED'
  | 'SKU_INCLUDED'
  | 'CATEGORY_EXCLUDED'
  | 'PRODUCT_EXCLUDED'
  | 'SKU_EXCLUDED'
  | 'OUTSIDE_WHITELIST';

export interface WelfareScopeResource {
  readonly categoryId: string;
  readonly productId: string;
  readonly skuId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const V1_FIELDS = new Set(['schemaVersion', 'includedIds', 'excludedIds']);
const V2_LIST_FIELDS = [
  'categoryIncludedIds',
  'productIncludedIds',
  'skuIncludedIds',
  'categoryExcludedIds',
  'productExcludedIds',
  'skuExcludedIds',
] as const;
const V2_FIELDS = new Set(['schemaVersion', ...V2_LIST_FIELDS]);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isIdList = (value: unknown): value is readonly string[] => Array.isArray(value)
  && value.every((id) => typeof id === 'string' && UUID.test(id))
  && new Set(value).size === value.length;

export const parseWelfareScopeRules = (scopeType: WelfareScopeType, value: unknown): WelfareScopeRules | null => {
  if (!isRecord(value)) return null;
  if (value.schemaVersion === 1) {
    if (scopeType === 'COMPOSITE' || Object.keys(value).some((field) => !V1_FIELDS.has(field))) return null;
    if (!isIdList(value.includedIds) || !isIdList(value.excludedIds)) return null;
    const allIds = [...value.includedIds, ...value.excludedIds];
    if (allIds.length > 1000 || new Set(allIds).size !== allIds.length) return null;
    if (scopeType === 'ALL_PRODUCTS' && allIds.length > 0) return null;
    return { schemaVersion: 1, includedIds: [...value.includedIds], excludedIds: [...value.excludedIds] };
  }
  if (value.schemaVersion === 2) {
    if (scopeType !== 'COMPOSITE' || Object.keys(value).some((field) => !V2_FIELDS.has(field))) return null;
    if (V2_LIST_FIELDS.some((field) => !isIdList(value[field]))) return null;
    const totalIds = V2_LIST_FIELDS.reduce((sum, field) => sum + (value[field] as readonly string[]).length, 0);
    if (totalIds > 1000) return null;
    return {
      schemaVersion: 2,
      categoryIncludedIds: [...value.categoryIncludedIds as readonly string[]],
      productIncludedIds: [...value.productIncludedIds as readonly string[]],
      skuIncludedIds: [...value.skuIncludedIds as readonly string[]],
      categoryExcludedIds: [...value.categoryExcludedIds as readonly string[]],
      productExcludedIds: [...value.productExcludedIds as readonly string[]],
      skuExcludedIds: [...value.skuExcludedIds as readonly string[]],
    };
  }
  return null;
};

export const evaluateWelfareScope = (
  scopeType: WelfareScopeType,
  rules: WelfareScopeRules,
  resource: WelfareScopeResource,
): Readonly<{ eligible: boolean; reason: WelfareLineEligibilityReason }> => {
  if (rules.schemaVersion === 1) {
    if (scopeType === 'ALL_PRODUCTS') return { eligible: true, reason: 'ALL_PRODUCTS' };
    const resourceId = scopeType === 'CATEGORY' ? resource.categoryId : scopeType === 'PRODUCT' ? resource.productId : resource.skuId;
    if (rules.excludedIds.includes(resourceId)) {
      const reason = scopeType === 'CATEGORY' ? 'CATEGORY_EXCLUDED' : scopeType === 'PRODUCT' ? 'PRODUCT_EXCLUDED' : 'SKU_EXCLUDED';
      return { eligible: false, reason };
    }
    if (rules.includedIds.includes(resourceId)) {
      const reason = scopeType === 'CATEGORY' ? 'CATEGORY_INCLUDED' : scopeType === 'PRODUCT' ? 'PRODUCT_INCLUDED' : 'SKU_INCLUDED';
      return { eligible: true, reason };
    }
    return { eligible: false, reason: 'OUTSIDE_WHITELIST' };
  }

  if (rules.skuExcludedIds.includes(resource.skuId)) return { eligible: false, reason: 'SKU_EXCLUDED' };
  if (rules.productExcludedIds.includes(resource.productId)) return { eligible: false, reason: 'PRODUCT_EXCLUDED' };
  if (rules.categoryExcludedIds.includes(resource.categoryId)) return { eligible: false, reason: 'CATEGORY_EXCLUDED' };
  if (rules.skuIncludedIds.includes(resource.skuId)) return { eligible: true, reason: 'SKU_INCLUDED' };
  if (rules.productIncludedIds.includes(resource.productId)) return { eligible: true, reason: 'PRODUCT_INCLUDED' };
  if (rules.categoryIncludedIds.includes(resource.categoryId)) return { eligible: true, reason: 'CATEGORY_INCLUDED' };
  const hasWhitelist = rules.skuIncludedIds.length + rules.productIncludedIds.length + rules.categoryIncludedIds.length > 0;
  return hasWhitelist ? { eligible: false, reason: 'OUTSIDE_WHITELIST' } : { eligible: true, reason: 'DEFAULT_INCLUDED' };
};

export const cloneWelfareScopeRules = (rules: WelfareScopeRules): WelfareScopeRules => rules.schemaVersion === 1
  ? { schemaVersion: 1, includedIds: [...rules.includedIds], excludedIds: [...rules.excludedIds] }
  : {
      schemaVersion: 2,
      categoryIncludedIds: [...rules.categoryIncludedIds],
      productIncludedIds: [...rules.productIncludedIds],
      skuIncludedIds: [...rules.skuIncludedIds],
      categoryExcludedIds: [...rules.categoryExcludedIds],
      productExcludedIds: [...rules.productExcludedIds],
      skuExcludedIds: [...rules.skuExcludedIds],
    };
