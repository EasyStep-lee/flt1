import { ShellFrame } from '@fulishe/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default function EnterpriseWorkspaceShell() {
  return (
    <ShellFrame
      audience="已认证企业账号"
      boundary="服务端鉴权、动态渲染、noindex、private/no-store；尚未实现采购工作台"
      shellId="portal-private-shell"
      title="企业私有区壳"
    />
  );
}
