import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  CreateOrderCommand,
  CreateOrderResult,
  OrderAggregateRecord,
  OrderRepository,
  OrderableSkuRecord,
  ReleaseOrderInventoryCommand,
  ReleaseOrderInventoryResult,
} from './order.repository.js';

const asObject = (value: unknown): Readonly<Record<string, unknown>> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (structuredClone(value) as Readonly<Record<string, unknown>>)
    : {};

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

class InventoryReservationFailure extends Error {
  constructor(
    readonly kind: 'INVENTORY_INSUFFICIENT' | 'INVENTORY_RESERVATION_CONFLICT',
    readonly skuId?: string,
  ) {
    super(kind);
  }
}

const reservationKey = (command: CreateOrderCommand): string =>
  createHash('sha256')
    .update(`${command.idempotencyScope}:${command.idempotencyKey}`)
    .digest('hex');

const releaseRequestHash = (command: ReleaseOrderInventoryCommand): string =>
  createHash('sha256')
    .update(JSON.stringify({ orderId: command.orderId, reason: command.reason }))
    .digest('hex');

const orderInclude = Prisma.validator<Prisma.BuyerOrderInclude>()({
  items: { orderBy: { lineNo: 'asc' } },
  supplierFulfillments: { orderBy: { supplierId: 'asc' } },
  events: { where: { event: 'CREATED' }, orderBy: { version: 'asc' }, take: 1 },
  enterpriseProcurementOrder: true,
});

type StoredOrder = Prisma.BuyerOrderGetPayload<{ include: typeof orderInclude }>;

