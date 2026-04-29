export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import {
  listDrops, getDrop, createDrop, updateDrop,
  expireDrop, restoreDrop, deleteDrop,
} from '../../lib/studio/drops-store.js';

export default async function handler(req) {
  if (!authed(req)) return unauthorized();

  const url = new URL(req.url);
  const id  = url.searchParams.get('id');
  const archivedFlag = url.searchParams.get('archived') === '1';

  try {
    if (req.method === 'GET') {
      if (id) {
        const drop = await getDrop(id);
        if (!drop) return json({ error: 'not_found' }, 404);
        return json({ ok: true, drop });
      }
      const drops = await listDrops({ archived: archivedFlag });
      return json({ ok: true, drops });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: 'bad_json' }, 400);
      const drop = await createDrop(body);
      return json({ ok: true, drop });
    }

    if (req.method === 'PATCH') {
      if (!id) return json({ error: 'missing_id' }, 400);
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: 'bad_json' }, 400);

      // PATCH supports two special verbs in the body: action: 'expire' | 'restore'
      if (body.action === 'expire') {
        const drop = await expireDrop(id);
        return json({ ok: true, drop });
      }
      if (body.action === 'restore') {
        const drop = await restoreDrop(id);
        return json({ ok: true, drop });
      }

      const drop = await updateDrop(id, body);
      return json({ ok: true, drop });
    }

    if (req.method === 'DELETE') {
      if (!id) return json({ error: 'missing_id' }, 400);
      await deleteDrop(id);
      return json({ ok: true });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === 'not_found' ? 404
      : msg.endsWith('_required') ? 400
      : 500;
    return json({ error: msg }, status);
  }
}
