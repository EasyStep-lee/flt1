import Link from 'next/link';

import { ClosingCta, JsonLd, PageHero, SectionHeading } from '../../../public-components';
import {
  buildMetadata,
  buildWebPageJsonLd,
  COMPANY_LEGAL_NAME,
  PUBLIC_CUSTOMER_SERVICE,
} from '../../../public-content';

export const dynamic = 'force-static';
export const revalidate = 300;

const description = '联系福礼团客服，了解企业采购、福利服务、供应商合作或投诉反馈渠道。';

export const metadata = buildMetadata({ description, path: '/contact', title: '联系我们' });

const contactPurposes = [
  ['企业采购', '企业注册、采购范围、统一结账、配送与售后咨询。'],
  ['福利服务', '企业福利场景、办理流程、员工领取与使用说明。'],
  ['供应商合作', '首期开放分类、准入资料、审核流程与账号入口。'],
  ['投诉与售后', '由平台公司统一受理对客投诉、退款与售后问题。'],
] as const;

export default function ContactPage() {
  return (
    <main className="site-container" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description, path: '/contact', title: '联系我们', type: 'ContactPage' })} />
      <PageHero
        description="请说明联系用途，客服将按企业采购、福利服务、供应商合作或投诉售后分流。"
        eyebrow="联系与支持"
        title="联系我们"
      />
      <section className="section-block section-block--split">
        <div>
          <SectionHeading eyebrow="已确认客服渠道" title="对客客服使用手机" />
          <div className="contact-primary">
            <span>客服展示</span>
            <strong>{PUBLIC_CUSTOMER_SERVICE}</strong>
            <p>为避免在代码仓库、搜索索引和自动化制品中保存完整联系方式，此处使用公司已批准的脱敏展示值。</p>
          </div>
        </div>
        <dl className="fact-panel">
          <div><dt>经营主体</dt><dd>{COMPANY_LEGAL_NAME}</dd></div>
          <div><dt>客服渠道</dt><dd>手机</dd></div>
          <div><dt>办公地址</dt><dd>尚未取得公开发布授权，不在此页面虚构</dd></div>
          <div><dt>服务时间</dt><dd>请通过客服渠道确认，以公司正式公示为准</dd></div>
        </dl>
      </section>
      <section className="section-block section-block--tint" id="enterprise-welfare">
        <SectionHeading eyebrow="诉求分流" title="联系前请选择对应事项" />
        <div className="card-grid card-grid--two">
          {contactPurposes.map(([title, copy]) => <article className="plain-card" key={title}><h2>{title}</h2><p>{copy}</p></article>)}
        </div>
      </section>
      <section className="section-block">
        <SectionHeading eyebrow="隐私说明" title="按事项进入最小化咨询入口" />
        <div className="notice-panel">
          <p>企业福利咨询只收集联系人、企业名称、手机、需求摘要和明确同意，并经过来源校验、人机验证、限流和幂等保护。</p>
          <p>请勿提交营业执照原件、身份证、银行账号、密码或与咨询无关的个人资料；提交咨询不会直接创建福利卡账户或资金。</p>
        </div>
        <Link className="text-link" href="/welfare-card-service#enterprise-welfare-inquiry">进入企业福利咨询 →</Link>
      </section>
      <ClosingCta
        description="企业采购从企业注册开始；供应商供货协作请先核对准入条件与独立入口。"
        primaryHref="/enterprise/register"
        primaryLabel="注册企业"
        secondaryHref="/supplier-cooperation"
        secondaryLabel="查看供应商合作"
        title="选择与身份对应的下一步"
      />
    </main>
  );
}
