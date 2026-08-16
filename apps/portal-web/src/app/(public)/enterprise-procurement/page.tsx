import Link from 'next/link';

import {
  ClosingCta,
  JsonLd,
  PageHero,
  SectionHeading,
} from '../../../public-components';
import {
  buildMetadata,
  buildWebPageJsonLd,
  COMPANY_LEGAL_NAME,
} from '../../../public-content';

export const dynamic = 'force-static';
export const revalidate = 300;

const description =
  '社区集采是福礼团持续开放的普通企业采购入口，企业认证后可跨供应来源选品并统一向平台公司下单。';

export const metadata = buildMetadata({
  description,
  path: '/enterprise-procurement',
  title: '社区集采企业采购入口',
});

const process = [
  ['01', '企业注册认证', '提交企业主体、联系人、开票和收货资料，由平台公司审核。'],
  ['02', '浏览企业货架', '认证后查看带集采标识的在售商品、集采销售价和可采购状态。'],
  ['03', '跨供应来源选品', '多个供应来源的商品进入同一企业采购车，共用平台商品和库存真源。'],
  ['04', '统一下单结账', '企业只向平台公司提交一个主订单，并选择公司微信支付或配置的对公转账。'],
  ['05', '平台统一服务', '供应商分别备货，由平台公司汇总配送并统一承担开票、退款与售后。'],
] as const;

const availableCategories = ['食品饮料', '生鲜农产品', '家居日用', '个护清洁', '文体办公', '节庆礼盒'] as const;

export default function EnterpriseProcurementEntryPage() {
  return (
    <main data-p0-id="P0-030" id="main-content">
      <JsonLd
        value={{
          ...buildWebPageJsonLd({
            description,
            path: '/enterprise-procurement',
            title: '社区集采企业采购入口',
          }),
          about: {
            '@type': 'Service',
            name: '普通企业采购服务',
            provider: {
              '@type': 'Organization',
              legalName: COMPANY_LEGAL_NAME,
            },
          },
        }}
      />
      <div className="site-container">
        <h2 className="public-zone-heading">社区集采 · 企业采购入口</h2>
        <PageHero
          actions={
            <>
              <Link className="button" href="/enterprise/register">
                注册企业
              </Link>
              <Link className="button button--outline" href="/enterprise/login">
                企业登录
              </Link>
            </>
          }
          description="面向正常企业持续开放。完成认证后，可浏览企业采购商品、跨供应来源统一下单，并由平台公司统一提供配送、开票与售后服务。"
          eyebrow="普通企业采购 · 长期开放"
          title="社区集采，不是限时团购活动"
        />

        <section className="section-block">
          <SectionHeading
            description="名称保留“社区集采”，业务实质始终是企业与平台公司之间的普通采购。"
            eyebrow="边界说明"
            title="无需等待开团，也没有活动门槛"
          />
          <div className="route-comparison">
            <article>
              <span>本平台提供</span>
              <h3>持续开放的普通企业采购入口</h3>
              <p>企业可以按自身采购需要注册、认证、选品、统一下单和查看订单。</p>
            </article>
            <div aria-hidden="true" className="route-comparison__divider">≠</div>
            <article>
              <span>本平台不提供</span>
              <h3>社区团购或企业内部管理系统</h3>
              <p>
                不限定指定社区、活动时段、成团门槛或团长角色；不提供企业内部 OA、预算或采购审批流程。
              </p>
            </article>
          </div>
        </section>

        <section className="section-block section-block--tint">
          <SectionHeading
            description="企业始终只向江苏福礼团供应链科技有限公司提交一个主订单并统一结账。"
            eyebrow="采购流程"
            title="从企业认证到平台统一服务"
          />
          <ol className="timeline timeline--wide">
            {process.map(([number, title, copy]) => (
              <li key={number}>
                <span>{number}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="section-block section-block--split">
          <div>
            <SectionHeading
              description="仅展示平台首期可组织的品类方向；公开访客不查看集采销售价或精确库存。"
              eyebrow="商品范围"
              title="共用商品资源，认证后进入采购货架"
            />
            <div className="tag-cloud">
              {availableCategories.map((category) => <span key={category}>{category}</span>)}
            </div>
          </div>
          <article className="feature-card">
            <p className="status-pill">认证企业入口</p>
            <h2>已有企业账号？</h2>
            <p>登录后进入受保护的企业采购货架。价格、采购车和订单数据不进入公开缓存，也不会被搜索引擎索引。</p>
            <div className="button-row">
              <Link className="button" href="/enterprise/procurement/products">
                进入企业采购货架
              </Link>
              <Link className="button button--outline" href="/enterprise/login">
                企业登录
              </Link>
            </div>
          </article>
        </section>

        <section className="section-block">
          <div className="notice-panel">
            <p><strong>责任主体：</strong>{COMPANY_LEGAL_NAME}统一销售、结账、开票、退款与售后。</p>
            <p>供应商是上游供货协作方，不形成独立店铺，也不直接向企业客户收款。</p>
          </div>
        </section>

        <ClosingCta
          description="首次使用请先提交企业认证；审核通过后可进入企业采购货架。"
          primaryHref="/enterprise/register"
          primaryLabel="注册企业"
          title="从一个清晰、持续开放的入口开始采购"
        />
      </div>
    </main>
  );
}
