import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type { ConsumerOrderActor } from '../orders/order.actor.js';
import type { WelfareCardActor } from './welfare-card.actor.js';
import { normalizeBatch, normalizeProgram, normalizeWelfareCardBinding, requireWelfareId, requireWelfareIdempotencyKey, welfareRequestHash } from './welfare-card.policy.js';
import { WELFARE_CARD_REPOSITORY, type WelfareBatchRecord, type WelfareCardAccountRecord, type WelfareCardRepository, type WelfareMutationResult, type WelfareProgramRecord } from './welfare-card.repository.js';

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
  scopeType: record.scopeType, scopeRules: { ...record.scopeRules, includedIds: [...record.scopeRules.includedIds], excludedIds: [...record.scopeRules.excludedIds] },
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
  constructor(@Inject(WELFARE_CARD_REPOSITORY) private readonly repository: WelfareCardRepository) {}

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
}
