export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import { getLetter, markLetterSent } from '../../lib/studio/letters-store.js';
import { listDrops } from '../../lib/studio/drops-store.js';
import { renderLetter, buildPlainText } from '../../lib/studio/render.js';
import { listSubscribers } from '../../lib/broadcast-store.js';
import { CLIENT_BRAND } from '../../lib/client-config.js';
import { getBrand } from '../../lib/brand-store.js';
import { studioKey, redisCmd } from '../../lib/studio/redis.js';

const RESEND_KEY        = process.env.RESEND_API_KEY;
const FROM_EMAIL        = process.env.CONTACT_FROM_EMAIL || `hub@${CLIENT_BRAND.domain}`;
const BEEHIIV_API_KEY   = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUB_ID    = process.env.BEEHIIV_PUBLICATION_ID;

const MAX_RECIPIENTS = 500;
const BATCH_SIZE     = 8;
const BATCH_DELAY_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendOne({ to, subject, html, text }) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: `${CLIENT_BRAND.name} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    return { to, ok: res.ok, status: res.status };
  } catch (e) {
    return { to, ok: false, error: String(e) };
  }
}

async function resolveRecipients({ mode, segment, testEmail }) {
  if (mode === 'test') {
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) throw new Error('invalid_test_email');
    return [testEmail];
  }
  if (segment && segment !== 'all') {
    const members = await redisCmd('SMEMBERS', studioKey(`segments:${segment}`));
    if (!members || !members.length) throw new Error('segment_empty');
    return members.slice(0, MAX_RECIPIENTS);
  }
  // Default: all newsletter subscribers (reuse the existing store)
  const subs = await listSubscribers(MAX_RECIPIENTS + 1);
  return subs.slice(0, MAX_RECIPIENTS);
}

// Best-effort Beehiiv mirror — creates the post as a DRAFT (Mandi can publish
// to web from her dashboard once she's verified the Resend send went well).
// Failure is non-fatal.
async function mirrorToBeehiiv({ subject, html, name }) {
  if (!BEEHIIV_API_KEY || !BEEHIIV_PUB_ID) return { ok: false, skipped: true };
  try {
    const res = await fetch(`https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
      },
      body: JSON.stringify({
        title: subject,
        body_content: html,
        status: 'draft',
        recipients: 'none',
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export default async function handler(req) {
  if (!authed(req)) return unauthorized();
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!RESEND_KEY) return json({ error: 'Email not configured — RESEND_API_KEY missing.' }, 503);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'bad_json' }, 400); }

  const letterId  = String(body.letterId || '').trim();
  const mode      = String(body.mode || 'now').toLowerCase();
  const segment   = body.segment ? String(body.segment).trim() : '';
  const testEmail = body.testEmail ? String(body.testEmail).trim().toLowerCase() : '';

  if (!letterId) return json({ error: 'missing_letter_id' }, 400);
  if (!['now', 'test'].includes(mode)) return json({ error: 'unsupported_mode' }, 400);

  // Load
  const letter = await getLetter(letterId);
  if (!letter) return json({ error: 'letter_not_found' }, 404);
  const subject = (letter.subject || letter.name || '').trim();
  if (!subject) return json({ error: 'subject_required' }, 400);
  // Custom HTML letters bypass sections; section letters need at least one
  const isCustom = letter.type === 'custom';
  if (!isCustom && (!letter.sections || !letter.sections.length)) {
    return json({ error: 'no_sections' }, 400);
  }
  if (isCustom && !(letter.customHtml || '').trim()) {
    return json({ error: 'no_html', message: 'Custom letter has no HTML to send.' }, 400);
  }

  // Resolve recipients
  let recipients;
  try {
    recipients = await resolveRecipients({ mode, segment, testEmail });
  } catch (e) {
    return json({ error: String(e.message || e) }, 400);
  }
  if (!recipients.length) return json({ error: 'no_recipients' }, 400);

  // Render with brand overrides applied + drops auto-pulled (sections only)
  const brand = await getBrand().catch(() => CLIENT_BRAND);
  const dataContext = {};
  if (!isCustom) {
    const types = new Set((letter.sections || []).map(s => s?.type).filter(Boolean));
    if (types.has('drops')) {
      const cap = brand.studioConfig?.maxDropsPerLetter || CLIENT_BRAND.studioConfig?.maxDropsPerLetter || 4;
      dataContext.drops = (await listDrops()).slice(0, cap);
    }
    if (types.has('recap')) dataContext.recap = []; // Phase 4 wires this in
  }

  const html = renderLetter(letter, brand, dataContext);
  const text = buildPlainText(letter, brand);
  const finalSubject = mode === 'test' ? '[TEST] ' + subject : subject;

  // Send via Resend in batches
  let sent = 0, failed = 0;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(to => sendOne({ to, subject: finalSubject, html, text })));
    for (const r of results) r.ok ? sent++ : failed++;
    if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_DELAY_MS);
  }

  // Beehiiv mirror — only on real (non-test) sends
  let beehiiv = { ok: false, skipped: true };
  if (mode === 'now') {
    beehiiv = await mirrorToBeehiiv({ subject, html, name: letter.name });
  }

  // Mark sent (only on real sends — test sends don't change status)
  if (mode === 'now') {
    await markLetterSent(letterId).catch(() => {});
  }

  return json({
    ok: true,
    mode,
    sent,
    failed,
    totalRecipients: recipients.length,
    beehiivOk: beehiiv.ok,
    beehiivSkipped: beehiiv.skipped || false,
  });
}
