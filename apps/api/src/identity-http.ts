import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac } from 'node:crypto';
import { IdentityError, readCookie, opaqueToken, validToken, equalToken } from './identity-security.ts';
import { IdentityStore, type CommandContext } from './identity-store.ts';
import { IdentityOidc, type OidcSettings } from './identity-oidc.ts';
import { TeamExports } from '@encave/tenancy';
import { CaseStore } from './case-store.ts';

async function jsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') throw new IdentityError(415, 'json_required');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new IdentityError(413, 'request_too_large');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error();
    return body;
  } catch { throw new IdentityError(400, 'invalid_request'); }
}

export function createIdentityHandler(store: IdentityStore, settings: OidcSettings, options: { exportRetentionSeconds?: number } = {}) {
  const authentication = new IdentityOidc(settings, store);
  const exports = new TeamExports(store.pool, options.exportRetentionSeconds ?? 3600);
  const cases = new CaseStore(store.pool);
  const secure = new URL(settings.appOrigin).protocol === 'https:';
  const sessionCookie = secure ? '__Host-encave_session' : 'encave_session';
  const loginCookie = secure ? '__Host-encave_login' : 'encave_login';
  const rateCookie = secure ? '__Host-encave_attempts' : 'encave_attempts';
  const cookie = (name: string, value: string, maxAge: number) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  const signRate = (id: string) => createHmac('sha256', Buffer.from(settings.encryptionKey, 'hex')).update('login-rate:' + id).digest('base64url');
  const browserRate = (value: string) => {
    const [id, signature, extra] = value.split('.');
    return !extra && validToken(id) && validToken(signature) && equalToken(signRate(id), signature) ? id : opaqueToken();
  };
  const loginRates = new Map<string, { count: number; expires: number }>();
  const limited = (key: string) => {
    const now = Date.now();
    for (const [ip, item] of loginRates) if (item.expires <= now) loginRates.delete(ip);
    const current = loginRates.get(key) ?? { count: 0, expires: now + 600_000 };
    if (current.count >= 40) throw new IdentityError(429, 'try_later');
    // Bounded best-effort browser throttling. Network abuse protection belongs at
    // the trusted ingress; a local proxy address must never share one user quota.
    if (!loginRates.has(key) && loginRates.size >= 10_000) loginRates.delete(loginRates.keys().next().value!);
    current.count++; loginRates.set(key, current);
  };
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const send = (status: number, body: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(body)); };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    let path = '';
    try {
      const url = new URL(request.url ?? '/', settings.appOrigin);
      if (url.origin !== settings.appOrigin) throw new IdentityError(400, 'invalid_request');
      path = url.pathname;
      if (request.method === 'GET' && path === '/api/auth/start') {
        const rateId = browserRate(readCookie(request.headers.cookie, rateCookie));
        const rateHeader = cookie(rateCookie, rateId + '.' + signRate(rateId), 600);
        response.setHeader('Set-Cookie', rateHeader);
        limited(rateId);
        const result = await authentication.begin();
        response.setHeader('Set-Cookie', [rateHeader, cookie(loginCookie, result.browser, 600)]);
        response.writeHead(303, { Location: result.url }).end(); return;
      }
      if (request.method === 'GET' && path === '/api/auth/callback') {
        const token = await authentication.finish(url, readCookie(request.headers.cookie, loginCookie));
        response.setHeader('Set-Cookie', [cookie(sessionCookie, token, 8 * 3600), cookie(loginCookie, '', 0)]);
        response.writeHead(303, { Location: settings.appOrigin + '/espace' }).end(); return;
      }
      const context: CommandContext = {
        token: readCookie(request.headers.cookie, sessionCookie),
        csrf: typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
        expectedCave: typeof request.headers['x-encave-cave'] === 'string' ? request.headers['x-encave-cave'] : '',
      };
      if (request.method === 'GET' && path === '/api/session') { send(200, await store.snapshot(context.token)); return; }
      if (request.method === 'GET' && path === '/api/team') { send(200, await store.team(context)); return; }
      const inquiryPath = /^\/api\/inquiries\/([^/]+)$/.exec(path);
      if (request.method === 'GET' && inquiryPath) { send(200, await cases.read(context, inquiryPath[1])); return; }
      if (request.method === 'GET' && path === '/api/team/exports') { send(200, await exports.list(context)); return; }
      const exportPath = /^\/api\/team\/exports\/([^/]+)(\/download)?$/.exec(path);
      if (request.method === 'GET' && exportPath) {
        const result = await exports.get(context, exportPath[1], Boolean(exportPath[2]));
        if ('content' in result) {
          response.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${result.filename}"` }).end(result.content);
        } else send(200, result);
        return;
      }
      if (request.method !== 'POST') { send(404, { error: 'not_found' }); return; }
      if (request.headers.origin !== settings.appOrigin) throw new IdentityError(403, 'origin_forbidden');
      const body = await jsonBody(request);
      if (path === '/api/team/exports') {
        if (Object.keys(body).length) throw new IdentityError(400, 'invalid_request');
        send(202, await exports.create(context, request.headers['idempotency-key'])); return;
      } else if (path === '/api/auth/logout') {
        await store.logout(context);
        response.setHeader('Set-Cookie', cookie(sessionCookie, '', 0));
      } else if (path === '/api/caves/switch') await store.switchCave(context, body.caveId);
      else if (path === '/api/invitations') { send(201, await store.invite(context, body.email, body.role)); return; }
      else if (path === '/api/invitations/preview') { send(200, await store.invitationPreview(context, body.token)); return; }
      else if (path === '/api/invitations/accept') await store.acceptInvitation(context, body.token);
      else if (path === '/api/invitations/revoke') await store.revokeInvitation(context, body.id);
      else if (path === '/api/members/revoke') await store.revokeMember(context, body.identityId, body.version);
      else { send(404, { error: 'not_found' }); return; }
      send(200, { ok: true });
    } catch (error) {
      if (response.headersSent) { response.end(); return; }
      if (path === '/api/auth/callback' || path === '/api/auth/start') {
        const existing = response.getHeader('Set-Cookie');
        response.setHeader('Set-Cookie', [...(Array.isArray(existing) ? existing : typeof existing === 'string' ? [existing] : []), cookie(loginCookie, '', 0)]);
        response.writeHead(303, { Location: settings.appOrigin + '/connexion?erreur=connexion' }).end();
      } else if (error instanceof IdentityError) send(error.status, { error: error.code });
      else send(503, { error: 'service_unavailable' });
      // External messages, authorization codes and SQL details never enter logs.
    }
  };
}
