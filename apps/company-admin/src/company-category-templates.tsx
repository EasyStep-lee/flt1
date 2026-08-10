import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';

type CategoryNode = components['schemas']['CategoryTreeNodeDto'];
type CategoryTree = components['schemas']['CategoryTreeResponseDto'];
type Template = components['schemas']['CategoryTemplateResponseDto'];
type TemplateList = components['schemas']['CategoryTemplateListResponseDto'];
type TemplateDefinition = components['schemas']['CategoryTemplateCreateRequestDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const flatten = (nodes: readonly CategoryNode[]): readonly CategoryNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

const defaultDefinition = (): TemplateDefinition => ({
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      {
        key: 'description',
        label: '商品说明',
        type: 'TEXT',
        required: true,
        unit: null,
        enumValues: [],
        validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
        searchable: false,
        specification: false,
        detailModuleKey: 'base',
      },
    ],
  },
  skuDimensions: { dimensions: [] },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [{ key: 'base', title: '基础信息', kind: 'FIELDS', sortWeight: 10 }],
  },
  afterSaleRules: {
    returnPolicy: 'COMPANY_STANDARD',
    notice: '由江苏福礼团供应链科技有限公司统一受理售后。',
    evidenceRequirements: [],
  },
});

const messageFrom = (value: unknown, fallback: string): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

const definitionOf = (value: Template): TemplateDefinition => ({
  fieldSchema: value.fieldSchema,
  skuDimensions: value.skuDimensions,
  qualificationRules: value.qualificationRules,
  detailModules: value.detailModules,
  afterSaleRules: value.afterSaleRules,
});

