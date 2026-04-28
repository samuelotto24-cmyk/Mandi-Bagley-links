export const config = { runtime: 'edge' };

import { getAllCopy, saveCopy, resetCopy, saveCommsDesign } from '../lib/comms-store.js';

const PASSWORD = process.env.DASHBOARD_PASSWORD || 'Cassandra2024';

function authed(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  return token === PASSWORD;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (!authed(req)) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const all = await getAllCopy();
    return json({ ok: true, comms: all });
  }

  if (req.method === 'POST') {
    const kind = url.searchParams.get('kind');
    const target = url.searchParams.get('target') || 'copy';  // 'copy' | 'design'
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
    try {
      if (target === 'design') {
        const result = await saveCommsDesign(kind, body || {});
        return json({ ok: true, ...result });
      }
      const result = await saveCopy(kind, body);
      return json({ ok: true, ...result });
    } catch (e) {
      return json({ error: String(e.message || e) }, 400);
    }
  }

  if (req.method === 'DELETE') {
    const kind  = url.searchParams.get('kind');
    const field = url.searchParams.get('field') || null;
    try {
      const result = await resetCopy(kind, field);
      return json({ ok: true, ...result });
    } catch (e) {
      return json({ error: String(e.message || e) }, 400);
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
