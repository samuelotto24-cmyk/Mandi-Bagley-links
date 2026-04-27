export const config = { runtime: 'edge' };

const CLIENT_NAME     = 'Cassandra';
const SITE_NAME       = '__CLIENT_NAME__';
const SITE_URL        = 'https://__CLIENT_DOMAIN__';
const DASHBOARD_URL   = 'https://__CLIENT_DOMAIN__/dashboard';
const FROM_EMAIL      = process.env.CONTACT_FROM_EMAIL || 'noreply@__CLIENT_DOMAIN__';
const CLIENT_EMAIL    = process.env.CLIENT_EMAIL || process.env.CONTACT_TO_EMAIL;
const RESEND_KEY      = process.env.RESEND_API_KEY;
const DASH_PASSWORD   = process.env.DASHBOARD_PASSWORD || '__DASHBOARD_PASSWORD__';
const CRON_SECRET     = process.env.CRON_SECRET;

const REDIS_URL       = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN     = process.env.UPSTASH_REDIS_REST_TOKEN;

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

function parseHash(item) {
  if (!item || !item.result) return {};
  const obj = {};
  for (let i = 0; i < item.result.length; i += 2) {
    obj[item.result[i]] = parseInt(item.result[i + 1], 10) || 0;
  }
  return obj;
}
function parseList(item) {
  if (!item || !Array.isArray(item.result)) return [];
  return item.result.map((raw) => { try { return JSON.parse(raw); } catch { return null; } }).filter(Boolean);
}

