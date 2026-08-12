import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, InputNumber, Space, Spin, Table, Tag, Typography } from 'antd';
import type { components } from '@fulishe/contracts';

import { createSupplierPortalApiClient } from './api-client.js';

type ListedSku = components['schemas']['ListedSkuPriceDto'];
type Draft = {
  readonly supply?: number;
  readonly retail?: number;
  readonly enterprise?: number;
  readonly reason?: string;
  readonly effectiveAt?: string;
  readonly verification?: string;
};

const api = createSupplierPortalApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

export function SupplierPostListingPricePanel() {
  const [items, setItems] = useState<readonly ListedSku[]>([]);
  const [drafts, setDrafts] = useState<Readonly<Record<string, Draft>>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error' | 'offline' | 'unknown'>('loading');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState<string>();
  const pendingKeys = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await api.GET('/v1/supplier/pricing/skus');
      if (!response.data) {
        setState('error');
        setMessage('在售 SKU 价格暂时无法加载，请确认当前价格职能权限。');
        return;
      }
      setItems(response.data.items);
      setDrafts(Object.fromEntries(response.data.items.map((sku) => [sku.id, {
        supply: sku.approvedSupplyPrice,
        retail: sku.currentRetailSalePrice,
        enterprise: sku.currentEnterpriseSalePrice,
        effectiveAt: new Date().toISOString(),
      }])));
      setState(response.data.total === 0 ? 'empty' : 'ready');
      setMessage('');
    } catch {
      setState('offline');
      setMessage('网络离线或请求超时，请恢复后刷新。');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patchDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const mutate = async (sku: ListedSku, kind: 'sale' | 'supply') => {
    const draft = drafts[sku.id];
    if (!draft?.reason?.trim() || !draft.verification?.trim() || !draft.effectiveAt) {
      setState('error');
      setMessage('请填写调价原因、生效时间和二次验证口令。');
      return;
    }
    const commandKey = `${kind}:${sku.id}`;
    const idempotencyKey = pendingKeys.current.get(commandKey) ?? crypto.randomUUID();
    pendingKeys.current.set(commandKey, idempotencyKey);
    setSubmitting(commandKey);
    try {
      const response = kind === 'supply'
        ? await api.POST('/v1/supplier/pricing/skus/{skuId}/supply-price-change', {
            params: { header: { 'Idempotency-Key': idempotencyKey }, path: { skuId: sku.id } },
            body: {
              requestedSupplyPrice: draft.supply ?? sku.approvedSupplyPrice,
              reason: draft.reason.trim(),
              effectiveAt: draft.effectiveAt,
              version: sku.supplyPriceVersion,
              secondVerificationCode: draft.verification,
            },
          })
        : await api.PATCH('/v1/supplier/pricing/skus/{skuId}/sale-prices', {
            params: { header: { 'Idempotency-Key': idempotencyKey }, path: { skuId: sku.id } },
            body: {
              retailSalePrice: draft.retail ?? sku.currentRetailSalePrice,
              enterpriseSalePrice: draft.enterprise ?? sku.currentEnterpriseSalePrice,
              retailPriceVersion: sku.retailPriceVersion,
              enterprisePriceVersion: sku.enterprisePriceVersion,
              reason: draft.reason.trim(),
              effectiveAt: draft.effectiveAt,
              secondVerificationCode: draft.verification,
            },
          });
      if (!response.data) {
        setState('error');
        setMessage('调价未提交。请根据错误提示修正，或使用相同内容重试。');
        return;
      }
      pendingKeys.current.delete(commandKey);
      setState('ready');
      setMessage(kind === 'supply'
        ? '供应价变更已提交公司价格审核，审核生效前旧供应价继续有效。'
        : '零售与集采销售价未创建审核任务，已按生效时间版本化留痕。');
      await load();
    } catch {
      setState('unknown');
      setMessage('结果未知。再次点击原操作会复用同一幂等键恢复结果。');
    } finally {
      setSubmitting(undefined);
    }
  };

  return (
    <section data-m2-slice="M2-P019" data-price-state={state}>
      <div className="supplier-product-heading">
        <div>
          <Typography.Text className="eyebrow">POST-LISTING TIERED PRICING</Typography.Text>
          <Typography.Title level={2}>上架后分级调价</Typography.Title>
          <Typography.Paragraph>
            供应价提交后等待公司价格审核；个人零售价和企业集采价免审生效。三类价格均追加版本与审计历史。
          </Typography.Paragraph>
        </div>
        <Button onClick={() => void load()}>刷新在售价</Button>
      </div>
      {message ? <Alert message={state === 'unknown' ? '结果未知' : '调价提示'} description={message} showIcon type={state === 'ready' ? 'success' : state === 'unknown' ? 'warning' : 'error'} /> : null}
      {state === 'loading' ? <Card><Spin tip="正在加载本供应商在售 SKU" /></Card> : items.length === 0 ? <Card><Empty description="当前没有可调价的本供应商在售 SKU" /></Card> : (
        <Card>
          <Table<ListedSku>
            dataSource={[...items]}
            pagination={false}
            rowKey="id"
            scroll={{ x: 1500 }}
            columns={[
              { title: '商品 / SKU', key: 'sku', fixed: 'left', render: (_value, row) => <Space direction="vertical" size={0}><strong>{row.productName}</strong><span>{row.code}</span></Space> },
              { title: '当前供应价', key: 'supply', render: (_value, row) => <Space direction="vertical"><Tag>V{row.supplyPriceVersion}</Tag><InputNumber<number> min={0} precision={0} value={drafts[row.id]?.supply ?? null} onChange={(value) => patchDraft(row.id, { ...(value === null ? {} : { supply: value }) })} /></Space> },
              { title: '个人零售价', key: 'retail', render: (_value, row) => <Space direction="vertical"><Tag>V{row.retailPriceVersion}</Tag><InputNumber<number> min={0} precision={0} value={drafts[row.id]?.retail ?? null} onChange={(value) => patchDraft(row.id, { ...(value === null ? {} : { retail: value }) })} /></Space> },
              { title: '企业集采价', key: 'enterprise', render: (_value, row) => <Space direction="vertical"><Tag>V{row.enterprisePriceVersion}</Tag><InputNumber<number> min={0} precision={0} value={drafts[row.id]?.enterprise ?? null} onChange={(value) => patchDraft(row.id, { ...(value === null ? {} : { enterprise: value }) })} /></Space> },
              { title: '原因 / 生效时间', key: 'reason', render: (_value, row) => <Space direction="vertical"><Input aria-label={`${row.code}调价原因`} placeholder="调价原因" value={drafts[row.id]?.reason} onChange={(event) => patchDraft(row.id, { reason: event.target.value })} /><Input aria-label={`${row.code}生效时间`} value={drafts[row.id]?.effectiveAt} onChange={(event) => patchDraft(row.id, { effectiveAt: event.target.value })} /></Space> },
              { title: '二次验证', key: 'verification', render: (_value, row) => <Input.Password aria-label={`${row.code}二次验证`} value={drafts[row.id]?.verification} onChange={(event) => patchDraft(row.id, { verification: event.target.value })} /> },
              { title: '操作', key: 'action', fixed: 'right', render: (_value, row) => <Space direction="vertical"><Button loading={submitting === `supply:${row.id}`} onClick={() => void mutate(row, 'supply')}>提交供应价审核</Button><Button type="primary" loading={submitting === `sale:${row.id}`} onClick={() => void mutate(row, 'sale')}>销售价免审生效</Button></Space> },
            ]}
          />
        </Card>
      )}
    </section>
  );
}
