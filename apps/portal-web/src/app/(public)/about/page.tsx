import Link from 'next/link';

import { ClosingCta, JsonLd, PageHero, SectionHeading } from '../../../public-components';
import {
  buildMetadata,
  buildWebPageJsonLd,
  COMPANY_LEGAL_NAME,
} from '../../../public-content';

export const dynamic = 'force-static';
export const revalidate = 300;

const description =
  '了解福礼团的经营主体、平台定位、服务理念、责任边界与公开信息原则。';

export const metadata = buildMetadata({ description, path: '/about', title: '关于福礼团' });

export default function AboutPage() {
  return (
    <main className="site-container" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description, path: '/about', title: '关于福礼团', type: 'AboutPage' })} />
      <PageHero
        actions={<Link className="button" href="/contact">联系我们</Link>}
        description="福礼团聚焦企业福利采购与供应链协同，以清晰的经营主体和可追溯流程承接对客责任。"
        eyebrow="关于我们"
        title="关于福礼团"
      />
      <section className="section-block section-block--split">
        <div>
          <SectionHeading eyebrow="平台定位" title="单一经营主体，协同多方供货" />
          <p className="lead-copy">
            {COMPANY_LEGAL_NAME}是平台唯一面向个人和企业的销售、收款、开票、退款与售后主体。
            供应商是上游供货协作方，不是面向客户独立经营的店铺。
          </p>
        </div>
        <dl className="fact-panel">
          <div><dt>批准展示名称</dt><dd>福礼团</dd></div>
          <div><dt>经营主体</dt><dd>{COMPANY_LEGAL_NAME}</dd></div>
          <div><dt>服务方向</dt><dd>企业福利、企业采购、供应链协同</dd></div>
          <div><dt>责任原则</dt><dd>统一经营、统一结账、统一服务</dd></div>
        </dl>
      </section>
      <section className="section-block section-block--tint">
        <SectionHeading eyebrow="服务理念" title="把责任边界放在体验之前说明白" />
        <div className="card-grid card-grid--three">
          {[
            ['可信', '公开内容只使用已确认主体和业务边界，不虚构客户、资质、销量或覆盖范围。'],
            ['清晰', '企业采购、个人零售、供应商协作和配送链路保持入口与责任分离。'],
            ['可追溯', '商品、价格、订单、资金、履约与审核历史按追加或版本方式保留。'],
          ].map(([title, copy]) => <article className="plain-card" key={title}><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>
      <section className="section-block">
        <SectionHeading eyebrow="公开信息原则" title="没有公开授权的信息，不用占位内容冒充" />
        <div className="notice-panel">
          <p>
            公司营业执照已由授权人员核验并保存在公司受控存储。证照原件、统一社会信用代码、银行资料等敏感内容不进入代码仓库或公开页面。
          </p>
          <p>
            企业历程、资质荣誉、办公地址与备案信息将在取得正式公开授权后展示；当前页面不虚构时间线、证书或荣誉。
          </p>
        </div>
      </section>
      <ClosingCta
        description="继续了解平台如何组织商品、订单、配送和售后协作。"
        primaryHref="/capabilities"
        primaryLabel="查看供应链能力"
        title="从公开边界了解福礼团"
      />
    </main>
  );
}
