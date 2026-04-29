export const config = { runtime: 'edge' };

import { submitQa } from '../lib/studio/qa-store.js';
import { CLIENT_BRAND } from '../lib/client-config.js';
import { studioKey, redisPipeline } from '../lib/studio/redis.js';

// Public endpoint. POST only. No auth.
// Body: { question, email, name?, hp? (honeypot) }
// Side effects: stores in qa_inbox + soft-subscribes to newsletter
//   (disclosed on the form). Soft-subscribe = adds to newsletter_subscribers
//   and Beehiiv (best-effort).

const BEEHIIV_API_KEY    = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); }
  catch { return json({ ok: false, error: 'bad_json' }, 400); }

  // Honeypot
  if (body.hp) return json({ ok: true });  // silently accept bots

  let entry;
  try {
    entry = await submitQa({
      question: body.question,
      email: body.email,
      name: body.name,
    });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg === 'rate_limited') {
      return json({ ok: false, error: 'rate_limited',
        message: 'Looks like you already sent a question recently — try again tomorrow.' }, 429);
    }
    return json({ ok: false, error: msg }, 400);
  }

  // Soft-subscribe to newsletter (best-effort, non-blocking on failure)
  try {
    const ts = Date.now();
    const day = new Date(ts).toISOString().slice(0, 10);
    const PREFIX = (CLIENT_BRAND.redisPrefix || '').replace(/:$/, '');
    await redisPipeline([
      ['LPUSH',   `${PREFIX}:newsletter_subscribers`, JSON.stringify({ email: entry.email, ts, source: 'ask' })],
      ['LTRIM',   `${PREFIX}:newsletter_subscribers`, '0', '499'],
      ['HINCRBY', `${PREFIX}:newsletter_daily`, day, '1'],
      ['HINCRBY', `${PREFIX}:leads`, 'ask_form', '1'],
    ]);
  } catch (_) {}

  // Beehiiv mirror (best-effort)
  if (BEEHIIV_API_KEY && BEEHIIV_PUBLICATION_ID) {
    try {
      await fetch(`https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BEEHIIV_API_KEY}` },
        body: JSON.stringify({
          email: entry.email,
          reactivate_existing: true,
          send_welcome_email: false,
          custom_fields: [{ name: 'source', value: 'ask_form' }],
        }),
      });
    } catch (_) {}
  }

  return json({ ok: true, message: `Got it — I read every question. Watch for an answer in an upcoming letter.` });
}
