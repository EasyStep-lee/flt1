import { ShellFrame } from '@fulishe/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default function EnterpriseLoginShell() {
  return (
    <ShellFrame
      audience="企业账号"
      boundary="认证入口动态渲染、noindex、private/no-store；尚未实现登录"
      shellId="portal-auth-shell"
      title="企业认证入口壳"
    />
  );
}
