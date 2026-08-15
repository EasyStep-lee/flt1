import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClosingCta, JsonLd, PageHero, SectionHeading } from '../../../../public-components';
import {
  buildMetadata,
  buildWebPageJsonLd,
  getScenario,
  publicScenarios,
} from '../../../../public-content';

export const dynamic = 'force-static';
export const dynamicParams = false;
export const revalidate = 300;

export function generateStaticParams() {
  return publicScenarios.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) notFound();
  return buildMetadata({
    description: scenario.summary,
    path: `/cases/${scenario.slug}`,
    title: scenario.title,
  });
}

export default async function ScenarioDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) notFound();
  const path = `/cases/${scenario.slug}`;
  return (
    <main className="site-container" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description: scenario.summary, path, title: scenario.title })} />
      <PageHero
        actions={<Link className="button button--outline" href="/cases">返回服务场景</Link>}
        description={scenario.summary}
        eyebrow={scenario.eyebrow}
        title={scenario.title}
      />
      <section className="section-block">
        <div className="disclosure disclosure--prominent">{scenario.disclosure}</div>
        <SectionHeading eyebrow="服务步骤" title="从企业需求到公司统一服务" />
        <ol className="timeline">
          {scenario.steps.map((step, index) => <li key={step}><span>{index + 1}</span><strong>{step}</strong></li>)}
        </ol>
      </section>
      <section className="section-block section-block--tint">
        <SectionHeading eyebrow="责任结果" title="这条路径保持的三项原则" />
        <ul className="check-list">{scenario.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
      </section>
      <ClosingCta
        description="实际商品、价格、交付时间和服务范围以企业认证后的正式方案与订单为准。"
        primaryHref="/contact"
        primaryLabel="联系企业服务"
        title="将匿名场景转化为可核对的企业方案"
      />
    </main>
  );
}
