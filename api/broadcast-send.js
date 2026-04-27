export const config = { runtime: 'edge' };

import { getDraft, saveDraft, listSubscribers, recordSent } from '../lib/broadcast-store.js';
import { renderBroadcast } from '../lib/broadcast-renderer.js';
import { CLIENT_BRAND } from '../lib/client-config.js';
import { getBrand } from '../lib/brand-store.js';

const PASSWORD   = process.env.DASHBOARD_PASSWORD || '__DASHBOARD_PASSWORD__';
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || `hub@${CLIENT_BRAND.domain}`;

const MAX_RECIPIENTS = 500;     // hard cap per blast (safety net)
const BATCH_SIZE     = 8;       // parallel Resend calls per batch
const BATCH_DELAY_MS = 250;     // gap between batches to avoid rate limits

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

async function sendOne({ to, subject, html }) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: `${CLIENT_BRAND.name} <${FROM_EMAIL}>`, to: [to], subject, html }),
    });
    return { to, ok: res.ok, status: res.status };
  } catch (e) {
    return { to, ok: false, error: String(e) };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req) {
  if (req.method !== 'POST')   return new Response('Method not allowed', { status: 405 });
  if (!authed(req))            return json({ error: 'Unauthorized' }, 401);
  if (!RESEND_KEY)             return json({ error: 'Email not configured — DNS + Resend must be live first.' }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const id        = String(body.id        || '').trim();
  const testTo    = String(body.test_to   || '').trim().toLowerCase();
  const draftIn   = body.draft || null;       // optional inline draft (preview-style send-test)

  // Source the draft from Redis or from the inline body
  let draft = null;
  if (id) {
    draft = await getDraft(id);
    if (!draft) return json({ error: 'draft_not_found' }, 404);
  } else if (draftIn) {
    draft = draftIn;
  } else {
    return json({ error: 'missing_draft_or_id' }, 400);
  }

  if (!draft.subject || !draft.body) {
    return json({ error: 'subject_and_body_required' }, 400);
  }

  const brand = await getBrand().catch(() => null);
  const html = renderBroadcast(draft, brand);

  // ── Test-only path: one recipient, prefix subject with [TEST]
  if (testTo) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) return json({ error: 'invalid_email' }, 400);
    const result = await sendOne({ to: testTo, subject: '[TEST] ' + draft.subject, html });
    if (!result.ok) return json({ error: 'send_failed', detail: result.error || `status_${result.status}` }, 502);
    return json({ ok: true, mode: 'test', to: testTo });
  }

  // ── Real broadcast — only allowed with a stored draft id (no inline send-to-list)
  if (!id) return json({ error: 'real_send_requires_saved_draft' }, 400);

  const subscribers = (await listSubscribers(MAX_RECIPIENTS + 1)).slice(0, MAX_RECIPIENTS);
  if (!subscribers.length) {
    return json({ error: 'no_subscribers', detail: 'No newsletter subscribers yet — check back after launch.' }, 400);
  }

  // Batch with delay so Resend doesn't rate-limit us
  let sent = 0; let failed = 0;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((to) => sendOne({ to, subject: draft.subject, html })));
    for (const r of results) (r.ok ? sent++ : failed++);
    if (i + BATCH_SIZE < subscribers.length) await sleep(BATCH_DELAY_MS);
  }

  // Mark the draft as sent and record the broadcast
  draft.status = 'sent';
  draft.sentAt = Date.now();
  draft.recipientCount = sent;
  await saveDraft(draft).catch(() => {});
  await recordSent({ id, draft, recipientCount: sent }).catch(() => {});

  return json({ ok: true, mode: 'broadcast', sent, failed, totalSubscribers: subscribers.length });
}
