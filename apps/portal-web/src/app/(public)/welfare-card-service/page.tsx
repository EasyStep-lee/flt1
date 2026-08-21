import { JsonLd, PageHero, SectionHeading } from '../../../public-components';
import { buildMetadata, buildWebPageJsonLd } from '../../../public-content';
import { BusinessInquiryForm } from './business-inquiry-form';

export const dynamic = 'force-static';
export const revalidate = 300;

const description = '了解福礼团企业福利卡服务的申请、员工领取绑定使用、适用范围、退款客服与合规边界。';

export const metadata = buildMetadata({
  description,
  path: '/welfare-card-service',
  title: '企业福利卡服务',
});

export default function WelfareCardServicePage() {
  return (
    <main className="site-container" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description, path: '/welfare-card-service', title: '企业福利卡服务' })} />
      <PageHero
        actions={<a className="button" href="#enterprise-welfare-inquiry">提交企业福利咨询</a>}
        description="企业可申请员工福利方案；员工按批准计划领取、绑定并在适用商品范围内使用，个人不能现金充值。"
        eyebrow="福利服务"
        title="企业福利卡服务"
      />
      <section className="section-block">
        <SectionHeading eyebrow="适用场景" title="适用场景" description="面向企业员工福利、节日关怀和公司批准的福利活动，不是个人储值钱包。" />
        <div className="card-grid card-grid--three">
          {[
            ['企业福利发放', '企业确认方案与人员范围后，由公司按批准计划发放福利。'],
            ['公司活动赠送', '仅用于公司已批准活动，资金来源和适用范围均可追溯。'],
            ['实体卡或卡密兑换', '员工通过个人小程序领取或绑定，并查看余额、范围和账本记录。'],
          ].map(([title, copy]) => <article className="plain-card" key={title}><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>
      <section className="section-block section-block--tint">
        <SectionHeading eyebrow="企业办理" title="企业申请流程" />
        <ol className="timeline timeline--wide">
          {[
            ['01', '提交咨询', '仅提交联系人、企业、手机和需求摘要，不直接开户。'],
            ['02', '需求核对', '公司核对使用场景、人数、预算口径、适用范围和退款规则。'],
            ['03', '企业确认', '按正式协议和企业认证结果确认福利计划，不承诺提交即通过。'],
            ['04', '计划与批次', '由公司福利卡职能建立计划和批次，所有入账来源受限并留痕。'],
            ['05', '员工使用', '员工领取或绑定后按范围使用，可查看余额和只追加账本。'],
          ].map(([number, title, copy]) => <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{copy}</p></div></li>)}
        </ol>
      </section>
      <section className="section-block section-block--split">
        <div>
          <SectionHeading eyebrow="员工侧" title="员工使用路径" />
          <ul className="check-list">
            <li>在用户小程序按需登录并选择领取、兑换或绑定福利卡</li>
            <li>结算时自主选择适用账户，可福利卡全额或福利卡＋微信混合支付</li>
            <li>退款严格按福利卡与微信原支付结构退回，累计不超过实付</li>
            <li>余额和账本只追加、冲正，不提供个人现金充值入口</li>
          </ul>
        </div>
        <div>
          <SectionHeading eyebrow="固定边界" title="适用与退款边界" />
          <div className="notice-panel">
            <p>每个计划可限定商品、分类、渠道、有效期及是否支付配送费；不可用部分须明确说明。</p>
            <p>福利卡不替代企业采购付款，不用于供应商结算，也不形成供应商钱包、提现或自动打款。</p>
            <p>取消、超时、支付失败和退款均须保持资金守恒；具体规则以批准计划及正式协议为准。</p>
          </div>
        </div>
      </section>
      <section className="section-block section-block--tint" id="enterprise-welfare-inquiry">
        <SectionHeading
          eyebrow="最小必要收集"
          title="企业福利咨询"
          description="提交后会生成线索编号；公司将在内部受理后联系，不承诺固定时效，也不会直接创建福利资金账户。"
        />
        <BusinessInquiryForm />
      </section>
    </main>
  );
}
