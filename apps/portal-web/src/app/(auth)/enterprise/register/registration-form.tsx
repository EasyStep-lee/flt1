'use client';

import { createWebApiClient } from '@fulishe/web-api-client';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Row,
  Select,
  Steps,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';

import styles from './registration.module.css';

const { Paragraph, Text, Title } = Typography;
const credentialStorageKey = 'fulishe.enterprise.registration.credential';

interface RegistrationValues {
  readonly legalName: string;
  readonly creditCode: string;
  readonly enterpriseType: string;
  readonly registeredAddress: string;
  readonly licenseObjectKey: string;
  readonly licenseValidUntil?: string;
  readonly administratorName: string;
  readonly administratorMobile: string;
  readonly administratorEmail: string;
  readonly administratorTitle: string;
  readonly verificationCode: string;
  readonly invoiceTitle: string;
  readonly taxNumber: string;
  readonly invoiceRegisteredAddress?: string;
  readonly invoiceRegisteredPhone?: string;
  readonly bankName?: string;
  readonly bankAccount?: string;
  readonly consignee: string;
  readonly shippingMobile: string;
  readonly shippingRegion: string;
  readonly shippingAddress: string;
  readonly deliveryNote?: string;
  readonly agreementAccepted: boolean;
}

interface RegistrationCredential {
  readonly registrationId: string;
  readonly registrationAccessToken: string;
  readonly version: number;
}

const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (code === 'CREDIT_CODE_DUPLICATE') return '该统一社会信用代码已提交过认证，请联系企业管理员。';
    if (code === 'IDEMPOTENCY_CONFLICT') return '本次提交内容与已受理请求不一致，请刷新后重试。';
    if (code === 'SERVICE_UNAVAILABLE') return '手机验证或外部资料服务暂不可用，未创建认证记录。';
    if (code === 'VALIDATION_FAILED') return '资料不完整或格式不正确，请检查标红字段。';
  }
  return fallback;
};

const idempotencyKey = (scope: string): string =>
  `${scope}-${crypto.randomUUID()}`;

