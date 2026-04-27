export const config = { runtime: 'edge' };

import { getCopy } from '../lib/comms-store.js';
import { CLIENT_BRAND } from '../lib/client-config.js';
import { getBrand } from '../lib/brand-store.js';

const REDIS_URL    = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.CONTACT_FROM_EMAIL || `hub@${CLIENT_BRAND.domain}`;
const SITE_URL     = CLIENT_BRAND.siteUrl;
const SITE_NAME    = CLIENT_BRAND.name;
const CRON_SECRET  = process.env.CRON_SECRET;

const QUEUE_KEY = `${CLIENT_BRAND.redisPrefix}nurture_queue`;

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Email templates — same dark editorial aesthetic as welcome ── */

export function midWeekHtml(copy = {}, brand = null) {
  const B = brand || CLIENT_BRAND;
  const kicker      = copy.kicker      ?? 'The Mid-Week';
  const headline    = copy.headline    ?? 'Day Four.';
  const subhead     = copy.subheadline ?? 'The hard part is behind you.';
  const intro1      = copy.intro_p1    ?? "If you're here, you're three days into the program — and that means you've already done the part most people quit at: starting.";
  const intro2      = copy.intro_p2    ?? "Day 4 is active recovery. Walk. Stretch. Sleep. The work you just did needs the rest you're about to take.";
  const quote       = copy.pull_quote  ?? 'Most people skip recovery and call it discipline. The pros build their physiques in it.';
  const closing1    = copy.closing_p1  ?? 'Three more days. Stay with it.';
  const closing2    = copy.closing_p2  ?? `If you're loving the framework and want a plan built around <em style="color:${B.accent};font-style:italic;">your</em> body and goals, the application is open.`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${B.bg};font-family:${B.bodyFont};">
<div style="background:radial-gradient(ellipse 800px 500px at 50% 0%, rgba(201,185,165,0.10) 0%, transparent 60%), ${B.bg};padding:40px 16px;">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:linear-gradient(180deg, ${B.surface} 0%, ${B.surfaceAlt} 100%);border:1px solid ${B.border};box-shadow:0 30px 80px rgba(0,0,0,0.45);">

  <tr><td style="padding:56px 48px 16px;text-align:center;">
    <div style="font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:${B.accent};margin-bottom:22px;font-weight:500;">${kicker}</div>
    <div style="font-family:${B.displayFont};font-size:46px;color:${B.text};line-height:1.05;letter-spacing:-0.015em;">${headline}</div>
    <div style="font-family:${B.displayFont};font-style:italic;font-size:18px;color:${B.accent};margin-top:14px;">${subhead}</div>
  </td></tr>

  <tr><td style="padding:32px 48px 8px;">
    <p style="font-size:16px;line-height:1.75;color:${B.textSoft};margin:0 0 18px;">${intro1}</p>
    <p style="font-size:16px;line-height:1.75;color:${B.textSoft};margin:0 0 18px;">${intro2}</p>
  </td></tr>

  <tr><td style="padding:24px 48px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(201,185,165,0.045);border:1px solid ${B.borderSoft};border-left:3px solid ${B.accent};">
      <tr><td style="padding:28px 36px 28px 56px;position:relative;">
        <span style="font-family:'Georgia',serif;font-size:88px;color:${B.accent};opacity:0.28;position:absolute;left:18px;top:-6px;line-height:1;font-weight:400;">&ldquo;</span>
        <div style="font-family:${B.displayFont};font-style:italic;font-size:21px;color:${B.text};line-height:1.45;letter-spacing:-0.005em;">${quote}</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:32px 48px 8px;">
    <p style="font-size:16px;line-height:1.75;color:${B.textSoft};margin:0 0 18px;">A quick check-in for you:</p>
  </td></tr>

  <tr><td style="padding:0 48px 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:14px 0;border-bottom:1px solid ${B.borderSoft};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" width="50" style="font-family:${B.displayFont};font-style:italic;color:${B.accent};font-size:18px;padding-right:14px;">→</td>
          <td valign="top" style="font-size:14px;color:${B.textSoft};line-height:1.65;"><strong style="color:${B.text};font-weight:500;">Are you sleeping 7+ hours?</strong> If not, the lifts can't do their job.</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid ${B.borderSoft};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" width="50" style="font-family:${B.displayFont};font-style:italic;color:${B.accent};font-size:18px;padding-right:14px;">→</td>
          <td valign="top" style="font-size:14px;color:${B.textSoft};line-height:1.65;"><strong style="color:${B.text};font-weight:500;">Are you hitting your steps?</strong> 8,000 a day is the floor, not the ceiling.</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" width="50" style="font-family:${B.displayFont};font-style:italic;color:${B.accent};font-size:18px;padding-right:14px;">→</td>
          <td valign="top" style="font-size:14px;color:${B.textSoft};line-height:1.65;"><strong style="color:${B.text};font-weight:500;">Are you feeling the right muscles work?</strong> Form &gt; weight, every time.</td>
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
    <p style="font-size:14px;line-height:1.7;color:${B.textSoft};margin:0 0 12px;">${closing1}</p>
    <p style="font-size:14px;line-height:1.7;color:${B.textSoft};margin:0;">${closing2}</p>
  </td></tr>

  <tr><td style="padding:24px 48px 8px;">
    <a href="${SITE_URL}#contact" style="display:inline-block;border:1px solid ${B.accent};color:${B.accent};padding:14px 32px;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;background:rgba(201,185,165,0.04);">Apply for Coaching →</a>
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

export function dayServenHtml(copy = {}, brand = null) {
  const B = brand || CLIENT_BRAND;
  const kicker     = copy.kicker      ?? 'You Finished.';
  const headline   = copy.headline    ?? 'Now what?';
  const intro1     = copy.intro_p1    ?? 'Seven days. Thirty-something exercises. Two glute-volume sessions, one rest day, four heavy lifts on the priority list.';
  const intro2     = copy.intro_p2    ?? "If you actually did the work — congratulations. You're now somewhere most of the people who downloaded that PDF will never reach.";
  const quote      = copy.pull_quote  ?? 'There are two paths from here. Both are valid.';
  const path1Title = copy.path1_title ?? 'Run it again.';
  const path1Text  = copy.path1_text  ?? 'If the framework feels right and you want to dial in form before progressing, repeat the seven days. Track each lift. The second pass is always sharper than the first.';
  const path2Title = copy.path2_title ?? 'Get a plan built for you.';
  const path2Text  = copy.path2_text  ?? 'If you want a custom program — built around your body, your schedule, your goals, with weekly check-ins and form review from me — apply for 1:1 coaching. Spots are intentionally limited. I read every application.';
  const path2Cta   = copy.path2_cta   ?? 'Apply for Coaching →';
  const closing    = copy.closing     ?? "Either way, I'll keep showing up in your inbox with the kind of training and mindset content I send my paid clients. No fluff, no filler.";

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${B.bg};font-family:${B.bodyFont};">
<div style="background:radial-gradient(ellipse 800px 500px at 50% 0%, rgba(201,185,165,0.10) 0%, transparent 60%), ${B.bg};padding:40px 16px;">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:linear-gradient(180deg, ${B.surface} 0%, ${B.surfaceAlt} 100%);border:1px solid ${B.border};box-shadow:0 30px 80px rgba(0,0,0,0.45);">

  <tr><td style="padding:56px 48px 16px;text-align:center;">
    <div style="font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:${B.accent};margin-bottom:22px;font-weight:500;">${kicker}</div>
    <div style="font-family:${B.displayFont};font-size:50px;color:${B.text};line-height:1;letter-spacing:-0.02em;">${headline}</div>
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0;"><tr>
      <td width="6" height="6" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
      <td width="60" height="1" style="background:${B.accent};font-size:0;line-height:0;">&nbsp;</td>
      <td width="6" height="6" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:32px 48px 8px;">
    <p style="font-size:16px;line-height:1.75;color:${B.textSoft};margin:0 0 18px;">${intro1}</p>
    <p style="font-size:16px;line-height:1.75;color:${B.textSoft};margin:0 0 18px;">${intro2}</p>
  </td></tr>

  <tr><td style="padding:24px 48px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(201,185,165,0.045);border:1px solid ${B.borderSoft};border-left:3px solid ${B.accent};">
      <tr><td style="padding:28px 36px 28px 56px;position:relative;">
        <span style="font-family:'Georgia',serif;font-size:88px;color:${B.accent};opacity:0.28;position:absolute;left:18px;top:-6px;line-height:1;font-weight:400;">&ldquo;</span>
        <div style="font-family:${B.displayFont};font-style:italic;font-size:21px;color:${B.text};line-height:1.45;letter-spacing:-0.005em;">${quote}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- ── Path 1 — Repeat ── -->
  <tr><td style="padding:36px 48px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:${B.surfaceAlt};border:1px solid ${B.border};border-left:3px solid ${B.accent};padding:24px 28px;">
        <div style="font-family:${B.displayFont};font-style:italic;font-size:14px;color:${B.accent};margin-bottom:8px;">Path No.01</div>
        <div style="font-family:${B.displayFont};font-size:22px;color:${B.text};line-height:1.2;margin-bottom:10px;">${path1Title}</div>
        <p style="font-size:14px;color:${B.textSoft};line-height:1.65;margin:0;">${path1Text}</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- ── Path 2 — Apply ── -->
  <tr><td style="padding:14px 48px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:${B.surfaceAlt};border:1px solid ${B.border};border-left:3px solid ${B.accent};padding:24px 28px;">
        <div style="font-family:${B.displayFont};font-style:italic;font-size:14px;color:${B.accent};margin-bottom:8px;">Path No.02</div>
        <div style="font-family:${B.displayFont};font-size:22px;color:${B.text};line-height:1.2;margin-bottom:10px;">${path2Title}</div>
        <p style="font-size:14px;color:${B.textSoft};line-height:1.65;margin:0 0 16px;">${path2Text}</p>
        <a href="${SITE_URL}#contact" style="display:inline-block;background:${B.text};color:${B.bg};padding:15px 36px;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;box-shadow:0 8px 20px rgba(0,0,0,0.32);">${path2Cta}</a>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:36px 48px 8px;">
    <p style="font-size:14px;line-height:1.7;color:${B.textSoft};margin:0;">${closing}</p>
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

// Maps queue kind → comms key + default subject + template renderer.
const TEMPLATES = {
  midweek: { commsKey: 'day4', defaultSubject: "How's the week feeling?", html: midWeekHtml   },
  day7:    { commsKey: 'day7', defaultSubject: 'You finished. What now?', html: dayServenHtml },
};

async function sendEmail(to, kind) {
  const tpl = TEMPLATES[kind];
  if (!tpl || !RESEND_KEY) return false;
  try {
    const [copy, brand] = await Promise.all([
      getCopy(tpl.commsKey).catch(() => ({})),
      getBrand().catch(() => null),
    ]);
    const subject = copy.subject || tpl.defaultSubject;
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
        html: tpl.html(copy, brand),
      }),
    });
    return res.ok;
  } catch { return false; }
}

