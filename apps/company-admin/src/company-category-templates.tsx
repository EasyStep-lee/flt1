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
  regulatoryMode: 'STANDARD',
  profile: 'GENERIC',
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

const foodField = (
  key: string,
  label: string,
  detailModuleKey: string,
  specification = false,
): TemplateDefinition['fieldSchema']['fields'][number] => ({
  key,
  label,
  type: 'TEXT',
  required: true,
  unit: null,
  enumValues: [],
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false,
  specification,
  detailModuleKey,
});

const foodDefinition = (): TemplateDefinition => ({
  regulatoryMode: 'STANDARD',
  profile: 'FOOD',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      foodField('ingredients', '配料表', 'ingredients-nutrition'),
      foodField('nutrition-facts', '营养成分', 'ingredients-nutrition'),
      foodField('production-license', '生产许可', 'production-information'),
      foodField('shelf-life', '保质期', 'production-information'),
      foodField('storage-method', '储存方式', 'consumption-storage'),
      foodField('allergens', '过敏原', 'consumption-storage'),
      foodField('flavor', '口味', 'specifications', true),
      foodField('net-content', '净含量', 'specifications', true),
      foodField('package-count', '包装数', 'specifications', true),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'flavor', label: '口味', fieldKey: 'flavor' },
      { key: 'net-content', label: '净含量', fieldKey: 'net-content' },
      { key: 'package-count', label: '包装数', fieldKey: 'package-count' },
    ],
  },
  qualificationRules: {
    rules: [
      {
        key: 'food-production-license',
        label: '食品生产许可证明',
        required: true,
        expiryRequired: true,
        objectTypes: ['IMAGE', 'PDF'],
      },
    ],
  },
  detailModules: {
    modules: [
      { key: 'ingredients-nutrition', title: '配料与营养', kind: 'FIELDS', sortWeight: 10 },
      { key: 'production-information', title: '生产信息', kind: 'FIELDS', sortWeight: 20 },
      { key: 'consumption-storage', title: '食用和储存提示', kind: 'FIELDS', sortWeight: 30 },
      { key: 'specifications', title: '规格参数', kind: 'FIELDS', sortWeight: 40 },
      { key: 'food-safety-warning', title: '食品安全提示', kind: 'NOTICE', sortWeight: 50 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理售后。',
    evidenceRequirements: ['PACKAGE_PHOTO'],
  },
});

const freshField = (
  key: string,
  label: string,
  detailModuleKey: string,
  options: {
    readonly enumValues?: readonly string[];
    readonly specification?: boolean;
    readonly type?: 'DATE' | 'ENUM' | 'TEXT';
  } = {},
): TemplateDefinition['fieldSchema']['fields'][number] => ({
  key,
  label,
  type: options.type ?? 'TEXT',
  required: true,
  unit: null,
  enumValues: [...(options.enumValues ?? [])],
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false,
  specification: options.specification ?? false,
  detailModuleKey,
});

const freshDefinition = (): TemplateDefinition => ({
  regulatoryMode: 'STANDARD',
  profile: 'FRESH',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      freshField('variety', '品种', 'origin-traceability'),
      freshField('grade', '等级', 'origin-traceability'),
      freshField('origin', '产地', 'origin-traceability'),
      freshField('harvest-slaughter-date', '采收/屠宰日期', 'freshness-storage', { type: 'DATE' }),
      freshField('freshness-period', '保鲜期', 'freshness-storage'),
      freshField('temperature-zone', '温区', 'freshness-storage', {
        type: 'ENUM',
        enumValues: ['AMBIENT', 'CHILLED', 'FROZEN'],
      }),
      freshField('weighing-rule', '称重规则', 'weighing-difference', {
        type: 'ENUM',
        enumValues: ['FIXED_WEIGHT', 'ACTUAL_WEIGHT'],
      }),
      freshField('weight-tier', '重量档', 'specifications', { specification: true }),
      freshField('specification', '规格', 'specifications', { specification: true }),
      freshField('processing-method', '处理方式', 'specifications', { specification: true }),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'weight-tier', label: '重量档', fieldKey: 'weight-tier' },
      { key: 'specification', label: '规格', fieldKey: 'specification' },
      { key: 'processing-method', label: '处理方式', fieldKey: 'processing-method' },
    ],
  },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [
      { key: 'origin-traceability', title: '产地溯源', kind: 'FIELDS', sortWeight: 10 },
      { key: 'freshness-storage', title: '保鲜与温区', kind: 'FIELDS', sortWeight: 20 },
      { key: 'weighing-difference', title: '称重差异', kind: 'FIELDS', sortWeight: 30 },
      { key: 'specifications', title: '规格参数', kind: 'FIELDS', sortWeight: 40 },
      { key: 'fresh-after-sales', title: '生鲜售后规则', kind: 'AFTER_SALE', sortWeight: 50 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理；称重差异按实际称重和已审核规则处理。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'WEIGHT_PHOTO'],
  },
});

