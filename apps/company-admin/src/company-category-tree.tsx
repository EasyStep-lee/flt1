import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';

type CategoryNode = components['schemas']['CategoryTreeNodeDto'];
type CategoryTree = components['schemas']['CategoryTreeResponseDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const messageFrom = (value: unknown, fallback: string): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

const flatten = (nodes: readonly CategoryNode[]): readonly CategoryNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

export function CompanyCategoryTreePanel() {
  const [data, setData] = useState<CategoryTree>();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<
    { readonly kind: 'error' | 'offline' | 'permission'; readonly message: string } | undefined
  >();
  const [mutationMessage, setMutationMessage] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [sortWeight, setSortWeight] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const rows = useMemo(() => flatten(data?.items ?? []), [data]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(undefined);
    try {
      const response = await api.GET('/v1/company/categories');
      if (!response.data) {
        setFailure({
          kind: [401, 403].includes(response.response.status) ? 'permission' : 'error',
          message: messageFrom(response.error, '分类树暂时无法加载'),
        });
        setData(undefined);
      } else {
        setData(response.data);
      }
    } catch {
      setFailure({ kind: 'offline', message: '网络离线或请求超时，请恢复后重试' });
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (parent?: CategoryNode) => {
    setParentId(parent?.id ?? null);
    setLevel(parent ? ((parent.level + 1) as 2 | 3) : 1);
    setName('');
    setSortWeight(10);
    setMutationMessage(undefined);
    setModalOpen(true);
  };

  const create = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setMutationMessage(undefined);
    try {
      const response = await api.POST('/v1/company/categories', {
        params: { header: { 'Idempotency-Key': crypto.randomUUID() } },
        body: { parentId, name: name.trim(), level, sortWeight },
      });
      if (!response.data) {
        setMutationMessage(messageFrom(response.error, '分类创建失败'));
        return;
      }
      setModalOpen(false);
      await load();
    } catch {
      setMutationMessage('创建结果未知，请先刷新分类树，勿重复提交');
    } finally {
      setSubmitting(false);
    }
  };

  const patch = async (
    category: CategoryNode,
    body: { readonly sortWeight?: number; readonly status?: 'ENABLED' | 'DISABLED' },
  ) => {
    setMutationMessage(undefined);
    try {
      const response = await api.PATCH('/v1/company/categories/{categoryId}', {
        params: {
          header: { 'Idempotency-Key': crypto.randomUUID() },
          path: { categoryId: category.id },
        },
        body: { version: category.version, ...body },
      });
      if (!response.data) {
        setMutationMessage(messageFrom(response.error, '分类更新失败'));
        return;
      }
      await load();
    } catch {
      setMutationMessage('更新结果未知，请刷新确认最新版本后再操作');
    }
  };

  const remove = async (category: CategoryNode) => {
    setMutationMessage(undefined);
    try {
      const response = await api.DELETE('/v1/company/categories/{categoryId}', {
        params: {
          header: { 'Idempotency-Key': crypto.randomUUID() },
          path: { categoryId: category.id },
          query: { version: category.version },
        },
      });
      if (!response.data) {
        setMutationMessage(messageFrom(response.error, '分类删除失败'));
        return;
      }
      await load();
    } catch {
      setMutationMessage('删除结果未知，请刷新确认；已引用分类不会被物理删除');
    }
  };

  const state = loading && !data ? 'loading' : failure?.kind ?? (rows.length ? 'success' : 'empty');

  return (
    <section className="category-tree-panel" data-category-tree-state={state}>
      <div className="workspace-section-heading">
        <div>
          <Typography.Text className="eyebrow">THREE-LEVEL CATEGORY TREE</Typography.Text>
          <Typography.Title level={2}>平台分类树</Typography.Title>
          <Typography.Paragraph>
            商品仅可绑定启用的第三级末级分类；停用保留历史，存在子级或商品引用时禁止物理删除。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button onClick={() => void load()}>刷新分类</Button>
          <Button onClick={() => openCreate()} type="primary">新增一级分类</Button>
        </Space>
      </div>

      <div className="metric-grid">
        <Card bordered={false}><Statistic title="分类总数" value={data?.total ?? 0} /></Card>
        <Card bordered={false}><Statistic title="启用分类" value={rows.filter(({ status }) => status === 'ENABLED').length} /></Card>
        <Card bordered={false}><Statistic title="末级分类" value={rows.filter(({ level: value }) => value === 3).length} /></Card>
      </div>

      {failure ? (
        <Alert
          action={<Button onClick={() => void load()}>重新加载</Button>}
          description={failure.message}
          message={failure.kind === 'permission' ? '无权访问分类管理' : failure.kind === 'offline' ? '分类树网络离线或超时' : '分类树加载失败'}
          showIcon
          type="error"
        />
      ) : null}
      {mutationMessage ? <Alert action={<Button onClick={() => void load()}>刷新确认</Button>} message={mutationMessage} showIcon type="warning" /> : null}

      <Card bordered={false} className="supplier-table-card">
        <Table<CategoryNode>
          dataSource={data?.items ?? []}
          expandable={{
            expandedRowKeys: rows.filter(({ level: value }) => value < 3).map(({ id }) => id),
          }}
          loading={loading}
          locale={{ emptyText: <Empty description="尚未建立平台分类" /> }}
          pagination={false}
          rowKey="id"
          columns={[
            { title: '分类名称', dataIndex: 'name', render: (value: string, row) => <Space><strong>{value}</strong><Tag>第 {row.level} 级</Tag></Space> },
            { title: '排序', dataIndex: 'sortWeight' },
            { title: '状态', dataIndex: 'status', render: (value: CategoryNode['status']) => <Tag color={value === 'ENABLED' ? 'success' : 'default'}>{value === 'ENABLED' ? '启用' : '停用'}</Tag> },
            { title: '版本', dataIndex: 'version', render: (value: number) => `V${value}` },
            {
              title: '操作',
              key: 'actions',
              render: (_value, row) => (
                <Space wrap>
                  {row.level < 3 ? <Button onClick={() => openCreate(row)}>新增子级</Button> : null}
                  <Button onClick={() => void patch(row, { sortWeight: row.sortWeight - 10 })}>上移</Button>
                  <Button onClick={() => void patch(row, { sortWeight: row.sortWeight + 10 })}>下移</Button>
                  <Button onClick={() => void patch(row, { status: row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED' })}>
                    {row.status === 'ENABLED' ? '停用' : '启用'}
                  </Button>
                  <Popconfirm
                    cancelText="取消"
                    description="存在子级或商品引用时服务端会拒绝删除"
                    okText="确认删除"
                    onConfirm={() => void remove(row)}
                    title="确认物理删除未引用分类？"
                  >
                    <Button danger>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        cancelText="取消"
        confirmLoading={submitting}
        okButtonProps={{ disabled: !name.trim() }}
        okText="创建分类"
        onCancel={() => setModalOpen(false)}
        onOk={() => void create()}
        open={modalOpen}
        title={`新增第 ${level} 级分类`}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {level > 1 ? (
            <Select
              aria-label="父级分类"
              disabled
              options={rows.filter((row) => row.level === level - 1).map((row) => ({ label: row.name, value: row.id }))}
              value={parentId ?? undefined}
            />
          ) : null}
          <Input aria-label="分类名称" maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="分类名称" value={name} />
          <InputNumber aria-label="分类排序权重" onChange={(value) => setSortWeight(value ?? 0)} precision={0} style={{ width: '100%' }} value={sortWeight} />
        </Space>
      </Modal>
    </section>
  );
}
