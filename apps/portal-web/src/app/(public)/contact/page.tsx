import Link from 'next/link';

import { JsonLd, PageHero, SectionHeading } from '../../../public-components';
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
      <section className="section-block section-block--tint">
        <SectionHeading eyebrow="诉求分流" title="联系前请选择对应事项" />
        <div className="card-grid card-grid--two">
          {contactPurposes.map(([title, copy]) => <article className="plain-card" key={title}><h2>{title}</h2><p>{copy}</p></article>)}
        </div>
      </section>
      <section className="section-block">
        <SectionHeading eyebrow="隐私说明" title="不在公开页面收集业务线索" />
        <div className="notice-panel">
          <p>本切片不提供姓名、企业、手机号、地址或凭证上传表单，不会在浏览器本地保存咨询草稿。</p>
          <p>商务咨询的最小收集、同意、幂等、限流和审计由后续 M5 业务咨询接口实现；当前不可用的能力不以静态表单冒充。</p>
        </div>
        <Link className="text-link" href="/supplier-cooperation">供应商可先查看合作条件与独立注册入口 →</Link>
      </section>
    </main>
  );
}