const apparelField = (
  key: string,
  label: string,
  detailModuleKey: string,
  options: {
    readonly specification?: boolean;
    readonly type?: 'RICH_TEXT' | 'TEXT';
  } = {},
): TemplateDefinition['fieldSchema']['fields'][number] => ({
  key,
  label,
  type: options.type ?? 'TEXT',
  required: true,
  unit: null,
  enumValues: [],
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false,
  specification: options.specification ?? false,
  detailModuleKey,
});

const apparelDefinition = (): TemplateDefinition => ({
  regulatoryMode: 'STANDARD',
  profile: 'APPAREL',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      apparelField('fabric', '面料', 'materials'),
      apparelField('lining', '里料', 'materials'),
      apparelField('fit', '版型', 'size-assistant'),
      apparelField('execution-standard', '执行标准', 'materials'),
      apparelField('care-instructions', '洗护方式', 'care-instructions'),
      apparelField('size-chart', '尺码表', 'size-assistant', { type: 'RICH_TEXT' }),
      apparelField('color', '颜色', 'specifications', { specification: true }),
      apparelField('size', '尺码', 'specifications', { specification: true }),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'color', label: '颜色', fieldKey: 'color' },
      { key: 'size', label: '尺码', fieldKey: 'size' },
    ],
  },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [
      { key: 'size-assistant', title: '尺码助手', kind: 'FIELDS', sortWeight: 10 },
      { key: 'materials', title: '材质说明', kind: 'FIELDS', sortWeight: 20 },
      { key: 'care-instructions', title: '洗护说明', kind: 'FIELDS', sortWeight: 30 },
      { key: 'specifications', title: '颜色与尺码', kind: 'FIELDS', sortWeight: 40 },
      { key: 'apparel-after-sales', title: '试穿与退换说明', kind: 'AFTER_SALE', sortWeight: 50 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理；退换商品须保持未洗涤、未污损且不影响二次销售。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'PRODUCT_PHOTO'],
  },
});

const digitalField = (
  key: string,
  label: string,
  detailModuleKey: string,
  options: {
    readonly specification?: boolean;
    readonly type?: 'RICH_TEXT' | 'TEXT';
  } = {},
): TemplateDefinition['fieldSchema']['fields'][number] => ({
  key,
  label,
  type: options.type ?? 'TEXT',
  required: true,
  unit: null,
  enumValues: [],
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false,
  specification: options.specification ?? false,
  detailModuleKey,
});

const digitalDefinition = (): TemplateDefinition => ({
  regulatoryMode: 'STANDARD',
  profile: 'DIGITAL',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      digitalField('dimensions', '尺寸', 'technical-parameters'),
      digitalField('power', '功率', 'technical-parameters'),
      digitalField('voltage', '电压', 'technical-parameters'),
      digitalField('interfaces', '接口', 'technical-parameters'),
      digitalField('energy-efficiency', '能效', 'energy-efficiency'),
      digitalField('execution-standard', '执行标准', 'technical-parameters'),
      digitalField('package-list', '包装清单', 'package-and-installation', { type: 'RICH_TEXT' }),
      digitalField('installation-instructions', '安装说明', 'package-and-installation', { type: 'RICH_TEXT' }),
      digitalField('warranty-period', '保修期', 'warranty'),
      digitalField('color', '颜色', 'specifications', { specification: true }),
      digitalField('capacity', '容量', 'specifications', { specification: true }),
      digitalField('model', '型号', 'specifications', { specification: true }),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'color', label: '颜色', fieldKey: 'color' },
      { key: 'capacity', label: '容量', fieldKey: 'capacity' },
      { key: 'model', label: '型号', fieldKey: 'model' },
    ],
  },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [
      { key: 'technical-parameters', title: '规格参数', kind: 'FIELDS', sortWeight: 10 },
      { key: 'energy-efficiency', title: '能效信息', kind: 'FIELDS', sortWeight: 20 },
      { key: 'package-and-installation', title: '包装与安装', kind: 'FIELDS', sortWeight: 30 },
      { key: 'warranty', title: '保修信息', kind: 'FIELDS', sortWeight: 40 },
      { key: 'specifications', title: '型号规格', kind: 'FIELDS', sortWeight: 50 },
      { key: 'digital-after-sales', title: '安装与保修服务', kind: 'AFTER_SALE', sortWeight: 60 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理；安装与保修按已发布规则执行。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'PRODUCT_PHOTO'],
  },
});

