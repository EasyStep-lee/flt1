import Link from 'next/link';

import { ClosingCta, JsonLd, PageHero, SectionHeading } from '../../../public-components';
import { buildMetadata, buildWebPageJsonLd, publicScenarios } from '../../../public-content';

export const dynamic = 'force-static';
export const revalidate = 300;

const description = '浏览福礼团基于已确认平台能力整理的匿名服务场景，不构成特定客户案例或结果承诺。';

export const metadata = buildMetadata({ description, path: '/cases', title: '服务场景' });

export default function CasesPage() {
  return (
    <main className="site-container" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description, path: '/cases', title: '服务场景', type: 'CollectionPage' })} />
      <PageHero
        description="在未取得客户名称、标识、图片与数据授权前，只展示匿名能力场景，不虚构客户案例。"
        eyebrow="场景说明"
        title="服务场景"
      />
      <section className="section-block">
        <SectionHeading
          description="每个场景都标明信息性质、适用边界和下一步，不展示未经授权的客户资料。"
          eyebrow="当前可公开内容"
          title="从业务路径理解服务能力"
        />
        <div className="card-grid card-grid--two">
          {publicScenarios.map((scenario) => (
            <article className="feature-card" key={scenario.slug}>
              <p className="status-pill">{scenario.eyebrow}</p>
              <h2>{scenario.title}</h2>
              <p>{scenario.summary}</p>
              <p className="disclosure">{scenario.disclosure}</p>
              <Link className="text-link" href={`/cases/${scenario.slug}`}>查看服务路径 →</Link>
            </article>
          ))}
          <article className="empty-card">
            <span aria-hidden="true">＋</span>
            <h2>已授权客户案例</h2>
            <p>当前没有可在代码仓库和公开站点发布的客户授权材料，因此保持诚实空态。</p>
          </article>
        </div>
      </section>
      <ClosingCta
        description="如需结合企业人数、品类与交付要求讨论方案，请通过已确认客服渠道联系公司。"
        primaryHref="/contact"
        primaryLabel="联系企业服务"
        title="讨论适合企业的采购与福利路径"
      />
    </main>
  );
}
