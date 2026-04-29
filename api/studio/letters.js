export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import {
  listLetters, getLetter, createLetter,
  updateLetter, deleteLetter,
} from '../../lib/studio/letters-store.js';

export default async function handler(req) {
  if (!authed(req)) return unauthorized();

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  try {
    if (req.method === 'GET') {
      if (id) {
        const letter = await getLetter(id);
        if (!letter) return json({ error: 'not_found' }, 404);
        return json({ ok: true, letter });
      }
      const letters = await listLetters({ limit: 100 });
      return json({ ok: true, letters });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: 'bad_json' }, 400);
      const letter = await createLetter(body);
      return json({ ok: true, letter });
    }

    if (req.method === 'PATCH') {
      if (!id) return json({ error: 'missing_id' }, 400);
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: 'bad_json' }, 400);
      const letter = await updateLetter(id, body);
      return json({ ok: true, letter });
    }

    if (req.method === 'DELETE') {
      if (!id) return json({ error: 'missing_id' }, 400);
      await deleteLetter(id);
      return json({ ok: true });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === 'not_found' ? 404 : 500;
    return json({ error: msg }, status);
  }
}
