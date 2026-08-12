import { createServer } from 'node:http';

const port = Number(process.env.P0_ENTERPRISE_CATALOG_PORT ?? 4324);
const productId = '21111111-1111-4111-8111-111111111111';

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('ok');
    return;
  }
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (
    request.url !== `/v1/enterprise/catalog/products/${productId}` ||
    request.headers.cookie !== '__Host-fulishe-enterprise-portal=p0-session'
  ) {
    response.writeHead(401);
    response.end(JSON.stringify({ code: 'AUTHENTICATION_REQUIRED' }));
    return;
  }
  response.writeHead(200);
  response.end(JSON.stringify({
    productId,
    supplierId: '2aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    categoryId: '22222222-2222-4222-8222-222222222222',
    templateVersion: 1,
    templateProfile: 'FOOD',
    name: '企业采购测试商品',
    brand: '福礼团',
    sellerName: '江苏福礼团供应链科技有限公司',
    checkoutMode: 'COMPANY_UNIFIED',
    enterpriseSalePrice: 6190,
    skus: [{
      skuId: '23333333-3333-4333-8333-333333333333',
      enterpriseSalePrice: 6190,
      specifications: [{ key: 'flavor', label: '口味', value: '原味' }],
    }],
    detailModules: [],
  }));
});

server.listen(port, '127.0.0.1');

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
