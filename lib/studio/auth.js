// Shared bearer-token auth helper for /api/studio/* endpoints.
// Mirrors the pattern used by api/broadcast.js, api/comms.js, etc.

const PASSWORD = process.env.DASHBOARD_PASSWORD || '__DASHBOARD_PASSWORD__';

export function authed(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  return token === PASSWORD;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
