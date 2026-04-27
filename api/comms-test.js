export const config = { runtime: 'edge' };

import { getCopy } from '../lib/comms-store.js';
import { getBrand } from '../lib/brand-store.js';
import { welcomeEmailHtml }         from './subscribe.js';
import { midWeekHtml, dayServenHtml } from './nurture-tick.js';
import { applicantConfirmationHtml } from './apply.js';

const PASSWORD   = process.env.DASHBOARD_PASSWORD || '__DASHBOARD_PASSWORD__';
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'hub@__CLIENT_DOMAIN__';
const SITE_NAME  = '__CLIENT_NAME__';

const TEMPLATES = {
  welcome:     { default_subject: 'Your free guide — welcome', render: (copy, brand) => welcomeEmailHtml({ copy, brand }) },
  day4:        { default_subject: "How's the week feeling?",                       render: (copy, brand) => midWeekHtml(copy, brand) },
  day7:        { default_subject: 'You finished. What now?',                       render: (copy, brand) => dayServenHtml(copy, brand) },
  apply_reply: { default_subject: 'Got your application — talk soon.',             render: (copy, brand) => applicantConfirmationHtml('there', copy, brand) },
};

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
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!authed(req))         return json({ error: 'Unauthorized' }, 401);
  if (!RESEND_KEY)          return json({ error: 'Email not configured — wait until DNS + Resend are live.' }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const kind = String(body.kind || '');
  const to   = String(body.to   || '').trim().toLowerCase();
  const tpl  = TEMPLATES[kind];

  if (!tpl) return json({ error: 'unknown_kind' }, 400);
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ error: 'invalid_email' }, 400);

  const [copy, brand] = await Promise.all([
    getCopy(kind).catch(() => ({})),
    getBrand().catch(() => null),
  ]);
  const subject = '[TEST] ' + (copy.subject || tpl.default_subject);
  const html    = tpl.render(copy, brand);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: `${SITE_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return json({ error: 'send_failed', detail: errBody.slice(0, 300) }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'send_failed', detail: String(e) }, 502);
  }
}
