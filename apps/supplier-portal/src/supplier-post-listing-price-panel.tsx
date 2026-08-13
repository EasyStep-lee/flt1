import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { components } from '@fulishe/contracts';

import { createSupplierPortalApiClient } from './api-client.js';

type ListedSku = components['schemas']['ListedSkuPriceDto'];
type SupplyApplication = components['schemas']['SupplyPriceChangeDto'];
type Draft = {
  readonly supply?: number;
  readonly retail?: number;
  readonly enterprise?: number;
  readonly reason?: string;
  readonly effectiveAt?: string;
  readonly verification?: string;
};
type PriceState =
  | 'conflict'
  | 'empty'
  | 'error'
  | 'loading'
  | 'offline'
  | 'permission'
  | 'ready'
  | 'unknown'
  | 'validation';

const api = createSupplierPortalApiClient(import.meta.env.VITE_API_BASE_URL ?? '');
const statusLabel: Record<string, string> = {
  APPROVED: '已审核待生效',
  CANCELLED: '已取消',
  EFFECTIVE: '已生效',
  REJECTED: '已驳回',
  SUBMITTED: '待公司审核',
};

const money = (value: number) => `¥${(value / 100).toFixed(2)}`;

export function SupplierPostListingPricePanel() {
  const [items, setItems] = useState<readonly ListedSku[]>([]);
  const [applications, setApplications] = useState<readonly SupplyApplication[]>([]);
  const [drafts, setDrafts] = useState<Readonly<Record<string, Draft>>>({});
  const [state, setState] = useState<PriceState>('loading');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState<string>();
  const pendingKeys = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [prices, requests] = await Promise.all([
        api.GET('/v1/supplier/pricing/skus'),
        api.GET('/v1/supplier/pricing/supply-price-changes'),
      ]);
      if (!prices.data || !requests.data) {
        const status = !prices.data ? prices.response.status : requests.response.status;
        setState([401, 403].includes(status) ? 'permission' : 'error');
        setMessage('价格数据暂时无法加载，请确认当前供应商价格职能权限。');
        return;
      }
      setItems(prices.data.items);
      setApplications(requests.data.items);
      setDrafts(Object.fromEntries(prices.data.items.map((sku) => [sku.id, {
        supply: sku.approvedSupplyPrice,
        retail: sku.currentRetailSalePrice,
        enterprise: sku.currentEnterpriseSalePrice,
        effectiveAt: new Date().toISOString(),
      }])));
      setState(prices.data.total === 0 ? 'empty' : 'ready');
      setMessage('');
    } catch {
      setState('offline');
      setMessage('网络离线或请求超时，请恢复后刷新。');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patchDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
    if (state === 'validation' || state === 'conflict') {
      setState('ready');
      setMessage('');
    }
  };

  const mutate = async (sku: ListedSku, kind: 'sale' | 'supply') => {
    const draft = drafts[sku.id];
    if (!draft?.reason?.trim() || !draft.verification?.trim() || !draft.effectiveAt) {
      setState('validation');
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
        const status = response.response.status;
        setState([401, 403].includes(status) ? 'permission' : status === 409 ? 'conflict' : 'error');
        setMessage(status === 409
          ? '价格版本或待审状态已变化，请刷新后重新确认。'
          : '调价未提交。请根据错误提示修正，或使用相同内容重试。');
        return;
      }
      pendingKeys.current.delete(commandKey);
      setState('ready');
      setMessage(kind === 'supply'
        ? '供应价变更已提交公司价格审核，审核前旧供应价继续有效。'
        : '个人零售价与企业集采价未创建审核任务，已按生效时间版本化留痕。');
      await load();
    } catch {
      setState('unknown');
      setMessage('结果未知。再次点击原操作会复用同一幂等键恢复结果。');
    } finally {
      setSubmitting(undefined);
    }
  };

  const commonInputs = (row: ListedSku) => (
    <Space direction="vertical">
      <Input
        aria-label={`${row.code}调价原因`}
        placeholder="调价原因"
        value={drafts[row.id]?.reason}
        onChange={(event) => patchDraft(row.id, { reason: event.target.value })}
      />
      <Input
        aria-label={`${row.code}生效时间`}
        value={drafts[row.id]?.effectiveAt}
        onChange={(event) => patchDraft(row.id, { effectiveAt: event.target.value })}
      />
      <Input.Password
        aria-label={`${row.code}二次验证`}
        placeholder="二次验证口令"
        value={drafts[row.id]?.verification}
        onChange={(event) => patchDraft(row.id, { verification: event.target.value })}
      />
    </Space>
  );

  const supplyPanel = (
    <Space data-p071-section="supply-price-application" direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        description="每个 SKU 同时只允许一个待审申请；公司通过且到达约定时间前，当前供应价不变。"
        message="供应价变更必须审核，审核前旧供应价继续有效"
        showIcon
        type="warning"
      />
      <Table<ListedSku>
        dataSource={[...items]}
        pagination={false}
        rowKey="id"
        scroll={{ x: 1100 }}
        columns={[
          { title: '商品 / SKU', key: 'sku', render: (_value, row) => <Space direction="vertical" size={0}><strong>{row.productName}</strong><span>{row.code}</span></Space> },
          { title: '当前供应价', key: 'supply', render: (_value, row) => <Space direction="vertical"><Tag>V{row.supplyPriceVersion}</Tag><InputNumber<number> aria-label={`${row.code}申请供应价`} min={0} precision={0} value={drafts[row.id]?.supply ?? null} onChange={(value) => patchDraft(row.id, value === null ? {} : { supply: value })} /></Space> },
          { title: '原因 / 生效时间 / 二次验证', key: 'command', render: (_value, row) => commonInputs(row) },
          { title: '操作', key: 'action', render: (_value, row) => <Button loading={submitting === `supply:${row.id}`} onClick={() => void mutate(row, 'supply')} type="primary">提交供应价审核</Button> },
        ]}
      />
      <Card title="本供应商供应价申请与历史意见">
        <Table<SupplyApplication>
          dataSource={[...applications]}
          locale={{ emptyText: <Empty description="暂无供应价变更申请" /> }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1300 }}
          columns={[
            { title: '商品 / SKU', key: 'sku', render: (_value, row) => <Space direction="vertical" size={0}><strong>{row.productName}</strong><span>{row.skuCode}</span></Space> },
            { title: '旧价 → 申请价', key: 'change', render: (_value, row) => `${money(row.oldSupplyPrice)} → ${money(row.requestedSupplyPrice)}` },
            { title: '申请原因', dataIndex: 'reason' },
            { title: '约定生效时间', dataIndex: 'requestedEffectiveAt' },
            { title: '状态', dataIndex: 'status', render: (value: string) => <Tag>{statusLabel[value] ?? value}</Tag> },
            { title: '历史意见', dataIndex: 'reviewOpinion', render: (value: string | null) => value ?? '尚无审核意见' },
            { title: '版本', dataIndex: 'version', render: (value: number) => `V${value}` },
          ]}
        />
      </Card>
    </Space>
  );

  const salePanel = (
    <Space data-p071-section="direct-sale-pricing" direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        description="保存后立即或按约定时间生效，并分别追加零售与集采价格版本；不会进入公司审批队列。"
        message="个人零售价与企业集采价直接调价，不创建审核任务"
        showIcon
        type="info"
      />
      <Table<ListedSku>
        dataSource={[...items]}
        pagination={false}
        rowKey="id"
        scroll={{ x: 1350 }}
        columns={[
          { title: '商品 / SKU', key: 'sku', render: (_value, row) => <Space direction="vertical" size={0}><strong>{row.productName}</strong><span>{row.code}</span></Space> },
          { title: '个人零售价', key: 'retail', render: (_value, row) => <Space direction="vertical"><Tag>V{row.retailPriceVersion}</Tag><InputNumber<number> aria-label={`${row.code}个人零售价`} min={0} precision={0} value={drafts[row.id]?.retail ?? null} onChange={(value) => patchDraft(row.id, value === null ? {} : { retail: value })} /></Space> },
          { title: '企业集采价', key: 'enterprise', render: (_value, row) => <Space direction="vertical"><Tag>V{row.enterprisePriceVersion}</Tag><InputNumber<number> aria-label={`${row.code}企业集采价`} min={0} precision={0} value={drafts[row.id]?.enterprise ?? null} onChange={(value) => patchDraft(row.id, value === null ? {} : { enterprise: value })} /></Space> },
          { title: '原因 / 生效时间 / 二次验证', key: 'command', render: (_value, row) => commonInputs(row) },
          { title: '操作', key: 'action', render: (_value, row) => <Button loading={submitting === `sale:${row.id}`} onClick={() => void mutate(row, 'sale')} type="primary">销售价免审生效</Button> },
        ]}
      />
    </Space>
  );

  return (
    <section data-m2-slice="M2-P019" data-price-state={state}>
      <div className="supplier-product-heading">
        <div>
          <Typography.Text className="eyebrow">POST-LISTING TIERED PRICING</Typography.Text>
          <Typography.Title level={2}>上架后价格管理</Typography.Title>
          <Typography.Paragraph>供应价申请与两类销售价直接调价使用独立分区，避免把免审销售价误送审批。</Typography.Paragraph>
        </div>
        <Button onClick={() => void load()}>刷新价格状态</Button>
      </div>
      {message ? <Alert message={state === 'unknown' ? '结果未知' : state === 'conflict' ? '版本冲突' : state === 'permission' ? '无权访问' : '调价提示'} description={message} showIcon type={state === 'ready' ? 'success' : state === 'unknown' || state === 'conflict' || state === 'validation' ? 'warning' : 'error'} /> : null}
      {state === 'loading' ? <Card><Spin tip="正在加载本供应商价格数据" /></Card> : state === 'permission' ? <Card><Empty description="当前职能无权访问价格数据" /></Card> : items.length === 0 ? <Card><Empty description="当前没有可调价的本供应商在售 SKU" /></Card> : (
        <Card>
          <Tabs
            items={[
              { key: 'supply', label: '供应价变更申请', children: supplyPanel },
              { key: 'sale', label: '销售价直接调价', children: salePanel },
            ]}
          />
        </Card>
      )}
    </section>
  );
}
