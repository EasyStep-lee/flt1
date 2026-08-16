import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ShellFrame } from '@fulishe/ui';
import type { components } from '@fulishe/contracts';

import { createSupplierPortalApiClient } from './api-client.js';
import {
  SupplierAccountSelectPage,
  SupplierLoginPage,
} from './supplier-auth-pages.js';
import { supplierSessionBoundary } from './session-boundary.js';
import {
  SupplierWorkspaceGate,
  type SupplierWorkspace,
} from './supplier-workspace-pages.js';
import { SupplierProductsPage } from './supplier-products-page.js';
import { SupplierPricingPage } from './supplier-pricing-page.js';
import { SupplierInventoryPage } from './supplier-inventory-page.js';
import { SupplierFulfillmentPage } from './supplier-fulfillment-page.js';

type RegistrationResponse = components['schemas']['SupplierRegistrationResponseDto'];
type SupplierStatus = RegistrationResponse['status'];
type FunctionalAccount = components['schemas']['FunctionalAccountResponseDto'];
type CreateFunctionalAccount = components['schemas']['CreateFunctionalAccountRequestDto'];
type AuditEvent = components['schemas']['AuditEventResponseDto'];
type SensitiveApproval = components['schemas']['SensitiveApprovalTaskResponseDto'];

interface RegistrationFormValues {
  readonly legalName: string;
  readonly creditCode: string;
  readonly contactName: string;
  readonly mobile: string;
  readonly email?: string;
  readonly verificationCode: string;
  readonly qualificationReferences?: string;
  readonly pickupAddress?: string;
  readonly pickupLat?: number;
  readonly pickupLng?: number;
  readonly agreementVersion: string;
}

const api = createSupplierPortalApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const statusMeta: Record<SupplierStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING_REVIEW: { label: '待审核', color: 'processing' },
  CORRECTION_REQUIRED: { label: '待补正', color: 'warning' },
  ACTIVE: { label: '已启用', color: 'success' },
  SUSPENDED: { label: '已停用', color: 'error' },
  EXITING: { label: '退出处理中', color: 'orange' },
  EXITED: { label: '已退出', color: 'default' },
};

const functionalAccountTypes = [
  ['SUPPLIER_ACCOUNT_ADMIN', '主体管理'],
  ['SUPPLIER_PRODUCT', '商品运营'],
  ['SUPPLIER_PRICING', '价格管理'],
  ['SUPPLIER_INVENTORY', '库存/仓库'],
  ['SUPPLIER_FULFILLMENT', '订单履约'],
  ['SUPPLIER_AFTERSALES', '售后'],
  ['SUPPLIER_FINANCE', '财务对账'],
  ['SUPPLIER_AUDIT', '只读审计'],
] as const;

const readErrorMessage = (value: unknown): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '申请暂未保存，请检查资料后重试。';
};

