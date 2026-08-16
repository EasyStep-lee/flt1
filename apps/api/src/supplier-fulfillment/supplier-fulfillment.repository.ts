import type { FulfillmentHandoverParty, FulfillmentNode } from './supplier-fulfillment.policy.js';

export const SUPPLIER_FULFILLMENT_REPOSITORY = Symbol('SUPPLIER_FULFILLMENT_REPOSITORY');

export type FulfillmentPreparationStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY_FOR_HANDOVER' | 'HANDED_OVER' | 'COMPLETED' | 'CANCELLED';

export interface FulfillmentNodeRecord {
  readonly id: string;
  readonly node: FulfillmentNode;
  readonly reason: string | null;
  readonly resultingVersion: number;
  readonly occurredAt: string;
}
export interface SupplierFulfillmentRecord {
  readonly id: string;
  readonly orderId: string;
  readonly enterpriseProcurementOrderId: string | null;
  readonly supplierId: string;
  readonly orderNo: string;
  readonly subOrderNo: string;
  readonly channelType: 'CONSUMER' | 'ENTERPRISE';
  readonly activationStatus: 'PENDING_PAYMENT' | 'ACTIVE' | 'CANCELLED';
  readonly preparationStatus: FulfillmentPreparationStatus;
  readonly handoverStatus: 'NOT_READY' | 'READY' | 'HANDED_OVER';
  readonly settlementStatus: 'NOT_RECONCILED' | 'PENDING_STATEMENT' | 'IN_STATEMENT' | 'ADJUSTED';
  readonly goodsAmount: number;
  readonly supplyAmount: number;
  readonly pickupPoint: { readonly address: string; readonly lat?: string; readonly lng?: string };
  readonly items: readonly { readonly orderItemId: string; readonly productName: string; readonly skuLabel: string; readonly quantity: number }[];
  readonly nodes: readonly FulfillmentNodeRecord[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppendFulfillmentNodeCommand {
  readonly supplierId: string;
  readonly subOrderId: string;
  readonly node: FulfillmentNode;
  readonly expectedVersion: number;
  readonly reason: string | null;
  readonly shortages: readonly { readonly orderItemId: string; readonly quantity: number }[];
  readonly handoverParty: FulfillmentHandoverParty | null;
  readonly handoverReference: string | null;
  readonly actorIdentityId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
  readonly ip: string | null;
}

export type FulfillmentMutationResult =
  | { readonly kind: 'OK'; readonly value: SupplierFulfillmentRecord; readonly replayed: boolean }
  | { readonly kind: 'NOT_FOUND' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'STATE_INVALID' | 'HANDOVER_PARTY_INVALID' | 'SHORTAGE_INVALID' | 'PICKUP_POINT_INVALID' | 'ACTIVATION_INVALID' };

export interface SupplierFulfillmentRepository {
  list(supplierId: string): Promise<readonly SupplierFulfillmentRecord[]>;
  appendNode(command: AppendFulfillmentNodeCommand): Promise<FulfillmentMutationResult>;
}