const toAggregate = (order: StoredOrder): OrderAggregateRecord => {
  const event = order.events[0];
  const enterpriseProcurement = order.enterpriseProcurementOrder;
  const address = asObject(enterpriseProcurement?.enterpriseAddressSnapshot);
  const invoiceProfile = asObject(enterpriseProcurement?.invoiceProfileSnapshot);
  return {
    orderId: order.id,
    orderNo: order.orderNo,
    companyId: order.companyId,
    consumerUserId: order.consumerUserId,
    enterpriseCustomerId: order.enterpriseCustomerId,
    orderType: order.orderType,
    goodsAmount: order.goodsAmount,
    deliveryFee: 0,
    discountAmount: 0,
    totalAmount: order.totalAmount,
    welfareCardAmount: 0,
    cashAmount: order.cashAmount,
    externalPaymentMethod: order.externalPaymentMethod,
    paymentStatus: 'PENDING',
    orderStatus: 'PENDING_PAYMENT',
    idempotencyScope: order.idempotencyScope,
    idempotencyKey: order.idempotencyKey,
    requestHash: order.requestHash,
    requestId: event?.requestId ?? 'request-id-unavailable',
    actorId: event?.actorId ?? (order.consumerUserId ?? order.enterpriseCustomerId ?? order.companyId),
    items: order.items.map((item) => {
      const snapshot = asObject(item.productSnapshot);
      return {
        orderItemId: item.id,
        supplierId: item.supplierId,
        productId: item.productId,
        skuId: item.skuId,
        productName: typeof snapshot.name === 'string' ? snapshot.name : '商品',
        categoryId: typeof snapshot.categoryId === 'string' ? snapshot.categoryId : '',
        templateVersion: typeof snapshot.templateVersion === 'number' ? snapshot.templateVersion : 0,
        afterSaleSnapshot: asObject(snapshot.afterSaleSnapshot),
        quantity: item.quantity,
        salePrice: item.salePriceSnapshot,
        supplyPrice: item.supplyPriceSnapshot,
        totalAmount: item.lineAmount,
      };
    }),
    supplierFulfillments: order.supplierFulfillments.map((fulfillment) => ({
      fulfillmentOrderId: fulfillment.id,
      supplierId: fulfillment.supplierId,
      itemCount: fulfillment.itemCount,
      goodsAmount: fulfillment.goodsAmount,
      supplyAmount: fulfillment.supplyAmount,
      status: 'PENDING_PAYMENT',
    })),
    enterpriseProcurement: enterpriseProcurement
      ? {
          enterpriseOrderId: enterpriseProcurement.id,
          paymentMethod: enterpriseProcurement.paymentMethod,
          remittanceReviewStatus: 'NOT_SUBMITTED',
          status: 'PENDING_PAYMENT',
          address: {
            consignee: typeof address.consignee === 'string' ? address.consignee : '',
            mobile: typeof address.mobile === 'string' ? address.mobile : '',
            region: typeof address.region === 'string' ? address.region : '',
            fullAddress: typeof address.fullAddress === 'string' ? address.fullAddress : '',
            deliveryNote: typeof address.deliveryNote === 'string' ? address.deliveryNote : null,
          },
          invoiceProfile: {
            title: typeof invoiceProfile.title === 'string' ? invoiceProfile.title : '',
            taxNumber: typeof invoiceProfile.taxNumber === 'string' ? invoiceProfile.taxNumber : '',
            registeredAddress: typeof invoiceProfile.registeredAddress === 'string' ? invoiceProfile.registeredAddress : null,
            registeredPhone: typeof invoiceProfile.registeredPhone === 'string' ? invoiceProfile.registeredPhone : null,
            bankName: typeof invoiceProfile.bankName === 'string' ? invoiceProfile.bankName : null,
            bankAccountMasked: typeof invoiceProfile.bankAccountMasked === 'string' ? invoiceProfile.bankAccountMasked : null,
          },
        }
      : null,
  };
};

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findOrderableSkus(
    companyId: string,
    skuIds: readonly string[],
  ): Promise<readonly OrderableSkuRecord[]> {
    const rows = await this.prisma.sku.findMany({
      where: {
        id: { in: [...skuIds] },
        status: 'ACTIVE',
        product: {
          companyId,
          saleStatus: 'ACTIVE',
          company: { status: 'ACTIVE' },
          supplier: { status: 'ACTIVE' },
          category: { status: 'ENABLED' },
        },
      },
      select: {
        id: true,
        status: true,
        approvedSupplyPrice: true,
        currentRetailSalePrice: true,
        currentEnterpriseSalePrice: true,
        product: {
          select: {
            id: true,
            companyId: true,
            supplierId: true,
            categoryId: true,
            templateVersion: true,
            name: true,
            saleStatus: true,
            isRetailEnabled: true,
            isEnterpriseProcurementEnabled: true,
            afterSaleSnapshot: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      skuId: row.id,
      productId: row.product.id,
      supplierId: row.product.supplierId,
      companyId: row.product.companyId,
      productName: row.product.name,
      categoryId: row.product.categoryId,
      templateVersion: row.product.templateVersion,
      afterSaleSnapshot: asObject(row.product.afterSaleSnapshot),
      status: row.status,
      productStatus: row.product.saleStatus,
      isRetailEnabled: row.product.isRetailEnabled,
      isEnterpriseProcurementEnabled: row.product.isEnterpriseProcurementEnabled,
      retailSalePrice: row.currentRetailSalePrice,
      enterpriseSalePrice: row.currentEnterpriseSalePrice,
      approvedSupplyPrice: row.approvedSupplyPrice,
    }));
  }

  async createOrder(command: CreateOrderCommand): Promise<CreateOrderResult> {
    const create = async (): Promise<CreateOrderResult> =>
      this.prisma.$transaction(async (tx) => {
        const existing = await tx.buyerOrder.findUnique({
          where: {
            idempotencyScope_idempotencyKey: {
              idempotencyScope: command.idempotencyScope,
              idempotencyKey: command.idempotencyKey,
            },
          },
          include: orderInclude,
        });
        if (existing) {
          return existing.requestHash === command.requestHash
            ? { kind: 'REPLAY', order: toAggregate(existing) }
            : { kind: 'IDEMPOTENCY_CONFLICT' };
        }

        let enterpriseCheckout:
          | {
              address: {
                consignee: string;
                mobile: string;
                region: string;
                fullAddress: string;
                deliveryNote: string | null;
              };
              invoiceProfile: {
                title: string;
                taxNumber: string;
                registeredAddress: string | null;
                registeredPhone: string | null;
                bankName: string | null;
                bankAccountMasked: string | null;
              };
            }
          | undefined;
        if (command.orderType === 'ENTERPRISE') {
          if (!command.enterpriseCustomerId || !command.enterpriseProcurement) {
            return { kind: 'ENTERPRISE_PROFILE_INCOMPLETE' };
          }
          const [enterprise, purchaser] = await Promise.all([
            tx.enterpriseCustomer.findUnique({
              where: { id: command.enterpriseCustomerId },
              select: {
                companyId: true,
                status: true,
                procurementProfile: {
                  select: { status: true, defaultAddressId: true, defaultInvoiceProfileId: true },
                },
              },
            }),
            tx.enterpriseUser.findUnique({
              where: { id: command.enterpriseProcurement.purchaserUserId },
              select: { enterpriseCustomerId: true, role: true, status: true },
            }),
          ]);
          if (!enterprise || enterprise.companyId !== command.companyId || enterprise.status !== 'ACTIVE') {
            return { kind: 'ENTERPRISE_NOT_ACTIVE' };
          }
          if (
            !purchaser ||
            purchaser.enterpriseCustomerId !== command.enterpriseCustomerId ||
            purchaser.status !== 'ACTIVE' ||
            (purchaser.role !== 'ENTERPRISE_ADMIN' && purchaser.role !== 'ENTERPRISE_PURCHASER')
          ) {
            return { kind: 'ENTERPRISE_SCOPE_FORBIDDEN' };
          }
          if (enterprise.procurementProfile?.status !== 'ACTIVE') {
            return { kind: 'ENTERPRISE_PROFILE_INCOMPLETE' };
          }
          const addressId = command.enterpriseProcurement.enterpriseAddressId ??
            enterprise.procurementProfile.defaultAddressId;
          const invoiceProfileId = command.enterpriseProcurement.invoiceProfileId ??
            enterprise.procurementProfile.defaultInvoiceProfileId;
          if (!addressId || !invoiceProfileId) {
            return { kind: 'ENTERPRISE_PROFILE_INCOMPLETE' };
          }
          const [address, invoiceProfile] = await Promise.all([
            tx.enterpriseAddress.findUnique({
              where: { id: addressId },
              select: {
                enterpriseCustomerId: true,
                consignee: true,
                mobile: true,
                region: true,
                fullAddress: true,
                deliveryNote: true,
              },
            }),
            tx.enterpriseInvoiceProfile.findUnique({
              where: { id: invoiceProfileId },
              select: {
                enterpriseCustomerId: true,
                title: true,
                taxNumber: true,
                registeredAddress: true,
                registeredPhone: true,
                bankName: true,
                bankAccountMasked: true,
              },
            }),
          ]);
          if (
            (address && address.enterpriseCustomerId !== command.enterpriseCustomerId) ||
            (invoiceProfile && invoiceProfile.enterpriseCustomerId !== command.enterpriseCustomerId)
          ) {
            return { kind: 'ENTERPRISE_SCOPE_FORBIDDEN' };
          }
          if (!address || !invoiceProfile) {
            return { kind: 'ENTERPRISE_PROFILE_INCOMPLETE' };
          }
          enterpriseCheckout = {
            address: {
              consignee: address.consignee,
              mobile: address.mobile,
              region: address.region,
              fullAddress: address.fullAddress,
              deliveryNote: address.deliveryNote,
            },
            invoiceProfile: {
              title: invoiceProfile.title,
              taxNumber: invoiceProfile.taxNumber,
              registeredAddress: invoiceProfile.registeredAddress,
              registeredPhone: invoiceProfile.registeredPhone,
              bankName: invoiceProfile.bankName,
              bankAccountMasked: invoiceProfile.bankAccountMasked,
            },
          };
        } else if (command.enterpriseProcurement || command.enterpriseCustomerId) {
          return { kind: 'ENTERPRISE_SCOPE_FORBIDDEN' };
        }

        const orderId = randomUUID();
        const enterpriseProcurementOrderId = command.enterpriseProcurement ? randomUUID() : null;
        const fulfillmentIds = new Map(
          command.supplierFulfillments.map((item) => [item.supplierId, randomUUID()]),
        );
        const orderNo = `FS${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
        const supplierPickupPoints = new Map(
          (await tx.supplier.findMany({
            where: { id: { in: command.supplierFulfillments.map(({ supplierId }) => supplierId) }, status: 'ACTIVE' },
            select: { id: true, pickupAddress: true, pickupLat: true, pickupLng: true },
          })).map((supplier) => [supplier.id, supplier]),
        );
        if (
          supplierPickupPoints.size !== command.supplierFulfillments.length ||
          [...supplierPickupPoints.values()].some((supplier) => !supplier.pickupAddress || supplier.pickupLat === null || supplier.pickupLng === null)
        ) {
          return { kind: 'SUPPLIER_PICKUP_POINT_INCOMPLETE' };
        }
        for (const item of [...command.items].sort((left, right) => left.skuId.localeCompare(right.skuId))) {
          const before = await tx.inventoryBalance.findUnique({
            where: { skuId: item.skuId },
            select: {
              id: true,
              skuId: true,
              availableQty: true,
              reservedQty: true,
              soldQty: true,
              damagedQty: true,
              version: true,
            },
          });
          if (!before || before.availableQty < item.quantity) {
            throw new InventoryReservationFailure('INVENTORY_INSUFFICIENT', item.skuId);
          }
          const changed = await tx.inventoryBalance.updateMany({
            where: {
              id: before.id,
              version: before.version,
              availableQty: { gte: item.quantity },
            },
            data: {
              availableQty: { decrement: item.quantity },
              reservedQty: { increment: item.quantity },
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) {
            const current = await tx.inventoryBalance.findUnique({
              where: { skuId: item.skuId },
              select: { availableQty: true },
            });
            throw new InventoryReservationFailure(
              !current || current.availableQty < item.quantity
                ? 'INVENTORY_INSUFFICIENT'
                : 'INVENTORY_RESERVATION_CONFLICT',
              item.skuId,
            );
          }
          await tx.inventoryChangeLog.create({
            data: {
              inventoryBalanceId: before.id,
              supplierId: item.supplierId,
              skuId: item.skuId,
              type: 'RESERVE',
              availableDelta: -item.quantity,
              reservedDelta: item.quantity,
              soldDelta: 0,
              damagedDelta: 0,
              beforeAvailableQty: before.availableQty,
              afterAvailableQty: before.availableQty - item.quantity,
              beforeReservedQty: before.reservedQty,
              afterReservedQty: before.reservedQty + item.quantity,
              beforeSoldQty: before.soldQty,
              afterSoldQty: before.soldQty,
              beforeDamagedQty: before.damagedQty,
              afterDamagedQty: before.damagedQty,
              resultingVersion: before.version + 1,
              referenceType: 'ORDER_RESERVATION',
              referenceId: orderId,
              reason: 'ORDER_RESERVATION',
            },
          });
        }
        await tx.inventoryCommand.create({
          data: {
            scope: 'order-reserve',
            idempotencyKey: reservationKey(command),
            requestHash: command.requestHash,
            responseSnapshot: json({ orderId, itemCount: command.items.length, status: 'RESERVED' }),
          },
        });
        await tx.buyerOrder.create({
          data: {
            id: orderId,
            orderNo,
            companyId: command.companyId,
            consumerUserId: command.consumerUserId,
            enterpriseCustomerId: command.enterpriseCustomerId,
            orderType: command.orderType,
            goodsAmount: command.goodsAmount,
            deliveryFee: command.deliveryFee,
            discountAmount: command.discountAmount,
            totalAmount: command.totalAmount,
            welfareCardAmount: command.welfareCardAmount,
            cashAmount: command.cashAmount,
            externalPaymentMethod: command.externalPaymentMethod,
            paymentStatus: command.paymentStatus,
            orderStatus: command.orderStatus,
            idempotencyScope: command.idempotencyScope,
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
          },
        });
        if (command.enterpriseProcurement && enterpriseCheckout && command.enterpriseCustomerId) {
          await tx.enterpriseProcurementOrder.create({
            data: {
              id: enterpriseProcurementOrderId!,
              buyerOrderId: orderId,
              enterpriseCustomerId: command.enterpriseCustomerId,
              purchaserUserId: command.enterpriseProcurement.purchaserUserId,
              invoiceProfileSnapshot: json({
                schemaVersion: 1,
                ...enterpriseCheckout.invoiceProfile,
              }),
              enterpriseAddressSnapshot: json({
                schemaVersion: 1,
                ...enterpriseCheckout.address,
              }),
              paymentMethod: command.enterpriseProcurement.paymentMethod,
            },
          });
        }
        await tx.supplierFulfillmentOrder.createMany({
          data: command.supplierFulfillments.map((item, index) => ({
            id: fulfillmentIds.get(item.supplierId)!,
            buyerOrderId: orderId,
            enterpriseProcurementOrderId,
            supplierId: item.supplierId,
            subOrderNo: `${orderNo}-${String(index + 1).padStart(2, '0')}`,
            goodsAmount: item.goodsAmount,
            supplyAmount: item.supplyAmount,
            itemCount: item.itemCount,
            channelType: command.orderType,
            activationStatus: item.status,
            preparationStatus: 'PENDING',
            handoverStatus: 'NOT_READY',
            settlementStatus: 'NOT_RECONCILED',
            pickupPointSnapshot: json({
              schemaVersion: 1,
              address: supplierPickupPoints.get(item.supplierId)!.pickupAddress,
              lat: supplierPickupPoints.get(item.supplierId)!.pickupLat!.toString(),
              lng: supplierPickupPoints.get(item.supplierId)!.pickupLng!.toString(),
            }),
          })),
        });
        await tx.buyerOrderItem.createMany({
          data: command.items.map((item, index) => ({
            id: randomUUID(),
            buyerOrderId: orderId,
            supplierFulfillmentOrderId: fulfillmentIds.get(item.supplierId)!,
            supplierId: item.supplierId,
            productId: item.productId,
            skuId: item.skuId,
            lineNo: index + 1,
            productSnapshot: json({
              name: item.productName,
              categoryId: item.categoryId,
              templateVersion: item.templateVersion,
              afterSaleSnapshot: item.afterSaleSnapshot,
            }),
            quantity: item.quantity,
            salePriceSnapshot: item.salePrice,
            supplyPriceSnapshot: item.supplyPrice,
            lineAmount: item.totalAmount,
          })),
        });
        await tx.buyerOrderEvent.create({
          data: {
            buyerOrderId: orderId,
            event: 'CREATED',
            fromStatus: null,
            toStatus: 'PENDING_PAYMENT',
            version: 0,
            snapshot: json({
              orderType: command.orderType,
              goodsAmount: command.goodsAmount,
              totalAmount: command.totalAmount,
              supplierCount: command.supplierFulfillments.length,
              itemCount: command.items.length,
            }),
            actorType: command.orderType,
            actorId: command.actorId,
            requestId: command.requestId,
          },
        });
        const stored = await tx.buyerOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderInclude,
        });
        return { kind: 'CREATED', order: toAggregate(stored) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    try {
      return await create();
    } catch (error) {
      if (error instanceof InventoryReservationFailure) {
        return error.kind === 'INVENTORY_INSUFFICIENT'
          ? { kind: error.kind, skuId: error.skuId! }
          : { kind: error.kind };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return { kind: 'INVENTORY_RESERVATION_CONFLICT' };
      }
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const existing = await this.prisma.buyerOrder.findUnique({
        where: {
          idempotencyScope_idempotencyKey: {
            idempotencyScope: command.idempotencyScope,
            idempotencyKey: command.idempotencyKey,
          },
        },
        include: orderInclude,
      });
      if (!existing || existing.requestHash !== command.requestHash) {
        return { kind: 'IDEMPOTENCY_CONFLICT' };
      }
      return { kind: 'REPLAY', order: toAggregate(existing) };
    }
  }

  async releaseOrderInventory(command: ReleaseOrderInventoryCommand): Promise<ReleaseOrderInventoryResult> {
    const scope = `order-release:${command.orderId}`;
    const requestHash = releaseRequestHash(command);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = await tx.inventoryCommand.findUnique({
          where: { scope_idempotencyKey: { scope, idempotencyKey: command.idempotencyKey } },
        });
        if (previous) {
          return previous.requestHash === requestHash
            ? { kind: 'REPLAY' as const }
            : { kind: 'IDEMPOTENCY_CONFLICT' as const };
        }
        const order = await tx.buyerOrder.findUnique({
          where: { id: command.orderId },
          include: { items: true },
        });
        if (!order) return { kind: 'NOT_FOUND' as const };
        if (order.paymentStatus === 'UNKNOWN' || order.paymentStatus === 'PAID') {
          return { kind: 'STATE_CONFLICT' as const };
        }

        const orderedItems = [...order.items].sort((left, right) => left.skuId.localeCompare(right.skuId));
        const lifecycle = await Promise.all(orderedItems.map(async (item) => ({
          item,
          reserved: await tx.inventoryChangeLog.findFirst({
            where: { skuId: item.skuId, referenceType: 'ORDER_RESERVATION', referenceId: order.id },
            select: { id: true },
          }),
          released: await tx.inventoryChangeLog.findFirst({
            where: { skuId: item.skuId, referenceType: 'ORDER_RELEASE', referenceId: order.id },
            select: { id: true },
          }),
        })));
        if (lifecycle.every(({ released }) => Boolean(released))) return { kind: 'REPLAY' as const };
        if (lifecycle.some(({ reserved, released }) => !reserved || Boolean(released))) {
          return { kind: 'STATE_CONFLICT' as const };
        }

        for (const { item } of lifecycle) {
          const before = await tx.inventoryBalance.findUnique({
            where: { skuId: item.skuId },
            select: {
              id: true,
              availableQty: true,
              reservedQty: true,
              soldQty: true,
              damagedQty: true,
              version: true,
            },
          });
          if (!before || before.reservedQty < item.quantity) {
            throw new InventoryReservationFailure('INVENTORY_RESERVATION_CONFLICT', item.skuId);
          }
          const changed = await tx.inventoryBalance.updateMany({
            where: { id: before.id, version: before.version, reservedQty: { gte: item.quantity } },
            data: {
              availableQty: { increment: item.quantity },
              reservedQty: { decrement: item.quantity },
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) {
            throw new InventoryReservationFailure('INVENTORY_RESERVATION_CONFLICT', item.skuId);
          }
          await tx.inventoryChangeLog.create({
            data: {
              inventoryBalanceId: before.id,
              supplierId: item.supplierId,
              skuId: item.skuId,
              type: 'RELEASE',
              availableDelta: item.quantity,
              reservedDelta: -item.quantity,
              soldDelta: 0,
              damagedDelta: 0,
              beforeAvailableQty: before.availableQty,
              afterAvailableQty: before.availableQty + item.quantity,
              beforeReservedQty: before.reservedQty,
              afterReservedQty: before.reservedQty - item.quantity,
              beforeSoldQty: before.soldQty,
              afterSoldQty: before.soldQty,
              beforeDamagedQty: before.damagedQty,
              afterDamagedQty: before.damagedQty,
              resultingVersion: before.version + 1,
              referenceType: 'ORDER_RELEASE',
              referenceId: order.id,
              reason: command.reason,
            },
          });
        }
        await tx.inventoryCommand.create({
          data: {
            scope,
            idempotencyKey: command.idempotencyKey,
            requestHash,
            responseSnapshot: json({ orderId: order.id, itemCount: order.items.length, status: 'RELEASED' }),
          },
        });
        return { kind: 'RELEASED' as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof InventoryReservationFailure) {
        return { kind: 'INVENTORY_RESERVATION_CONFLICT' };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
        const previous = await this.prisma.inventoryCommand.findUnique({
          where: { scope_idempotencyKey: { scope, idempotencyKey: command.idempotencyKey } },
        });
        if (previous) {
          return previous.requestHash === requestHash
            ? { kind: 'REPLAY' }
            : { kind: 'IDEMPOTENCY_CONFLICT' };
        }
        return { kind: 'INVENTORY_RESERVATION_CONFLICT' };
      }
      throw error;
    }
  }
}
