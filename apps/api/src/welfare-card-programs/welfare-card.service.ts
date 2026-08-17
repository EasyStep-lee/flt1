import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type { ConsumerOrderActor } from '../orders/order.actor.js';
import { ORDER_REPOSITORY, type OrderRepository } from '../orders/order.repository.js';
import type { WelfareCardActor } from './welfare-card.actor.js';
import { normalizeBatch, normalizeProgram, normalizeWelfareCardBinding, requireWelfareId, requireWelfareIdempotencyKey, welfareRequestHash } from './welfare-card.policy.js';
import { WELFARE_CARD_REPOSITORY, type WelfareBatchRecord, type WelfareCardAccountRecord, type WelfareCardEligibilityAccountRecord, type WelfareCardRepository, type WelfareMutationResult, type WelfareProgramRecord } from './welfare-card.repository.js';
import { cloneWelfareScopeRules, evaluateWelfareScope, parseWelfareScopeRules } from './welfare-card-scope.policy.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eligibilityFields = new Set(['skuId', 'quantity']);
const queryArray = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : value === undefined ? [] : [value];
const normalizeEligibilityQuery = (query: Record<string, unknown>) => {
  if (Object.keys(query).some((key) => !eligibilityFields.has(key))) {
    throw new SafeApiError(422, 'FIELD_FORBIDDEN', '福利卡资格查询不接受归属、价格或抵扣金额字段');
  }
  const skuIds = queryArray(query.skuId);
  const quantities = queryArray(query.quantity);
  if (skuIds.length < 1 || skuIds.length > 100 || skuIds.length !== quantities.length) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', '商品与数量必须一一对应且不超过 100 项');
  }
  const seen = new Set<string>();
  const items = skuIds.map((skuId, index) => {
    const quantityValue = quantities[index];
    const quantity = typeof quantityValue === 'string' && /^\d+$/u.test(quantityValue) ? Number(quantityValue) : Number.NaN;
    if (typeof skuId !== 'string' || !UUID.test(skuId) || seen.has(skuId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', '商品或数量格式无效');
    }
    seen.add(skuId);
    return { skuId, quantity };
  });
  return items;
};
const safeLineAmount = (price: number, quantity: number): number => {
  const amount = price * quantity;
  if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(amount)) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', '商品价格无效');
  }
  return amount;
};
const scopeDescription = (account: WelfareCardEligibilityAccountRecord): string => {
  const fee = account.canPayDeliveryFee ? '含配送费' : '不含配送费';
  if (account.scopeType === 'ALL_PRODUCTS') return `全部商品可用，${fee}`;
  const labels = { CATEGORY: '指定分类', PRODUCT: '指定商品', SKU: '指定规格', COMPOSITE: '组合白名单与黑名单' } as const;
  return `部分商品可用：${labels[account.scopeType]}，${fee}`;
};

const requireRole = (actor: WelfareCardActor): void => {
  if (actor.role !== 'COMPANY_WELFARE_CARD') throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '当前职能无权访问福利卡计划与批次');
};
const batchDto = (record: WelfareBatchRecord) => ({
  id: record.id, batchNo: record.batchNo, totalAmount: record.totalAmount, unitAmount: record.unitAmount,
  issueCount: record.issueCount, claimMode: record.claimMode, agreementVersion: record.agreementVersion,
  status: record.status, version: record.version, createdAt: record.createdAt,
  history: record.history.map(({ event, resultingVersion, occurredAt }) => ({ event, resultingVersion, occurredAt })),
});
const programDto = (record: WelfareProgramRecord) => ({
  id: record.id, name: record.name, fundingType: record.fundingType, issuerType: record.issuerType,
  scopeType: record.scopeType, scopeRules: cloneWelfareScopeRules(record.scopeRules),
  canPayDeliveryFee: record.canPayDeliveryFee, refundPolicy: record.refundPolicy,
  complianceStatus: record.complianceStatus, status: record.status, version: record.version,
  createdAt: record.createdAt, updatedAt: record.updatedAt,
  history: record.history.map(({ event, resultingVersion, occurredAt }) => ({ event, resultingVersion, occurredAt })),
  batches: (record.batches ?? []).map(batchDto),
});
const maskCardNo = (cardNo: string): string => `****${cardNo.slice(-4)}`;
const accountDto = (record: WelfareCardAccountRecord) => ({
  id: record.id,
  programName: record.programName,
  batchNo: record.batchNo,
  maskedCardNo: maskCardNo(record.cardNo),
  balanceAmount: record.balanceAmount,
  frozenAmount: record.frozenAmount,
  availableAmount: record.balanceAmount - record.frozenAmount,
  status: record.status,
  version: record.version,
  claimedAt: record.claimedAt,
});
const mutationValue = <T extends WelfareProgramRecord | WelfareBatchRecord>(result: WelfareMutationResult<T>): { value: T; replayed: boolean } => {
  if (result.kind === 'IDEMPOTENCY_CONFLICT') throw new SafeApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key 与首次请求冲突');
  if (result.kind === 'NOT_FOUND') throw new SafeApiError(404, 'WELFARE_PROGRAM_NOT_FOUND', '福利卡计划不存在于当前公司');
  if (result.kind === 'DUPLICATE') throw new SafeApiError(409, 'DUPLICATE_OR_STATE_CONFLICT', '计划名称或批次号重复');
  if (result.kind !== 'OK') throw new SafeApiError(409, 'DUPLICATE_OR_STATE_CONFLICT', '福利卡资源状态冲突');
  if ('duplicate' in result.value) throw new SafeApiError(409, 'DUPLICATE_OR_STATE_CONFLICT', '计划名称或批次号重复');
  return { value: result.value, replayed: result.replayed };
};

