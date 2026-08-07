import { useState } from 'react';
import { Alert, Button, Card, Input, Space, Spin, Tag, Typography } from 'antd';
import type { components } from '@fulishe/contracts';

import { createSupplierPortalApiClient } from './api-client.js';
import { ACCOUNT_SELECT_ROUTE, LOGIN_ROUTE } from './session-boundary.js';

type WorkspaceChoiceResponse =
  components['schemas']['SupplierWorkspaceChoiceResponseDto'];
type WorkspaceChoice = components['schemas']['SupplierWorkspaceChoiceDto'];

const api = createSupplierPortalApiClient(import.meta.env.VITE_API_BASE_URL ?? '');
const pendingSelectionKey = 'fulishe:supplier-portal:pending-selection';

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

export function SupplierLoginPage() {
  const [loginAccount, setLoginAccount] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{
    kind: 'error' | 'offline' | 'permission';
    message: string;
  }>();

  const submit = async () => {
    if (!loginAccount.trim() || !password) {
      setError({ kind: 'error', message: '请输入账号或手机号和密码。' });
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const response = await api.POST('/v1/supplier-auth/login', {
        body: {
          loginAccount: loginAccount.trim(),
          password,
          requestId: crypto.randomUUID(),
          ...(verificationCode.trim()
            ? { verificationCode: verificationCode.trim() }
            : {}),
        },
      });
      if (!response.data) {
        setError({
          kind:
            response.response.status === 403 || response.response.status === 428
              ? 'permission'
              : 'error',
          message: readError(response.error, '账号或凭证不正确'),
        });
        return;
      }
      if (response.data.selectionRequired) {
        persistSelection(response.data);
        window.location.assign(response.data.accountSelectRoute);
        return;
      }
      const route = response.data.accounts.find(
        (account) => account.status === 'ACTIVE',
      )?.workspaceRoute;
      if (!route) {
        setError({ kind: 'permission', message: '当前没有可进入的职能页面，请联系主体管理员。' });
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
    <main className="supplier-auth-page login-page" data-page-id="PAGE-014" data-route={LOGIN_ROUTE}>
      <section className="auth-brand-panel">
        <div className="auth-logo">福</div>
        <Typography.Text className="auth-eyebrow">FULISHE SUPPLIER CONSOLE</Typography.Text>
        <Typography.Title>供应商管理后台</Typography.Title>
        <Typography.Paragraph>
          已通过江苏福礼团供应链科技有限公司审核的供应商职能账号入口
        </Typography.Paragraph>
        <div className="auth-boundary">
          <strong>供应商不是店铺</strong>
          <span>每次仅进入一个固定职能页面 · 归属由服务端会话绑定</span>
        </div>
      </section>
      <section className="auth-form-panel">
        <Card className="auth-card" variant="borderless">
          <Tag color="cyan">供应商职能账号</Tag>
          <Typography.Title level={2}>欢迎登录</Typography.Title>
          <Typography.Paragraph type="secondary">
            使用已启用账号。系统不会通过错误信息确认某个账号是否存在。
          </Typography.Paragraph>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            {error ? (
              <Alert
                description={error.message}
                message={
                  error.kind === 'offline'
                    ? '网络不可用'
                    : error.kind === 'permission'
                      ? '账号或供应商不可用'
                      : '登录失败'
                }
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
            <Button block loading={loading} onClick={() => void submit()} size="large" type="primary">
              安全登录
            </Button>
          </Space>
          <div className="auth-links">
            <Typography.Link href="/supplier/register">申请成为供应商</Typography.Link>
            <Typography.Link href="mailto:support@fulishe.invalid">忘记密码 / 联系支持</Typography.Link>
          </div>
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

export function SupplierAccountSelectPage() {
  const [choice] = useState(readSelection);
  const [selecting, setSelecting] = useState<string>();
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<{
    kind: 'error' | 'offline' | 'permission';
    message: string;
  }>();

  const select = async (account: WorkspaceChoice) => {
    if (!choice) return;
    setSelecting(account.accountId);
    setError(undefined);
    try {
      const response = await api.POST(
        '/v1/supplier-auth/workspaces/{accountId}/select',
        {
          params: { path: { accountId: account.accountId } },
          body: {
            selectionNonce: choice.selectionNonce,
            ...(verificationCode.trim()
              ? { secondVerificationCode: verificationCode.trim() }
              : {}),
          },
        },
      );
      if (!response.data) {
        const permission =
          response.response.status === 403 || response.response.status === 428;
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
      <main className="supplier-auth-page select-page" data-page-id="PAGE-015" data-ui-state="expired">
        <Card className="selection-empty" variant="borderless">
          <Typography.Title level={2}>职能账号选择已失效</Typography.Title>
          <Typography.Paragraph>请返回供应商后台重新登录。</Typography.Paragraph>
          <Button href={LOGIN_ROUTE} type="primary">返回登录</Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="supplier-auth-page select-page" data-page-id="PAGE-015" data-route={ACCOUNT_SELECT_ROUTE}>
      <header className="selection-hero">
        <div>
          <Typography.Text className="auth-eyebrow">FIXED FUNCTIONAL WORKSPACE</Typography.Text>
          <Typography.Title>选择职能账号</Typography.Title>
          <Typography.Paragraph>每次只激活一个固定职能页面</Typography.Paragraph>
        </div>
        <Tag color="cyan">供应商独立后台</Tag>
      </header>
      <section className="selection-content">
        {error ? (
          <Alert
            description={error.message}
            message={
              error.kind === 'offline'
                ? '网络不可用'
                : error.kind === 'permission'
                  ? '职能账号不可进入'
                  : '选择失败'
            }
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
          <Card variant="borderless" data-ui-state="empty">
            <Typography.Title level={3}>暂无可用职能账号</Typography.Title>
            <Typography.Paragraph>请联系供应商主体管理员完成账号配置。</Typography.Paragraph>
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
          供应商、账号和路由均由服务端授权列表提供，不支持手工选择主体或账号类型。
        </Typography.Text>
      </section>
    </main>
  );
}
