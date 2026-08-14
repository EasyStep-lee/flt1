import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Result,
  Space,
  Tag,
  Typography,
} from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';
import {
  CompanyWorkspacePagePanel,
  type CompanyWorkspace,
} from './company-workspace-pages.js';

type RefundResponse = components['schemas']['RefundResponseDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const errorMessage = (value: unknown): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '退款请求未完成，请先查询状态后再处理。';
};

export function CompanyRefundInitiationPage({
  workspace,
}: {
  readonly workspace: CompanyWorkspace;
}) {
  const [afterSaleId, setAfterSaleId] = useState('');
  const [authorizationVersion, setAuthorizationVersion] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [refund, setRefund] = useState<RefundResponse>();
  const [failure, setFailure] = useState<{
    readonly kind: 'duplicate' | 'error' | 'offline' | 'permission';
    readonly message: string;
  }>();

  const resetCommand = () => {
    setIdempotencyKey(undefined);
    setRefund(undefined);
    setFailure(undefined);
  };

  const submit = async () => {
    if (!afterSaleId.trim() || !authorizationVersion || reason.trim().length < 2) return;
    const commandKey = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(commandKey);
    setLoading(true);
    setFailure(undefined);
    try {
      const response = await api.POST('/v1/aftersales/{afterSaleId}/refund', {
        params: {
          header: { 'Idempotency-Key': commandKey },
          path: { afterSaleId: afterSaleId.trim() },
        },
        body: {
          authorizationVersion,
          reason: reason.trim(),
        },
      });
      if (!response.data) {
        const code = response.error && typeof response.error === 'object' && 'code' in response.error
          ? String(response.error.code)
          : '';
        setFailure({
          kind: response.response.status === 401 || response.response.status === 403
            ? 'permission'
            : code === 'REFUND_DUPLICATE'
              ? 'duplicate'
              : 'error',
          message: errorMessage(response.error),
        });
        return;
      }
      setRefund(response.data);
    } catch {
      setFailure({
        kind: 'offline',
        message: '网络离线、超时或结果未知；系统保留同一幂等键，请恢复后先重试查询式提交。',
      });
    } finally {
      setLoading(false);
    }
  };

  const state = loading
    ? 'loading'
    : failure?.kind ?? (refund?.status === 'UNKNOWN' ? 'unknown-result' : refund ? 'success' : 'ready');

  return (
    <main
      className="supplier-ops-page"
      data-page-id="PAGE-007"
      data-refund-initiation-state={state}
      data-role="COMPANY_ORDER_SERVICE"
    >
      <header className="admin-topbar">
        <div className="brand-mark">福</div>
        <div>
          <strong>福礼社 · 公司管理后台</strong>
          <span>江苏福礼团供应链科技有限公司</span>
        </div>
        <Button href="/company-admin/account-select" ghost>切换职能</Button>
        <Tag color="cyan">订单客服</Tag>
      </header>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Typography.Text className="sidebar-label">当前独立页面</Typography.Text>
          <div className="active-menu" data-workspace-menu>退款执行</div>
          <div className="boundary-note">
            <strong>COMPANY_ORDER_SERVICE</strong>
            <span>只执行已批准授权；金额和退款渠道由服务端原快照决定</span>
          </div>
        </aside>
        <section className="admin-content">
          <div className="page-title-row">
            <div>
              <Typography.Title level={5}>订单客服</Typography.Title>
              <Typography.Text className="eyebrow">ORIGINAL PAYMENT REFUND</Typography.Text>
              <Typography.Title level={1}>按原支付结构退款</Typography.Title>
              <Typography.Paragraph>
                福利卡退回原账户，微信部分退回原交易；页面不能覆盖金额、账户或支付交易。
              </Typography.Paragraph>
            </div>
          </div>
          <CompanyWorkspacePagePanel workspace={workspace} />
          <Card bordered={false} className="supplier-table-card" title="执行已批准退款">
            <Alert
              description="完整售后申请、责任认定和供应商协同仍在 M5；本页只消费服务端已批准的退款授权快照。"
              message="退款边界"
              showIcon
              type="warning"
            />
            <Form layout="vertical" onFinish={() => void submit()} style={{ marginTop: 20 }}>
              <Form.Item label="退款授权编号" required>
                <Input
                  aria-label="退款授权编号"
                  maxLength={36}
                  onChange={(event) => { setAfterSaleId(event.target.value); resetCommand(); }}
                  placeholder="服务端已批准的 afterSaleId"
                  value={afterSaleId}
                />
              </Form.Item>
              <Form.Item label="授权版本" required>
                <InputNumber
                  aria-label="退款授权版本"
                  min={1}
                  onChange={(value) => { setAuthorizationVersion(value); resetCommand(); }}
                  precision={0}
                  style={{ width: '100%' }}
                  value={authorizationVersion}
                />
              </Form.Item>
              <Form.Item label="执行原因" required>
                <Input.TextArea
                  aria-label="退款执行原因"
                  maxLength={500}
                  onChange={(event) => { setReason(event.target.value); resetCommand(); }}
                  rows={4}
                  showCount
                  value={reason}
                />
              </Form.Item>
              <Button
                disabled={!afterSaleId.trim() || !authorizationVersion || reason.trim().length < 2}
                htmlType="submit"
                loading={loading}
                type="primary"
              >
                按原结构执行退款
              </Button>
            </Form>
          </Card>

          {failure ? (
            <Result
              extra={<Button onClick={() => void submit()}>使用同一幂等键重试</Button>}
              status={failure.kind === 'permission' ? '403' : 'error'}
              subTitle={failure.message}
              title={failure.kind === 'duplicate' ? '退款请求冲突' : failure.kind === 'offline' ? '请求结果未知' : '退款未完成'}
            />
          ) : null}
          {refund ? (
            <Card bordered={false} className="supplier-table-card" title="退款结果">
              {refund.status === 'UNKNOWN' ? (
                <Alert
                  description="禁止重新生成退款；请保留当前授权编号和幂等键，等待查单补偿。"
                  message="外部渠道结果未知"
                  showIcon
                  type="warning"
                />
              ) : null}
              <Descriptions
                bordered
                column={1}
                items={[
                  { key: 'refundNo', label: '退款单号', children: refund.refundNo },
                  { key: 'status', label: '状态', children: <Tag>{refund.status}</Tag> },
                  { key: 'welfare', label: '福利卡原路退款（分）', children: refund.welfareCardRefundAmount },
                  { key: 'wechat', label: '微信原路退款（分）', children: refund.cashRefundAmount },
                ]}
              />
            </Card>
          ) : null}
          <Space />
        </section>
      </div>
    </main>
  );
}
