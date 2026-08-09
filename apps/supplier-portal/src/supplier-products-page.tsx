import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import type { components } from '@fulishe/contracts';

import { createSupplierPortalApiClient } from './api-client.js';
import {
  FixedSupplierWorkspacePage,
  type SupplierWorkspace,
} from './supplier-workspace-pages.js';

type SupplierProduct = components['schemas']['SupplierProductResponseDto'];

interface SupplierProductFormValues {
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly name: string;
  readonly brand?: string;
  readonly attributes: string;
  readonly qualificationReferences?: string;
  readonly isRetailEnabled?: boolean;
  readonly isEnterpriseProcurementEnabled?: boolean;
  readonly enterpriseMinOrderQty: number;
  readonly enterprisePackageMultiple: number;
  readonly preparationMinutes: number;
  readonly supplierSkuCode: string;
  readonly skuAttributes: string;
  readonly initialStock: number;
}

const api = createSupplierPortalApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const safeMessage = (value: unknown): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '商品草稿暂未保存，请核对资料后重试。';
};

const jsonObject = (value: string, field: string): Readonly<Record<string, unknown>> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${field}必须是合法 JSON 对象`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${field}必须是 JSON 对象`);
  }
  return parsed as Readonly<Record<string, unknown>>;
};

export function SupplierProductsPage({
  workspace,
}: {
  readonly workspace: SupplierWorkspace;
}) {
  const [form] = Form.useForm<SupplierProductFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<SupplierProduct>();
  const [state, setState] = useState<
    | { readonly kind: 'error' | 'offline' | 'permission'; readonly message: string }
    | undefined
  >();

  const submit = async (values: SupplierProductFormValues) => {
    setSubmitting(true);
    setState(undefined);
    try {
      const attributes = jsonObject(values.attributes, '商品属性');
      const skuAttributes = jsonObject(values.skuAttributes, 'SKU 属性');
      const response = await api.POST('/v1/supplier/products', {
        params: { header: { 'Idempotency-Key': crypto.randomUUID() } },
        body: {
          categoryId: values.categoryId.trim(),
          templateVersion: values.templateVersion,
          name: values.name.trim(),
          brand: values.brand?.trim() || null,
          attributes,
          qualificationReferences: (values.qualificationReferences ?? '')
            .split(/\r?\n/u)
            .map((value) => value.trim())
            .filter(Boolean),
          isRetailEnabled: values.isRetailEnabled ?? false,
          isEnterpriseProcurementEnabled:
            values.isEnterpriseProcurementEnabled ?? false,
          enterpriseMinOrderQty: values.enterpriseMinOrderQty,
          enterprisePackageMultiple: values.enterprisePackageMultiple,
          preparationMinutes: values.preparationMinutes,
          skus: [
            {
              supplierSkuCode: values.supplierSkuCode.trim(),
              attributes: skuAttributes,
              initialStock: values.initialStock,
            },
          ],
        },
      });
      if (!response.data) {
        setState({
          kind:
            response.response.status === 401 || response.response.status === 403
              ? 'permission'
              : 'error',
          message: safeMessage(response.error),
        });
        return;
      }
      setCreated(response.data);
    } catch (error) {
      if (error instanceof Error && error.message.includes('JSON')) {
        setState({ kind: 'error', message: error.message });
      } else {
        setState({ kind: 'offline', message: '网络连接超时或已离线，请恢复网络后重试。' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-m2-slice="M2-P006" data-route="/supplier/workspaces/products">
      <FixedSupplierWorkspacePage workspace={workspace} />
      <section className="supplier-product-editor" data-supplier-product-state={created ? 'success' : state?.kind ?? 'empty'}>
        <div className="supplier-product-heading">
          <div>
            <Typography.Text className="eyebrow">SUPPLIER PRODUCT MATERIAL</Typography.Text>
            <Typography.Title level={2}>新建商品资料草稿</Typography.Title>
            <Typography.Paragraph>
              本页面只维护本供应商商品资料。提交公司资料审核前，草稿不会成为对客可售商品。
            </Typography.Paragraph>
          </div>
          <Tag color="cyan">{workspace.accountTypeName}</Tag>
        </div>

        {state ? (
          <Alert
            description={state.message}
            message={state.kind === 'permission' ? '无权保存' : state.kind === 'offline' ? '网络不可用' : '保存失败'}
            showIcon
            type="error"
          />
        ) : null}

        <Row gutter={[20, 20]}>
          <Col lg={16} xs={24}>
            <Card bordered={false}>
              <Form
                form={form}
                initialValues={{
                  attributes: '{"schemaVersion":"1.0"}',
                  skuAttributes: '{}',
                  templateVersion: 1,
                  enterpriseMinOrderQty: 1,
                  enterprisePackageMultiple: 1,
                  preparationMinutes: 0,
                  initialStock: 0,
                  isRetailEnabled: true,
                  isEnterpriseProcurementEnabled: false,
                }}
                layout="vertical"
                onFinish={submit}
              >
                <Row gutter={16}>
                  <Col md={16} xs={24}>
                    <Form.Item label="分类编号" name="categoryId" rules={[{ required: true, message: '请输入分类编号' }]}>
                      <Input placeholder="公司已发布分类的 UUID" />
                    </Form.Item>
                  </Col>
                  <Col md={8} xs={24}>
                    <Form.Item label="模板版本" name="templateVersion" rules={[{ required: true }]}>
                      <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col md={16} xs={24}>
                    <Form.Item label="商品名称" name="name" rules={[{ required: true, message: '请输入商品名称' }]}>
                      <Input maxLength={200} />
                    </Form.Item>
                  </Col>
                  <Col md={8} xs={24}>
                    <Form.Item label="品牌（选填）" name="brand">
                      <Input maxLength={120} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="商品属性 JSON" name="attributes" rules={[{ required: true }]}>
                  <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
                </Form.Item>
                <Form.Item
                  extra="每行一个 object://supplier-product/… 受控存储引用"
                  label="资质引用（选填）"
                  name="qualificationReferences"
                >
                  <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
                </Form.Item>
                <Space size="large" wrap>
                  <Form.Item name="isRetailEnabled" valuePropName="checked">
                    <Checkbox>进入个人零售候选</Checkbox>
                  </Form.Item>
                  <Form.Item name="isEnterpriseProcurementEnabled" valuePropName="checked">
                    <Checkbox>进入企业集采候选</Checkbox>
                  </Form.Item>
                </Space>
                <Row gutter={16}>
                  <Col md={8} xs={24}>
                    <Form.Item label="企业最小起订量" name="enterpriseMinOrderQty" rules={[{ required: true }]}>
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col md={8} xs={24}>
                    <Form.Item label="企业包装倍数" name="enterprisePackageMultiple" rules={[{ required: true }]}>
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col md={8} xs={24}>
                    <Form.Item label="备货分钟数" name="preparationMinutes" rules={[{ required: true }]}>
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Typography.Title level={4}>首个 SKU</Typography.Title>
                <Row gutter={16}>
                  <Col md={10} xs={24}>
                    <Form.Item label="供应商 SKU 编码" name="supplierSkuCode" rules={[{ required: true }]}>
                      <Input maxLength={64} />
                    </Form.Item>
                  </Col>
                  <Col md={8} xs={24}>
                    <Form.Item label="SKU 属性 JSON" name="skuAttributes" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col md={6} xs={24}>
                    <Form.Item label="初始库存" name="initialStock" rules={[{ required: true }]}>
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Button htmlType="submit" loading={submitting} size="large" type="primary">
                  保存商品资料草稿
                </Button>
              </Form>
            </Card>
          </Col>
          <Col lg={8} xs={24}>
            <Card bordered={false} className="supplier-product-result">
              {created ? (
                <Space direction="vertical" size="middle">
                  <Tag color="blue">{created.status}</Tag>
                  <Typography.Title level={3}>{created.name}</Typography.Title>
                  <Typography.Text>草稿编号：{created.id}</Typography.Text>
                  <Typography.Text>SKU：{created.skus.length} 个</Typography.Text>
                  <Alert
                    description="仅保存了上游资料，尚未生成公司 Product/Sku，也不能对客销售。"
                    message="等待后续提交资料审核"
                    showIcon
                    type="warning"
                  />
                </Space>
              ) : (
                <div data-ui-state="empty">
                  <Typography.Title level={4}>尚未保存草稿</Typography.Title>
                  <Typography.Paragraph>
                    所有归属均从当前固定职能会话派生，页面不会提交公司或供应商归属字段。
                  </Typography.Paragraph>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </section>
    </div>
  );
}
