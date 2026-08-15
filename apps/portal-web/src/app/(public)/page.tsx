import Link from 'next/link';

import {
  ClosingCta,
  JsonLd,
  PageHero,
  SectionHeading,
} from '../../public-components';
import {
  buildMetadata,
  buildWebPageJsonLd,
  COMPANY_LEGAL_NAME,
  publicAnnouncements,
  publicScenarios,
} from '../../public-content';

export const dynamic = 'force-static';
export const revalidate = 300;

const description =
  '福礼团面向企业提供福利采购、供应链协同和统一服务，江苏福礼团供应链科技有限公司是唯一对客经营主体。';

export const metadata = buildMetadata({
  description,
  path: '/',
  title: '企业福利采购与供应链服务',
});

const services = [
  ['企业采购', '持续开放的普通企业采购入口，支持跨供应来源统一向公司下单。', '了解社区集采', '#community-procurement'],
  ['企业福利服务', '围绕员工福利、节庆礼赠和日常关怀提供受控商品与服务说明。', '联系企业服务', '/contact'],
  ['供应商合作', '供应商作为上游供货协作方，按准入、审核、上架和履约流程合作。', '查看合作流程', '/supplier-cooperation'],
] as const;

const capabilities = [
  ['01', '供应商准入', '主体与资料经过公司审核，供应商不是面向客户的独立店铺。'],
  ['02', '商品审核', '商品资料与初始价格分别审核，通过后由公司统一上架。'],
  ['03', '分类与模板', '按商品分类和详情模板组织公开信息，不复制多套商品资源。'],
  ['04', '统一订单', '个人与企业均可跨供应来源采购并向公司提交一个主订单。'],
  ['05', '分链路配送', '个人按供应来源履约；企业由平台公司统一组织配送。'],
  ['06', '统一售后', '公司统一承担对客开票、退款与售后责任。'],
] as const;

