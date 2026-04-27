export const config = { runtime: 'edge' };

import { listDrafts, getDraft, saveDraft, deleteDraft } from '../lib/broadcast-store.js';

const PASSWORD = process.env.DASHBOARD_PASSWORD || '__DASHBOARD_PASSWORD__';

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
  const id = url.searchParams.get('id');

  if (req.method === 'GET') {
    if (id) {
      const d = await getDraft(id);
      if (!d) return json({ error: 'not_found' }, 404);
      return json({ ok: true, draft: d });
    }
    const drafts = await listDrafts();
    return json({ ok: true, drafts });
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
    try {
      const saved = await saveDraft(body);
      return json({ ok: true, draft: saved });
    } catch (e) {
      return json({ error: String(e.message || e) }, 400);
    }
  }

  if (req.method === 'DELETE') {
    if (!id) return json({ error: 'missing_id' }, 400);
    try {
      await deleteDraft(id);
      return json({ ok: true });
    } catch (e) {
      return json({ error: String(e.message || e) }, 400);
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