@Injectable()
export class WelfareCardService {
  constructor(
    @Inject(WELFARE_CARD_REPOSITORY) private readonly repository: WelfareCardRepository,
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
  ) {}

  async list(actor: WelfareCardActor, query: Record<string, unknown> = {}) {
    requireRole(actor);
    if (Object.keys(query).length > 0) throw new SafeApiError(422, 'FIELD_FORBIDDEN', '福利卡计划列表不接受客户端归属或筛选覆盖字段');
    const items = (await this.repository.listPrograms(actor.companyId)).map(programDto);
    return { items, total: items.length };
  }

  async createProgram(actor: WelfareCardActor, body: unknown, keyValue: unknown, requestId: string, ip: string | null) {
    requireRole(actor);
    const input = normalizeProgram(body);
    const idempotencyKey = requireWelfareIdempotencyKey(keyValue);
    const result = mutationValue(await this.repository.createProgram({
      companyId: actor.companyId, ...input, actorIdentityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId, idempotencyKey,
      requestHash: welfareRequestHash(input), requestId, ip,
    }));
    return { body: programDto(result.value), replayed: result.replayed };
  }

  async createBatch(actor: WelfareCardActor, programIdValue: unknown, body: unknown, keyValue: unknown, requestId: string, ip: string | null) {
    requireRole(actor);
    const programId = requireWelfareId(programIdValue);
    const program = (await this.repository.listPrograms(actor.companyId)).find((entry) => entry.id === programId);
    if (!program) throw new SafeApiError(404, 'WELFARE_PROGRAM_NOT_FOUND', '福利卡计划不存在于当前公司');
    const input = normalizeBatch(body, program.fundingType);
    const idempotencyKey = requireWelfareIdempotencyKey(keyValue);
    const result = mutationValue(await this.repository.createBatch({
      companyId: actor.companyId, programId, ...input, actorIdentityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId, idempotencyKey,
      requestHash: welfareRequestHash({ programId, ...input }), requestId, ip,
    }));
    return { body: batchDto(result.value), replayed: result.replayed };
  }

  async bindCard(actor: ConsumerOrderActor, body: unknown, keyValue: unknown, requestId: string) {
    if (actor.status !== 'ACTIVE') throw new SafeApiError(403, 'ACCOUNT_SUSPENDED', '当前个人账号不可绑定福利卡');
    const input = normalizeWelfareCardBinding(body);
    const idempotencyKey = requireWelfareIdempotencyKey(keyValue);
    const result = await this.repository.bindCard({
      companyId: actor.companyId,
      consumerUserId: actor.consumerUserId,
      ...input,
      idempotencyKey,
      requestHash: welfareRequestHash(input),
      requestId,
    });
    if (result.kind === 'IDEMPOTENCY_CONFLICT') throw new SafeApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key 与首次请求冲突');
    if (result.kind === 'CARD_ALREADY_CLAIMED') throw new SafeApiError(409, 'CARD_ALREADY_CLAIMED', '该福利卡已领取，不能重复绑定');
    if (result.kind === 'CARD_RECIPIENT_MISMATCH') throw new SafeApiError(403, 'CARD_RECIPIENT_MISMATCH', '该福利卡不属于当前用户');
    if (result.kind === 'CARD_CODE_INVALID') {
      const status = result.reason === 'CREDENTIAL' ? 422 : 409;
      throw new SafeApiError(status, 'CARD_CODE_INVALID', result.reason === 'AGREEMENT' ? '福利卡协议版本已变化，请刷新后重试' : '福利卡卡密或当前状态无效');
    }
    return { body: accountDto(result.value), replayed: result.replayed };
  }