export default async function handler(req) {
  // Vercel cron auth (or ?password fallback for manual testing).
  const url = new URL(req.url);
  const auth = req.headers.get('Authorization') || '';
  const isCron = CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
  const isManual = url.searchParams.get('password') === (process.env.DASHBOARD_PASSWORD || '__DASHBOARD_PASSWORD__');
  if (!isCron && !isManual) return new Response('Unauthorized', { status: 401 });

  const now = Date.now();

  // Pull all queue entries due now or earlier
  const res = await redis([['ZRANGEBYSCORE', QUEUE_KEY, '0', String(now), 'LIMIT', '0', '50']]);
  const due = res?.[0]?.result || [];

  let sent = 0;
  let failed = 0;
  const removeArgs = ['ZREM', QUEUE_KEY];

  for (const entry of due) {
    let parsed;
    try { parsed = JSON.parse(entry); } catch { removeArgs.push(entry); continue; }
    const ok = await sendEmail(parsed.email, parsed.kind);
    if (ok) sent++; else failed++;
    removeArgs.push(entry); // remove regardless — don't infinite-retry
  }

  if (removeArgs.length > 2) {
    await redis([removeArgs]);
  }

  return new Response(JSON.stringify({
    ok: true,
    due: due.length,
    sent,
    failed,
    timestamp: new Date(now).toISOString(),
  }), { headers: { 'Content-Type': 'application/json' } });
}
