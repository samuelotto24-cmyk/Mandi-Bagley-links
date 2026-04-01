export const config = { runtime: 'edge' };

const REDIS_URL    = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_KEY;
const PASSWORD     = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX       = process.env.REDIS_PREFIX || 'stats:';
const CLIENT_NAME  = process.env.CLIENT_NAME || 'Mandi Bagley';
const CLIENT_NICHE = process.env.CLIENT_NICHE || 'Fitness · Faith · Food';
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || 'mandibagley21@gmail.com';
const FROM_EMAIL   = process.env.CONTACT_FROM_EMAIL || 'hub@mandibagley.com';
const REPLY_TO     = process.env.CONTACT_TO_EMAIL || 'samuelotto24@gmail.com';
const HUB_URL      = process.env.HUB_URL || 'https://mandibagley.com/hub/';

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function parseHash(item) {
  if (!item || !item.result) return {};
  const obj = {};
  for (let i = 0; i < item.result.length; i += 2) {
    obj[item.result[i]] = parseInt(item.result[i + 1], 10);
  }
  return obj;
}

function dateRange(today, offsetStart, count) {
  const dates = [];
  for (let i = offsetStart; i < offsetStart + count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function sumForDates(hash, dates) {
  return dates.reduce((sum, d) => sum + (hash[d] || 0), 0);
}

function pctChange(current, previous) {
  if (!previous) return current > 0 ? '+∞%' : '0%';
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function friendlyName(raw) {
  return raw.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default async function handler(req) {
  // Verify cron secret or password via header
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const validCron = token === process.env.CRON_SECRET;
  const validPw = token === PASSWORD;

  if (!validCron && !validPw) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!RESEND_KEY || !REDIS_URL) {
    return new Response(JSON.stringify({ error: 'Missing config' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch all analytics data
    const results = await redis([
      ['HGETALL', PREFIX + 'pageviews'],
      ['HGETALL', PREFIX + 'referrers'],
      ['HGETALL', PREFIX + 'clicks'],
      ['HGETALL', PREFIX + 'hourly'],
      ['HGETALL', PREFIX + 'visitors'],
      ['HGETALL', PREFIX + 'duration'],
      ['HGETALL', PREFIX + 'duration_count'],
      ['GET', PREFIX + 'automations'],
    ]);

    const pageviews = parseHash(results[0]);
    const referrers = parseHash(results[1]);
    const clicks = parseHash(results[2]);
    const hourly = parseHash(results[3]);
    const visitors = parseHash(results[4]);
    const duration = parseHash(results[5]);
    const durationCount = parseHash(results[6]);

    // Engagement automations
    const automationsRaw = results[7]?.result;
    const recapAutomations = automationsRaw ? JSON.parse(automationsRaw) : [];
    let automationRows = '';
    if (recapAutomations.length > 0) {
      const funnelCmds = recapAutomations.map(a => ['HGETALL', PREFIX + 'funnel:' + a.keyword]);
      const funnelRes = await redis(funnelCmds);
      automationRows = '<tr><td colspan="2" style="padding:24px 0 8px;font-size:18px;font-weight:600;border-top:1px solid #eee">Engagement Automations</td></tr>';
      recapAutomations.forEach(function(a, i) {
        const fr = funnelRes[i]?.result || [];
        const stats = {};
        for (let j = 0; j < fr.length; j += 2) stats[fr[j]] = parseInt(fr[j + 1], 10) || 0;
        const pct = stats.comments > 0 ? Math.round((stats.captured || 0) / stats.comments * 100) : 0;
        automationRows += '<tr><td style="padding:6px 0;font-size:14px"><strong>' + a.keyword + '</strong>: '
          + (stats.captured || 0) + ' emails captured (' + pct + '% conversion) — '
          + (stats.comments || 0) + ' comments, ' + (stats.dms || 0) + ' DMs, '
          + (stats.clicks || 0) + ' clicks</td></tr>';
      });
    }

    const today = new Date();
    const thisWeekDates = dateRange(today, 0, 7);
    const lastWeekDates = dateRange(today, 7, 7);
    const thisWeekViews = sumForDates(pageviews, thisWeekDates);
    const lastWeekViews = sumForDates(pageviews, lastWeekDates);
    const wow = pctChange(thisWeekViews, lastWeekViews);

    // Top referrer
    const refEntries = Object.entries(referrers);
    const totalRef = refEntries.reduce((s, [, v]) => s + v, 0);
    let topSource = 'Direct';
    let topSourcePct = 0;
    if (refEntries.length > 0) {
      const [name, count] = refEntries.reduce((a, b) => b[1] > a[1] ? b : a);
      topSource = name;
      topSourcePct = totalRef > 0 ? Math.round((count / totalRef) * 100) : 0;
    }

    // Top link
    const clickEntries = Object.entries(clicks).sort((a, b) => b[1] - a[1]);
    const topLink = clickEntries.length > 0 ? { name: friendlyName(clickEntries[0][0]), clicks: clickEntries[0][1] } : null;

    // Avg session
    const durTotal = Object.values(duration).reduce((a, b) => a + b, 0);
    const durCount = Object.values(durationCount).reduce((a, b) => a + b, 0);
    const avgSession = durCount > 0 ? Math.round(durTotal / durCount / 1000) : 0;

    // Visitors
    const newVisitors = visitors['new'] || 0;
    const returning = visitors['returning'] || 0;

    // Peak hour
    const byHour = {};
    Object.entries(hourly).forEach(([key, val]) => {
      const hr = key.includes(':') ? parseInt(key.split(':').pop(), 10) : parseInt(key, 10);
      if (!isNaN(hr)) byHour[hr] = (byHour[hr] || 0) + val;
    });
    let peakHour = '';
    if (Object.keys(byHour).length > 0) {
      const [h] = Object.entries(byHour).reduce((a, b) => b[1] > a[1] ? b : a);
      const hr = parseInt(h);
      peakHour = (hr % 12 || 12) + (hr >= 12 ? ' PM' : ' AM');
    }

    // Week range label
    const end = new Date(today);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekRange = `${fmt(start)} – ${fmt(end)}`;

    // Generate AI advice
    let advice = '';
    if (ANTHROPIC_KEY) {
      try {
        const prompt = `You are a personal brand strategist for ${CLIENT_NAME}, a ${CLIENT_NICHE} creator.

This week's data:
- ${thisWeekViews.toLocaleString()} views (${wow} vs last week)
- Top source: ${topSource} (${topSourcePct}%)
- Top link: ${topLink ? topLink.name + ' (' + topLink.clicks + ' clicks)' : 'none'}
- Peak hour: ${peakHour || 'unknown'}
- Avg session: ${avgSession}s
- ${returning} returning visitors, ${newVisitors} new

Write 2 short, specific action items for this week. Be direct and conversational — like texting a friend who manages their brand. Reference the actual numbers. Each item should be 1-2 sentences max. Format as two bullet points with a blank line between them. NEVER suggest website layout changes.`;

        const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            system: 'You are a concise brand strategist. Write like a smart friend texting advice. No fluff. Reference real numbers.',
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (llmRes.ok) {
          const llmData = await llmRes.json();
          advice = llmData.content?.[0]?.text || '';
        }
      } catch (e) {
        console.error('Recap AI error:', e);
      }
    }

    // Format advice bullets as HTML
    const adviceHtml = advice
      ? advice.split('\n').filter(l => l.trim()).map(l =>
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#2B1A1A">${l.replace(/^[-•*]\s*/, '')}</p>`
        ).join('')
      : '<p style="margin:0;font-size:15px;color:#2B1A1A">Keep doing what you\'re doing — your audience is growing.</p>';

    // Trend arrow
    const wowNum = parseInt(wow);
    const trendColor = wowNum > 0 ? '#16a34a' : wowNum < 0 ? '#dc2626' : '#6b7280';
    const trendArrow = wowNum > 0 ? '↑' : wowNum < 0 ? '↓' : '→';

    // Build HTML email
    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <!-- Header -->
  <tr><td style="text-align:center;padding:0 0 24px">
    <p style="margin:0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#A08578">Weekly Recap</p>
    <h1 style="margin:8px 0 4px;font-family:Georgia,serif;font-size:28px;font-weight:400;color:#2B1A1A">${weekRange}</h1>
    <p style="margin:0;font-size:13px;color:#8E6B6B">Here's how your page performed this week, ${CLIENT_NAME.split(' ')[0]}.</p>
  </td></tr>

  <!-- Stats bar -->
  <tr><td style="padding:0 0 24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAD0C8;border-radius:12px;overflow:hidden">
      <tr>
        <td style="padding:20px;text-align:center;width:33%;border-right:1px solid #F5EBE6">
          <div style="font-family:Georgia,serif;font-size:28px;color:#2B1A1A">${thisWeekViews.toLocaleString()}</div>
          <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#A08578;margin-top:4px">Views</div>
          <div style="font-size:12px;font-weight:600;color:${trendColor};margin-top:4px">${trendArrow} ${wow}</div>
        </td>
        <td style="padding:20px;text-align:center;width:33%;border-right:1px solid #F5EBE6">
          <div style="font-family:Georgia,serif;font-size:28px;color:#2B1A1A">${topSourcePct}%</div>
          <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#A08578;margin-top:4px">From ${topSource}</div>
        </td>
        <td style="padding:20px;text-align:center;width:33%">
          <div style="font-family:Georgia,serif;font-size:28px;color:#2B1A1A">${topLink ? topLink.clicks.toLocaleString() : '—'}</div>
          <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#A08578;margin-top:4px">${topLink ? topLink.name : 'Top Link'}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Advice section -->
  <tr><td style="padding:0 0 24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAD0C8;border-radius:12px;overflow:hidden">
      <tr><td style="padding:24px">
        <p style="margin:0 0 16px;font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#B8546A">My advice this week</p>
        ${adviceHtml}
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA button -->
  <tr><td style="text-align:center;padding:0 0 32px">
    <a href="${HUB_URL}" style="display:inline-block;padding:14px 32px;background:#B8546A;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:50px;letter-spacing:0.04em">Open Your Hub →</a>
  </td></tr>

  <!-- Reply section -->
  ${automationRows ? `<tr><td style="padding:0 0 24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden">
      ${automationRows}
    </table>
  </td></tr>` : ''}

  <tr><td style="padding:0 0 24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF9F5;border:1px solid #EAD0C8;border-radius:12px;overflow:hidden">
      <tr><td style="padding:24px;text-align:center">
        <p style="margin:0 0 8px;font-size:15px;font-weight:500;color:#2B1A1A">Need anything changed?</p>
        <p style="margin:0;font-size:13px;color:#8E6B6B;line-height:1.5">Want to update a brand code, change a link, add a new partner, or request a feature? Just reply to this email — I'll get it done.</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="text-align:center;padding:16px 0 0;border-top:1px solid #EAD0C8">
    <p style="margin:0;font-size:11px;color:#C4AFA4">Sent by your hub at ${new URL(HUB_URL).hostname}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    // Send via Resend
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${CLIENT_NAME.split(' ')[0]}'s Hub <${FROM_EMAIL}>`,
        to: [CLIENT_EMAIL],
        reply_to: REPLY_TO,
        subject: `Your week: ${thisWeekViews.toLocaleString()} views ${trendArrow} ${wow} — ${weekRange}`,
        html: emailHtml,
      }),
    });

    const sendData = await sendRes.json();

    if (!sendRes.ok) {
      return new Response(JSON.stringify({ error: 'Send failed', details: sendData }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      emailId: sendData.id,
      to: CLIENT_EMAIL,
      subject: `Your week: ${thisWeekViews.toLocaleString()} views ${trendArrow} ${wow}`,
      stats: { views: thisWeekViews, wow, topSource, topLink: topLink?.name },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Recap failed', message: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
