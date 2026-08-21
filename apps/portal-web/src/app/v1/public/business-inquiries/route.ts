import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const safeHeader = (request: Request, name: string): string | undefined => {
  const value = request.headers.get(name)?.trim();
  return value || undefined;
};

export async function POST(request: Request): Promise<Response> {
  const apiBase = process.env.PORTAL_API_BASE_URL ?? 'http://127.0.0.1:3000';
  const requestOrigin = safeHeader(request, 'origin') ?? new URL(request.url).origin;
  const headers = new Headers({
    'Content-Type': 'application/json',
    Origin: requestOrigin,
    'Sec-Fetch-Site': safeHeader(request, 'sec-fetch-site') ?? 'same-origin',
  });
  for (const name of ['idempotency-key', 'x-captcha-token', 'x-request-id']) {
    const value = safeHeader(request, name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(`${apiBase}/v1/public/business-inquiries`, {
      body: await request.text(),
      cache: 'no-store',
      headers,
      method: 'POST',
    });
    const responseHeaders = new Headers({
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });
    for (const name of ['idempotency-replayed', 'x-request-id']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(await upstream.text(), {
      headers: responseHeaders,
      status: upstream.status,
    });
  } catch {
    return NextResponse.json(
      { code: 'SERVICE_UNAVAILABLE', message: 'Business inquiry service is unavailable' },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
        status: 503,
      },
    );
  }
}