function sumForDates(hash, dates) {
  return dates.reduce((s, d) => s + (hash[d] || 0), 0);
}
function dateRange(today, offsetStart, count) {
  const dates = [];
  for (let i = offsetStart; i < offsetStart + count; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
function pctChange(current, previous) {
  if (!previous) return current > 0 ? '+∞%' : '0%';
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}
function fmt(n) { return Number(n).toLocaleString('en-US'); }
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isBookingLink(key) {
  const k = key.toLowerCase();
  return k.includes('calendly') || k.includes('program_primary') || k.includes('booking') || k.includes('apply');
}

async function generateAdvice(bullets) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !bullets.length) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 260,
        system: 'You are a sharp, concise brand strategist writing a weekly performance note for a fitness creator. Write in second person. Be specific — reference the actual numbers provided. 2–3 short sentences. Speak like a smart friend who reads their data, not a marketing robot.',
        messages: [{ role: 'user', content: `Creator: ${CLIENT_NAME}\n\nThis week's signals:\n${bullets.map(b => `- ${b}`).join('\n')}\n\nWrite a short advisory note — what should she focus on this week?` }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch { return null; }
}

function buildEmailHtml({ weekRange, metrics, applications, newsletter, topReferrer, topClick, advice }) {
  const apps = applications.slice(0, 5);
  const appsRows = apps.length ? apps.map((a) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2420;color:#ede6d9;font-size:14px;">${escapeHtml(a.name || '—')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2420;color:#8e8578;font-size:12px;"><a href="mailto:${escapeHtml(a.email)}" style="color:#b8a898;text-decoration:none;">${escapeHtml(a.email || '—')}</a></td>
    </tr>`).join('') : '';

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#15110d;">
  <div style="background:#15110d;padding:40px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#1a1613;border:1px solid #2a2420;border-radius:4px;">
      <tr><td style="padding:36px 36px 24px;">
        <div style="font-family:'DM Serif Display',Georgia,serif;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#b8a898;margin-bottom:8px;">Weekly Briefing</div>
        <div style="font-family:'DM Serif Display',Georgia,serif;font-size:28px;color:#ede6d9;line-height:1.2;">${SITE_NAME}</div>
        <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:#8e8578;margin-top:4px;">${weekRange}</div>
      </td></tr>

      ${advice ? `
      <tr><td style="padding:0 36px 28px;">
        <div style="border-left:2px solid #b8a898;padding:4px 0 4px 16px;font-family:'DM Sans',sans-serif;font-size:15px;line-height:1.65;color:#ede6d9;">
          ${escapeHtml(advice).replace(/\n/g, '<br>')}
        </div>
      </td></tr>` : ''}

      <tr><td style="padding:0 36px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="33%" style="padding:0 8px 0 0;">
              <div style="background:#211c18;border:1px solid #2a2420;border-radius:3px;padding:16px;">
                <div style="font-family:'DM Sans',sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8e8578;">Pageviews</div>
                <div style="font-family:'DM Serif Display',Georgia,serif;font-size:26px;color:#ede6d9;margin-top:6px;">${fmt(metrics.thisWeekViews)}</div>
                <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:${metrics.weekOverWeek.startsWith('-') ? '#d87b6a' : '#b8a898'};margin-top:2px;">${metrics.weekOverWeek} vs last week</div>
              </div>
            </td>
            <td width="33%" style="padding:0 4px;">
              <div style="background:#211c18;border:1px solid #2a2420;border-radius:3px;padding:16px;">
                <div style="font-family:'DM Sans',sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8e8578;">Applications</div>
                <div style="font-family:'DM Serif Display',Georgia,serif;font-size:26px;color:#ede6d9;margin-top:6px;">${metrics.applicationsThisWeek}</div>
                <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:#b8a898;margin-top:2px;">${metrics.applicationsTotal} total to date</div>
              </div>
            </td>
            <td width="33%" style="padding:0 0 0 8px;">
              <div style="background:#211c18;border:1px solid #2a2420;border-radius:3px;padding:16px;">
                <div style="font-family:'DM Sans',sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8e8578;">Subscribers</div>
                <div style="font-family:'DM Serif Display',Georgia,serif;font-size:26px;color:#ede6d9;margin-top:6px;">+${newsletter.thisWeek}</div>
                <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:#b8a898;margin-top:2px;">${newsletter.total} total list</div>
              </div>
            </td>
          </tr>
        </table>
      </td></tr>

      ${topReferrer || topClick ? `
      <tr><td style="padding:0 36px 28px;">
        ${topReferrer ? `<div style="font-family:'DM Sans',sans-serif;font-size:13px;color:#ede6d9;margin-bottom:8px;"><span style="color:#8e8578;">Top source:</span> ${escapeHtml(topReferrer)}</div>` : ''}
        ${topClick    ? `<div style="font-family:'DM Sans',sans-serif;font-size:13px;color:#ede6d9;"><span style="color:#8e8578;">Most clicked:</span> ${escapeHtml(topClick)}</div>` : ''}
      </td></tr>` : ''}

      ${apps.length ? `
      <tr><td style="padding:0 36px 28px;">
        <div style="font-family:'DM Serif Display',Georgia,serif;font-size:14px;color:#ede6d9;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px;">Recent Applications</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2a2420;border-radius:3px;">
          ${appsRows}
        </table>
      </td></tr>` : ''}

      <tr><td style="padding:12px 36px 36px;text-align:center;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:#ede6d9;color:#15110d;padding:14px 28px;text-decoration:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;border-radius:2px;">Open Full Dashboard</a>
        <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:#6e665a;margin-top:16px;">${SITE_URL}</div>
      </td></tr>
    </table>
  </div>
</body></html>`;
}

export default async function handler(req) {
  // Auth: accept either Vercel cron signature OR an explicit ?password for manual runs.
  const url  = new URL(req.url);
  const auth = req.headers.get('Authorization') || '';
  const isCron = CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
  const isManual = url.searchParams.get('password') === DASH_PASSWORD;
  if (!isCron && !isManual) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!RESEND_KEY || !CLIENT_EMAIL) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_config' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const results = await redis([
      ['HGETALL', '__CLIENT_SLUG__:pageviews'],
      ['HGETALL', '__CLIENT_SLUG__:referrers'],
      ['HGETALL', '__CLIENT_SLUG__:clicks'],
      ['HGETALL', '__CLIENT_SLUG__:newsletter_daily'],
      ['HGET',    '__CLIENT_SLUG__:leads', 'newsletter'],
      ['LRANGE',  '__CLIENT_SLUG__:applications', '0', '19'],
      ['LLEN',    '__CLIENT_SLUG__:applications'],
    ]);
    const pv = parseHash(results[0]);
    const ref = parseHash(results[1]);
    const clicks = parseHash(results[2]);
    const nlDaily = parseHash(results[3]);
    const nlTotal = parseInt(results[4]?.result, 10) || 0;
    const applications = parseList(results[5]);
    const applicationsTotal = parseInt(results[6]?.result, 10) || 0;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const thisWeek = dateRange(today, 0, 7);
    const lastWeek = dateRange(today, 7, 7);

    const thisWeekViews = sumForDates(pv, thisWeek);
    const lastWeekViews = sumForDates(pv, lastWeek);

    const weekStart = new Date(today); weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const cutoff = weekStart.getTime();
    const appsThisWeek = applications.filter(a => Number(a.ts) >= cutoff);

    const newsletter = {
      thisWeek: sumForDates(nlDaily, thisWeek),
      lastWeek: sumForDates(nlDaily, lastWeek),
      total:    nlTotal,
    };

    const topReferrerKey = Object.entries(ref).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topClickKey    = Object.entries(clicks).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const bookingClicks  = Object.entries(clicks).filter(([k]) => isBookingLink(k)).reduce((s, [, v]) => s + v, 0);

    const fmtRange = (d) => {
      const end = new Date(d);
      const start = new Date(d); start.setUTCDate(start.getUTCDate() - 6);
      const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
      return `${start.toLocaleDateString('en-US', opts)}–${end.toLocaleDateString('en-US', opts)}`;
    };

    const metrics = {
      thisWeekViews,
      weekOverWeek:       pctChange(thisWeekViews, lastWeekViews),
      applicationsThisWeek: appsThisWeek.length,
      applicationsTotal,
    };

    // Bullets for the LLM — plain-language numbers, not raw flags
    const bullets = [];
    bullets.push(`${thisWeekViews} pageviews this week (${metrics.weekOverWeek} vs last week)`);
    bullets.push(`${appsThisWeek.length} new coaching application${appsThisWeek.length === 1 ? '' : 's'} this week`);
    bullets.push(`${newsletter.thisWeek} newsletter signup${newsletter.thisWeek === 1 ? '' : 's'} this week`);
    if (topReferrerKey) bullets.push(`Top traffic source: ${topReferrerKey}`);
    if (topClickKey)    bullets.push(`Most-clicked link: ${topClickKey}`);
    if (bookingClicks)  bullets.push(`${bookingClicks} booking/apply button clicks this week`);

    const advice = await generateAdvice(bullets);

    const html = buildEmailHtml({
      weekRange: fmtRange(today),
      metrics,
      applications: appsThisWeek,
      newsletter,
      topReferrer: topReferrerKey,
      topClick:    topClickKey,
      advice,
    });

    const subject = appsThisWeek.length > 0
      ? `Your weekly briefing — ${appsThisWeek.length} new application${appsThisWeek.length === 1 ? '' : 's'}`
      : `Your weekly briefing — ${thisWeekViews} views this week`;

    // Preview mode: return the HTML that would be sent, without calling Resend.
    if (url.searchParams.get('preview') === '1') {
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Preview-send: let caller override the from/to via query for a one-off test
    // (only works when auth'd manually, not via cron).
    const overrideFrom = isManual ? url.searchParams.get('from') : null;
    const overrideTo   = isManual ? url.searchParams.get('to')   : null;
    const fromAddr = overrideFrom || FROM_EMAIL;
    const toAddr   = overrideTo   || CLIENT_EMAIL;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: `${SITE_NAME} <${fromAddr}>`,
        to: [toAddr],
        subject,
        html,
      }),
    });

    const ok = emailRes.ok;
    const resendBody = ok ? null : await emailRes.text().catch(() => null);
    return new Response(JSON.stringify({
      ok,
      subject,
      from: fromAddr,
      to: toAddr,
      viewsThisWeek: thisWeekViews,
      applicationsThisWeek: appsThisWeek.length,
      newsletterThisWeek: newsletter.thisWeek,
      hasAdvice: Boolean(advice),
      resendStatus: emailRes.status,
      resendError: resendBody,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
