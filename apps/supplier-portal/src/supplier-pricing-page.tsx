import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  InputNumber,
  Result,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { components } from '@fulishe/contracts';

import { createSupplierPortalApiClient } from './api-client.js';
import {
  FixedSupplierWorkspacePage,
  type SupplierWorkspace,
} from './supplier-workspace-pages.js';

type PricingProduct = components['schemas']['SupplierInitialPricingProductDto'];
type InitialPriceRequest = components['schemas']['InitialPricesRequestDto'];
type PriceRow = InitialPriceRequest['prices'][number];

type PriceDraft = {
  readonly requestedEnterpriseSalePrice?: number;
  readonly requestedRetailSalePrice?: number;
  readonly requestedSupplyPrice?: number;
};

type PricingState =
  | 'empty'
  | 'error'
  | 'loading'
  | 'offline'
  | 'permission'
  | 'success'
  | 'unknown-result'
  | 'validation';

interface PendingSubmission {
  readonly body: InitialPriceRequest;
  readonly idempotencyKey: string;
  readonly supplierProductId: string;
}

const api = createSupplierPortalApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const draftKey = (productId: string, skuCode: string) => `${productId}:${skuCode}`;

const messageFrom = (value: unknown, fallback: string): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

const reviewMeta = {
  APPROVED: { color: 'success', label: '已通过' },
  PENDING: { color: 'processing', label: '待公司价格审核' },
  REJECTED: { color: 'error', label: '已驳回' },
} as const;

const isIntegerCent = (value: number | undefined): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

