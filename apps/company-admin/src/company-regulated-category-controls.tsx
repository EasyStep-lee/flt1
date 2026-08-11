import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';

type CategoryNode = components['schemas']['CategoryTreeNodeDto'];
type CategoryTree = components['schemas']['CategoryTreeResponseDto'];
type Control = components['schemas']['RegulatedCategoryControlResponseDto'];
type ControlPage = components['schemas']['RegulatedCategoryControlPageDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');
const flatten = (nodes: readonly CategoryNode[]): readonly CategoryNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

const messageFrom = (value: unknown, fallback: string): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

export function CompanyRegulatedCategoryControlPanel() {
  const [tree, setTree] = useState<CategoryTree>();
  const [data, setData] = useState<ControlPage>();
  const [categoryId, setCategoryId] = useState<string>();
  const [references, setReferences] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [disableTarget, setDisableTarget] = useState<Control>();
  const [disableReason, setDisableReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<
    { readonly kind: 'error' | 'offline' | 'permission' | 'unknown'; readonly message: string } | undefined
  >();

  const leaves = useMemo(
    () => flatten(tree?.items ?? []).filter(({ level, status }) => level === 3 && status === 'ENABLED'),
    [tree],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(undefined);
    try {
      const [categories, controls] = await Promise.all([
        api.GET('/v1/company/categories'),
        api.GET('/v1/company/regulated-category-controls'),
      ]);
      const denied = [categories.response.status, controls.response.status].some((status) => [401, 403].includes(status));
      if (!categories.data || !controls.data) {
        setFailure({
          kind: denied ? 'permission' : 'error',
          message: messageFrom(categories.error ?? controls.error, '强监管开关暂时无法加载'),
        });
        setTree(undefined);
        setData(undefined);
        return;
      }
      setTree(categories.data);
      setData(controls.data);
      const candidates = flatten(categories.data.items).filter(
        ({ level, status }) => level === 3 && status === 'ENABLED',
      );
      setCategoryId((current) => candidates.some(({ id }) => id === current) ? current : candidates[0]?.id);
    } catch {
      setFailure({ kind: 'offline', message: '网络离线或请求超时，请恢复后重新加载' });
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const enable = async () => {
    if (!categoryId) return;
    const companyQualificationReferences = references
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean);
    const qualificationValidUntil = new Date(validUntil).toISOString();
    const current = data?.items.find((item) => item.categoryId === categoryId);
    setSubmitting(true);
    setFailure(undefined);
    try {
      const response = await api.POST('/v1/company/regulated-category-controls/{categoryId}/enable', {
        params: {
          header: { 'Idempotency-Key': crypto.randomUUID() },
          path: { categoryId },
        },
        body: {
          version: current?.version ?? 0,
          companyQualificationReferences,
          qualificationValidUntil,
          secondVerificationCode: verificationCode,
        },
      });
      if (!response.data) {
        setFailure({
          kind: [401, 403].includes(response.response.status) ? 'permission' : 'error',
          message: messageFrom(response.error, '强监管启用失败'),
        });
        return;
      }
      setReferences('');
      setVerificationCode('');
      await load();
    } catch {
      setFailure({ kind: 'unknown', message: '启用结果未知，请先刷新状态，勿重复操作' });
    } finally {
      setSubmitting(false);
    }
  };

  const disable = async () => {
    if (!disableTarget) return;
    setSubmitting(true);
    setFailure(undefined);
    try {
      const response = await api.POST('/v1/company/regulated-category-controls/{categoryId}/disable', {
        params: {
          header: { 'Idempotency-Key': crypto.randomUUID() },
          path: { categoryId: disableTarget.categoryId },
        },
        body: {
          version: disableTarget.version,
          reason: disableReason,
          secondVerificationCode: verificationCode,
        },
      });
      if (!response.data) {
        setFailure({ kind: 'error', message: messageFrom(response.error, '强监管停用失败') });
        return;
      }
      setDisableTarget(undefined);
      setDisableReason('');
      setVerificationCode('');
      await load();
    } catch {
      setFailure({ kind: 'unknown', message: '停用结果未知，请先刷新状态，勿重复操作' });
    } finally {
      setSubmitting(false);
    }
  };

  const state = loading && !tree
    ? 'loading'
    : failure?.kind ?? (!leaves.length ? 'empty-category' : data?.items.length ? 'success' : 'empty');

  return (
    <section
      className="regulated-category-control-panel"
      data-page-id="PAGE-M2-018"
      data-regulated-category-state={state}
      data-role="COMPANY_PRODUCT_OPS"
    >
      <div className="workspace-section-heading">
        <div>
          <Typography.Text className="eyebrow">HIGH-RISK DEFAULT DENY</Typography.Text>
          <Typography.Title level={2}>强监管品类开关</Typography.Title>
          <Typography.Paragraph>
            无公司显式启用、已发布合规模板或有效资质时一律不可提交、上架和对客交易；启停均需二次验证并审计。
          </Typography.Paragraph>
        </div>
        <Button onClick={() => void load()}>刷新状态</Button>
      </div>

      {failure ? (
        <Alert
          action={<Button onClick={() => void load()}>刷新确认</Button>}
          description={failure.message}
          message={failure.kind === 'permission' ? '无权访问强监管开关' : failure.kind === 'offline' ? '网络离线或超时' : failure.kind === 'unknown' ? '操作结果未知' : '强监管开关失败'}
          showIcon
          type="error"
        />
      ) : null}

      <Card bordered={false} title="启用强监管末级分类">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Select
            aria-label="强监管末级分类"
            loading={loading}
            onChange={setCategoryId}
            options={leaves.map(({ id, name }) => ({ label: name, value: id }))}
            placeholder="选择已发布 HIGH_RISK 模板的末级分类"
            style={{ width: '100%' }}
            value={categoryId}
          />
          <Input.TextArea
            aria-label="公司资质受控对象引用"
            onChange={(event) => setReferences(event.target.value)}
            placeholder="每行一个 object://company-qualification/...；成功后页面只显示份数"
            rows={3}
            value={references}
          />
          <Input
            aria-label="公司资质有效期"
            onChange={(event) => setValidUntil(event.target.value)}
            type="datetime-local"
            value={validUntil}
          />
          <Input.Password
            aria-label="强监管二次验证码"
            maxLength={64}
            onChange={(event) => setVerificationCode(event.target.value)}
            value={verificationCode}
          />
          <Button
            disabled={!categoryId || !references.trim() || !validUntil || verificationCode.length < 4}
            loading={submitting}
            onClick={() => void enable()}
            type="primary"
          >
            二次验证并启用
          </Button>
        </Space>
      </Card>

      <Card bordered={false} className="supplier-table-card">
        <Table<Control>
          dataSource={data?.items ?? []}
          loading={loading}
          locale={{ emptyText: <Empty description="尚无显式启用记录；强监管模板仍保持默认关闭" /> }}
          pagination={false}
          rowKey="id"
          columns={[
            { title: '分类', dataIndex: 'categoryId' },
            { title: '状态', dataIndex: 'status', render: (value: Control['status']) => <Tag color={value === 'ENABLED' ? 'success' : 'default'}>{value === 'ENABLED' ? '已启用' : '已停用'}</Tag> },
            { title: '公司资质', dataIndex: 'companyQualificationReferenceCount', render: (value: number) => `${value} 份` },
            { title: '有效期', dataIndex: 'qualificationValidUntil', render: (value: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '未配置' },
            { title: '版本', dataIndex: 'version', render: (value: number) => `V${value}` },
            { title: '操作', key: 'action', render: (_value, row) => row.status === 'ENABLED' ? <Button danger onClick={() => setDisableTarget(row)}>停用</Button> : <Typography.Text type="secondary">保持关闭</Typography.Text> },
          ]}
        />
      </Card>

      <Modal
        cancelText="取消"
        confirmLoading={submitting}
        okButtonProps={{ danger: true, disabled: disableReason.trim().length < 2 || verificationCode.length < 4 }}
        okText="二次验证并停用"
        onCancel={() => setDisableTarget(undefined)}
        onOk={() => void disable()}
        open={Boolean(disableTarget)}
        title="停用强监管分类"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert message="停用后相关强监管商品立即从公开目录失效，历史记录不会删除。" showIcon type="warning" />
          <Input.TextArea aria-label="停用原因" onChange={(event) => setDisableReason(event.target.value)} value={disableReason} />
          <Input.Password aria-label="停用二次验证码" maxLength={64} onChange={(event) => setVerificationCode(event.target.value)} value={verificationCode} />
        </Space>
      </Modal>
    </section>
  );
}
