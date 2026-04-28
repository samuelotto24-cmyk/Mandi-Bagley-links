export const config = { runtime: 'edge' };

import { getCopy, getBrandForKind } from '../lib/comms-store.js';
import { CLIENT_BRAND } from '../lib/client-config.js';

const REDIS_URL      = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN    = process.env.UPSTASH_REDIS_REST_TOKEN;
const RESEND_KEY     = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.CONTACT_FROM_EMAIL || `hub@${CLIENT_BRAND.domain}`;
const TO_EMAIL       = process.env.CONTACT_TO_EMAIL   || 'samuelotto24@gmail.com';
const SITE_URL       = CLIENT_BRAND.siteUrl;
const SITE_NAME      = CLIENT_BRAND.name;
const PREFIX         = `${CLIENT_BRAND.redisPrefix}applications`;

async function redisCall(path, body) {
  return fetch(`${REDIS_URL}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

  let payload;
  try { payload = await req.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }

  const fields = {
    name:        (payload.name        || '').toString().trim(),
    email:       (payload.email       || '').toString().trim(),
    instagram:   (payload.instagram   || '').toString().trim(),
    phone:       (payload.phone       || '').toString().trim(),
    goals:       (payload.goals       || '').toString().trim(),
    experience:  (payload.experience  || '').toString().trim(),
    budget:      (payload.budget      || '').toString().trim(),
    timeline:    (payload.timeline    || '').toString().trim(),
    note:        (payload.note        || '').toString().trim(),
  };

  if (!fields.name || !fields.email || !fields.goals) {
    return json({ ok: false, error: 'missing_required' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }

  const ts = Date.now();
  const id = `${ts}_${Math.random().toString(36).slice(2, 8)}`;
  const record = { id, ts, ...fields };

  if (REDIS_URL && REDIS_TOKEN) {
    try {
      await redisCall('pipeline', [
        ['LPUSH', PREFIX, JSON.stringify(record)],
        ['LTRIM', PREFIX, '0', '499'],
        ['HINCRBY', `${CLIENT_BRAND.redisPrefix}leads`, 'applications', '1'],
      ]);
    } catch (_) { /* log-and-continue */ }
  }

  if (RESEND_KEY) {
    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
        <h2 style="margin: 0 0 16px; font-size: 20px;">New coaching application — ${SITE_NAME}</h2>
        <table cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="color:#555;width:140px;">Name</td><td><b>${escapeHtml(fields.name)}</b></td></tr>
          <tr><td style="color:#555;">Email</td><td><a href="mailto:${escapeHtml(fields.email)}">${escapeHtml(fields.email)}</a></td></tr>
          <tr><td style="color:#555;">Instagram</td><td>${escapeHtml(fields.instagram) || '—'}</td></tr>
          <tr><td style="color:#555;">Phone</td><td>${escapeHtml(fields.phone) || '—'}</td></tr>
          <tr><td style="color:#555;">Experience</td><td>${escapeHtml(fields.experience) || '—'}</td></tr>
          <tr><td style="color:#555;">Budget</td><td>${escapeHtml(fields.budget) || '—'}</td></tr>
          <tr><td style="color:#555;">Timeline</td><td>${escapeHtml(fields.timeline) || '—'}</td></tr>
          <tr><td colspan="2" style="padding-top:16px;"><b>Goals</b></td></tr>
          <tr><td colspan="2" style="background:#f6f6f4; padding:12px; border-radius:6px; white-space:pre-wrap;">${escapeHtml(fields.goals)}</td></tr>
          ${fields.note ? `
            <tr><td colspan="2" style="padding-top:16px;"><b>Anything else</b></td></tr>
            <tr><td colspan="2" style="background:#f6f6f4; padding:12px; border-radius:6px; white-space:pre-wrap;">${escapeHtml(fields.note)}</td></tr>
          ` : ''}
        </table>
        <p style="margin-top:20px; font-size:12px; color:#888;">Received ${new Date(ts).toUTCString()} · id ${id}</p>
      </div>`;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_KEY}`,
        },
        body: JSON.stringify({
          from: `${SITE_NAME} Apply <${FROM_EMAIL}>`,
          to: [TO_EMAIL],
          reply_to: fields.email,
          subject: `New coaching application — ${fields.name}`,
          html,
        }),
      });
    } catch (_) { /* email failure shouldn't block the user's confirmation */ }

    // ── Applicant auto-response — sets expectations + adds warmth ──
    try {
      const [replyCopy, brand] = await Promise.all([
        getCopy('apply_reply').catch(() => ({})),
        getBrandForKind('apply_reply').catch(() => null),
      ]);
      const replySubject = replyCopy.subject || 'Got your application — talk soon.';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_KEY}`,
        },
        body: JSON.stringify({
          from: `${SITE_NAME} <${FROM_EMAIL}>`,
          to: [fields.email],
          reply_to: TO_EMAIL,
          subject: replySubject,
          html: applicantConfirmationHtml(fields.name, replyCopy, brand),
        }),
      });
    } catch (_) { /* swallow — primary goal already done */ }
  }

  return json({ ok: true, id });
}

