import type { ReactNode } from 'react';

export interface ShellFrameProps {
  readonly audience: string;
  readonly boundary: string;
  readonly children?: ReactNode;
  readonly shellId: string;
  readonly title: string;
}

export function ShellFrame({ audience, boundary, children, shellId, title }: ShellFrameProps) {
  return (
    <main
      data-shell-id={shellId}
      style={{
        background: 'linear-gradient(145deg, #eef9f7 0%, #f8fbff 65%, #fff3ef 100%)',
        boxSizing: 'border-box',
        color: '#16363d',
        minHeight: '100vh',
        padding: 'clamp(24px, 5vw, 64px)',
      }}
    >
      <section
        style={{
          background: '#ffffff',
          border: '1px solid #d9ebe8',
          borderRadius: 18,
          boxShadow: '0 18px 48px rgba(15, 118, 110, 0.10)',
          margin: '0 auto',
          maxWidth: 960,
          padding: 'clamp(24px, 4vw, 48px)',
        }}
      >
        <p style={{ color: '#0f766e', fontWeight: 700, letterSpacing: 1, margin: 0 }}>
          福礼社 · 应用壳
        </p>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', margin: '12px 0' }}>{title}</h1>
        <p style={{ color: '#49656b', fontSize: 16, lineHeight: 1.7 }}>
          使用者：{audience}
          <br />
          当前冻结边界：{boundary}
        </p>
        <div
          style={{
            background: '#fff3ef',
            borderLeft: '4px solid #e95b48',
            borderRadius: 8,
            color: '#7c352c',
            marginTop: 24,
            padding: '14px 16px',
          }}
        >
          当前仅提供可构建入口和技术边界，不代表任何业务页面或交易能力已经完成。
        </div>
        {children}
      </section>
    </main>
  );
}
