import Link from 'next/link';

import { JsonLd, PageHero, SectionHeading } from '../../../public-components';
import { buildMetadata, buildWebPageJsonLd, publicAnnouncements } from '../../../public-content';

export const dynamic = 'force-static';
export const revalidate = 300;

const description = '查看福礼团已发布的服务规则与平台公告；规则内容显示版本、生效日期和适用对象。';

export const metadata = buildMetadata({ description, path: '/news', title: '新闻与公告' });

export default function NewsPage() {
  return (
    <main className="site-container" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description, path: '/news', title: '新闻与公告', type: 'CollectionPage' })} />
      <PageHero
        description="只展示有明确来源、版本与生效日期的公开内容，不使用占位新闻冒充公司动态。"
        eyebrow="公开信息"
        title="新闻与公告"
      />
      <section className="section-block">
        <SectionHeading
          description="当前只有经产品基线确认的服务规则公告；公司新闻将在取得真实材料后发布。"
          eyebrow="已发布内容"
          title="规则透明，历史可追溯"
        />
        <div className="news-list">
          {publicAnnouncements.map((announcement) => (
            <article className="news-card" key={announcement.slug}>
              <div><span>{announcement.category}</span><time dateTime={announcement.effectiveAt}>{announcement.effectiveAt}</time></div>
              <h2><Link href={`/news/${announcement.slug}`}>{announcement.title}</Link></h2>
              <p>{announcement.summary}</p>
              <dl className="meta-list"><div><dt>版本</dt><dd>{announcement.version}</dd></div><div><dt>适用对象</dt><dd>{announcement.applicableTo}</dd></div></dl>
            </article>
          ))}
          <article className="empty-card empty-card--compact">
            <span aria-hidden="true">○</span>
            <h2>公司新闻</h2>
            <p>当前没有已确认且可公开的公司新闻材料，本栏目不生成虚构动态。</p>
          </article>
        </div>
      </section>
    </main>
  );
}
