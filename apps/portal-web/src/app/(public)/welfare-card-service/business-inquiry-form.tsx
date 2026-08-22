'use client';

import { createWebApiClient } from '@fulishe/web-api-client';
import { type FormEvent, useMemo, useState } from 'react';

interface InquiryValues {
  contactName: string;
  enterpriseName: string;
  mobile: string;
  demandSummary: string;
  consentToUse: boolean;
}

interface InquirySuccess {
  readonly leadNumber: string;
  readonly submittedAt: string;
  readonly contactExpectation: string;
  readonly modificationOrWithdrawalChannel: string;
}

declare global {
  interface Window {
    fulisheBusinessInquirySecurity?: {
      getCaptchaToken(): Promise<string>;
    };
  }
}

const pendingKeyStorage = 'fulishe.portal.business-inquiry.pending-key';
const emptyValues: InquiryValues = {
  contactName: '',
  enterpriseName: '',
  mobile: '',
  demandSummary: '',
  consentToUse: false,
};

const pendingKey = (): string => {
  const stored = sessionStorage.getItem(pendingKeyStorage);
  if (stored) return stored;
  const created = `business-inquiry-${crypto.randomUUID()}`;
  sessionStorage.setItem(pendingKeyStorage, created);
  return created;
};

export function BusinessInquiryForm() {
  const client = useMemo(() => createWebApiClient({ baseUrl: '' }), []);
  const [values, setValues] = useState<InquiryValues>(emptyValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [success, setSuccess] = useState<InquirySuccess>();

  const update = <K extends keyof InquiryValues>(key: K, value: InquiryValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const validate = (): string | undefined => {
    if (values.contactName.trim().length < 2) return '请填写联系人';
    if (values.enterpriseName.trim().length < 2) return '请填写企业名称';
    if (!/^\+?\d{8,15}$/u.test(values.mobile.replaceAll(/\s|-/gu, ''))) return '请填写有效手机号码';
    if (values.demandSummary.trim().length < 10) return '需求摘要至少填写 10 个字符';
    if (!values.consentToUse) return '请先阅读并同意隐私说明';
    return undefined;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setError(validation);
      setUncertain(false);
      return;
    }
    const security = window.fulisheBusinessInquirySecurity;
    if (!security) {
      setError('人机验证暂不可用，未发送咨询资料，请稍后重试或使用客服渠道。');
      setUncertain(false);
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const captchaToken = await security.getCaptchaToken();
      const result = await client.POST('/v1/public/business-inquiries', {
        params: {
          header: {
            'Idempotency-Key': pendingKey(),
            Origin: window.location.origin,
            'Sec-Fetch-Site': 'same-origin',
            'X-Captcha-Token': captchaToken,
          },
        },
        body: {
          contactName: values.contactName.trim(),
          enterpriseName: values.enterpriseName.trim(),
          mobile: values.mobile.replaceAll(/\s|-/gu, ''),
          demandSummary: values.demandSummary.trim(),
          consentToUse: true,
        },
      });
      if (!result.data) {
        const code = result.error && typeof result.error === 'object' && 'code' in result.error
          ? String(result.error.code)
          : '';
        if (code === 'VALIDATION_FAILED' || code === 'FIELD_FORBIDDEN') {
          setError('资料格式不正确，请检查后重新提交。');
          setUncertain(false);
          return;
        }
        if (code === 'RATE_LIMITED') {
          setError('提交过于频繁，未新增咨询，请稍后重试。');
          setUncertain(false);
          return;
        }
        setError('结果暂未确认，请使用原请求重试，系统不会重复创建咨询。');
        setUncertain(true);
        return;
      }
      sessionStorage.removeItem(pendingKeyStorage);
      setSuccess(result.data);
      setUncertain(false);
    } catch {
      setError('结果暂未确认，请使用原请求重试，系统不会重复创建咨询。');
      setUncertain(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <section className="inquiry-success" aria-live="polite" data-inquiry-success>
        <p className="eyebrow">提交结果</p>
        <h3>咨询已受理</h3>
        <strong>{success.leadNumber}</strong>
        <p>{success.contactExpectation}</p>
        <p>修改或撤回资料请联系：{success.modificationOrWithdrawalChannel}</p>
        <button className="button button--outline" onClick={() => { setSuccess(undefined); setValues(emptyValues); }} type="button">
          返回咨询表单
        </button>
      </section>
    );
  }

  return (
    <form className="inquiry-form" noValidate onSubmit={submit}>
      <div className="inquiry-form__grid">
        <label>
          <span>联系人 *</span>
          <input autoComplete="name" maxLength={64} onChange={(event) => update('contactName', event.target.value)} value={values.contactName} />
        </label>
        <label>
          <span>企业名称 *</span>
          <input autoComplete="organization" maxLength={191} onChange={(event) => update('enterpriseName', event.target.value)} value={values.enterpriseName} />
        </label>
        <label>
          <span>手机号码 *</span>
          <input autoComplete="tel" inputMode="tel" maxLength={16} onChange={(event) => update('mobile', event.target.value)} value={values.mobile} />
        </label>
        <label className="inquiry-form__wide">
          <span>需求摘要 *</span>
          <textarea maxLength={500} onChange={(event) => update('demandSummary', event.target.value)} rows={4} value={values.demandSummary} />
          <small>请说明人数范围、使用场景和希望了解的事项；不要上传证照、身份证、银行结算资料或密码。</small>
        </label>
      </div>
      <label className="inquiry-form__consent">
        <input checked={values.consentToUse} onChange={(event) => update('consentToUse', event.target.checked)} type="checkbox" />
        <span>我已阅读并同意隐私说明，授权公司仅为本次福利咨询与后续联系使用上述资料。</span>
      </label>
      {error ? <div className="form-alert" role="alert">{error}</div> : null}
      <div className="button-row">
        <button className="button" disabled={submitting} type="submit">
          {submitting ? '正在安全提交…' : uncertain ? '重试原请求' : '提交企业福利咨询'}
        </button>
        <span className="form-hint">提交只创建业务咨询，不创建福利卡账户或发放资金。</span>
      </div>
    </form>
  );
}
