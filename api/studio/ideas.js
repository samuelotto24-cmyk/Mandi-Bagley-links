export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import {
  listIdeas, addIdea, updateIdeaStatus, deleteIdea,
} from '../../lib/studio/ideas-store.js';

export default async function handler(req) {
  if (!authed(req)) return unauthorized();

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  try {
    if (req.method === 'GET') {
      const ideas = await listIdeas();
      return json({ ok: true, ideas });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: 'bad_json' }, 400);
      const idea = await addIdea(body);
      return json({ ok: true, idea });
    }

    if (req.method === 'PATCH') {
      if (!id) return json({ error: 'missing_id' }, 400);
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: 'bad_json' }, 400);
      const idea = await updateIdeaStatus(id, body.status);
      if (!idea) return json({ error: 'not_found' }, 404);
      return json({ ok: true, idea });
    }

    if (req.method === 'DELETE') {
      if (!id) return json({ error: 'missing_id' }, 400);
      const ok = await deleteIdea(id);
      return json({ ok });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    const msg = String(e?.message || e);
    return json({ error: msg }, 500);
  }
}