const giftBoxField = (
  key: string,
  label: string,
  detailModuleKey: string,
  options: {
    readonly specification?: boolean;
    readonly type?: 'BUNDLE_ITEMS' | 'TEXT';
  } = {},
): TemplateDefinition['fieldSchema']['fields'][number] => ({
  key,
  label,
  type: options.type ?? 'TEXT',
  required: true,
  unit: null,
  enumValues: [],
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false,
  specification: options.specification ?? false,
  detailModuleKey,
});

const giftBoxDefinition = (): TemplateDefinition => ({
  regulatoryMode: 'STANDARD',
  profile: 'GIFT_BOX',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      giftBoxField('bundle-items', '组合清单', 'bundle-list', { type: 'BUNDLE_ITEMS' }),
      giftBoxField('packaging', '包装说明', 'customization'),
      giftBoxField('customization', '定制项', 'customization'),
      giftBoxField('delivery-cycle', '交付周期', 'customization'),
      giftBoxField('welfare-scenario', '福利场景', 'welfare-scenario'),
      giftBoxField('package', '套餐', 'specifications', { specification: true }),
      giftBoxField('tier', '档位', 'specifications', { specification: true }),
      giftBoxField('custom-version', '定制版本', 'specifications', { specification: true }),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'package', label: '套餐', fieldKey: 'package' },
      { key: 'tier', label: '档位', fieldKey: 'tier' },
      { key: 'custom-version', label: '定制版本', fieldKey: 'custom-version' },
    ],
  },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [
      { key: 'bundle-list', title: '组合清单', kind: 'FIELDS', sortWeight: 10 },
      { key: 'welfare-scenario', title: '福利场景', kind: 'FIELDS', sortWeight: 20 },
      { key: 'customization', title: '定制说明', kind: 'FIELDS', sortWeight: 30 },
      { key: 'specifications', title: '套餐规格', kind: 'FIELDS', sortWeight: 40 },
      { key: 'gift-box-after-sales', title: '统一售后口径', kind: 'AFTER_SALE', sortWeight: 50 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'COMPANY_STANDARD',
    notice: '由江苏福礼团供应链科技有限公司统一受理礼盒售后。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'PRODUCT_PHOTO'],
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
  regulatoryMode: value.regulatoryMode ?? 'STANDARD',
  profile: value.profile ?? 'GENERIC',
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

  const createDraft = async (definition: TemplateDefinition = defaultDefinition()) => {
    if (!categoryId) return;
    setSubmitting(true);
    setMutationMessage(undefined);
    try {
      const response = await api.POST('/v1/company/categories/{categoryId}/template-versions', {
        params: {
          header: { 'Idempotency-Key': crypto.randomUUID() },
          path: { categoryId },
        },
        body: definition,
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
          <Button
            disabled={!categoryId || Boolean(data?.items.some(({ status }) => status === 'DRAFT'))}
            loading={submitting}
            onClick={() => void createDraft(foodDefinition())}
          >
            新建食品模板草稿
          </Button>
          <Button
            disabled={!categoryId || Boolean(data?.items.some(({ status }) => status === 'DRAFT'))}
            loading={submitting}
            onClick={() => void createDraft(freshDefinition())}
          >
            新建生鲜模板草稿
          </Button>
          <Button
            disabled={!categoryId || Boolean(data?.items.some(({ status }) => status === 'DRAFT'))}
            loading={submitting}
            onClick={() => void createDraft(apparelDefinition())}
          >
            新建服饰模板草稿
          </Button>
          <Button
            disabled={!categoryId || Boolean(data?.items.some(({ status }) => status === 'DRAFT'))}
            loading={submitting}
            onClick={() => void createDraft(digitalDefinition())}
          >
            新建数码模板草稿
          </Button>
          <Button
            disabled={!categoryId || Boolean(data?.items.some(({ status }) => status === 'DRAFT'))}
            loading={submitting}
            onClick={() => void createDraft(giftBoxDefinition())}
          >
            新建礼盒模板草稿
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
            { title: '类型', dataIndex: 'profile', render: (value: Template['profile']) => value === 'FOOD' ? <Tag color="gold">食品</Tag> : value === 'FRESH' ? <Tag color="green">生鲜</Tag> : value === 'APPAREL' ? <Tag color="magenta">服饰</Tag> : value === 'DIGITAL' ? <Tag color="blue">数码</Tag> : value === 'GIFT_BOX' ? <Tag color="volcano">礼盒</Tag> : <Tag>通用</Tag> },
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
