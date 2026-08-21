import type { Metadata } from 'next';

import {
  COMPANY_LEGAL_NAME,
  PLATFORM_NAME,
  PUBLIC_DISPLAY_NAME,
} from '@fulishe/contracts';

const fallbackOrigin = 'https://fulishe.example.invalid';

function resolveSiteOrigin(): URL {
  const candidate = process.env.NEXT_PUBLIC_PORTAL_ORIGIN ?? fallbackOrigin;
  const origin = new URL(candidate);
  const localDevelopmentOrigin =
    origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname);
  if (origin.protocol !== 'https:' && !localDevelopmentOrigin) {
    throw new Error('PORTAL_ORIGIN_HTTPS_REQUIRED');
  }
  if (origin.username || origin.password || origin.search || origin.hash) {
    throw new Error('PORTAL_ORIGIN_MUST_NOT_CONTAIN_CREDENTIALS_OR_QUERY');
  }
  origin.pathname = '/';
  return origin;
}

export const siteOrigin = resolveSiteOrigin();
export const PUBLIC_CUSTOMER_SERVICE = '189****9999' as const;
export const CONTENT_EFFECTIVE_DATE = '2026-08-02' as const;

export const publicHomeCategories = [
  '食品',
  '家居日用',
  '个护',
  '纸品',
  '家庭清洁',
  '文体办公',
] as const;

export const publicNavigation = [
  { href: '/', label: '首页' },
  { href: '/about', label: '关于福礼团' },
  { href: '/capabilities', label: '供应链能力' },
  { href: '/enterprise-procurement', label: '社区集采' },
  { href: '/contact#enterprise-welfare', label: '福利卡' },
  { href: '/cases', label: '服务场景' },
  { href: '/supplier-cooperation', label: '供应商合作' },
  { href: '/news', label: '新闻公告' },
  { href: '/contact', label: '联系我们' },
] as const;

export const publicRoutes = [
  '/',
  '/about',
  '/capabilities',
  '/enterprise-procurement',
  '/cases',
  '/cases/enterprise-welfare-service',
  '/supplier-cooperation',
  '/news',
  '/news/community-procurement-boundary',
  '/contact',
  '/legal/privacy-policy',
  '/legal/service-agreement',
] as const;

export interface PublicScenario {
  readonly disclosure: string;
  readonly eyebrow: string;
  readonly outcomes: readonly string[];
  readonly slug: string;
  readonly steps: readonly string[];
  readonly summary: string;
  readonly title: string;
}

export const publicScenarios = [
  {
    disclosure:
      '本页是按平台已确认能力整理的匿名服务场景，不代表特定客户案例或客户背书，也不承诺所有企业取得相同结果。',
    eyebrow: '匿名能力场景',
    outcomes: [
      '企业只向平台公司提交一个主订单并统一结账',
      '不同供应来源按供应商拆分备货，由平台公司统一组织企业配送',
      '公司统一承担对客开票、退款与售后责任',
    ],
    slug: 'enterprise-welfare-service',
    steps: ['企业注册认证', '选择适用商品', '跨供应来源统一下单', '平台统一配送', '公司统一售后'],
    summary: '展示员工福利和企业物资采购可复用的服务路径，不使用客户名称、Logo、销量或交易金额。',
    title: '企业福利采购服务路径',
  },
] as const satisfies readonly PublicScenario[];

export interface PublicAuthorizedCase {
  readonly authorizedAt: string;
  readonly customerDisplayName: string;
  readonly serviceType: string;
  readonly slug: string;
  readonly summary: string;
}

// Customer names, logos, images, metrics and endorsements must not be published
// until their explicit public-use authorization has been recorded.
export const publicAuthorizedCases = [] as const satisfies readonly PublicAuthorizedCase[];

export interface PublicAnnouncement {
  readonly applicableTo: string;
  readonly body: readonly string[];
  readonly category: string;
  readonly effectiveAt: string;
  readonly slug: string;
  readonly summary: string;
  readonly title: string;
  readonly version: string;
}

export const publicAnnouncements = [
  {
    applicableTo: '公众访客、企业客户与意向供应商',
    body: [
      '“社区集采”是持续开放的普通企业采购入口，不设置指定社区、活动周期、成团门槛或团长角色。',
      '企业完成注册认证后，可持续浏览符合企业采购标识的商品并向平台公司统一下单、结账和申请售后。',
      '企业采购由平台公司统一组织配送，不生成个人跑腿任务，也不进入跑腿抢单大厅。',
    ],
    category: '服务规则',
    effectiveAt: CONTENT_EFFECTIVE_DATE,
    slug: 'community-procurement-boundary',
    summary: '说明“社区集采”作为普通企业采购入口的固定业务边界。',
    title: '社区集采服务边界说明',
    version: 'V1.1',
  },
] as const satisfies readonly PublicAnnouncement[];

export function getScenario(slug: string): PublicScenario | undefined {
  return publicScenarios.find((scenario) => scenario.slug === slug);
}

export function getAnnouncement(slug: string): PublicAnnouncement | undefined {
  return publicAnnouncements.find((announcement) => announcement.slug === slug);
}

export function buildMetadata({
  description,
  path,
  title,
}: {
  readonly description: string;
  readonly path: string;
  readonly title: string;
}): Metadata {
  return {
    alternates: { canonical: path },
    description,
    openGraph: {
      description,
      locale: 'zh_CN',
      siteName: `${PUBLIC_DISPLAY_NAME}企业门户`,
      title,
      type: 'website',
      url: path,
    },
    title,
  };
}

export function buildWebPageJsonLd({
  description,
  path,
  title,
  type = 'WebPage',
}: {
  readonly description: string;
  readonly path: string;
  readonly title: string;
  readonly type?: 'AboutPage' | 'ContactPage' | 'CollectionPage' | 'WebPage';
}) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    description,
    inLanguage: 'zh-CN',
    isPartOf: {
      '@type': 'WebSite',
      name: `${PUBLIC_DISPLAY_NAME}企业门户`,
      url: siteOrigin.href,
    },
    name: title,
    publisher: {
      '@type': 'Organization',
      legalName: COMPANY_LEGAL_NAME,
      name: PUBLIC_DISPLAY_NAME,
    },
    url: new URL(path, siteOrigin).href,
  };
}

export { COMPANY_LEGAL_NAME, PLATFORM_NAME, PUBLIC_DISPLAY_NAME };