function interpolate(str, vars) {
  return String(str || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export function applicantConfirmationHtml(name, copy = {}, brand = null) {
  const B = brand || CLIENT_BRAND;
  const HSIZE = (typeof B.headlineSize === 'number' && B.headlineSize >= 24 && B.headlineSize <= 80) ? B.headlineSize : 42;
  const firstName = escapeHtml((name || '').split(' ')[0] || 'there');

  const kicker     = copy.kicker      ?? 'Application Received';
  const headline   = copy.headline    ?? 'Got it.';
  const intro1     = interpolate(copy.intro_p1   ?? "{firstName} — thank you for applying. I read every application personally, so this isn't going into a black hole.", { firstName });
  const intro2     = copy.intro_p2    ?? "Here's what happens next:";
  const step1      = copy.step1       ?? `Within <strong style="color:${B.text};font-weight:500;">48 hours</strong>, I'll personally review what you wrote and email you back.`;
  const step2      = copy.step2       ?? "If we're a fit, I'll send a short questionnaire and we'll book a 20-minute call to align on goals and timeline.";
  const step3      = copy.step3       ?? "If it's not the right time or fit, I'll tell you that too — with honesty about why and what I'd recommend instead.";
  const waitKick   = copy.wait_kicker ?? 'While you wait —';
  const waitText   = copy.wait_text   ?? "Grab my free 7-day glute &amp; core primer. It's what I run my clients on for the first week of coaching, and it'll give you a feel for how I think about training.";
  const waitCta    = copy.wait_cta    ?? 'Download The Guide →';

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${B.bg};font-family:${B.bodyFont};">
<div style="background:radial-gradient(ellipse 800px 500px at 50% 0%, rgba(201,185,165,0.10) 0%, transparent 60%), ${B.bg};padding:40px 16px;">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:linear-gradient(180deg, ${B.surface} 0%, ${B.surfaceAlt} 100%);border:1px solid ${B.border};box-shadow:0 30px 80px rgba(0,0,0,0.45);">

  <tr><td style="padding:56px 48px 16px;text-align:center;">
    <div style="font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:${B.accent};margin-bottom:22px;font-weight:500;">${kicker}</div>
    <div style="font-family:${B.displayFont};font-size:${HSIZE}px;color:${B.text};line-height:1.05;letter-spacing:-0.015em;">${headline}</div>
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0;"><tr>
      <td width="6" height="6" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
      <td width="60" height="1" style="background:${B.accent};font-size:0;line-height:0;">&nbsp;</td>
      <td width="6" height="6" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:24px 48px 8px;">
    <p style="font-size:16px;line-height:1.75;color:${B.textSoft};margin:0 0 18px;">${intro1}</p>
    <p style="font-size:16px;line-height:1.75;color:${B.textSoft};margin:0 0 18px;">${intro2}</p>
  </td></tr>

  <tr><td style="padding:0 48px 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:14px 0;border-bottom:1px solid ${B.borderSoft};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" width="60" style="font-family:${B.displayFont};font-style:italic;color:${B.accent};font-size:18px;padding-right:14px;">No.01</td>
          <td valign="top" style="font-size:14px;color:${B.textSoft};line-height:1.65;">${step1}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid ${B.borderSoft};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" width="60" style="font-family:${B.displayFont};font-style:italic;color:${B.accent};font-size:18px;padding-right:14px;">No.02</td>
          <td valign="top" style="font-size:14px;color:${B.textSoft};line-height:1.65;">${step2}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" width="60" style="font-family:${B.displayFont};font-style:italic;color:${B.accent};font-size:18px;padding-right:14px;">No.03</td>
          <td valign="top" style="font-size:14px;color:${B.textSoft};line-height:1.65;">${step3}</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 48px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td height="1" style="background:${B.border};font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:32px 48px 8px;">
    <p style="font-size:14px;line-height:1.7;color:${B.textSoft};margin:0 0 12px;"><strong style="color:${B.text};font-weight:500;">${waitKick}</strong></p>
    <p style="font-size:14px;line-height:1.7;color:${B.textSoft};margin:0 0 18px;">${waitText}</p>
    <a href="${SITE_URL}${B.leadMagnetPath}" style="display:inline-block;border:1px solid ${B.accent};color:${B.accent};padding:14px 32px;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;background:rgba(201,185,165,0.04);">${waitCta}</a>
  </td></tr>

  <tr><td style="padding:36px 48px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td height="1" style="background:${B.border};font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:30px 48px 12px;text-align:center;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td width="100" height="1" style="background:linear-gradient(90deg, transparent, ${B.border});font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:0 12px;font-family:${B.displayFont};font-style:italic;font-size:13px;color:${B.accent};opacity:0.75;">until next time</td>
      <td width="100" height="1" style="background:linear-gradient(90deg, ${B.border}, transparent);font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:30px 48px 52px;text-align:center;">
    <div style="font-family:${B.displayFont};font-style:italic;font-size:26px;color:${B.text};line-height:1.15;margin-bottom:8px;letter-spacing:-0.005em;">${B.name}</div>
    <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${B.muted};margin-bottom:22px;">${B.role}</div>
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 22px;"><tr>
      <td width="5" height="5" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
      <td width="60" height="1" style="background:${B.accent};opacity:0.45;font-size:0;line-height:0;">&nbsp;</td>
      <td width="5" height="5" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
    <a href="${SITE_URL}" style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${B.accent};text-decoration:none;">${B.domain}</a>
  </td></tr>

</table>
</div>
</body></html>`;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
