import { createServer } from 'node:http';

const port = Number(process.env.P0_ENTERPRISE_CATALOG_PORT ?? 4324);
const sellerName = '江苏福礼团供应链科技有限公司';
const products = [
  {
    productId: '21111111-1111-4111-8111-111111111111',
    skuId: '23333333-3333-4333-8333-333333333333',
    supplierId: '2aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: '企业采购测试大米',
    enterpriseSalePrice: 6190,
    media: [{ url: 'https://cdn.example.test/catalog/rice.webp', alt: '企业采购测试大米' }],
  },
  {
    productId: '31111111-1111-4111-8111-111111111111',
    skuId: '33333333-3333-4333-8333-333333333333',
    supplierId: '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: '企业采购测试牛奶',
    enterpriseSalePrice: 4590,
    media: [{ url: 'https://cdn.example.test/catalog/milk.webp', alt: '企业采购测试牛奶' }],
  },
  {
    productId: '41111111-1111-4111-8111-111111111111',
    skuId: '43333333-3333-4333-8333-333333333333',
    supplierId: '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: '企业采购测试纸品',
    enterpriseSalePrice: 3290,
    media: [{ url: 'https://cdn.example.test/catalog/tissue.webp', alt: '企业采购测试纸品' }],
  },
];
const observations = { orderRequests: [] };
let orderResponseStatuses = [];

const readJson = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const sendJson = (response, status, body) => {
  response.writeHead(status);
  response.end(JSON.stringify(body));
};

const server = createServer(async (request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('ok');
    return;
  }
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.headers.cookie !== '__Host-fulishe-enterprise-portal=p0-session') {
    sendJson(response, 401, { code: 'AUTHENTICATION_REQUIRED' });
    return;
  }
  if (request.method === 'GET' && request.url === '/test-observations') {
    sendJson(response, 200, observations);
    return;
  }
  if (request.method === 'POST' && request.url === '/test-order-behavior') {
    const body = await readJson(request);
    orderResponseStatuses = Array.isArray(body.statuses) ? [...body.statuses] : [];
    observations.orderRequests.length = 0;
    sendJson(response, 200, { accepted: true });
    return;
  }
  if (request.method === 'GET' && request.url === '/v1/enterprise/catalog/products?page=1&pageSize=20') {
    sendJson(response, 200, {
      sellerName,
      checkoutMode: 'COMPANY_UNIFIED',
      page: 1,
      pageSize: 20,
      total: products.length,
      items: products.map((product) => ({
        productId: product.productId,
        supplierId: product.supplierId,
        categoryId: '22222222-2222-4222-8222-222222222222',
        templateVersion: 1,
        name: product.name,
        media: product.media,
        skuIds: [product.skuId],
        enterpriseSalePrice: product.enterpriseSalePrice,
        activeSkuCount: 1,
      })),
    });
    return;
  }
  const product = products.find(({ productId }) => request.url === `/v1/enterprise/catalog/products/${productId}`);
  if (request.method === 'GET' && product) {
    sendJson(response, 200, {
      productId: product.productId,
      supplierId: product.supplierId,
      categoryId: '22222222-2222-4222-8222-222222222222',
      templateVersion: 1,
      templateProfile: 'FOOD',
      name: product.name,
      brand: '福礼团',
      sellerName,
      checkoutMode: 'COMPANY_UNIFIED',
      enterpriseSalePrice: product.enterpriseSalePrice,
      media: product.media,
      skus: [{
        skuId: product.skuId,
        enterpriseSalePrice: product.enterpriseSalePrice,
        specifications: [{ key: 'package', label: '包装', value: '标准装' }],
      }],
      detailModules: [],
    });
    return;
  }
  if (request.method === 'POST' && request.url === '/v1/enterprise/orders') {
    const body = await readJson(request);
    observations.orderRequests.push({ body, idempotencyKey: request.headers['idempotency-key'] ?? null });
    const forcedStatus = orderResponseStatuses.shift();
    if (forcedStatus === 503) {
      sendJson(response, 503, { code: 'SERVICE_UNAVAILABLE' });
      return;
    }
    const items = body.items.map((item, index) => {
      const source = products.find(({ skuId }) => skuId === item.skuId);
      if (!source) return null;
      return {
        orderItemId: `${index + 1}5555555-5555-4555-8555-555555555555`,
        productId: source.productId,
        skuId: source.skuId,
        supplierId: source.supplierId,
        productName: source.name,
        quantity: item.quantity,
        salePrice: source.enterpriseSalePrice,
        totalAmount: source.enterpriseSalePrice * item.quantity,
      };
    });
    if (items.some((item) => item === null)) {
      sendJson(response, 409, { code: 'ORDER_SKU_NOT_AVAILABLE' });
      return;
    }
    const resolvedItems = items.filter(Boolean);
    const goodsAmount = resolvedItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const supplierFulfillments = resolvedItems.map((item, index) => ({
      fulfillmentOrderId: `${index + 6}5555555-5555-4555-8555-555555555555`,
      supplierId: item.supplierId,
      itemCount: item.quantity,
      goodsAmount: item.totalAmount,
      status: 'PENDING_PAYMENT',
    }));
    sendJson(response, 201, {
      orderId: '51111111-1111-4111-8111-111111111111', orderNo: 'E202608200001', orderType: 'ENTERPRISE',
      sellerName, checkoutMode: 'COMPANY_UNIFIED', goodsAmount, deliveryFee: 0, discountAmount: 0,
      totalAmount: goodsAmount, paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT',
      items: resolvedItems, supplierFulfillments,
      enterpriseProcurement: {
        enterpriseOrderId: '52222222-2222-4222-8222-222222222222', paymentMethod: 'WECHAT_PAY',
        remittanceReviewStatus: 'NOT_SUBMITTED', status: 'PENDING_PAYMENT', nextAction: 'START_WECHAT_PAYMENT',
        address: { consignee: '企业收货人', mobileMasked: '138****8000', region: '江苏省南京市', fullAddress: '江东中路100号', deliveryNote: null },
        invoiceProfile: { title: '南京示例企业有限公司', taxNumberMasked: '9132********2D3X', registeredAddress: null, registeredPhoneMasked: null, bankName: null, bankAccountMasked: null },
      },
    });
    return;
  }
  sendJson(response, 404, { code: 'PRODUCT_NOT_FOUND' });
});

server.listen(port, '127.0.0.1');
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
