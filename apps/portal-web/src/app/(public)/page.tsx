import Link from 'next/link';

import { ClosingCta, JsonLd, PageHero, SectionHeading } from '../../public-components';
import {
  buildMetadata,
  buildWebPageJsonLd,
  COMPANY_LEGAL_NAME,
  publicAnnouncements,
  publicAuthorizedCases,
  publicHomeCategories,
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
  ['企业采购', '面向正常企业持续开放，支持跨供应来源统一向公司下单。', '企业注册', '/enterprise/register'],
  ['企业福利服务', '围绕员工福利、节庆礼赠和日常关怀提供受控商品与服务说明。', '福利咨询', '/contact#enterprise-welfare'],
  ['供应商合作', '供应商作为上游供货协作方，按准入、审核、上架和履约流程合作。', '申请供应商合作', '/supplier/register'],
] as const;

const capabilities = [
  ['01', '分类商品', '按已启用分类和版本化模板组织商品，首期强监管品类继续关闭。'],
  ['02', '供应商准入', '主体、资质和取货信息经公司审核，供应商不是面向客户的店铺。'],
  ['03', '质量审核', '商品资料与初始价格分别审核，通过后由公司统一上架。'],
  ['04', '库存协同', '个人和企业共用每个 SKU 唯一库存真源，避免多套库存。'],
  ['05', '统一结账', '个人与企业均可跨供应来源采购，只向平台公司提交一个主订单。'],
  ['06', '配送与售后', '企业由平台统一配送，公司统一承担开票、退款与售后责任。'],
] as const;

const communitySteps = [
  '企业注册认证',
  '选择集采商品',
  '跨供应来源统一下单',
  '平台统一组织配送',
  '公司统一售后',
] as const;

const supplierSteps = ['注册申请', '资质审核', '商品发布', '备货履约', '线上对账与线下结算'] as const;

const subjectRoles = [
  ['seller', '销售主体'],
  ['payment-payee', '收款主体'],
  ['refund-operator', '退款主体'],
] as const;

