export const config = { runtime: 'edge' };

import { getCopy, getBrandForKind, isCommsDisabled } from '../lib/comms-store.js';
import { CLIENT_BRAND } from '../lib/client-config.js';

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const PUBLICATION_ID  = process.env.BEEHIIV_PUBLICATION_ID;
const REDIS_URL       = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN     = process.env.UPSTASH_REDIS_REST_TOKEN;
const RESEND_KEY      = process.env.RESEND_API_KEY;
const FROM_EMAIL      = process.env.CONTACT_FROM_EMAIL || `hub@${CLIENT_BRAND.domain}`;
const SITE_URL        = CLIENT_BRAND.siteUrl;
const SITE_NAME       = CLIENT_BRAND.name;
const LEAD_MAGNET_URL = `${SITE_URL}${CLIENT_BRAND.leadMagnetPath}`;
const PREFIX          = CLIENT_BRAND.redisPrefix.replace(/:$/, '');

async function redisPipeline(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  return fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
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

export function welcomeEmailHtml({ heroSrc, coverSrc, copy = {}, brand = null } = {}) {
  const B = brand || CLIENT_BRAND;
  // Default to hosted URLs in production; preview can override with base64.
  const HERO  = heroSrc  || `${SITE_URL}/email-assets/welcome-hero.jpg`;
  const COVER = coverSrc || `${SITE_URL}/email-assets/lead-magnet-cover.jpg`;

  // Editable copy with hard-coded fallbacks (so previews still work without Redis).
  const intro1   = copy.intro_p1           ?? `Thank you for joining the list. As promised — your free copy of <em style="color:${B.accent};font-style:italic;">${B.leadMagnetTitle}</em> is ready below.`;
  const intro2   = copy.intro_p2           ?? "It's the same 7-day glute and core primer I run my 1:1 coaching clients on for their first week. Save it, print it, take it to the gym, and use it honestly for one week.";
  const cta      = copy.cta_button         ?? 'Download The Guide';
  const quote    = copy.pull_quote         ?? "If you can do these seven days exactly as written, you're ready for what comes next.";
  const coachH   = copy.coaching_headline  ?? `Want a plan built <em style="color:${B.accent};font-style:italic;">for you</em>?`;
  const coachP   = copy.coaching_paragraph ?? "If after the 7 days you're ready to go further, apply for 1:1 coaching. I read every application personally.";
  const coachCta = copy.coaching_cta       ?? 'Apply for Coaching →';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome — ${B.name}</title>
<!--[if mso]><style>* { font-family: Georgia, serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${B.bg};font-family:${B.bodyFont};-webkit-text-size-adjust:100%;">
<div style="background:radial-gradient(ellipse 800px 500px at 50% 0%, rgba(201,185,165,0.10) 0%, transparent 60%), ${B.bg};padding:40px 16px;">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:linear-gradient(180deg, ${B.surface} 0%, ${B.surfaceAlt} 100%);border:1px solid ${B.border};box-shadow:0 30px 80px rgba(0,0,0,0.45);">

  <!-- ─── HERO BANNER (text baked in) ─── -->
  <tr><td style="padding:0;line-height:0;">
    <a href="${SITE_URL}" style="display:block;text-decoration:none;">
      <img src="${HERO}" alt="Welcome — ${B.name} · ${B.domain}"
           width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />
    </a>
  </td></tr>

  <tr><td style="padding:44px 48px 8px;">
    <p style="font-size:16px;line-height:1.75;color:${B.textSoft};margin:0 0 16px;">${intro1}</p>
    <p style="font-size:16px;line-height:1.75;color:${B.textSoft};margin:0;">${intro2}</p>
  </td></tr>

  <!-- ─── PDF COVER PREVIEW + CTA ─── -->
  <tr><td style="padding:36px 48px 0;" align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding-bottom:28px;">
        <a href="${LEAD_MAGNET_URL}" style="text-decoration:none;display:inline-block;">
          <img src="${COVER}" alt="${B.leadMagnetTitle} — Cover"
               width="220" style="display:block;width:220px;height:auto;border:1px solid ${B.border};box-shadow:0 12px 32px rgba(0,0,0,0.5);" />
        </a>
      </td></tr>
      <tr><td align="center">
        <a href="${LEAD_MAGNET_URL}" style="display:inline-block;background:${B.text};color:${B.bg};padding:19px 50px;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;font-family:${B.bodyFont};box-shadow:0 12px 30px rgba(0,0,0,0.32);border-radius:1px;">${cta}</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- ─── DIVIDER ─── -->
  <tr><td style="padding:48px 48px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td height="1" style="background:${B.border};font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <!-- ─── PULL QUOTE ─── -->
  <tr><td style="padding:32px 48px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(201,185,165,0.045);border:1px solid ${B.borderSoft};border-left:3px solid ${B.accent};">
      <tr><td style="padding:28px 36px 28px 56px;position:relative;">
        <span style="font-family:'Georgia',serif;font-size:88px;color:${B.accent};opacity:0.28;position:absolute;left:18px;top:-6px;line-height:1;font-weight:400;">&ldquo;</span>
        <div style="font-family:${B.displayFont};font-style:italic;font-size:21px;color:${B.text};line-height:1.45;letter-spacing:-0.005em;">${quote}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- ─── COACHING CTA ─── -->
  <tr><td style="padding:48px 48px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td height="1" style="background:${B.border};font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:36px 48px 8px;text-align:center;">
    <div style="font-family:${B.displayFont};font-size:24px;color:${B.text};line-height:1.25;margin-bottom:14px;">${coachH}</div>
    <p style="font-size:15px;color:${B.textSoft};line-height:1.7;margin:0 0 24px;max-width:440px;display:inline-block;">${coachP}</p>
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
      <a href="${SITE_URL}#contact" style="display:inline-block;border:1px solid ${B.accent};color:${B.accent};padding:15px 40px;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;background:rgba(201,185,165,0.04);">${coachCta}</a>
    </td></tr></table>
  </td></tr>

  <!-- ─── SIGNATURE ─── -->
  <tr><td style="padding:48px 48px 12px;">
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

async function sendWelcomeEmail(to) {
  if (!RESEND_KEY) return { ok: false, error: 'no_resend_key' };
  try {
    const [copy, brand] = await Promise.all([
      getCopy('welcome').catch(() => ({})),
      getBrandForKind('welcome').catch(() => null),
    ]);
    const subject = copy.subject || `Your free guide — ${CLIENT_BRAND.leadMagnetTitle}`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: `${SITE_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html: welcomeEmailHtml({ copy, brand }),
      }),
    });
    const ok = res.ok;
    const errBody = ok ? null : await res.text().catch(() => null);
    return { ok, status: res.status, error: errBody };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
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

  let email;
  try {
    const body = await req.json();
    email = (body.email || '').toString().trim().toLowerCase();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }

  const ts  = Date.now();
  const day = new Date(ts).toISOString().slice(0, 10);

  // Always store locally — source of truth for the dashboard.
  // Schedule the Day-7 follow-up (scored by send-time ms).
  const day7Ts = ts + 7 * 24 * 60 * 60 * 1000;
  try {
    await redisPipeline([
      ['LPUSH',   `${PREFIX}:newsletter_subscribers`, JSON.stringify({ email, ts })],
      ['LTRIM',   `${PREFIX}:newsletter_subscribers`, '0', '499'],
      ['HINCRBY', `${PREFIX}:newsletter_daily`, day, '1'],
      ['HINCRBY', `${PREFIX}:leads`, 'newsletter', '1'],
      ['ZADD',    `${PREFIX}:nurture_queue`, String(day7Ts), JSON.stringify({ email, kind: 'day7', enq: ts })],
    ]);
  } catch (_) { /* log-and-continue */ }

  // Send the welcome email — but only if the welcome comm is enabled.
  // She can pause it from Messages → "Emails that send themselves".
  const welcomePaused = await isCommsDisabled('welcome').catch(() => false);
  const welcome = welcomePaused
    ? { ok: true, paused: true }
    : await sendWelcomeEmail(email);

  // Best-effort Beehiiv sync (for the ongoing newsletter; not the magnet).
  let beehiivOk = false;
  if (BEEHIIV_API_KEY && PUBLICATION_ID) {
    try {
      const res = await fetch(
        `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
          },
          body: JSON.stringify({
            email,
            reactivate_existing: true,
            send_welcome_email: false, // we send our own welcome with the magnet
          }),
        }
      );
      beehiivOk = res.status === 200 || res.status === 201;
    } catch (_) { /* swallow */ }
  }

  return json({ ok: true, welcomeSent: welcome.ok, beehiiv: beehiivOk, welcomeError: welcome.error || undefined });
}