export function CompanyCategoryTemplatePanel() {
  const [tree, setTree] = useState<CategoryTree>();
  const [categoryId, setCategoryId] = useState<string>();
  const [data, setData] = useState<TemplateList>();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<
    { readonly kind: 'error' | 'offline' | 'permission'; readonly message: string } | undefined
  >();
  const [mutationMessage, setMutationMessage] = useState<string>();
  const [editor, setEditor] = useState<string>();
  const [editing, setEditing] = useState<Template>();
  const [submitting, setSubmitting] = useState(false);

  const leaves = useMemo(
    () => flatten(tree?.items ?? []).filter(({ level, status }) => level === 3 && status === 'ENABLED'),
    [tree],
  );

  const loadTemplates = useCallback(async (selectedCategoryId: string) => {
    const response = await api.GET('/v1/company/categories/{categoryId}/template-versions', {
      params: { path: { categoryId: selectedCategoryId } },
    });
    if (!response.data) {
      setFailure({
        kind: [401, 403].includes(response.response.status) ? 'permission' : 'error',
        message: messageFrom(response.error, '分类模板暂时无法加载'),
      });
      setData(undefined);
      return;
    }
    setData(response.data);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(undefined);
    try {
      const response = await api.GET('/v1/company/categories');
      if (!response.data) {
        setFailure({
          kind: [401, 403].includes(response.response.status) ? 'permission' : 'error',
          message: messageFrom(response.error, '分类模板入口暂时无法加载'),
        });
        setTree(undefined);
        setData(undefined);
        return;
      }
      setTree(response.data);
      const candidates = flatten(response.data.items).filter(
        ({ level, status }) => level === 3 && status === 'ENABLED',
      );
      const selected = candidates.some(({ id }) => id === categoryId)
        ? categoryId!
        : candidates[0]?.id;
      setCategoryId(selected);
      if (selected) await loadTemplates(selected);
      else setData(undefined);
    } catch {
      setFailure({ kind: 'offline', message: '模板请求离线或超时，请恢复后重试' });
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, [categoryId, loadTemplates]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectCategory = async (value: string) => {
    setCategoryId(value);
    setLoading(true);
    setFailure(undefined);
    try {
      await loadTemplates(value);
    } catch {
      setFailure({ kind: 'offline', message: '模板请求离线或超时，请恢复后重试' });
    } finally {
      setLoading(false);
    }
  };

  const createDraft = async () => {
    if (!categoryId) return;
    setSubmitting(true);
    setMutationMessage(undefined);
    try {
      const response = await api.POST('/v1/company/categories/{categoryId}/template-versions', {
        params: {
          header: { 'Idempotency-Key': crypto.randomUUID() },
          path: { categoryId },
        },
        body: defaultDefinition(),
      });
      if (!response.data) {
        setMutationMessage(messageFrom(response.error, '模板草稿创建失败'));
        return;
      }
      setEditing(response.data);
      setEditor(JSON.stringify(definitionOf(response.data), null, 2));
      await loadTemplates(categoryId);
    } catch {
      setMutationMessage('创建结果未知，请先刷新版本列表，勿重复提交');
    } finally {
      setSubmitting(false);
    }
  };

  const saveDraft = async () => {
    if (!editing || !editor) return;
    setSubmitting(true);
    setMutationMessage(undefined);
    try {
      const definition = JSON.parse(editor) as TemplateDefinition;
      const response = await api.PATCH('/v1/company/category-template-versions/{templateId}', {
        params: {
          header: { 'Idempotency-Key': crypto.randomUUID() },
          path: { templateId: editing.id },
        },
        body: { revision: editing.revision, ...definition },
      });
      if (!response.data) {
        setMutationMessage(messageFrom(response.error, '模板草稿保存失败'));
        return;
      }
      setEditing(response.data);
      setEditor(JSON.stringify(definitionOf(response.data), null, 2));
      await loadTemplates(response.data.categoryId);
    } catch (error) {
      setMutationMessage(error instanceof SyntaxError ? '模板 JSON 格式无效' : '保存结果未知，请刷新版本列表确认');
    } finally {
      setSubmitting(false);
    }
  };

  const publish = async (template: Template) => {
    setSubmitting(true);
    setMutationMessage(undefined);
    try {
      const response = await api.POST('/v1/company/category-template-versions/{templateId}/publish', {
        params: {
          header: { 'Idempotency-Key': crypto.randomUUID() },
          path: { templateId: template.id },
        },
        body: { revision: template.revision },
      });
      if (!response.data) {
        setMutationMessage(messageFrom(response.error, '模板发布失败'));
        return;
      }
      setEditing(undefined);
      setEditor(undefined);
      await loadTemplates(response.data.categoryId);
    } catch {
      setMutationMessage('发布结果未知，请刷新确认当前生效版本，勿重复发布');
    } finally {
      setSubmitting(false);
    }
  };

  const state = loading && !tree
    ? 'loading'
    : failure?.kind ?? (!leaves.length ? 'empty-category' : data?.items.length ? 'success' : 'empty');

  return (
    <section className="category-template-panel" data-category-template-state={state}>
      <div className="workspace-section-heading">
        <div>
          <Typography.Text className="eyebrow">VERSIONED CATEGORY TEMPLATE</Typography.Text>
          <Typography.Title level={2}>分类模板版本</Typography.Title>
          <Typography.Paragraph>
            仅启用的末级分类可发布模板；供应商商品只能绑定当前发布版本，历史版本退役后仍保留快照。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Select
            aria-label="模板所属末级分类"
            loading={loading}
            onChange={(value) => { if (value) void selectCategory(value); }}
            options={leaves.map(({ id, name }) => ({ label: name, value: id }))}
            placeholder="选择启用末级分类"
            style={{ minWidth: 220 }}
            value={categoryId}
          />
          <Button onClick={() => void load()}>刷新模板</Button>
          <Button
            disabled={!categoryId || Boolean(data?.items.some(({ status }) => status === 'DRAFT'))}
            loading={submitting}
            onClick={() => void createDraft()}
            type="primary"
          >
            新建下一版本草稿
          </Button>
        </Space>
      </div>

      {failure ? (
        <Alert
          action={<Button onClick={() => void load()}>重新加载</Button>}
          description={failure.message}
          message={failure.kind === 'permission' ? '无权访问分类模板' : failure.kind === 'offline' ? '分类模板网络离线或超时' : '分类模板加载失败'}
          showIcon
          type="error"
        />
      ) : null}
      {mutationMessage ? <Alert action={<Button onClick={() => void load()}>刷新确认</Button>} message={mutationMessage} showIcon type="warning" /> : null}

      <Card bordered={false} className="supplier-table-card">
        <Table<Template>
          dataSource={data?.items ?? []}
          loading={loading}
          locale={{ emptyText: <Empty description={leaves.length ? '该分类尚未发布模板' : '请先建立启用的第三级分类'} /> }}
          pagination={false}
          rowKey="id"
          columns={[
            { title: '版本', dataIndex: 'version', render: (value: number) => `V${value}` },
            { title: '修订', dataIndex: 'revision', render: (value: number) => `R${value}` },
            { title: '状态', dataIndex: 'status', render: (value: Template['status']) => <Tag color={value === 'PUBLISHED' ? 'success' : value === 'DRAFT' ? 'processing' : 'default'}>{value === 'PUBLISHED' ? '当前发布' : value === 'DRAFT' ? '草稿' : '已退役'}</Tag> },
            { title: '字段/SKU 维度', key: 'shape', render: (_value, row) => `${row.fieldSchema.fields.length} / ${row.skuDimensions.dimensions.length}` },
            { title: '资质规则', key: 'qualification', render: (_value, row) => `${row.qualificationRules.rules.length} 项` },
            {
              title: '操作',
              key: 'action',
              render: (_value, row) => row.status === 'DRAFT' ? (
                <Space>
                  <Button onClick={() => { setEditing(row); setEditor(JSON.stringify(definitionOf(row), null, 2)); }}>编辑定义</Button>
                  <Popconfirm cancelText="取消" description="发布后该版本不可修改，并会退役旧的当前版本。" okText="确认发布" onConfirm={() => void publish(row)} title={`发布模板 V${row.version}？`}>
                    <Button type="primary">发布版本</Button>
                  </Popconfirm>
                </Space>
              ) : <Typography.Text type="secondary">定义只读</Typography.Text>,
            },
          ]}
        />
      </Card>

      {editing && editor ? (
        <Card bordered={false} title={`编辑模板 V${editing.version} · R${editing.revision}`}>
          <Typography.Paragraph type="secondary">JSON 字段严格白名单校验；保存失败不会覆盖当前草稿。</Typography.Paragraph>
          <textarea aria-label="模板定义 JSON" onChange={(event) => setEditor(event.target.value)} rows={18} style={{ fontFamily: 'monospace', width: '100%' }} value={editor} />
          <Space style={{ marginTop: 16 }}>
            <Button loading={submitting} onClick={() => void saveDraft()} type="primary">保存草稿</Button>
            <Button onClick={() => { setEditing(undefined); setEditor(undefined); }}>关闭编辑</Button>
          </Space>
        </Card>
      ) : null}
    </section>
  );
}
