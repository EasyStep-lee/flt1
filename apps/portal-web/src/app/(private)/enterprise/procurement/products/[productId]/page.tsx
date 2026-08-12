import { createWebApiClient } from '@fulishe/web-api-client';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const money = (cents: number): string => `¥${(cents / 100).toFixed(2)}`;

export default async function EnterpriseProductDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly productId: string }>;
}) {
  const { productId } = await params;
  const cookieHeader = (await cookies())
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  const client = createWebApiClient({
    baseUrl: process.env.PORTAL_API_BASE_URL ?? 'http://127.0.0.1:3000',
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
    fetch: (request: Request) =>
      fetch(new Request(request, { cache: 'no-store' })),
  });
  const { data, response } = await client.GET(
    '/v1/enterprise/catalog/products/{productId}',
    { params: { path: { productId } } },
  );

  if (!data) {
    const message =
      response.status === 401
        ? '请先完成企业认证并登录后查看集采价。'
        : response.status === 404
          ? '未找到该商品。'
          : response.status === 409
            ? '该商品暂未开放企业采购。'
            : '商品详情暂时不可用，请稍后重试。';
    return (
      <main data-shell="enterprise-product-detail" style={{ margin: '48px auto', maxWidth: 960, padding: 24 }}>
        <p aria-live="polite">{message}</p>
      </main>
    );
  }

  return (
    <main data-shell="enterprise-product-detail" style={{ margin: '48px auto', maxWidth: 960, padding: 24 }}>
      <p style={{ color: '#8a5a00', margin: 0 }}>企业采购 · 公司统一结账</p>
      <h1>{data.name}</h1>
      {data.brand ? <p>品牌：{data.brand}</p> : null}
      <p data-price-channel="enterprise" style={{ color: '#c2410c', fontSize: 28, fontWeight: 700 }}>
        集采价 {money(data.enterpriseSalePrice)}
      </p>
      <section aria-labelledby="enterprise-skus">
        <h2 id="enterprise-skus">可采购规格</h2>
        <ul>
          {data.skus.map((sku) => (
            <li key={sku.skuId}>
              {sku.specifications.map(({ label, value }) => `${label}：${value}`).join(' / ') || '默认规格'}
              {' · '}
              {money(sku.enterpriseSalePrice)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
