import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';
import { ShellFrame } from '@fulishe/ui';

export const dynamic = 'force-static';
export const revalidate = 300;

export default function PublicPortalShell() {
  return (
    <ShellFrame
      audience="公众与企业客户"
      boundary="公开内容使用静态生成/ISR；当前仅实现P0-001经营主体公示，不代表交易功能完成"
      shellId="portal-public-shell"
      title="企业门户公开区"
    >
      <section
        data-p0-id="P0-001"
        style={{
          background: '#f4f9f8',
          border: '1px solid #cfe7e3',
          borderRadius: 14,
          marginTop: 24,
          padding: 20,
        }}
      >
        <h2 style={{ color: '#123b5d', margin: '0 0 8px' }}>唯一对客经营主体</h2>
        <p style={{ color: '#49656b', lineHeight: 1.7, margin: '0 0 16px' }}>
          商品可来自不同供应来源，但对客交易责任始终由公司统一承担。
        </p>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          }}
        >
          {[
            ['seller', '销售主体'],
            ['payment-payee', '收款主体'],
            ['refund-operator', '退款主体'],
          ].map(([subject, label]) => (
            <article
              data-subject={subject}
              key={subject}
              style={{
                background: '#ffffff',
                borderLeft: '4px solid #0e8f82',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <strong
                style={{ color: '#0e8f82', display: 'block', marginBottom: 8 }}
              >
                {label}
              </strong>
              <span>{COMPANY_LEGAL_NAME}</span>
            </article>
          ))}
        </div>
      </section>
      <section
        data-p0-id="P0-009"
        style={{
          background: '#fff9ed',
          border: '1px solid #f0d9aa',
          borderRadius: 14,
          marginTop: 24,
          padding: 20,
        }}
      >
        <h2 style={{ color: '#6f3f15', margin: '0 0 8px' }}>
          供应来源不是店铺
        </h2>
        <p style={{ color: '#6f5a42', lineHeight: 1.7, margin: '0 0 16px' }}>
          供应商负责供货，商品展示、客户结账与售后服务均由福礼团统一组织。
        </p>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          }}
        >
          {[
            ['company-catalog', '公司统一商品货架', '跨供应来源商品统一展示'],
            ['company-checkout', '公司统一结账', '客户只向公司提交主订单'],
            ['company-service', '公司统一服务', '开票、退款与售后均由公司承担'],
          ].map(([capability, title, description]) => (
            <article
              data-capability={capability}
              key={capability}
              style={{
                background: '#ffffff',
                borderLeft: '4px solid #d48932',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <strong
                style={{ color: '#9c571a', display: 'block', marginBottom: 8 }}
              >
                {title}
              </strong>
              <span>{description}</span>
            </article>
          ))}
        </div>
      </section>
    </ShellFrame>
  );
}
