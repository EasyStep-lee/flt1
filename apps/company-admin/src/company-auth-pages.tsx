import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';
import { ACCOUNT_SELECT_ROUTE } from './session-boundary.js';

type WorkspaceChoiceResponse = components['schemas']['WorkspaceChoiceResponseDto'];
type WorkspaceChoice = components['schemas']['WorkspaceChoiceDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');
const pendingSelectionKey = 'fulishe:company-admin:pending-selection';

const readError = (value: unknown, fallback: string): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

const persistSelection = (choice: WorkspaceChoiceResponse): void => {
  sessionStorage.setItem(pendingSelectionKey, JSON.stringify(choice));
};

const readSelection = (): WorkspaceChoiceResponse | null => {
  const stored = sessionStorage.getItem(pendingSelectionKey);
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as WorkspaceChoiceResponse;
    return value.selectionRequired && value.selectionNonce ? value : null;
  } catch {
    return null;
  }
};

export function CompanyLoginPage() {
  const [loginAccount, setLoginAccount] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [rememberAccount, setRememberAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ kind: 'error' | 'offline'; message: string }>();

  const submit = async () => {
    if (!loginAccount.trim() || !password) {
      setError({ kind: 'error', message: '请输入账号或手机号和密码。' });
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const response = await api.POST('/v1/company-auth/login', {
        body: {
          loginAccount: loginAccount.trim(),
          password,
          requestId: crypto.randomUUID(),
          ...(verificationCode.trim() ? { verificationCode: verificationCode.trim() } : {}),
        },
      });
      if (!response.data) {
        setError({
          kind: 'error',
          message: readError(response.error, '账号或凭证不正确'),
        });
        return;
      }
      if (rememberAccount) localStorage.setItem('fulishe:company-admin:login-account', loginAccount);
      if (response.data.selectionRequired) {
        persistSelection(response.data);
        window.location.assign(ACCOUNT_SELECT_ROUTE);
        return;
      }
      const route = response.data.accounts[0]?.workspaceRoute;
      if (!route) {
        setError({ kind: 'error', message: '当前没有可进入的职能页面，请联系超级管理员。' });
        return;
      }
      window.location.assign(route);
    } catch {
      setError({ kind: 'offline', message: '网络离线或请求超时，请恢复网络后重试。' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="company-auth-page login-page" data-page-id="PAGE-001">
      <section className="auth-brand-panel">
        <div className="auth-logo">福</div>
        <Typography.Text className="auth-eyebrow">FULISHE COMPANY CONSOLE</Typography.Text>
        <Typography.Title>公司管理后台</Typography.Title>
        <Typography.Paragraph>
          江苏福礼团供应链科技有限公司职能账号专用入口
        </Typography.Paragraph>
        <div className="auth-boundary">
          <strong>独立入口</strong>
          <span>不开放公众注册 · 每次仅进入一个固定职能页面</span>
        </div>
      </section>
      <section className="auth-form-panel">
        <Card className="auth-card" variant="borderless">
          <Tag color="cyan">公司职能账号</Tag>
          <Typography.Title level={2}>欢迎登录</Typography.Title>
          <Typography.Paragraph type="secondary">
            使用已邀请并启用的账号。系统不会确认某个账号是否存在。
          </Typography.Paragraph>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            {error ? (
              <Alert
                message={error.kind === 'offline' ? '网络不可用' : '登录失败'}
                description={error.message}
                showIcon
                type="error"
              />
            ) : null}
            <label className="auth-field">
              <span>账号或手机号</span>
              <Input
                autoComplete="username"
                maxLength={254}
                onChange={(event) => setLoginAccount(event.target.value)}
                placeholder="请输入账号或手机号"
                value={loginAccount}
              />
            </label>
            <label className="auth-field">
              <span>密码</span>
              <Input.Password
                autoComplete="current-password"
                maxLength={256}
                onChange={(event) => setPassword(event.target.value)}
                onPressEnter={() => void submit()}
                placeholder="请输入密码"
                value={password}
              />
            </label>
            <label className="auth-field">
              <span>安全验证码（风险校验时填写）</span>
              <Input
                autoComplete="one-time-code"
                maxLength={16}
                onChange={(event) => setVerificationCode(event.target.value)}
                placeholder="选填"
                value={verificationCode}
              />
            </label>
            <div className="auth-form-options">
              <Checkbox
                checked={rememberAccount}
                onChange={(event) => setRememberAccount(event.target.checked)}
              >
                仅记住账号
              </Checkbox>
              <Typography.Link href="mailto:support@fulishe.invalid">忘记密码 / 联系支持</Typography.Link>
            </div>
            <Button block loading={loading} onClick={() => void submit()} size="large" type="primary">
              安全登录
            </Button>
          </Space>
          <Typography.Text className="auth-footnote" type="secondary">
            会话通过 Secure、HttpOnly Cookie 签发，页面不接收或保存原始会话令牌。
          </Typography.Text>
        </Card>
      </section>
    </main>
  );
}

const accountStatus = (account: WorkspaceChoice): { color: string; label: string } => {
  if (account.status === 'ACTIVE') return { color: 'success', label: '正常' };
  if (account.status === 'SUSPENDED') return { color: 'warning', label: '已停用' };
  if (account.status === 'REVOKED') return { color: 'default', label: '已撤销' };
  return { color: 'processing', label: '待激活' };
};

export function CompanyAccountSelectPage() {
  const [choice] = useState(readSelection);
  const [selecting, setSelecting] = useState<string>();
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<{ kind: 'error' | 'offline' | 'permission'; message: string }>();

  const select = async (account: WorkspaceChoice) => {
    if (!choice) return;
    setSelecting(account.accountId);
    setError(undefined);
    try {
      const response = await api.POST('/v1/company-auth/workspaces/{accountId}/select', {
        params: { path: { accountId: account.accountId } },
        body: {
          selectionNonce: choice.selectionNonce,
          ...(verificationCode.trim()
            ? { secondVerificationCode: verificationCode.trim() }
            : {}),
        },
      });
      if (!response.data) {
        const permission = response.response.status === 403 || response.response.status === 428;
        setError({
          kind: permission ? 'permission' : 'error',
          message: readError(response.error, '职能账号暂时无法进入。'),
        });
        return;
      }
      sessionStorage.removeItem(pendingSelectionKey);
      window.location.assign(response.data.workspaceRoute);
    } catch {
      setError({ kind: 'offline', message: '网络离线或请求超时，请恢复网络后重试。' });
    } finally {
      setSelecting(undefined);
    }
  };

  if (!choice) {
    return (
      <main className="company-auth-page select-page" data-page-id="PAGE-002">
        <Card className="selection-empty" variant="borderless">
          <Typography.Title level={2}>职能账号选择已失效</Typography.Title>
          <Typography.Paragraph>请返回公司后台重新登录。</Typography.Paragraph>
          <Button href="/company-admin/login" type="primary">返回登录</Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="company-auth-page select-page" data-page-id="PAGE-002">
      <header className="selection-hero">
        <div>
          <Typography.Text className="auth-eyebrow">FIXED FUNCTIONAL WORKSPACE</Typography.Text>
          <Typography.Title>选择职能账号</Typography.Title>
          <Typography.Paragraph>每次只激活一个固定职能页面</Typography.Paragraph>
        </div>
        <Tag color="cyan">江苏福礼团供应链科技有限公司</Tag>
      </header>
      <section className="selection-content">
        {error ? (
          <Alert
            message={
              error.kind === 'offline'
                ? '网络不可用'
                : error.kind === 'permission'
                  ? '职能账号不可进入'
                  : '选择失败'
            }
            description={error.message}
            showIcon
            type="error"
          />
        ) : null}
        <label className="auth-field second-check-field">
          <span>二次验证码（系统要求时填写）</span>
          <Input
            autoComplete="one-time-code"
            maxLength={16}
            onChange={(event) => setVerificationCode(event.target.value)}
            placeholder="选填"
            value={verificationCode}
          />
        </label>
        {choice.accounts.length === 0 ? (
          <Card variant="borderless">
            <Typography.Title level={3}>暂无可用职能账号</Typography.Title>
            <Typography.Paragraph>请联系超级管理员完成职能账号配置。</Typography.Paragraph>
          </Card>
        ) : (
          <div className="account-choice-list">
            {choice.accounts.map((account) => {
              const meta = accountStatus(account);
              const disabled = account.status !== 'ACTIVE';
              return (
                <button
                  className="account-choice"
                  disabled={disabled || Boolean(selecting)}
                  key={account.accountId}
                  onClick={() => void select(account)}
                  type="button"
                >
                  <div>
                    <strong>{account.accountTypeName}</strong>
                    <span>{account.ownerDisplayName}</span>
                    <small>
                      {account.lastUsedAt
                        ? `最近使用 ${new Date(account.lastUsedAt).toLocaleString('zh-CN')}`
                        : '尚无使用记录'}
                    </small>
                  </div>
                  <Space>
                    {selecting === account.accountId ? <Spin size="small" /> : null}
                    <Tag color={meta.color}>{meta.label}</Tag>
                  </Space>
                </button>
              );
            })}
          </div>
        )}
        <Typography.Text className="selection-note" type="secondary">
          账号和路由均由服务端授权列表提供，不支持手工选择主体或账号类型。
        </Typography.Text>
      </section>
    </main>
  );
}
