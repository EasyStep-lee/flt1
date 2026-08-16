import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Space, Spin, Table, Tag, Typography } from 'antd';
import type { components } from '@fulishe/contracts';

import { createSupplierPortalApiClient } from './api-client.js';
import { FixedSupplierWorkspacePage, type SupplierWorkspace } from './supplier-workspace-pages.js';

type SubOrder = components['schemas']['SupplierSubOrderResponseDto'];
type NodeRequest = components['schemas']['FulfillmentNodeRequestDto'];
type PageState = 'empty' | 'error' | 'loading' | 'offline' | 'permission' | 'success' | 'unknown-result';
type ShortageForm = { orderItemId: string; quantity: number; reason: string };
type HandoverForm = { handoverReference: string };

const api = createSupplierPortalApiClient(import.meta.env.VITE_API_BASE_URL ?? '');
const stateMeta: Record<string, { color: string; label: string }> = {
  PENDING: { color: 'default', label: '待确认' },
  ACCEPTED: { color: 'blue', label: '已确认' },
  PREPARING: { color: 'processing', label: '备货中' },
  READY_FOR_HANDOVER: { color: 'warning', label: '待移交' },
  HANDED_OVER: { color: 'success', label: '已移交' },
  COMPLETED: { color: 'success', label: '已完成' },
  CANCELLED: { color: 'error', label: '已取消' },
};

