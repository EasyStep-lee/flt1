import Link from 'next/link';

import { ClosingCta, JsonLd, PageHero, SectionHeading } from '../../../public-components';
import { buildMetadata, buildWebPageJsonLd } from '../../../public-content';

export const dynamic = 'force-static';
export const revalidate = 300;

const description =
  '了解福礼团在品类组织、供应商准入、商品审核、库存协同、统一订单、配送和售后方面的公开能力。';

export const metadata = buildMetadata({
  description,
  path: '/capabilities',
  title: '一站式供应链服务能力',
});

const capabilityGroups = [
  ['品类与商品', ['分类树与版本化模板', '供应商提交商品资料', '公司商品资料与价格分别审核', '个人与企业共用商品资源']],
  ['库存与订单', ['每个 SKU 只有一个成交库存真源', '个人与企业可跨供应来源采购', '客户只向平台公司提交一个主订单', '平台按供应来源拆分履约协作']],
  ['配送与服务', ['个人履约进入独立跑腿链路', '企业采购由平台公司统一组织配送', '公司统一承担售后与退款责任', '公司与供应商线上对账、线下结算']],
] as const;

export default function CapabilitiesPage() {
  return (
    <main className="site-container" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description, path: '/capabilities', title: '一站式供应链服务能力' })} />
      <PageHero
        actions={<Link className="button" href="/contact">咨询企业服务</Link>}
        description="围绕商品、库存、订单、配送与售后组织协作，对客责任由平台公司统一承担。"
        eyebrow="公开能力"
        title="一站式供应链服务能力"
      />
      <section className="section-block">
        <SectionHeading
          description="公开页面说明业务结果和责任边界，不展示供应商名单、供货价格、内部毛利或风控阈值。"
          eyebrow="能力全景"
          title="从上游准入到对客服务"
        />
        <div className="card-grid card-grid--three">
          {capabilityGroups.map(([title, items], groupIndex) => (
            <article className="capability-detail" key={title}>
              <span className="capability-detail__number">0{groupIndex + 1}</span>
              <h2>{title}</h2>
              <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>
      <section className="section-block section-block--tint">
        <SectionHeading eyebrow="链路隔离" title="个人配送与企业统一配送严格分开" />
        <div className="route-comparison">
          <article><span>个人零售</span><h3>按供应来源履约</h3><p>满足条件的个人履约子单进入跑腿链路，取货点与用户目的地分别固化。</p></article>
          <div aria-hidden="true" className="route-comparison__divider">≠</div>
          <article><span>企业采购</span><h3>平台公司统一配送</h3><p>企业商品由平台汇总备货并统一组织配送，绝不进入个人跑腿抢单大厅。</p></article>
        </div>
      </section>
      <ClosingCta
        description="通过匿名场景了解这些能力如何组成企业福利采购服务路径。"
        primaryHref="/cases"
        primaryLabel="查看服务场景"
        title="把能力落实到一条清晰服务路径"
      />
    </main>
  );
}