export function EnterpriseRegistrationForm() {
  const [form] = Form.useForm<RegistrationValues>();
  const [stage, setStage] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<
    | { readonly kind: 'error' | 'info' | 'success'; readonly text: string }
    | undefined
  >();
  const client = useMemo(
    () =>
      createWebApiClient({
        baseUrl:
          process.env.NEXT_PUBLIC_PORTAL_API_BASE_URL ??
          'http://127.0.0.1:3000',
      }),
    [],
  );

  const submit = async (values: RegistrationValues) => {
    setSubmitting(true);
    setMessage({ kind: 'info', text: '正在验证手机号并创建认证草稿…' });
    try {
      const registration = await client.POST('/v1/enterprise/registrations', {
        params: {
          header: {
            'Idempotency-Key': idempotencyKey('enterprise-register'),
          },
        },
        body: {
          legalName: values.legalName,
          creditCode: values.creditCode,
          enterpriseType: values.enterpriseType,
          registeredAddress: values.registeredAddress,
          licenseObjectKey: values.licenseObjectKey,
          ...(values.licenseValidUntil
            ? { licenseValidUntil: values.licenseValidUntil }
            : {}),
          administratorName: values.administratorName,
          administratorMobile: values.administratorMobile,
          administratorEmail: values.administratorEmail,
          administratorTitle: values.administratorTitle,
          verificationCode: values.verificationCode,
          agreementVersion: 'enterprise-procurement-v1.1',
          invoiceProfile: {
            title: values.invoiceTitle,
            taxNumber: values.taxNumber,
            ...(values.invoiceRegisteredAddress
              ? { registeredAddress: values.invoiceRegisteredAddress }
              : {}),
            ...(values.invoiceRegisteredPhone
              ? { registeredPhone: values.invoiceRegisteredPhone }
              : {}),
            ...(values.bankName ? { bankName: values.bankName } : {}),
            ...(values.bankAccount ? { bankAccount: values.bankAccount } : {}),
          },
          addresses: [
            {
              consignee: values.consignee,
              mobile: values.shippingMobile,
              region: values.shippingRegion,
              fullAddress: values.shippingAddress,
              ...(values.deliveryNote ? { deliveryNote: values.deliveryNote } : {}),
              isDefault: true,
            },
          ],
        },
      });
      if (!registration.data) {
        setMessage({
          kind: 'error',
          text: apiErrorMessage(registration.error, '认证草稿创建失败，请稍后重试。'),
        });
        return;
      }
      const credential: RegistrationCredential = {
        registrationId: registration.data.registrationId,
        registrationAccessToken: registration.data.registrationAccessToken,
        version: registration.data.version,
      };
      sessionStorage.setItem(credentialStorageKey, JSON.stringify(credential));
      setStage(3);
      setMessage({ kind: 'info', text: '认证草稿已安全保存，正在提交公司审核…' });
      const review = await client.POST(
        '/v1/enterprise/registrations/me/submit-review',
        {
          params: {
            header: {
              Authorization: `Registration ${credential.registrationAccessToken}`,
              'Idempotency-Key': idempotencyKey('enterprise-submit'),
            },
          },
          body: { version: credential.version },
        },
      );
      if (!review.data) {
        setMessage({
          kind: 'error',
          text: `${apiErrorMessage(review.error, '提交审核失败。')}草稿已保存，可稍后继续。`,
        });
        return;
      }
      sessionStorage.setItem(
        credentialStorageKey,
        JSON.stringify({ ...credential, version: review.data.version }),
      );
      setStage(4);
      setMessage({
        kind: 'success',
        text: '企业认证已提交。公司审核后可进入企业采购工作台；如需补正，将在此流程中显示。',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className={styles.page}
      data-p0="P0-028"
      data-p0-partial="P0-077"
      data-shell="enterprise-registration"
    >
      <header className={styles.header}>
        <a className={styles.brand} href="/">福礼团</a>
        <span>企业采购开户注册</span>
        <a className={styles.login} href="/enterprise/login">已有账号，去登录</a>
      </header>
      <section className={styles.hero}>
        <div>
          <Text className={styles.eyebrow!}>企业采购 · 主体认证</Text>
          <Title level={1}>一次提交，开启统一企业采购</Title>
          <Paragraph>
            企业可跨供应商选购商品，统一向江苏福礼团供应链科技有限公司结账。
            “社区集采”是普通企业采购入口，不是拼团活动。
          </Paragraph>
        </div>
        <div className={styles.promise}>
          <strong>资料仅用于企业认证</strong>
          <span>私有动态页面 · 禁止公开缓存 · 敏感字段脱敏回显</span>
        </div>
      </section>
      <section className={styles.workspace}>
        <aside className={styles.aside}>
          <Steps
            current={stage}
            direction="vertical"
            items={[
              { title: '企业主体', description: '名称、信用代码、营业执照' },
              { title: '联系人与开票', description: '管理员与发票资料' },
              { title: '收货信息', description: '企业统一配送地址' },
              { title: '提交审核', description: '公司审核或发起补正' },
              { title: '等待结果', description: '通过后进入采购工作台' },
            ]}
          />
          <div className={styles.help}>
            <strong>需要帮助？</strong>
            <a href="/contact">189****9999</a>
            <span>工作时间以公司客服公告为准</span>
          </div>
        </aside>
        <Card className={styles.card!} bordered={false}>
          <Title level={2}>企业认证资料</Title>
          <Paragraph type="secondary">带 * 的信息用于主体审核，请按证照与财务资料如实填写。</Paragraph>
          {message ? (
            <Alert
              className={styles.alert!}
              message={message.text}
              showIcon
              type={message.kind}
            />
          ) : null}
          <Form
            form={form}
            layout="vertical"
            onFinish={submit}
            onFinishFailed={() =>
              setMessage({ kind: 'error', text: '请先补全必填资料，再提交认证。' })
            }
            requiredMark="optional"
          >
            <section className={styles.group}>
              <h3>1. 企业主体与证照</h3>
              <Row gutter={18}>
                <Col xs={24} md={12}>
                  <Form.Item label="企业全称" name="legalName" rules={[{ required: true }]}>
                    <Input autoComplete="organization" placeholder="与营业执照一致" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="统一社会信用代码"
                    name="creditCode"
                    rules={[{ len: 18, required: true }]}
                  >
                    <Input maxLength={18} placeholder="18 位代码" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="企业类型" name="enterpriseType" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { label: '有限责任公司', value: 'LIMITED_COMPANY' },
                        { label: '股份有限公司', value: 'JOINT_STOCK_COMPANY' },
                        { label: '事业单位/社会组织', value: 'INSTITUTION' },
                        { label: '其他企业主体', value: 'OTHER_ENTERPRISE' },
                      ]}
                      placeholder="请选择"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="证照有效期" name="licenseValidUntil">
                    <Input type="date" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="注册地址" name="registeredAddress" rules={[{ required: true }]}>
                    <Input placeholder="省市区及详细地址" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    extra="该引用由公司配置的受控对象存储上传服务返回；请勿填写本地路径、公开网盘或营业执照原件内容。"
                    label="营业执照受控存储引用"
                    name="licenseObjectKey"
                    rules={[
                      { required: true },
                      { pattern: /^object:\/\/enterprise-certification\//u, message: '请输入受控上传服务返回的引用' },
                    ]}
                  >
                    <Input placeholder="object://enterprise-certification/…" />
                  </Form.Item>
                </Col>
              </Row>
            </section>

            <section className={styles.group}>
              <h3>2. 企业管理员与开票资料</h3>
              <Row gutter={18}>
                <Col xs={24} md={12}>
                  <Form.Item label="管理员姓名" name="administratorName" rules={[{ required: true }]}>
                    <Input autoComplete="name" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="职务" name="administratorTitle" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="管理员手机" name="administratorMobile" rules={[{ required: true }]}>
                    <Input autoComplete="tel" maxLength={16} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="短信验证码" name="verificationCode" rules={[{ required: true }]}>
                    <Input autoComplete="one-time-code" maxLength={8} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="管理员邮箱" name="administratorEmail" rules={[{ required: true, type: 'email' }]}>
                    <Input autoComplete="email" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="发票抬头" name="invoiceTitle" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="纳税人识别号" name="taxNumber" rules={[{ required: true }]}>
                    <Input maxLength={32} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="注册电话" name="invoiceRegisteredPhone"><Input /></Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="开户行" name="bankName"><Input /></Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="发票注册地址" name="invoiceRegisteredAddress"><Input /></Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item extra="仅传输给认证接口，页面不会公开展示完整账号。" label="银行账号" name="bankAccount">
                    <Input autoComplete="off" inputMode="numeric" />
                  </Form.Item>
                </Col>
              </Row>
            </section>

            <section className={styles.group}>
              <h3>3. 默认收货信息</h3>
              <Row gutter={18}>
                <Col xs={24} md={12}>
                  <Form.Item label="收货人" name="consignee" rules={[{ required: true }]}><Input /></Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="收货手机" name="shippingMobile" rules={[{ required: true }]}><Input /></Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="省市区" name="shippingRegion" rules={[{ required: true }]}><Input /></Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="详细地址" name="shippingAddress" rules={[{ required: true }]}><Input /></Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="配送备注" name="deliveryNote"><Input.TextArea rows={2} /></Form.Item>
                </Col>
              </Row>
            </section>

            <Form.Item
              name="agreementAccepted"
              rules={[{ transform: (value) => (value ? value : undefined), required: true, message: '请确认协议与隐私说明' }]}
              valuePropName="checked"
            >
              <Checkbox>我已阅读并同意企业采购协议与隐私说明，确认资料真实有效。</Checkbox>
            </Form.Item>
            <div className={styles.actions}>
              <Button htmlType="submit" loading={submitting} size="large" type="primary">
                保存并提交公司审核
              </Button>
              <Text type="secondary">同一自然人不能切换账号自审；审核通过前不会开放交易工作台。</Text>
            </div>
          </Form>
        </Card>
      </section>
    </main>
  );
}