  async listEligibleAccounts(actor: ConsumerOrderActor, query: Record<string, unknown>) {
    if (actor.status !== 'ACTIVE') throw new SafeApiError(403, 'ACCOUNT_SUSPENDED', '当前个人账号不可使用福利卡');
    const items = normalizeEligibilityQuery(query);
    const skuRows = await this.orderRepository.findOrderableSkus(actor.companyId, items.map(({ skuId }) => skuId));
    const skuById = new Map(skuRows.map((row) => [row.skuId, row]));
    if (skuRows.length !== items.length || skuRows.some((row) => row.companyId !== actor.companyId || row.status !== 'ACTIVE' || row.productStatus !== 'ACTIVE' || !row.isRetailEnabled)) {
      throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', '一个或多个商品当前不可结算');
    }
    const pricedItems = items.map((item) => {
      const sku = skuById.get(item.skuId);
      if (!sku) throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', '一个或多个商品当前不可结算');
      return { sku, lineAmount: safeLineAmount(sku.retailSalePrice, item.quantity) };
    });
    const goodsAmount = pricedItems.reduce((sum, item) => {
      const next = sum + item.lineAmount;
      if (!Number.isSafeInteger(next)) throw new SafeApiError(422, 'VALIDATION_FAILED', '结算金额超过支持范围');
      return next;
    }, 0);
    const deliveryFee = 0;
    const accounts = (await this.repository.listEligibilityAccounts(actor.companyId, actor.consumerUserId))
      .filter((account) => account.companyId === actor.companyId
        && account.consumerUserId === actor.consumerUserId
        && account.status === 'ACTIVE'
        && Number.isSafeInteger(account.balanceAmount)
        && account.balanceAmount >= 0
        && Number.isSafeInteger(account.frozenAmount)
        && account.frozenAmount >= 0)
      .flatMap((account) => {
        const rules = parseWelfareScopeRules(account.scopeType, account.scopeRules);
        if (!rules) return [];
        const availableAmount = Math.max(0, account.balanceAmount - account.frozenAmount);
        const itemApplicability = pricedItems.map((item) => {
          const evaluation = evaluateWelfareScope(account.scopeType, rules, item.sku);
          return {
            skuId: item.sku.skuId,
            eligible: evaluation.eligible,
            eligibleAmount: evaluation.eligible ? item.lineAmount : 0,
            reason: evaluation.reason,
          };
        });
        const goodsEligibleAmount = itemApplicability.reduce((sum, item) => sum + item.eligibleAmount, 0);
        const eligibleAmount = goodsEligibleAmount + (account.canPayDeliveryFee ? deliveryFee : 0);
        const maximumDeductibleAmount = Math.min(availableAmount, eligibleAmount);
        if (maximumDeductibleAmount <= 0) return [];
        return [{
          id: account.id,
          programName: account.programName,
          maskedCardNo: maskCardNo(account.cardNo),
          balanceAmount: account.balanceAmount,
          frozenAmount: account.frozenAmount,
          availableAmount,
          status: 'ACTIVE' as const,
          version: account.version,
          scopeType: account.scopeType,
          scopeDescription: scopeDescription(account),
          itemApplicability,
          deliveryFeeApplicability: {
            eligible: account.canPayDeliveryFee,
            eligibleAmount: account.canPayDeliveryFee ? deliveryFee : 0,
          },
          eligibleAmount,
          maximumDeductibleAmount,
        }];
      })
      .sort((left, right) => right.maximumDeductibleAmount - left.maximumDeductibleAmount || left.id.localeCompare(right.id));
    return { goodsAmount, deliveryFee, totalAmount: goodsAmount + deliveryFee, accounts };
  }
}