export default function HomePage() {
  const scenario = publicScenarios[0];
  const announcement = publicAnnouncements[0];
  return (
    <main id="main-content">
      <JsonLd
        value={{
          ...buildWebPageJsonLd({ description, path: '/', title: '福礼团企业门户' }),
          '@type': 'Organization',
          legalName: COMPANY_LEGAL_NAME,
        }}
      />
      <div className="site-container">
        <h2 className="public-zone-heading">企业门户公开区</h2>
        <PageHero
          actions={
            <>
              <a className="button" href="#community-procurement">
                了解社区集采
              </a>
              <Link className="button button--outline" href="/capabilities">
                了解供应链能力
              </Link>
            </>
          }
          description="由江苏福礼团供应链科技有限公司统一销售、统一结账、统一开票、统一退款与售后，供应商专注供货协作。"
          eyebrow="企业福利 · 供应链协同"
          title="福礼社企业福利与供应链服务平台"
        />

        <section className="trust-strip" aria-label="平台责任边界">
          <span>公司统一经营</span>
          <span>商品资料与价格分别审核</span>
          <span>企业采购统一配送</span>
          <span>公司统一售后</span>
        </section>

        <section className="section-block">
          <SectionHeading
            description="明确服务对象、业务结果与下一步，不设置限时成团或团长入口。"
            eyebrow="核心服务"
            title="企业服务，从一个清晰入口开始"
          />
          <div className="card-grid card-grid--three">
            {services.map(([title, copy, label, href]) => (
              <article className="service-card" key={title}>
                <span className="service-card__icon" aria-hidden="true">
                  {title.slice(0, 1)}
                </span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <Link className="text-link" href={href}>
                  {label} <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block section-block--tint">
          <SectionHeading
            description="从上游准入到公司统一服务，页面只展示公开能力，不披露内部参数或供货结算数据。"
            eyebrow="一站式能力"
            title="让采购责任更清楚、协作链路更可追溯"
          />
          <div className="capability-grid">
            {capabilities.map(([number, title, copy]) => (
              <article className="capability-card" key={title}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <Link className="section-link" href="/capabilities">
            查看完整供应链能力 →
          </Link>
        </section>

        <section className="section-block community" id="community-procurement">
          <div>
            <p className="eyebrow">社区集采 · 企业采购入口</p>
            <h2>持续开放，不是限时团购活动</h2>
            <p>
              正常企业完成注册认证后，可持续浏览企业采购商品、跨供应来源统一下单并向平台公司结账。
              本入口不设置指定社区、活动时间、成团门槛或团长角色。
            </p>
            <div className="button-row">
              <Link className="button" href="/enterprise/login">
                企业登录
              </Link>
              <Link className="button button--outline" href="/contact">
                咨询企业服务
              </Link>
            </div>
          </div>
          <ol className="process-list">
            {['企业注册认证', '选择适用商品', '跨供应来源统一下单', '平台统一组织配送', '公司统一售后'].map(
              (step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  {step}
                </li>
              ),
            )}
          </ol>
        </section>

        <section className="section-block">
          <SectionHeading
            description="这里只展示首期可组织的品类方向，不展示未认证企业不可见的价格和精确库存。"
            eyebrow="品类能力"
            title="围绕企业福利与日常采购组织商品"
          />
          <div className="category-row">
            {['食品', '家居日用', '个护', '纸品', '家庭清洁', '文体办公'].map(
              (category) => (
                <span key={category}>{category}</span>
              ),
            )}
          </div>
        </section>

        <section className="section-block section-block--split">
          <div>
            <SectionHeading eyebrow="服务场景" title="用明确边界说明可提供的服务" />
            <article className="feature-card">
              <p className="status-pill">{scenario.eyebrow}</p>
              <h3>{scenario.title}</h3>
              <p>{scenario.summary}</p>
              <p className="disclosure">{scenario.disclosure}</p>
              <Link className="text-link" href={`/cases/${scenario.slug}`}>
                查看服务路径 →
              </Link>
            </article>
          </div>
          <div>
            <SectionHeading eyebrow="新闻公告" title="规则透明，版本清楚" />
            <article className="feature-card">
              <p className="status-pill status-pill--warm">{announcement.category}</p>
              <h3>{announcement.title}</h3>
              <p>{announcement.summary}</p>
              <dl className="meta-list">
                <div><dt>版本</dt><dd>{announcement.version}</dd></div>
                <div><dt>生效日期</dt><dd>{announcement.effectiveAt}</dd></div>
              </dl>
              <Link className="text-link" href={`/news/${announcement.slug}`}>
                查看公告正文 →
              </Link>
            </article>
          </div>
        </section>

        <section className="section-block" data-p0-id="P0-001">
          <SectionHeading
            description="无论商品来自哪个供应来源，对客交易责任始终由同一公司承担。"
            eyebrow="责任公示"
            title="唯一对客经营主体"
          />
          <div className="card-grid card-grid--three">
            {[
              ['seller', '销售主体'],
              ['payment-payee', '收款主体'],
              ['refund-operator', '退款主体'],
            ].map(([subject, label]) => (
              <article className="subject-card" data-subject={subject} key={subject}>
                <strong>{label}</strong>
                <span>{COMPANY_LEGAL_NAME}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block section-block--tint" data-p0-id="P0-009">
          <SectionHeading
            description="供应商负责供货，商品展示、客户结账与售后服务均由平台公司统一组织。"
            eyebrow="供货关系"
            title="供应来源不是店铺"
          />
          <div className="card-grid card-grid--three">
            {[
              ['company-catalog', '公司统一商品货架', '跨供应来源商品统一展示'],
              ['company-checkout', '公司统一结账', '客户只向公司提交主订单'],
              ['company-service', '公司统一服务', '开票、退款与售后均由公司承担'],
            ].map(([capability, title, copy]) => (
              <article className="subject-card" data-capability={capability} key={capability}>
                <strong>{title}</strong>
                <span>{copy}</span>
              </article>
            ))}
          </div>
        </section>

        <ClosingCta
          description="如需企业采购、福利服务或供应商合作，请从对应入口了解流程或联系公司。"
          primaryHref="/contact"
          primaryLabel="联系企业服务"
          title="让采购与福利服务从清晰责任开始"
        />
      </div>
    </main>
  );
}
