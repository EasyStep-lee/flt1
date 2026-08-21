'use server';

import type { components } from '@fulishe/contracts';
import { createWebApiClient } from '@fulishe/web-api-client';
import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '../../../../../session-boundary';

type OrderItem = components['schemas']['CreateOrderItemRequestDto'];
type OrderResponse = components['schemas']['CreateEnterpriseOrderResponseDto'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface SafeOrderSummary {
  readonly orderNo: string;
  readonly sellerName: string;
  readonly totalAmount: number;
  readonly supplierFulfillments: OrderResponse['supplierFulfillments'];
}

export type EnterpriseOrderActionResult =
  | { readonly ok: true; readonly order: SafeOrderSummary }
  | { readonly ok: false; readonly code: string; readonly message: string };

const safeError = (status: number): EnterpriseOrderActionResult => {
  if (status === 401) return { ok: false, code: 'AUTHENTICATION_REQUIRED', message: '企业会话已失效，请重新登录后提交。' };
  if (status === 409) return { ok: false, code: 'ORDER_CONFLICT', message: '商品价格或库存已变化，请返回采购车核对。' };
  return { ok: false, code: 'ORDER_SUBMIT_UNKNOWN', message: '提交结果尚未确认，请保留当前页面后重试，系统会复用同一请求标识。' };
};

export async function createEnterpriseOrder(
  items: readonly OrderItem[],
  idempotencyKey: string,
): Promise<EnterpriseOrderActionResult> {
  if (
    !/^ent-[a-z0-9-]{16,}$/u.test(idempotencyKey) ||
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 100 ||
    items.some((item) =>
      !item ||
      typeof item !== 'object' ||
      typeof item.skuId !== 'string' ||
      !UUID.test(item.skuId) ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 9999)
  ) {
    return { ok: false, code: 'VALIDATION_FAILED', message: '采购车请求无效，请返回货架重新选择。' };
  }
  const enterpriseSession = (await cookies()).get(SESSION_COOKIE_NAME);
  const cookieHeader = enterpriseSession ? `${SESSION_COOKIE_NAME}=${enterpriseSession.value}` : '';
  const client = createWebApiClient({
    baseUrl: process.env.PORTAL_API_BASE_URL ?? 'http://127.0.0.1:3000',
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
    fetch: (request: Request) => fetch(new Request(request, { cache: 'no-store' })),
  });
  let result;
  try {
    result = await client.POST('/v1/enterprise/orders', {
      params: { header: { 'Idempotency-Key': idempotencyKey } },
      body: { items: items.map(({ skuId, quantity }) => ({ skuId, quantity })) },
    });
  } catch {
    return safeError(503);
  }
  const { data, response } = result;
  if (!data) return safeError(response.status);
  return {
    ok: true,
    order: {
      orderNo: data.orderNo,
      sellerName: data.sellerName,
      totalAmount: data.totalAmount,
      supplierFulfillments: data.supplierFulfillments.map((fulfillment) => ({
        fulfillmentOrderId: fulfillment.fulfillmentOrderId,
        supplierId: fulfillment.supplierId,
        itemCount: fulfillment.itemCount,
        goodsAmount: fulfillment.goodsAmount,
        status: fulfillment.status,
      })),
    },
  };
}