export function SupplierPricingPage({
  workspace,
}: {
  readonly workspace: SupplierWorkspace;
}) {
  const [products, setProducts] = useState<readonly PricingProduct[]>([]);
  const [drafts, setDrafts] = useState<Readonly<Record<string, PriceDraft>>>({});
  const [state, setState] = useState<PricingState>('loading');
  const [message, setMessage] = useState('');
  const [submittingId, setSubmittingId] = useState<string>();
  const [unknownProductId, setUnknownProductId] = useState<string>();
  const pendingSubmission = useRef<PendingSubmission | undefined>(undefined);

  const load = useCallback(async () => {
    setState('loading');
    setMessage('');
    try {
      const response = await api.GET('/v1/supplier/pricing/products');
      if (!response.data) {
        const permission =
          response.response.status === 401 || response.response.status === 403;
        setState(permission ? 'permission' : 'error');
        setMessage(messageFrom(response.error, '价格工作台暂时无法加载。'));
        setProducts([]);
        return;
      }
      setProducts(response.data.items);
      setDrafts(
        Object.fromEntries(
          response.data.items.flatMap((product) =>
            product.skus.map((sku) => [
              draftKey(product.supplierProductId, sku.supplierSkuCode),
              {
                ...(sku.requestedSupplyPrice === null
                  ? {}
                  : { requestedSupplyPrice: sku.requestedSupplyPrice }),
                ...(sku.requestedRetailSalePrice === null
                  ? {}
                  : { requestedRetailSalePrice: sku.requestedRetailSalePrice }),
                ...(sku.requestedEnterpriseSalePrice === null
                  ? {}
                  : { requestedEnterpriseSalePrice: sku.requestedEnterpriseSalePrice }),
              },
            ]),
          ),
        ),
      );
      setState(response.data.items.length === 0 ? 'empty' : 'success');
    } catch {
      setProducts([]);
      setState('offline');
      setMessage('网络离线或请求超时，请恢复网络后重试。');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = (
    productId: string,
    skuCode: string,
    field: keyof PriceDraft,
    value: number | null,
  ) => {
    const key = draftKey(productId, skuCode);
    setDrafts((current) => ({
      ...current,
      [key]: { ...current[key], ...(value === null ? { [field]: undefined } : { [field]: value }) },
    }));
    if (state === 'validation') {
      setState('success');
      setMessage('');
    }
  };

  const buildRows = (product: PricingProduct): readonly PriceRow[] | undefined => {
    const rows = product.skus.map((sku) => {
      const values = drafts[draftKey(product.supplierProductId, sku.supplierSkuCode)];
      if (
        !isIntegerCent(values?.requestedSupplyPrice) ||
        !isIntegerCent(values.requestedRetailSalePrice) ||
        !isIntegerCent(values.requestedEnterpriseSalePrice)
      ) {
        return undefined;
      }
      return {
        supplierSkuCode: sku.supplierSkuCode,
        requestedSupplyPrice: values.requestedSupplyPrice,
        requestedRetailSalePrice: values.requestedRetailSalePrice,
        requestedEnterpriseSalePrice: values.requestedEnterpriseSalePrice,
      };
    });
    return rows.every((row): row is PriceRow => row !== undefined) ? rows : undefined;
  };

  const submit = async (product: PricingProduct) => {
    const existing =
      pendingSubmission.current?.supplierProductId === product.supplierProductId
        ? pendingSubmission.current
        : undefined;
    const rows = existing ? existing.body.prices : buildRows(product);
    if (!rows) {
      setState('validation');
      setMessage('三类价格都必须填写为大于或等于 0 的整数分。');
      return;
    }
    const pending =
      existing ??
      ({
        body: { prices: [...rows], requestId: crypto.randomUUID() },
        idempotencyKey: crypto.randomUUID(),
        supplierProductId: product.supplierProductId,
      } satisfies PendingSubmission);
    pendingSubmission.current = pending;
    setSubmittingId(product.supplierProductId);
    setMessage('');
    try {
      const response = await api.PUT(
        '/v1/supplier/pricing/products/{supplierProductId}/initial-prices',
        {
          params: {
            header: { 'Idempotency-Key': pending.idempotencyKey },
            path: { supplierProductId: pending.supplierProductId },
          },
          body: pending.body,
        },
      );
      if (!response.data) {
        const permission =
          response.response.status === 401 || response.response.status === 403;
        setState(permission ? 'permission' : 'error');
        setMessage(messageFrom(response.error, '初始价格暂未提交，请按原请求重试。'));
        return;
      }
      pendingSubmission.current = undefined;
      setUnknownProductId(undefined);
      setMessage('三类初始价格已冻结并提交公司价格审核；公司只能通过或驳回。');
      await load();
    } catch {
      setUnknownProductId(product.supplierProductId);
      setState('unknown-result');
      setMessage('提交结果未知。请使用“按原请求恢复”，系统会复用同一幂等键查询结果。');
    } finally {
      setSubmittingId(undefined);
    }
  };

  const alert = message ? (
    <Alert
      action={
        unknownProductId ? (
          <Button
            onClick={() => {
              const product = products.find(
                ({ supplierProductId }) => supplierProductId === unknownProductId,
              );
              if (product) void submit(product);
            }}
            size="small"
          >
            按原请求恢复
          </Button>
        ) : undefined
      }
      description={message}
      message={
        state === 'permission'
          ? '无权访问价格页面'
          : state === 'offline'
            ? '网络不可用'
            : state === 'unknown-result'
              ? '提交结果未知'
              : state === 'validation'
                ? '价格校验未通过'
                : '价格工作台提示'
      }
      showIcon
      type={state === 'success' ? 'success' : state === 'validation' ? 'warning' : 'error'}
    />
  ) : null;

  return (
    <div
      data-m2-slice="M2-P008"
      data-pricing-state={state}
      data-route="/supplier/workspaces/pricing"
    >
      <FixedSupplierWorkspacePage workspace={workspace} />
      <section className="supplier-pricing-editor">
        <div className="supplier-product-heading">
          <div>
            <Typography.Text className="eyebrow">SUPPLIER INITIAL PRICING</Typography.Text>
            <Typography.Title level={2}>首次上架三类价格</Typography.Title>
            <Typography.Paragraph>
              本页面只读取当前供应商价格职能数据。金额按整数分提交，审核期间保留不可变快照。
            </Typography.Paragraph>
          </div>
          <Space>
            <Button onClick={() => void load()}>刷新</Button>
            <Tag color="cyan">{workspace.accountTypeName}</Tag>
          </Space>
        </div>

        {alert}
        {state === 'loading' ? (
          <Card><Spin size="large" tip="正在加载本供应商待定价商品" /></Card>
        ) : state === 'permission' ? (
          <Result status="403" subTitle={message} title="无权访问价格页面" />
        ) : products.length === 0 ? (
          <Card><Empty description="当前没有可提交初始价格的本供应商商品" /></Card>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {products.map((product) => {
              const locked =
                !product.initialPriceEditable || unknownProductId === product.supplierProductId;
              return (
                <Card
                  data-pricing-product={product.supplierProductId}
                  key={product.supplierProductId}
                  title={product.name}
                  extra={
                    product.latestReview ? (
                      <Tag color={reviewMeta[product.latestReview.status].color}>
                        {reviewMeta[product.latestReview.status].label}
                      </Tag>
                    ) : (
                      <Tag>待填写</Tag>
                    )
                  }
                >
                  <Table
                    dataSource={[...product.skus]}
                    pagination={false}
                    rowKey="id"
                    scroll={{ x: 920 }}
                    columns={[
                      { title: '供应商 SKU', dataIndex: 'supplierSkuCode' },
                      {
                        title: '供应价（分）',
                        render: (_value, sku) => (
                          <InputNumber<number>
                            aria-label={`${sku.supplierSkuCode}供应价整数分`}
                            disabled={locked}
                            min={0}
                            onChange={(value) =>
                              updateDraft(
                                product.supplierProductId,
                                sku.supplierSkuCode,
                                'requestedSupplyPrice',
                                value,
                              )
                            }
                            precision={0}
                            value={
                              drafts[draftKey(product.supplierProductId, sku.supplierSkuCode)]
                                ?.requestedSupplyPrice ?? null
                            }
                          />
                        ),
                      },
                      {
                        title: '个人零售价（分）',
                        render: (_value, sku) => (
                          <InputNumber<number>
                            aria-label={`${sku.supplierSkuCode}个人零售价整数分`}
                            disabled={locked}
                            min={0}
                            onChange={(value) =>
                              updateDraft(
                                product.supplierProductId,
                                sku.supplierSkuCode,
                                'requestedRetailSalePrice',
                                value,
                              )
                            }
                            precision={0}
                            value={
                              drafts[draftKey(product.supplierProductId, sku.supplierSkuCode)]
                                ?.requestedRetailSalePrice ?? null
                            }
                          />
                        ),
                      },
                      {
                        title: '企业集采价（分）',
                        render: (_value, sku) => (
                          <InputNumber<number>
                            aria-label={`${sku.supplierSkuCode}企业集采价整数分`}
                            disabled={locked}
                            min={0}
                            onChange={(value) =>
                              updateDraft(
                                product.supplierProductId,
                                sku.supplierSkuCode,
                                'requestedEnterpriseSalePrice',
                                value,
                              )
                            }
                            precision={0}
                            value={
                              drafts[draftKey(product.supplierProductId, sku.supplierSkuCode)]
                                ?.requestedEnterpriseSalePrice ?? null
                            }
                          />
                        ),
                      },
                    ]}
                  />
                  <Space className="supplier-pricing-actions" direction="vertical" size="middle">
                    <Alert
                      description="供应商提交后由公司价格审核职能独立处理；审核页面不能改写三类价格。"
                      message="提交即冻结当前快照"
                      showIcon
                      type="info"
                    />
                    <Button
                      disabled={
                        !product.initialPriceEditable &&
                        unknownProductId !== product.supplierProductId
                      }
                      loading={submittingId === product.supplierProductId}
                      onClick={() => void submit(product)}
                      type="primary"
                    >
                      {unknownProductId === product.supplierProductId
                        ? '按原请求恢复'
                        : product.latestReview?.status === 'PENDING'
                          ? '等待公司审核'
                          : '提交初始价格审核'}
                    </Button>
                  </Space>
                </Card>
              );
            })}
          </Space>
        )}
      </section>
    </div>
  );
}