export function SupplierFulfillmentPage({ workspace }: { readonly workspace: SupplierWorkspace }) {
  const [shortageForm] = Form.useForm<ShortageForm>();
  const [handoverForm] = Form.useForm<HandoverForm>();
  const [items, setItems] = useState<readonly SubOrder[]>([]);
  const [state, setState] = useState<PageState>('loading');
  const [message, setMessage] = useState('');
  const [selectedShortage, setSelectedShortage] = useState<SubOrder>();
  const [selectedHandover, setSelectedHandover] = useState<SubOrder>();
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef<{ subOrderId: string; key: string; body: NodeRequest } | undefined>(undefined);

  const load = useCallback(async () => {
    setState('loading');
    setMessage('');
    try {
      const response = await api.GET('/v1/supplier/fulfillment-sub-orders', { params: { query: { page: 1, pageSize: 100 } } });
      if (!response.data) {
        setState(response.response.status === 401 || response.response.status === 403 ? 'permission' : 'error');
        setMessage('履约子单暂时无法加载，请确认当前订单履约职能会话。');
        return;
      }
      setItems(response.data.items);
      setState(response.data.total === 0 ? 'empty' : 'success');
    } catch {
      setState('offline');
      setMessage('网络离线或请求超时，请恢复后刷新。');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (subOrder: SubOrder, body: NodeRequest) => {
    const command = pending.current ?? { subOrderId: subOrder.id, key: crypto.randomUUID(), body };
    pending.current = command;
    setSubmitting(true);
    setMessage('');
    try {
      const response = await api.POST('/v1/supplier/fulfillment-sub-orders/{subOrderId}/nodes', {
        params: { path: { subOrderId: command.subOrderId }, header: { 'Idempotency-Key': command.key } },
        body: command.body,
      });
      if (!response.data) {
        setState(response.response.status === 401 || response.response.status === 403 ? 'permission' : 'error');
        setMessage('节点未生效，请核对当前状态、版本和职能权限。');
        return;
      }
      pending.current = undefined;
      setItems((current) => current.map((item) => item.id === response.data?.id ? response.data : item));
      setState('success');
      setMessage('备货节点已追加，历史记录保持不可覆盖。');
      setSelectedShortage(undefined);
      setSelectedHandover(undefined);
      shortageForm.resetFields();
      handoverForm.resetFields();
    } catch {
      setState('unknown-result');
      setMessage('提交结果未知，请勿更换参数；点击“按原请求恢复”复用同一幂等键。');
    } finally {
      setSubmitting(false);
    }
  };

  const primaryAction = (subOrder: SubOrder) => {
    if (subOrder.preparationStatus === 'PENDING') return <Button onClick={() => void submit(subOrder, { node: 'ACCEPT', expectedVersion: subOrder.version })} type="primary">确认子单</Button>;
    if (subOrder.preparationStatus === 'ACCEPTED') return <Button onClick={() => void submit(subOrder, { node: 'START_PREPARING', expectedVersion: subOrder.version })} type="primary">开始备货</Button>;
    if (subOrder.preparationStatus === 'PREPARING') return <Button onClick={() => void submit(subOrder, { node: 'MARK_READY', expectedVersion: subOrder.version })} type="primary">标记待移交</Button>;
    if (subOrder.preparationStatus === 'READY_FOR_HANDOVER') return <Button onClick={() => setSelectedHandover(subOrder)} type="primary">确认移交</Button>;
    return null;
  };

  return (
    <div data-m3-slice="M3-P031" data-fulfillment-state={state} data-route="/supplier/workspaces/fulfillment">
      <FixedSupplierWorkspacePage workspace={workspace} />
      <section className="supplier-pricing-editor">
        <div className="supplier-product-heading">
          <div>
            <Typography.Text className="eyebrow">SUPPLIER FULFILLMENT</Typography.Text>
            <Typography.Title level={2}>供应商备货</Typography.Title>
            <Typography.Paragraph>只展示当前供应商已收款激活的子单。确认、报缺、备货和移交均按版本追加节点，页面仅加载履约必要信息。</Typography.Paragraph>
          </div>
          <Space><Button onClick={() => void load()}>刷新</Button><Tag color="cyan">{workspace.accountTypeName}</Tag></Space>
        </div>
        {message ? <Alert
          action={state === 'unknown-result' && pending.current ? <Button onClick={() => { const current = items.find((item) => item.id === pending.current?.subOrderId); if (current) void submit(current, pending.current!.body); }} size="small">按原请求恢复</Button> : undefined}
          description={message}
          message={state === 'unknown-result' ? '提交结果未知' : state === 'permission' ? '无权访问履约页面' : '备货工作台提示'}
          showIcon type={state === 'success' ? 'success' : 'error'}
        /> : null}
        {state === 'loading' ? <Card><Spin size="large" tip="正在加载本供应商履约子单" /></Card>
          : items.length === 0 ? <Card><Empty description="当前没有待处理履约子单" /></Card>
            : <Card bordered={false}><Table<SubOrder>
              dataSource={[...items]} pagination={false} rowKey="id"
              columns={[
                { title: '子单号', dataIndex: 'subOrderNo' },
                { title: '渠道', dataIndex: 'channelType', render: (value: string) => value === 'CONSUMER' ? '个人零售' : '企业采购' },
                { title: '商品', render: (_value, row) => <Space direction="vertical" size={0}>{row.items.map((item) => <span key={item.orderItemId}>{item.productName} · {item.skuLabel} × {item.quantity}</span>)}</Space> },
                { title: '取货点', render: (_value, row) => row.pickupPoint.address },
                { title: '状态', render: (_value, row) => <Tag color={stateMeta[row.preparationStatus]?.color ?? 'default'}>{stateMeta[row.preparationStatus]?.label ?? row.preparationStatus}</Tag> },
                { title: '操作', render: (_value, row) => <Space>{primaryAction(row)}{['PENDING', 'ACCEPTED', 'PREPARING'].includes(row.preparationStatus) ? <Button disabled={!row.items[0]} onClick={() => { const first = row.items[0]; if (!first) return; setSelectedShortage(row); shortageForm.setFieldsValue({ orderItemId: first.orderItemId, quantity: 1, reason: '' }); }}>报缺</Button> : null}</Space> },
              ]}
            /></Card>}
      </section>

      <Modal destroyOnHidden footer={null} onCancel={() => setSelectedShortage(undefined)} open={Boolean(selectedShortage)} title="追加缺货异常">
        <Form form={shortageForm} layout="vertical" onFinish={(values) => selectedShortage && void submit(selectedShortage, { node: 'REPORT_SHORTAGE', expectedVersion: selectedShortage.version, reason: values.reason, shortages: [{ orderItemId: values.orderItemId, quantity: values.quantity }] })}>
          <Form.Item label="缺货商品" name="orderItemId" rules={[{ required: true }]}><Input disabled /></Form.Item>
          <Form.Item label="缺货数量" name="quantity" rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="缺货说明" name="reason" rules={[{ required: true, min: 2 }]}><Input.TextArea maxLength={1000} /></Form.Item>
          <Alert description="报缺只追加异常节点，不直接改订单项、库存、退款或结算。" message="历史不可覆盖" showIcon type="warning" />
          <Button block htmlType="submit" loading={submitting} type="primary">确认报缺</Button>
        </Form>
      </Modal>

      <Modal destroyOnHidden footer={null} onCancel={() => setSelectedHandover(undefined)} open={Boolean(selectedHandover)} title="确认移交">
        <Form form={handoverForm} layout="vertical" onFinish={(values) => selectedHandover && void submit(selectedHandover, { node: 'HANDOVER', expectedVersion: selectedHandover.version, handoverParty: selectedHandover.channelType === 'CONSUMER' ? 'RUNNER' : 'COMPANY_LOGISTICS', handoverReference: values.handoverReference })}>
          <Form.Item label="交接凭证编号" name="handoverReference" rules={[{ required: true, min: 2 }]}><Input maxLength={191} /></Form.Item>
          <Alert description={selectedHandover?.channelType === 'CONSUMER' ? '个人子单仅记录交给跑腿承接人的凭证；本阶段不创建或投放跑腿任务。' : '企业子单仅记录交给公司物流的凭证；绝不进入个人跑腿大厅。'} message="渠道隔离" showIcon type="info" />
          <Button block htmlType="submit" loading={submitting} type="primary">确认移交</Button>
        </Form>
      </Modal>
    </div>
  );
}