function SupplierStatusLegend() {
  return (
    <div className="status-legend" data-testid="supplier-status-legend">
      {(['DRAFT', 'PENDING_REVIEW', 'CORRECTION_REQUIRED', 'ACTIVE'] as const).map(
        (status) => (
          <div className="status-step" key={status}>
            <span className="status-dot" />
            <div>
              <strong>{statusMeta[status].label}</strong>
              <small>{status}</small>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function SupplierRegistrationPage() {
  const [form] = Form.useForm<RegistrationFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegistrationResponse>();
  const [error, setError] = useState<{ kind: 'error' | 'offline' | 'permission'; message: string }>();

  const submit = async (values: RegistrationFormValues) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const qualificationFiles = (values.qualificationReferences ?? '')
        .split(/\r?\n/u)
        .map((value) => value.trim())
        .filter(Boolean);
      const response = await api.POST('/v1/suppliers/registrations', {
        params: { header: { 'Idempotency-Key': crypto.randomUUID() } },
        body: {
          legalName: values.legalName,
          creditCode: values.creditCode,
          contactName: values.contactName,
          mobile: values.mobile,
          ...(values.email ? { email: values.email } : {}),
          verificationCode: values.verificationCode,
          qualificationFiles,
          pickupAddress: values.pickupAddress ?? null,
          pickupLat: values.pickupLat ?? null,
          pickupLng: values.pickupLng ?? null,
          agreementVersion: values.agreementVersion,
        },
      });
      if (!response.data) {
        const kind =
          response.response.status === 401 || response.response.status === 403
            ? 'permission'
            : 'error';
        setError({ kind, message: readErrorMessage(response.error) });
        return;
      }
      setResult(response.data);
    } catch {
      setError({ kind: 'offline', message: '网络连接超时或已离线，请恢复网络后重试。' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="onboarding-page" data-page-id="PAGE-013" data-route="/supplier/register">
      <header className="brand-header">
        <div className="brand-mark">福</div>
        <div>
          <strong>福礼社</strong>
          <span>供应商合作中心</span>
        </div>
        <Tag color="cyan">江苏福礼团供应链科技有限公司</Tag>
      </header>

      <section className="registration-hero">
        <div>
          <Typography.Text className="eyebrow">SUPPLIER ONBOARDING</Typography.Text>
          <Typography.Title level={1}>供应商入驻申请</Typography.Title>
          <Typography.Paragraph>
            一次登记主体、资质与取货点。公司审核通过后，再由主体管理职能账号进入独立后台。
          </Typography.Paragraph>
        </div>
        <SupplierStatusLegend />
      </section>

      <div className="registration-layout">
        <Card className="form-card" bordered={false}>
          <div className="section-heading">
            <span>01</span>
            <div>
              <h2>主体与联系人</h2>
              <p>带 * 内容用于主体核验，系统不会在申请结果中回显验证码和联系方式。</p>
            </div>
          </div>
          <Form
            form={form}
            layout="vertical"
            initialValues={{ agreementVersion: 'supplier-agreement-v1.1' }}
            onFinish={submit}
            requiredMark="optional"
          >
            <Row gutter={18}>
              <Col md={12} xs={24}>
                <Form.Item label="企业名称" name="legalName" rules={[{ required: true, message: '请输入企业名称' }]}>
                  <Input maxLength={128} placeholder="营业执照上的企业全称" />
                </Form.Item>
              </Col>
              <Col md={12} xs={24}>
                <Form.Item label="统一社会信用代码" name="creditCode" rules={[{ required: true, message: '请输入统一社会信用代码' }]}>
                  <Input maxLength={18} placeholder="18 位代码" />
                </Form.Item>
              </Col>
              <Col md={8} xs={24}>
                <Form.Item label="联系人" name="contactName" rules={[{ required: true, message: '请输入联系人' }]}>
                  <Input maxLength={128} />
                </Form.Item>
              </Col>
              <Col md={8} xs={24}>
                <Form.Item label="手机号" name="mobile" rules={[{ required: true, message: '请输入手机号' }]}>
                  <Input inputMode="tel" maxLength={16} />
                </Form.Item>
              </Col>
              <Col md={8} xs={24}>
                <Form.Item label="验证码" name="verificationCode" rules={[{ required: true, message: '请输入验证码' }]}>
                  <Input inputMode="numeric" maxLength={8} />
                </Form.Item>
              </Col>
              <Col md={12} xs={24}>
                <Form.Item label="联系邮箱（选填）" name="email">
                  <Input type="email" />
                </Form.Item>
              </Col>
              <Col md={12} xs={24}>
                <Form.Item label="协议版本" name="agreementVersion" rules={[{ required: true }]}>
                  <Input readOnly />
                </Form.Item>
              </Col>
            </Row>

            <Divider />
            <div className="section-heading">
              <span>02</span>
              <div>
                <h2>资质与取货点</h2>
                <p>可以先保存草稿；提交审核前必须补齐至少一项资质引用和完整取货点。</p>
              </div>
            </div>
            <Form.Item
              extra="每行一个已上传到受控存储的 object://supplier-qualification/… 引用"
              label="资质文件引用"
              name="qualificationReferences"
            >
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
            </Form.Item>
            <Form.Item label="取货地址" name="pickupAddress">
              <Input maxLength={500} placeholder="详细到可交接货物的位置" />
            </Form.Item>
            <Row gutter={18}>
              <Col md={12} xs={24}>
                <Form.Item label="取货点纬度" name="pickupLat">
                  <InputNumber max={90} min={-90} precision={7} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col md={12} xs={24}>
                <Form.Item label="取货点经度" name="pickupLng">
                  <InputNumber max={180} min={-180} precision={7} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {error ? (
              <Alert
                className="form-alert"
                description={error.message}
                message={error.kind === 'offline' ? '网络不可用' : error.kind === 'permission' ? '无权操作' : '保存失败'}
                showIcon
                type="error"
              />
            ) : null}

            <Button block htmlType="submit" loading={submitting} size="large" type="primary">
              保存入驻申请
            </Button>
          </Form>
        </Card>

        <aside>
          {result ? (
            <Card className="result-card" bordered={false} data-ui-state="success">
              <Typography.Text className="eyebrow">申请已安全保存</Typography.Text>
              <Typography.Title level={3}>{statusMeta[result.status].label}</Typography.Title>
              <Tag color={statusMeta[result.status].color}>{result.status}</Tag>
              <dl>
                <dt>申请编号</dt>
                <dd>{result.registrationId}</dd>
                <dt>下一步</dt>
                <dd>继续补齐资料并提交公司审核</dd>
              </dl>
              <Alert
                description="草稿或审核进度不等同于供应商业务登录权限。审核通过后按通知完成账号激活。"
                message="边界提示"
                showIcon
                type="warning"
              />
            </Card>
          ) : (
            <Card className="help-card" bordered={false} data-ui-state="empty">
              <Typography.Title level={4}>入驻说明</Typography.Title>
              <Space direction="vertical" size="middle">
                <p>1. 主体代码经标准化后全平台唯一。</p>
                <p>2. 不完整资料可先存为草稿，不会被自动判定合规。</p>
                <p>3. 公司供应商运营人员审核后，可要求补正或批准启用。</p>
              </Space>
              <Divider />
              <Typography.Text type="secondary">
                已有账号？<Typography.Link href="/supplier/login">从供应商独立登录入口进入</Typography.Link>。
              </Typography.Text>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}

type InviteAccountFormValues = CreateFunctionalAccount;

function SupplierFunctionalAccountsPage() {
  const [form] = Form.useForm<InviteAccountFormValues>();
  const [accounts, setAccounts] = useState<readonly FunctionalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'success' | 'error' | 'permission' | 'offline'>('success');
  const [message, setMessage] = useState('');

  const loadAccounts = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await api.GET('/v1/{ownerType}/functional-accounts', {
        params: {
          path: { ownerType: 'supplier' },
          query: { page: 1, pageSize: 20 },
        },
      });
      if (!response.data) {
        const permission = response.response.status === 401 || response.response.status === 403;
        setState(permission ? 'permission' : 'error');
        setMessage(readErrorMessage(response.error));
        return;
      }
      setAccounts(response.data.items);
      setState('success');
    } catch {
      setState('offline');
      setMessage('网络连接超时或已离线，请恢复网络后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const invite = async (values: InviteAccountFormValues) => {
    setSubmitting(true);
    try {
      const response = await api.POST('/v1/{ownerType}/functional-accounts', {
        params: {
          path: { ownerType: 'supplier' },
          header: { 'Idempotency-Key': crypto.randomUUID() },
        },
        body: values,
      });
      if (!response.data) {
        const code =
          response.error && typeof response.error === 'object' && 'code' in response.error
            ? response.error.code
            : undefined;
        setMessage(
          code === 'SECOND_VERIFICATION_REQUIRED'
            ? '该账号变更必须先完成二次验证。'
            : readErrorMessage(response.error),
        );
        return;
      }
      setAccounts((current) => [...current, response.data as FunctionalAccount]);
      setOpen(false);
      form.resetFields();
      setState('success');
      setMessage('邀请已创建，账号等待独立激活。');
    } catch {
      setState('offline');
      setMessage('网络连接超时或已离线，请恢复网络后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="functional-account-page" data-page-id="PAGE-024" data-route="/supplier/workspaces/account-admin/accounts">
      <div className="functional-account-header">
        <div>
          <Typography.Text className="eyebrow">ACCOUNT SECURITY</Typography.Text>
          <Typography.Title level={1}>职能账号管理</Typography.Title>
          <Typography.Paragraph>
            八类职能账号相互隔离；邀请时由服务端绑定供应商、自然人身份和固定工作区。
          </Typography.Paragraph>
        </div>
        <Button onClick={() => setOpen(true)} type="primary">邀请职能账号</Button>
      </div>

      {message ? (
        <Alert
          className="form-alert"
          message={state === 'permission' ? '无权操作' : state === 'offline' ? '网络不可用' : '账号管理提示'}
          description={message}
          showIcon
          type={state === 'success' ? 'success' : 'error'}
        />
      ) : null}

      <Card bordered={false} loading={loading} data-ui-state={loading ? 'loading' : accounts.length === 0 ? 'empty' : state}>
        <Table
          dataSource={[...accounts]}
          locale={{ emptyText: '当前没有可显示的职能账号' }}
          pagination={false}
          rowKey="id"
          columns={[
            { title: '姓名', dataIndex: 'displayName' },
            { title: '职能类型', dataIndex: 'accountTypeName' },
            { title: '固定工作区', dataIndex: 'workspaceRoute' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status: FunctionalAccount['status']) => <Tag>{status}</Tag>,
            },
          ]}
        />
      </Card>

      <Modal
        destroyOnHidden
        footer={null}
        onCancel={() => setOpen(false)}
        open={open}
        title="邀请职能账号"
      >
        <Form form={form} layout="vertical" onFinish={invite} requiredMark="optional">
          <Form.Item label="职能类型" name="accountTypeCode" rules={[{ required: true }]}>
            <Select
              options={functionalAccountTypes.map(([value, label]) => ({ label, value }))}
            />
          </Form.Item>
          <Form.Item label="姓名" name="inviteeName" rules={[{ required: true }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item label="手机号" name="inviteeMobile" rules={[{ required: true }]}>
            <Input maxLength={16} />
          </Form.Item>
          <Form.Item label="邮箱（选填）" name="inviteeEmail">
            <Input maxLength={254} type="email" />
          </Form.Item>
          <Form.Item label="二次验证码" name="secondVerificationCode" rules={[{ required: true }]}>
            <Input maxLength={8} />
          </Form.Item>
          <Button block htmlType="submit" loading={submitting} type="primary">确认邀请</Button>
        </Form>
      </Modal>
    </main>
  );
}

function SupplierAuditPage({ workspace }: { readonly workspace: SupplierWorkspace }) {
  const [events, setEvents] = useState<readonly AuditEvent[]>([]);
  const [approvals, setApprovals] = useState<readonly SensitiveApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [auditResponse, approvalResponse] = await Promise.all([
        api.GET('/v1/audit/events', { params: { query: { page: 1, pageSize: 20 } } }),
        api.GET('/v1/audit/sensitive-export-approvals'),
      ]);
      if (!auditResponse.data || !approvalResponse.data) {
        setMessage(
          readErrorMessage(auditResponse.error ?? approvalResponse.error),
        );
        return;
      }
      setEvents(auditResponse.data.items);
      setApprovals(approvalResponse.data.items);
    } catch {
      setMessage('网络离线或请求超时，请恢复后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const requestApproval = async () => {
    if (reason.trim().length < 2) return;
    setLoading(true);
    setMessage('');
    try {
      const response = await api.POST('/v1/audit/sensitive-export-approvals', {
        params: { header: { 'Idempotency-Key': crypto.randomUUID() } },
        body: { reason: reason.trim(), resource: 'AUDIT_EVENTS' },
      });
      if (!response.data) {
        setMessage(readErrorMessage(response.error));
        return;
      }
      setReason('');
      setMessage('申请已提交公司审计职能复核；不会在 M1 生成导出文件。');
      await load();
    } catch {
      setMessage('申请结果未知，请先重新加载任务列表。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="functional-account-page"
      data-page-id="PAGE-023"
      data-role={workspace.accountTypeCode}
      data-route="/supplier/workspaces/audit"
    >
      <div
        className="functional-account-header"
        data-supplier-workspace-page
        data-workspace-role={workspace.accountTypeCode}
      >
        <div>
          <Typography.Text className="eyebrow">SUPPLIER AUDIT</Typography.Text>
          <Typography.Title level={1}>本供应商操作审计</Typography.Title>
          <Typography.Paragraph>
            服务端先按当前会话 supplierId 限定范围；页面只读展示脱敏事件和本方审批申请。
          </Typography.Paragraph>
        </div>
        <Space>
          <div className="supplier-active-menu" data-workspace-menu>
            {workspace.menuItems[0]?.label}
          </div>
          <Button onClick={() => void load()}>刷新记录</Button>
        </Space>
      </div>
      {message ? <Alert description={message} message="审计提示" showIcon type="info" /> : null}
      <Card bordered={false} data-supplier-audit-state={loading ? 'loading' : events.length ? 'success' : 'empty'}>
        <Table<AuditEvent>
          dataSource={[...events]}
          loading={loading}
          locale={{ emptyText: '本供应商暂无审计事件' }}
          pagination={false}
          rowKey="id"
          columns={[
            { title: '时间', dataIndex: 'occurredAt' },
            { title: '动作', dataIndex: 'action' },
            { title: '对象类型', dataIndex: 'objectType' },
            { title: '请求编号', dataIndex: 'requestId' },
          ]}
        />
      </Card>
      <Card bordered={false} title="敏感操作审批申请（不生成文件）">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space.Compact block>
            <Input
              aria-label="供应商敏感导出申请理由"
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="填写审计事件导出申请理由"
              value={reason}
            />
            <Button
              disabled={reason.trim().length < 2}
              loading={loading}
              onClick={() => void requestApproval()}
              type="primary"
            >
              提交复核
            </Button>
          </Space.Compact>
          <Table<SensitiveApproval>
            dataSource={[...approvals]}
            loading={loading}
            locale={{ emptyText: '本供应商暂无审批申请' }}
            pagination={false}
            rowKey="id"
            columns={[
              { title: '资源', dataIndex: 'resource' },
              { title: '状态', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
              { title: '版本', dataIndex: 'version' },
              { title: '复核意见', dataIndex: 'reviewOpinion', render: (value: string | null) => value ?? '—' },
            ]}
          />
        </Space>
      </Card>
    </main>
  );
}

export function SupplierPortalShell() {
  const currentPath = window.location.pathname;
  if (currentPath === supplierSessionBoundary.registerRoute) {
    return <SupplierRegistrationPage />;
  }
  if (currentPath === supplierSessionBoundary.loginRoute) {
    return <SupplierLoginPage />;
  }
  if (currentPath === supplierSessionBoundary.accountSelectRoute) {
    return <SupplierAccountSelectPage />;
  }
  if (currentPath === '/supplier/workspaces/account-admin/accounts') {
    return (
      <SupplierWorkspaceGate
        content={() => <SupplierFunctionalAccountsPage />}
        route="/supplier/workspaces/account-admin"
      />
    );
  }
  if (currentPath.startsWith(supplierSessionBoundary.workspaceRoutePrefix)) {
    return (
      <SupplierWorkspaceGate
        content={
          currentPath === '/supplier/workspaces/audit'
            ? (workspace) => <SupplierAuditPage workspace={workspace} />
            : currentPath === '/supplier/workspaces/products'
              ? (workspace) => <SupplierProductsPage workspace={workspace} />
              : currentPath === '/supplier/workspaces/pricing'
                ? (workspace) => <SupplierPricingPage workspace={workspace} />
                : currentPath === '/supplier/workspaces/inventory'
                  ? (workspace) => <SupplierInventoryPage workspace={workspace} />
                  : currentPath === '/supplier/workspaces/fulfillment'
                    ? (workspace) => <SupplierFulfillmentPage workspace={workspace} />
              : undefined
        }
        route={currentPath}
      />
    );
  }

  return (
    <ShellFrame
      audience="供应商固定职能账号"
      boundary="本供应商、单职能 workspaceRoute 与独立会话"
      shellId="supplier-portal-shell"
      title="供应商管理后台"
    >
      <Space direction="vertical" size="middle" style={{ marginTop: 24, width: '100%' }}>
        <Alert
          message="壳层已就绪"
          description="登录、商品、库存、履约、售后、财务等业务页面按后续任务逐项实现。"
          showIcon
          type="info"
        />
        <Typography.Text>
          当前路径：<Typography.Text code>{currentPath}</Typography.Text>
        </Typography.Text>
      </Space>
    </ShellFrame>
  );
}