const supplierBoundaries = [
  ['company-catalog', '公司统一商品货架', '跨供应来源商品统一展示'],
  ['company-checkout', '公司统一结账', '客户只向公司提交主订单'],
  ['company-service', '公司统一服务', '开票、退款与售后均由公司承担'],
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

        <div data-home-section="hero">
          <PageHero
            actions={
              <>
                <Link className="button" href="/enterprise-procurement">
                  进入社区集采
                </Link>
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
        </div>

        <section className="section-block" data-home-section="core-services">
          <SectionHeading
            description="明确服务对象、业务结果与下一步，不设置限时成团或团长入口。"
            eyebrow="核心服务"
            title="企业服务，从一个清晰入口开始"
          />
          <div className="card-grid card-grid--three">
            {services.map(([title, copy, label, href]) => (
              <article className="service-card" data-home-service={title} key={title}>
                <span className="service-card__icon" aria-hidden="true">{title.slice(0, 1)}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                {href.startsWith('/supplier/') ? (
                  <a className="text-link" href={href}>{label} <span aria-hidden="true">→</span></a>
                ) : (
                  <Link className="text-link" href={href}>{label} <span aria-hidden="true">→</span></Link>
                )}
              </article>
            ))}
          </div>

          <div className="home-subsection" data-p0-id="P0-001">
            <SectionHeading
              description="无论商品来自哪个供应来源，对客交易责任始终由同一公司承担。"
              eyebrow="责任公示"
              title="唯一对客经营主体"
            />
            <div className="card-grid card-grid--three">
              {subjectRoles.map(([subject, label]) => (
                <article className="subject-card" data-subject={subject} key={subject}>
                  <strong>{label}</strong>
                  <span>{COMPANY_LEGAL_NAME}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-block section-block--tint" data-home-section="supply-chain-capabilities">
          <SectionHeading
            description="从分类商品到公司统一服务，只展示公开能力，不披露内部参数或供货结算数据。"
            eyebrow="一站式能力"
            title="供应链服务责任清楚、协作链路可追溯"
          />
          <div className="capability-grid">
            {capabilities.map(([number, title, copy]) => (
              <article className="capability-card" data-home-capability={title} key={title}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <Link className="section-link" href="/capabilities">查看完整供应链能力 →</Link>
        </section>

        <section className="section-block community" data-home-section="community-procurement" id="community-procurement">
          <div>
            <p className="eyebrow">社区集采 · 企业采购入口</p>
            <h2>面向正常企业持续开放</h2>
            <p>
              企业完成注册认证后，可持续浏览企业采购商品、跨供应来源统一下单并向平台公司结账。
              本入口不是指定社区、限时活动、成团业务或团长模式。
            </p>
            <div className="button-row">
              <Link className="button" href="/enterprise/register">注册企业</Link>
              <Link className="button button--outline" href="/enterprise/login">企业登录</Link>
            </div>
          </div>
          <ol className="process-list">
            {communitySteps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}
          </ol>
        </section>

        <section className="section-block" data-home-section="category-preview">
          <SectionHeading
            description="仅展示 EXT-007 已批准启用的首期一级分类；未认证访客不显示集采销售价或精确库存。"
            eyebrow="分类预览"
            title="围绕企业福利与日常采购组织商品"
          />
          <div className="category-row" aria-label="首期启用分类">
            {publicHomeCategories.map((category) => <span data-home-category key={category}>{category}</span>)}
          </div>
          <Link className="section-link" href="/enterprise/register">认证后查看企业采购货架 →</Link>
        </section>

        <section className="section-block section-block--tint" data-home-section="authorized-cases">
          <SectionHeading
            description="客户名称、Logo、图片和业务数据只有在取得公开使用授权后才会发布。"
            eyebrow="经授权案例"
            title="只展示可核验的合作内容"
          />
          {publicAuthorizedCases.length === 0 ? (
            <div className="card-grid card-grid--two">
              <article className="empty-card" data-home-empty="authorized-cases">
                <p className="status-pill">等待授权资料</p>
                <h3>暂无已取得公开授权的客户案例</h3>
                <p>当前不展示客户名称、Logo、交易金额、销量或效果承诺。</p>
              </article>
              <article className="feature-card">
                <p className="status-pill">{scenario.eyebrow}</p>
                <h3>匿名服务路径（不是客户案例）</h3>
                <p>{scenario.summary}</p>
                <p className="disclosure">{scenario.disclosure}</p>
                <Link className="text-link" href="/cases">查看匿名服务路径 →</Link>
              </article>
            </div>
          ) : null}
        </section>

        <section className="section-block" data-home-section="supplier-cooperation">
          <SectionHeading
            description="供应商是上游供货协作方，不直接向客户收款；公司审核上架并分别线上对账、线下结算。"
            eyebrow="供应商合作"
            title="按准入、审核、履约与对账流程协作"
          />
          <ol className="process-list process-list--horizontal">
            {supplierSteps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}
          </ol>
          <div className="button-row">
            <Link className="button" href="/supplier-cooperation">查看合作资料</Link>
            <a className="button button--outline" href="/supplier/register">供应商注册</a>
            <a className="text-link" href="/supplier/login">供应商登录</a>
          </div>

          <div className="home-subsection home-subsection--compact" data-p0-id="P0-009">
            <SectionHeading
              description="供应商负责供货，商品展示、客户结账与售后服务均由平台公司统一组织。"
              eyebrow="供货关系"
              title="供应来源不是店铺"
            />
            <div className="card-grid card-grid--three">
              {supplierBoundaries.map(([capability, title, copy]) => (
                <article className="subject-card" data-capability={capability} key={capability}>
                  <strong>{title}</strong><span>{copy}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-block section-block--tint" data-home-section="news">
          <SectionHeading
            description="仅展示已登记版本和生效日期的平台规则公告，不虚构公司动态或发布时间。"
            eyebrow="新闻与公告"
            title="规则透明，版本清楚"
          />
          <article className="feature-card news-feature">
            <div>
              <p className="status-pill status-pill--warm">{announcement.category}</p>
              <h3>{announcement.title}</h3>
              <p>{announcement.summary}</p>
            </div>
            <dl className="meta-list">
              <div><dt>版本</dt><dd>{announcement.version}</dd></div>
              <div><dt>生效日期</dt><dd><time dateTime={announcement.effectiveAt}>{announcement.effectiveAt}</time></dd></div>
            </dl>
            <Link className="text-link" href={`/news/${announcement.slug}`}>查看公告正文 →</Link>
          </article>
          <Link className="section-link" href="/news">查看全部新闻 →</Link>
        </section>

        <div data-home-section="enterprise-service-cta">
          <ClosingCta
            description="面向企业采购和员工福利需求，先完成企业注册，或联系公司确认服务边界。"
            primaryHref="/enterprise/register"
            primaryLabel="注册企业"
            secondaryHref="/contact"
            secondaryLabel="联系商务"
            title="开启企业采购与员工福利服务"
          />
        </div>
      </div>
    </main>
  );
}
