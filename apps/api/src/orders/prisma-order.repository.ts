import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  CreateOrderCommand,
  CreateOrderResult,
  OrderAggregateRecord,
  OrderRepository,
  OrderableSkuRecord,
} from './order.repository.js';

const asObject = (value: unknown): Readonly<Record<string, unknown>> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (structuredClone(value) as Readonly<Record<string, unknown>>)
    : {};

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const orderInclude = Prisma.validator<Prisma.BuyerOrderInclude>()({
  items: { orderBy: { lineNo: 'asc' } },
  supplierFulfillments: { orderBy: { supplierId: 'asc' } },
  events: { where: { event: 'CREATED' }, orderBy: { version: 'asc' }, take: 1 },
});

type StoredOrder = Prisma.BuyerOrderGetPayload<{ include: typeof orderInclude }>;

const toAggregate = (order: StoredOrder): OrderAggregateRecord => {
  const event = order.events[0];
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
      status: 'PENDING_PAYMENT',
    })),
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

        const orderId = randomUUID();
        const fulfillmentIds = new Map(
          command.supplierFulfillments.map((item) => [item.supplierId, randomUUID()]),
        );
        const orderNo = `FS${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
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
            paymentStatus: command.paymentStatus,
            orderStatus: command.orderStatus,
            idempotencyScope: command.idempotencyScope,
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
          },
        });
        await tx.supplierFulfillmentOrder.createMany({
          data: command.supplierFulfillments.map((item) => ({
            id: fulfillmentIds.get(item.supplierId)!,
            buyerOrderId: orderId,
            supplierId: item.supplierId,
            goodsAmount: item.goodsAmount,
            itemCount: item.itemCount,
            status: item.status,
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
      });

    try {
      return await create();
    } catch (error) {
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
}
