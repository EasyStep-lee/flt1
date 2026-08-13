import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import type { components } from '@fulishe/contracts';

import { createSupplierPortalApiClient } from './api-client.js';
import { FixedSupplierWorkspacePage, type SupplierWorkspace } from './supplier-workspace-pages.js';

type Balance = components['schemas']['SupplierInventoryBalanceDto'];
type Adjustment = components['schemas']['SupplierInventoryAdjustmentRequestDto'];
type InventoryState = 'empty' | 'error' | 'loading' | 'offline' | 'permission' | 'success' | 'unknown-result';

const api = createSupplierPortalApiClient(import.meta.env.VITE_API_BASE_URL ?? '');
const status = {
  AVAILABLE: { color: 'success', label: '库存正常' },
  LOW_STOCK: { color: 'warning', label: '低库存' },
  OUT_OF_STOCK: { color: 'error', label: '已售罄' },
} as const;

export function SupplierInventoryPage({ workspace }: { readonly workspace: SupplierWorkspace }) {
  const [form] = Form.useForm<Adjustment>();
  const [items, setItems] = useState<readonly Balance[]>([]);
  const [state, setState] = useState<InventoryState>('loading');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Balance>();
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef<{ skuId: string; key: string; body: Adjustment } | undefined>(undefined);

  const load = useCallback(async () => {
    setState('loading');
    setMessage('');
    try {
      const response = await api.GET('/v1/supplier/inventory', {
        params: { query: { page: 1, pageSize: 100, warningOnly: false } },
      });
      if (!response.data) {
        setState(response.response.status === 401 || response.response.status === 403 ? 'permission' : 'error');
        setMessage('库存工作台暂时无法加载，请确认当前库存职能会话。');
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

  const submit = async (values?: Adjustment) => {
    const command = pending.current ?? (selected && values ? {
      skuId: selected.skuId,
      key: crypto.randomUUID(),
      body: values,
    } : undefined);
    if (!command) return;
    pending.current = command;
    setSubmitting(true);
    try {
      const response = await api.POST('/v1/supplier/inventory/{skuId}/adjustments', {
        params: { path: { skuId: command.skuId }, header: { 'Idempotency-Key': command.key } },
        body: command.body,
      });
      if (!response.data) {
        setState(response.response.status === 401 || response.response.status === 403 ? 'permission' : 'error');
        setMessage('库存调整未生效，请核对数量、版本和当前职能权限。');
        return;
      }
      pending.current = undefined;
      setSelected(undefined);
      form.resetFields();
      setMessage('库存调整和审计流水已原子写入。');
      await load();
    } catch {
      setState('unknown-result');
      setMessage('调整结果未知，请勿更换参数；点击“按原请求恢复”复用同一幂等键。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-m2-slice="M2-P063" data-inventory-state={state} data-route="/supplier/workspaces/inventory">
      <FixedSupplierWorkspacePage workspace={workspace} />
      <section className="supplier-pricing-editor" data-inventory-panel="shared-sku-balance">
        <div className="supplier-product-heading">
          <div>
            <Typography.Text className="eyebrow">SHARED SKU INVENTORY</Typography.Text>
            <Typography.Title level={2}>跨渠道共用库存</Typography.Title>
            <Typography.Paragraph>
              个人零售与企业集采读取同一 SKU 余额。本页仅允许当前供应商库存职能调整本方库存，不显示任何供应价。
            </Typography.Paragraph>
          </div>
          <Space><Button onClick={() => void load()}>刷新</Button><Tag color="cyan">{workspace.accountTypeName}</Tag></Space>
        </div>
        {message ? (
          <Alert
            action={state === 'unknown-result' ? <Button onClick={() => void submit()} size="small">按原请求恢复</Button> : undefined}
            description={message}
            message={state === 'unknown-result' ? '调整结果未知' : state === 'permission' ? '无权访问库存页面' : '库存工作台提示'}
            showIcon
            type={state === 'success' ? 'success' : 'error'}
          />
        ) : null}
        {state === 'loading' ? <Card><Spin size="large" tip="正在加载本供应商库存" /></Card>
          : items.length === 0 ? <Card><Empty description="当前没有已上架 SKU 库存" /></Card>
            : (
              <Card bordered={false}>
                <Table<Balance>
                  dataSource={[...items]}
                  pagination={false}
                  rowKey="skuId"
                  columns={[
                    { title: '商品', dataIndex: 'productName' },
                    { title: 'SKU', dataIndex: 'skuCode' },
                    { title: '可用', dataIndex: 'availableQty' },
                    { title: '已预留', dataIndex: 'reservedQty' },
                    { title: '已售', dataIndex: 'soldQty' },
                    { title: '安全库存', dataIndex: 'safetyStockQty' },
                    { title: '状态', render: (_value, row) => <Tag color={status[row.status].color}>{status[row.status].label}</Tag> },
                    { title: '操作', render: (_value, row) => <Button disabled={pending.current !== undefined} onClick={() => { setSelected(row); form.setFieldsValue({ type: 'INCREASE', mode: 'DELTA_AVAILABLE', quantity: 1, expectedVersion: row.version, reason: '' }); }}>调整库存</Button> },
                  ]}
                />
              </Card>
            )}
      </section>
      <Modal destroyOnHidden footer={null} onCancel={() => setSelected(undefined)} open={Boolean(selected)} title="追加库存调整">
        <Form form={form} layout="vertical" onFinish={(values) => void submit(values)}>
          <Form.Item label="调整类型" name="type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'INCREASE', label: '入库增加' },
              { value: 'DECREASE', label: '出库减少' },
              { value: 'STOCKTAKE_GAIN', label: '盘盈' },
              { value: 'STOCKTAKE_LOSS', label: '盘亏' },
              { value: 'DAMAGE', label: '报损' },
            ]} />
          </Form.Item>
          <Form.Item hidden name="mode"><Input /></Form.Item>
          <Form.Item hidden name="expectedVersion"><InputNumber /></Form.Item>
          <Form.Item label="调整数量（减少填写负数）" name="quantity" rules={[{ required: true }]}><InputNumber precision={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="安全库存" name="safetyStockQty"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="调整原因" name="reason" rules={[{ required: true, min: 2 }]}><Input.TextArea maxLength={1000} /></Form.Item>
          <Alert description="提交后只追加流水；负库存、旧版本和重复参数冲突会被服务端拒绝。" message="库存历史不可覆盖" showIcon type="info" />
          <Button block htmlType="submit" loading={submitting} type="primary">确认调整</Button>
        </Form>
      </Modal>
    </div>
  );
}
