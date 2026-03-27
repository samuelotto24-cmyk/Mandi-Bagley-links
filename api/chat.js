export const config = { runtime: 'edge' };

/* ── Constants ── */
const CLIENT_NAME = 'Mandi Bagley';

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_KEY;

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

function topN(obj, n) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get('password') !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'AI advisor not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const question = body.question;
    const history = body.history || []; // previous messages for context

    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'Question required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pull all Redis data
    const results = await redis([
      ['HGETALL', 'stats:pageviews'],
      ['HGETALL', 'stats:referrers'],
      ['HGETALL', 'stats:countries'],
      ['HGETALL', 'stats:clicks'],
      ['HGETALL', 'stats:hourly'],
      ['HGETALL', 'stats:devices'],
      ['HGETALL', 'stats:browsers'],
      ['HGETALL', 'stats:visitors'],
      ['HGETALL', 'stats:scroll'],
      ['HGETALL', 'stats:duration'],
      ['HGETALL', 'stats:duration_count'],
      ['HGETALL', 'stats:cities'],
      ['HGETALL', 'stats:conversions'],
    ]);

    const data = {
      pageviews:      parseHash(results[0]),
      referrers:      parseHash(results[1]),
      countries:      parseHash(results[2]),
      clicks:         parseHash(results[3]),
      hourly:         parseHash(results[4]),
      devices:        parseHash(results[5]),
      browsers:       parseHash(results[6]),
      visitors:       parseHash(results[7]),
      scroll:         parseHash(results[8]),
      duration:       parseHash(results[9]),
      duration_count: parseHash(results[10]),
      cities:         parseHash(results[11]),
      conversions:    parseHash(results[12]),
    };

    // Compute key metrics for context
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const thisWeekDates = dateRange(today, 0, 7);
    const lastWeekDates = dateRange(today, 7, 7);
    const thisWeekViews = sumForDates(data.pageviews, thisWeekDates);
    const lastWeekViews = sumForDates(data.pageviews, lastWeekDates);
    const todayViews = data.pageviews[todayStr] || 0;

    const totalReferrers = Object.values(data.referrers).reduce((a, b) => a + b, 0);
    const topSources = topN(data.referrers, 5);
    const topCountries = topN(data.countries, 5);
    const topClicks = topN(data.clicks, 8);
    const topCities = topN(data.cities, 5);

    const newV = data.visitors['new'] || 0;
    const retV = data.visitors['returning'] || 0;

    const durTotal = Object.values(data.duration).reduce((a, b) => a + b, 0);
    const durCount = Object.values(data.duration_count).reduce((a, b) => a + b, 0);
    const avgSec = durCount > 0 ? Math.round((durTotal / durCount) / 1000) : 0;

    const scrollTotal = Object.values(data.scroll).reduce((a, b) => a + b, 0);

    // Hourly: aggregate by hour-of-day
    const byHour = {};
    Object.entries(data.hourly).forEach(([key, val]) => {
      const hr = key.split(':').pop();
      byHour[hr] = (byHour[hr] || 0) + val;
    });
    const peakHours = Object.entries(byHour).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Build data context for the AI
    const dataContext = `
## ${CLIENT_NAME}'s Analytics Data (as of ${todayStr})

### Pageviews
- Today: ${todayViews}
- This week (7 days): ${thisWeekViews}
- Last week: ${lastWeekViews}
- Week-over-week change: ${lastWeekViews ? Math.round(((thisWeekViews - lastWeekViews) / lastWeekViews) * 100) : 'N/A'}%

### Traffic Sources (all time)
${topSources.map(([name, count]) => `- ${name}: ${count} (${totalReferrers ? Math.round(count / totalReferrers * 100) : 0}%)`).join('\n')}

### Link Clicks
${topClicks.map(([name, count]) => `- ${name}: ${count} clicks`).join('\n')}

### Conversions (referrer → action)
${topN(data.conversions, 8).map(([path, count]) => `- ${path}: ${count}`).join('\n') || 'No conversion data yet'}

### Audience
- New visitors: ${newV} | Returning: ${retV} (${newV + retV > 0 ? Math.round(retV / (newV + retV) * 100) : 0}% returning)
- Top countries: ${topCountries.map(([c, n]) => `${c} (${n})`).join(', ')}
- Top cities: ${topCities.map(([c, n]) => `${c} (${n})`).join(', ')}
- Devices: ${Object.entries(data.devices).map(([d, n]) => `${d}: ${n}`).join(', ')}

### Engagement
- Avg session duration: ${avgSec} seconds
- Scroll depth: ${Object.entries(data.scroll).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([depth, count]) => `${depth}%: ${scrollTotal ? Math.round(count / scrollTotal * 100) : 0}% of visitors`).join(', ')}

### Best Times (hourly traffic, top 5 hours UTC)
${peakHours.map(([hr, count]) => {
  const h = parseInt(hr);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = (h % 12) || 12;
  return `- ${h12}${ampm}: ${count} views`;
}).join('\n')}
`.trim();

    // Build messages array with conversation history
    const systemPrompt = `You are a personal brand strategist and data analyst for ${CLIENT_NAME}, a creator/influencer. You have access to their complete website analytics data below.

Your role:
- Give specific, data-backed advice. Always reference actual numbers from their data.
- When they ask about posting times, use their hourly traffic data to recommend specific windows.
- When they ask about platforms, compare conversion rates not just traffic volume.
- When they ask what to promote, look at which links get clicks and which don't.
- Be conversational and direct. Speak like a smart friend, not a corporate analyst.
- Keep responses concise — 2-5 sentences unless they ask for detail.
- If you don't have enough data to answer, say so honestly.
- Proactively suggest actions: "you should post...", "try creating...", "focus on..."

CRITICAL RULE: NEVER suggest changes to the website itself. No layout changes, no reorganizing sections, no moving CTAs, no "put this above the fold", no redesign suggestions. The website was custom-built by a professional developer — it is NOT the creator's responsibility to modify it. If you notice a data pattern that might relate to page structure (like low scroll depth), frame it as a content strategy insight ("your audience engages most with the top content — make sure your best offer is what you're promoting") NOT as a page change ("move your CTA higher"). Your advice is ONLY about: when to post, where to post, what content to create, which platforms to focus on, what to promote, and how to interpret their analytics.

${dataContext}`;

    const messages = [];
    // Add conversation history (last 10 messages max)
    const recentHistory = history.slice(-10);
    recentHistory.forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });
    messages.push({ role: 'user', content: question });

    const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error('Claude API error:', errText);
      return new Response(JSON.stringify({ error: 'AI advisor unavailable' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const llmData = await llmRes.json();
    const answer = llmData.content?.[0]?.text || 'I couldn\'t generate a response. Please try again.';

    return new Response(JSON.stringify({ answer }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
