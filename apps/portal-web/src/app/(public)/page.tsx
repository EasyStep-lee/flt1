import { ShellFrame } from '@fulishe/ui';

export const dynamic = 'force-static';
export const revalidate = 300;

export default function PublicPortalShell() {
  return (
    <ShellFrame
      audience="公众与企业客户"
      boundary="公开内容使用静态生成/ISR；当前尚未实现宣传或采购业务页面"
      shellId="portal-public-shell"
      title="企业门户公开区"
    />
  );
}
