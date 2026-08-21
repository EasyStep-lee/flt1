import { JsonLd, PageHero } from '../../../../public-components';
import { buildMetadata, buildWebPageJsonLd } from '../../../../public-content';

export const dynamic = 'force-static';
export const revalidate = 300;

const description = '福礼团平台服务协议公开入口及正式发布状态说明。';

export const metadata = buildMetadata({
  description,
  path: '/legal/service-agreement',
  title: '平台服务协议',
});

export default function ServiceAgreementPage() {
  return (
    <main className="site-container" data-legal-status="NOT_EXECUTED" data-p0-id="P0-073" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description, path: '/legal/service-agreement', title: '平台服务协议' })} />
      <PageHero
        description="本入口已建立；正式协议文本、版本号与生效日期须由公司授权法务人员审定后发布。当前页面不冒充正式法律文本。"
        eyebrow="法律入口 · 待正式发布"
        title="平台服务协议"
      />
      <section className="section-block">
        <div className="notice-panel">
          <p><strong>当前状态：</strong>NOT_EXECUTED。</p>
          <p>正式文本发布前，不在代码仓库中虚构合同条款、用户权利义务或争议解决口径。</p>
        </div>
      </section>
    </main>
  );
}
