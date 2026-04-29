export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import { listQa, updateQaStatus, deleteQa } from '../../lib/studio/qa-store.js';

export default async function handler(req) {
  if (!authed(req)) return unauthorized();

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  try {
    if (req.method === 'GET') {
      const items = await listQa();
      return json({ ok: true, items });
    }

    if (req.method === 'PATCH') {
      if (!id) return json({ error: 'missing_id' }, 400);
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: 'bad_json' }, 400);
      const item = await updateQaStatus(id, body.status);
      if (!item) return json({ error: 'not_found' }, 404);
      return json({ ok: true, item });
    }

    if (req.method === 'DELETE') {
      if (!id) return json({ error: 'missing_id' }, 400);
      const ok = await deleteQa(id);
      return json({ ok });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}
