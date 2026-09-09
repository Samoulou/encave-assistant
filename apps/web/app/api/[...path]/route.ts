import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest): Promise<Response> {
  const configured = process.env['ENCAVE_API_ORIGIN'];
  if (!configured) return Response.json({ error: 'identity_not_configured' }, { status: 503 });
  const origin = new URL(configured);
  if (origin.origin !== configured || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && origin.hostname === '127.0.0.1'))) {
    return Response.json({ error: 'identity_not_configured' }, { status: 503 });
  }
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, origin);
  const headers = new Headers();
  for (const name of ['cookie', 'content-type', 'origin', 'x-csrf-token', 'x-encave-cave', 'idempotency-key']) {
    const value = request.headers.get(name); if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(target, {
      method: request.method, headers, redirect: 'manual', cache: 'no-store',
      ...(request.method === 'POST' ? { body: request.body, duplex: 'half' } : {}),
      signal: AbortSignal.timeout(10_000),
    } as RequestInit);
    const output = new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    for (const name of ['content-type', 'location', 'content-disposition']) {
      const value = upstream.headers.get(name); if (value) output.set(name, value);
    }
    for (const value of upstream.headers.getSetCookie()) output.append('Set-Cookie', value);
    return new Response(upstream.body, { status: upstream.status, headers: output });
  } catch { return Response.json({ error: 'service_unavailable' }, { status: 503 }); }
}

export const GET = proxy;
export const POST = proxy;
