import { createWebApiClient } from '@fulishe/web-api-client';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { SESSION_COOKIE_NAME } from '../../../../../session-boundary';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const money = (cents: number): string => `¥${(cents / 100).toFixed(2)}`;

export default async function EnterpriseCatalogPage() {
  const enterpriseSession = (await cookies()).get(SESSION_COOKIE_NAME);
  const cookieHeader = enterpriseSession
    ? `${SESSION_COOKIE_NAME}=${enterpriseSession.value}`
    : '';
  const client = createWebApiClient({
    baseUrl: process.env.PORTAL_API_BASE_URL ?? 'http://127.0.0.1:3000',
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
    fetch: (request: Request) => fetch(new Request(request, { cache: 'no-store' })),
  });
  const { data, response } = await client.GET('/v1/enterprise/catalog/products', {
    params: { query: { page: 1, pageSize: 20 } },
  });

  if (!data) {
    const message =
      response.status === 401
        ? '请先完成企业认证并登录后浏览采购货架。'
        : '企业采购货架暂时不可用，请稍后重试。';
    return (
      <main data-shell="enterprise-catalog" style={{ margin: '48px auto', maxWidth: 1080, padding: 24 }}>
        <p aria-live="polite">{message}</p>
      </main>
    );
  }

  return (
    <main data-shell="enterprise-catalog" style={{ margin: '48px auto', maxWidth: 1080, padding: 24 }}>
      <p style={{ color: '#8a5a00', margin: 0 }}>社区集采 · 普通企业采购入口</p>
      <h1>企业采购货架</h1>
      <p>商品由{data.sellerName}统一结账；可跨供应商加入后续采购车。</p>
      {data.items.length === 0 ? (
        <p aria-live="polite">暂无可采购商品。</p>
      ) : (
        <ul style={{ display: 'grid', gap: 16, listStyle: 'none', padding: 0 }}>
          {data.items.map((item) => (
            <li
              data-product-id={item.productId}
              data-sku-ids={item.skuIds.join(',')}
              key={item.productId}
              style={{ border: '1px solid #ead7bd', borderRadius: 12, padding: 20 }}
            >
              <h2 style={{ marginTop: 0 }}>{item.name}</h2>
              <p data-price-channel="enterprise">集采价 {money(item.enterpriseSalePrice)} 起</p>
              <Link href={`/enterprise/procurement/products/${item.productId}`}>查看企业采购详情</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
