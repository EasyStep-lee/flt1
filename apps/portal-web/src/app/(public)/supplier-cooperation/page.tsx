import { ClosingCta, JsonLd, PageHero, SectionHeading } from '../../../public-components';
import { buildMetadata, buildWebPageJsonLd } from '../../../public-content';

export const dynamic = 'force-static';
export const revalidate = 300;

const description = '了解福礼团供应商合作条件、首期开放分类、准入资料、审核流程和独立注册登录入口。';

export const metadata = buildMetadata({
  description,
  path: '/supplier-cooperation',
  title: '成为福礼团合作供应商',
});

const steps = [
  ['01', '注册申请', '从供应商独立入口创建主体申请，不在公众页面建立后台会话。'],
  ['02', '主体与资料审核', '公司核对主体、联系人、供货分类和适用资质；不承诺提交后必然通过。'],
  ['03', '商品与价格审核', '供应商提交商品资料和三类初始价格，公司分别审核后才可上架。'],
  ['04', '备货履约', '供应商只处理本方履约子单、库存与经审核取货点。'],
  ['05', '线上对账', '公司与每个供应商分别生成线上对账单，实际资金在线下结算。'],
] as const;

export default function SupplierCooperationPage() {
  return (
    <main className="site-container" id="main-content">
      <JsonLd value={buildWebPageJsonLd({ description, path: '/supplier-cooperation', title: '成为福礼团合作供应商' })} />
      <PageHero
        actions={
          <>
            <a className="button" href="/supplier/register">申请供应商合作</a>
            <a className="button button--outline" href="/supplier/login">已有账号登录</a>
          </>
        }
        description="供应商是上游供货协作方，通过准入、商品和价格审核后参与供货，不直接向客户收款。"
        eyebrow="供应商合作"
        title="成为福礼团合作供应商"
      />
      <section className="section-block section-block--split">
        <div>
          <SectionHeading eyebrow="合作条件" title="主体真实、资料完整、履约可追溯" />
          <ul className="check-list">
            <li>具备合法有效的经营主体和与供货分类相匹配的资质</li>
            <li>接受商品资料、初始价格、取货点和后续供货价格变更审核</li>
            <li>按本供应商数据范围维护库存、备货、售后意见和对账</li>
            <li>不建立面向客户的店铺、收款、钱包或提现能力</li>
          </ul>
        </div>
        <div>
          <SectionHeading eyebrow="首期开放方向" title="以已批准分类政策为准" />
          <div className="tag-cloud">
            {['食品', '家居日用', '个护', '纸品', '家庭清洁', '文体办公'].map((category) => <span key={category}>{category}</span>)}
          </div>
          <p className="disclosure">生鲜、冷链、药品、医疗器械、烟酒等强监管或专项品类默认不开放，须另行取得公司明确批准。</p>
        </div>
      </section>
      <section className="section-block section-block--tint">
        <SectionHeading eyebrow="准入资料" title="按供货分类提交最少必要材料" />
        <div className="card-grid card-grid--three">
          {[
            ['主体资料', '营业执照、主体名称、经营状态、联系人和供货分类。'],
            ['分类资质', '食品等适用品类需提交对应备案、许可、有效期和进货来源证明。'],
            ['商品资料', '标签或包装、生产主体、执行标准、品牌授权及按分类要求的材料。'],
          ].map(([title, copy]) => <article className="plain-card" key={title}><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>
      <section className="section-block">
        <SectionHeading eyebrow="审核与协作" title="五步进入长期供货协作" />
        <ol className="timeline timeline--wide">
          {steps.map(([number, title, copy]) => <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{copy}</p></div></li>)}
        </ol>
      </section>
      <section className="section-block">
        <SectionHeading eyebrow="常见问题" title="合作前先确认这些边界" />
        <div className="faq-list">
          <details><summary>供应商是否拥有独立店铺？</summary><p>不拥有。供应商是供货协作方，客户在公司统一货架浏览并向公司结账。</p></details>
          <details><summary>提交商品后是否立即上架？</summary><p>不会。商品资料和初始价格分别审核，全部通过后才由公司统一上架。</p></details>
          <details><summary>平台是否自动向供应商打款？</summary><p>不自动打款。双方线上对账、处理差异，实际资金按约定在线下结算。</p></details>
        </div>
      </section>
      <ClosingCta
        description="请从供应商独立入口提交申请；已有账号的人员从独立登录入口进入对应职能页面。"
        primaryHref="/supplier/register"
        primaryLabel="开始注册"
        secondaryHref="/supplier/login"
        secondaryLabel="已有账号登录"
        title="准备好资料后，提交真实合作申请"
      />
    </main>
  );
}
