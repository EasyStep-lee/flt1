import { JsonLd, PageHero } from '../../../../public-components';
import { buildMetadata, buildWebPageJsonLd } from '../../../../public-content';

export const dynamic = 'force-static';
export const revalidate = 300;

const description = '福礼团隐私政策公开入口及正式发布状态说明。';

export const metadata = buildMetadata({
  description,
  path: '/legal/privacy-policy',
  title: '隐私政策',
});

export default function PrivacyPolicyPage() {
  return (
    <main className="site-container" data-legal-status="NOT_EXECUTED" data-p0-id="P0-073" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description, path: '/legal/privacy-policy', title: '隐私政策' })} />
      <PageHero
        description="本入口已建立；正式隐私政策、版本号与生效日期须由公司授权法务人员核定后发布。当前页面不冒充正式隐私文本。"
        eyebrow="法律入口 · 待正式发布"
        title="隐私政策"
      />
      <section className="section-block">
        <div className="notice-panel">
          <p><strong>当前状态：</strong>NOT_EXECUTED。</p>
          <p>正式文本发布前，不在代码仓库中虚构个人信息处理目的、共享清单或保存期限。</p>
        </div>
      </section>
    </main>
  );
}
