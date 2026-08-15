import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  COMPANY_LEGAL_NAME,
  PUBLIC_DISPLAY_NAME,
  PUBLIC_CUSTOMER_SERVICE,
  publicNavigation,
} from './public-content';

export function JsonLd({ value }: { readonly value: unknown }) {
  const serialized = JSON.stringify(value).replaceAll('<', '\\u003c');
  return <script dangerouslySetInnerHTML={{ __html: serialized }} type="application/ld+json" />;
}

export function PublicSiteFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="public-site" data-p0-id="P0-027" data-shell-id="portal-public-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link aria-label="福礼团企业门户首页" className="brand" href="/">
            <span className="brand__mark">福</span>
            <span>{PUBLIC_DISPLAY_NAME}</span>
          </Link>
          <nav aria-label="公开门户主导航" className="site-nav">
            {publicNavigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link className="button button--small button--outline" href="/enterprise/login">
            企业登录
          </Link>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="site-footer__grid">
          <div>
            <strong className="site-footer__brand">{PUBLIC_DISPLAY_NAME}</strong>
            <p>{COMPANY_LEGAL_NAME}</p>
            <p>统一销售 · 统一结账 · 统一售后</p>
          </div>
          <div>
            <strong>企业服务</strong>
            <Link href="/about">关于我们</Link>
            <Link href="/capabilities">供应链能力</Link>
            <Link href="/cases">服务场景</Link>
          </div>
          <div>
            <strong>合作入口</strong>
            <Link href="/supplier-cooperation">供应商合作</Link>
            <a href="/supplier/register">供应商注册</a>
            <a href="/supplier/login">供应商登录</a>
          </div>
          <div>
            <strong>联系与公示</strong>
            <Link href="/contact">联系我们</Link>
            <Link href="/news">新闻公告</Link>
            <span>客服：{PUBLIC_CUSTOMER_SERVICE}</span>
          </div>
        </div>
        <div className="site-footer__legal">
          <span>经营主体：{COMPANY_LEGAL_NAME}</span>
          <span>真实域名、备案及协议内容以公司正式发布为准</span>
        </div>
      </footer>
    </div>
  );
}

export function PageHero({
  actions,
  description,
  eyebrow,
  title,
}: {
  readonly actions?: ReactNode;
  readonly description: string;
  readonly eyebrow: string;
  readonly title: string;
}) {
  return (
    <section className="page-hero">
      <div className="page-hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-hero__description">{description}</p>
        {actions ? <div className="button-row">{actions}</div> : null}
      </div>
      <div aria-hidden="true" className="page-hero__visual">
        <span className="page-hero__ring page-hero__ring--one" />
        <span className="page-hero__ring page-hero__ring--two" />
        <span className="page-hero__seal">统一服务</span>
      </div>
    </section>
  );
}

export function SectionHeading({
  description,
  eyebrow,
  title,
}: {
  readonly description?: string;
  readonly eyebrow?: string;
  readonly title: string;
}) {
  return (
    <div className="section-heading">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function ClosingCta({
  description,
  primaryHref,
  primaryLabel,
  title,
}: {
  readonly description: string;
  readonly primaryHref: string;
  readonly primaryLabel: string;
  readonly title: string;
}) {
  const primaryAction = primaryHref.startsWith('/supplier/') ? (
    <a className="button button--light" href={primaryHref}>
      {primaryLabel}
    </a>
  ) : (
    <Link className="button button--light" href={primaryHref}>
      {primaryLabel}
    </Link>
  );

  return (
    <section className="closing-cta">
      <div>
        <p className="eyebrow eyebrow--light">下一步</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="button-row">
        {primaryAction}
        <Link className="button button--ghost" href="/contact">
          联系我们
        </Link>
      </div>
    </section>
  );
}
