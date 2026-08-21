import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClosingCta, JsonLd, PageHero, SectionHeading } from '../../../../public-components';
import {
  buildMetadata,
  buildWebPageJsonLd,
  getAnnouncement,
  publicAnnouncements,
} from '../../../../public-content';

export const dynamic = 'force-static';
export const dynamicParams = false;
export const revalidate = 300;

export function generateStaticParams() {
  return publicAnnouncements.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { readonly params: Promise<{ readonly slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const announcement = getAnnouncement(slug);
  if (!announcement) notFound();
  return buildMetadata({ description: announcement.summary, path: `/news/${announcement.slug}`, title: announcement.title });
}

export default async function NewsDetailPage({ params }: { readonly params: Promise<{ readonly slug: string }> }) {
  const { slug } = await params;
  const announcement = getAnnouncement(slug);
  if (!announcement) notFound();
  const path = `/news/${announcement.slug}`;
  return (
    <main className="site-container" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description: announcement.summary, path, title: announcement.title })} />
      <PageHero description={announcement.summary} eyebrow={announcement.category} title={announcement.title} />
      <article className="article-layout">
        <aside>
          <dl className="meta-list meta-list--stacked">
            <div><dt>版本</dt><dd>{announcement.version}</dd></div>
            <div><dt>生效日期</dt><dd><time dateTime={announcement.effectiveAt}>{announcement.effectiveAt}</time></dd></div>
            <div><dt>适用对象</dt><dd>{announcement.applicableTo}</dd></div>
          </dl>
          <Link className="text-link" href="/news">← 返回新闻与公告</Link>
        </aside>
        <section>
          <SectionHeading eyebrow="公告正文" title="固定业务边界" />
          {announcement.body.map((paragraph) => <p className="article-copy" key={paragraph}>{paragraph}</p>)}
          <div className="notice-panel"><p>本公告依据福礼社单商户供应链平台 V1.1 已确认业务边界整理。后续版本如有变化，将以新的版本和生效日期另行发布。</p></div>
        </section>
      </article>
      <ClosingCta
        description="企业完成注册认证后，可持续浏览企业采购商品并向平台公司统一下单。"
        primaryHref="/enterprise-procurement"
        primaryLabel="进入社区集采"
        title="按已公示边界进入企业采购"
      />
    </main>
  );
}
