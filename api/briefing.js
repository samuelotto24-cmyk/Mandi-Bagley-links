export const config = { runtime: 'edge' };

/* ── Constants (replaced per deployment) ── */
const CLIENT_NAME = 'Mandi Bagley';

const BOOKING_LINKS = ['calendly', 'program_primary', 'booking', 'call'];
function isBookingLink(key) {
  return BOOKING_LINKS.some((b) => key.toLowerCase().includes(b));
}

/* ── Redis / parsing (same pattern as stats.js) ── */
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';

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
    obj[item.result[i]] = parseInt(item.result[i + 1], 10);
  }
  return obj;
}

/* ── Aggregation helpers ── */

/** Returns "+12%" or "-8%" style string */
function pctChange(current, previous) {
  if (!previous) return current > 0 ? '+∞%' : '0%';
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

/** Returns the key with the highest value in an object */
function topEntry(obj) {
  let best = null;
  let max = -Infinity;
  for (const [key, val] of Object.entries(obj)) {
    if (val > max) { max = val; best = key; }
  }
  return best;
}

/** Returns "Mar 19–26" style range string for the 7-day window ending on `today` */
function weekRange(today) {
  const end = new Date(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 6);

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)}–${fmt(end)}`;
}

/** Sum values from a hash for a list of date-key strings */
function sumForDates(hash, dates) {
  return dates.reduce((sum, d) => sum + (hash[d] || 0), 0);
}

/** Build array of "YYYY-MM-DD" strings for N days ending at `today` */
function dateRange(today, offsetStart, count) {
  const dates = [];
  for (let i = offsetStart; i < offsetStart + count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** All dates in a given month (year, month 0-indexed) up to and including `cap` date */
function monthDates(year, month, cap) {
  const dates = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const str = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (str <= cap) dates.push(str);
  }
  return dates;
}

/* ── Rule engine ── */
function runRules(data, metrics) {
  const flags = [];

  // 1. Pageview trend (>10% week-over-week)
  if (metrics.lastWeekViews > 0) {
    const pct = Math.round(((metrics.thisWeekViews - metrics.lastWeekViews) / metrics.lastWeekViews) * 100);
    if (pct > 10) flags.push({ type: 'positive', text: `Pageviews up ${pct}% vs last week` });
    else if (pct < -10) flags.push({ type: 'warning', text: `Pageviews down ${Math.abs(pct)}% vs last week` });
  }

  // 2. Top source
  const refEntries = Object.entries(data.referrers);
  if (refEntries.length > 0) {
    const totalRef = refEntries.reduce((s, [, v]) => s + v, 0);
    const [topSrc, topSrcVal] = refEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const srcPct = totalRef > 0 ? Math.round((topSrcVal / totalRef) * 100) : 0;
    flags.push({ type: 'info', text: `Top traffic source: ${topSrc} (${srcPct}%)` });

    // 12. Single source dependency (>75%)
    if (srcPct > 75) {
      flags.push({ type: 'warning', text: `${topSrc} drives ${srcPct}% of all traffic — consider diversifying` });
    }
  }

  // 3. Booking click count
  const clickEntries = Object.entries(data.clicks);
  const bookingClicks = clickEntries.filter(([k]) => isBookingLink(k));
  const totalBookingClicks = bookingClicks.reduce((s, [, v]) => s + v, 0);
  if (totalBookingClicks > 0) {
    flags.push({ type: 'positive', text: `${totalBookingClicks} booking link click${totalBookingClicks !== 1 ? 's' : ''} recorded` });
  }

  // 4. Scroll depth — 50% threshold below 40% of total views
  const scrollEntries = Object.entries(data.scroll);
  const scroll50 = scrollEntries.find(([k]) => k === '50');
  const totalViews = metrics.thisWeekViews + metrics.lastWeekViews || Object.values(data.pageviews).reduce((s, v) => s + v, 0);
  if (scroll50 && totalViews > 0 && scroll50[1] < totalViews * 0.4) {
    flags.push({ type: 'warning', text: `Only ${Math.round((scroll50[1] / totalViews) * 100)}% of visitors scroll past the midpoint` });
  }

  // 5. Best posting time (peak 3-hour window)
  const hourlyEntries = Object.entries(data.hourly);
  if (hourlyEntries.length > 0) {
    // Aggregate by hour-of-day (keys may be "YYYY-MM-DD:HH" or just "HH")
    const byHour = {};
    for (const [k, v] of hourlyEntries) {
      const hour = k.includes(':') ? parseInt(k.split(':').pop(), 10) : parseInt(k, 10);
      if (!isNaN(hour)) byHour[hour] = (byHour[hour] || 0) + v;
    }
    // Find best 3-hour window
    let bestStart = 0;
    let bestSum = -1;
    for (let h = 0; h < 24; h++) {
      const windowSum = (byHour[h] || 0) + (byHour[(h + 1) % 24] || 0) + (byHour[(h + 2) % 24] || 0);
      if (windowSum > bestSum) { bestSum = windowSum; bestStart = h; }
    }
    const fmtHr = (h) => { const ampm = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}${ampm}`; };
    flags.push({ type: 'info', text: `Peak traffic window: ${fmtHr(bestStart)}–${fmtHr((bestStart + 3) % 24)}` });
  }

  // 6. Dead link (tracked link with 0 total clicks)
  for (const [k, v] of clickEntries) {
    if (v === 0) {
      flags.push({ type: 'warning', text: `"${k}" has received 0 clicks — consider removing or repositioning` });
      break; // only flag once
    }
  }

  // 7. New vs returning (returning >60%)
  const visitorEntries = Object.entries(data.visitors);
  const returning = visitorEntries.find(([k]) => k.toLowerCase() === 'returning');
  const newV = visitorEntries.find(([k]) => k.toLowerCase() === 'new');
  if (returning && newV) {
    const totalV = returning[1] + newV[1];
    if (totalV > 0 && returning[1] / totalV > 0.6) {
      flags.push({ type: 'info', text: `${Math.round((returning[1] / totalV) * 100)}% of visitors are returning — strong audience loyalty` });
    }
  }

  // 8 & 9. Session duration
  const durTotal = Object.values(data.duration).reduce((s, v) => s + v, 0);
  const durCount = Object.values(data.duration_count).reduce((s, v) => s + v, 0);
  const avgSessionSec = durCount > 0 ? Math.round(durTotal / durCount / 1000) : 0;
  if (durCount > 0) {
    if (avgSessionSec < 15) {
      flags.push({ type: 'warning', text: `Average session is only ${avgSessionSec}s — visitors may not be engaging` });
    } else if (avgSessionSec > 120) {
      flags.push({ type: 'positive', text: `Average session is ${avgSessionSec}s — visitors are highly engaged` });
    }
  }

  // 10. Country concentration (top country >80%)
  const countryEntries = Object.entries(data.countries);
  if (countryEntries.length > 0) {
    const totalCountry = countryEntries.reduce((s, [, v]) => s + v, 0);
    const [topC, topCV] = countryEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const cPct = totalCountry > 0 ? Math.round((topCV / totalCountry) * 100) : 0;
    if (cPct > 80) {
      flags.push({ type: 'info', text: `${cPct}% of traffic comes from ${topC}` });
    }
  }

  // 11. Mobile dominance (>85%)
  const deviceEntries = Object.entries(data.devices);
  if (deviceEntries.length > 0) {
    const totalDevices = deviceEntries.reduce((s, [, v]) => s + v, 0);
    const mobile = deviceEntries.find(([k]) => k.toLowerCase() === 'mobile');
    if (mobile && totalDevices > 0) {
      const mPct = Math.round((mobile[1] / totalDevices) * 100);
      if (mPct > 85) {
        flags.push({ type: 'info', text: `${mPct}% of visitors are on mobile` });
      }
    }
  }

  // 13. Link click spike (top clicked link)
  if (clickEntries.length > 0) {
    const [topLink, topLinkVal] = clickEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (topLinkVal > 0) {
      flags.push({ type: 'info', text: `Most clicked link: "${topLink}" (${topLinkVal} clicks)` });
    }
  }

  return { flags, avgSessionSec };
}

/* ── Handler ── */
export default async function handler(req) {
  const url = new URL(req.url);
  if (url.searchParams.get('password') !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const results = await redis([
      ['HGETALL', 'stats:pageviews'],
      ['HGETALL', 'stats:referrers'],
      ['HGETALL', 'stats:countries'],
      ['HGETALL', 'stats:clicks'],
      ['HGETALL', 'stats:hourly'],
      ['HGETALL', 'stats:devices'],
      ['HGETALL', 'stats:browsers'],
      ['HGETALL', 'stats:os'],
      ['HGETALL', 'stats:cities'],
      ['HGETALL', 'stats:languages'],
      ['HGETALL', 'stats:visitors'],
      ['HGETALL', 'stats:scroll'],
      ['HGETALL', 'stats:duration'],
      ['HGETALL', 'stats:duration_count'],
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
      os:             parseHash(results[7]),
      cities:         parseHash(results[8]),
      languages:      parseHash(results[9]),
      visitors:       parseHash(results[10]),
      scroll:         parseHash(results[11]),
      duration:       parseHash(results[12]),
      duration_count: parseHash(results[13]),
      conversions:    parseHash(results[14]),
    };

    /* ── Compute aggregations ── */
    const today = new Date().toISOString().slice(0, 10);
    const todayDate = new Date(today + 'T00:00:00Z');

    const thisWeekDates = dateRange(todayDate, 0, 7);
    const lastWeekDates = dateRange(todayDate, 7, 7);

    const thisWeekViews = sumForDates(data.pageviews, thisWeekDates);
    const lastWeekViews = sumForDates(data.pageviews, lastWeekDates);

    const yr = todayDate.getUTCFullYear();
    const mo = todayDate.getUTCMonth();
    const thisMonthDates = monthDates(yr, mo, today);
    const prevMo = mo === 0 ? 11 : mo - 1;
    const prevYr = mo === 0 ? yr - 1 : yr;
    const lastMonthDates = monthDates(prevYr, prevMo, '9999-12-31'); // full prev month

    const thisMonthViews = sumForDates(data.pageviews, thisMonthDates);
    const lastMonthViews = sumForDates(data.pageviews, lastMonthDates);

    const metrics = {
      clientName: CLIENT_NAME,
      today,
      thisWeekRange:  weekRange(todayDate),
      thisWeekViews,
      lastWeekViews,
      weekOverWeek:   pctChange(thisWeekViews, lastWeekViews),
      thisMonthViews,
      lastMonthViews,
      monthOverMonth: pctChange(thisMonthViews, lastMonthViews),
      topReferrer:    topEntry(data.referrers),
      topCountry:     topEntry(data.countries),
      topCity:        topEntry(data.cities),
      topClick:       topEntry(data.clicks),
    };

    /* ── Cold start check ── */
    if (thisWeekViews === 0 && lastWeekViews === 0) {
      return new Response(JSON.stringify({
        weekRange: weekRange(todayDate),
        summary: `Welcome to your ${CLIENT_NAME} briefing! No traffic data yet — check back once your site is live.`,
        advice: null,
        generatedAt: new Date().toISOString(),
        metrics,
        flags: [],
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    /* ── Rule engine ── */
    const { flags, avgSessionSec } = runRules(data, metrics);

    /* ── Deterministic summary ── */
    const parts = [];
    parts.push(`${thisWeekViews.toLocaleString('en-US')} view${thisWeekViews !== 1 ? 's' : ''} this week`);
    if (lastWeekViews > 0) {
      parts[0] += `, ${pctChange(thisWeekViews, lastWeekViews)} vs last week`;
    }

    // Top referrer sentence
    const refEntries = Object.entries(data.referrers);
    if (refEntries.length > 0) {
      const totalRef = refEntries.reduce((s, [, v]) => s + v, 0);
      const topRef = metrics.topReferrer;
      if (topRef && totalRef > 0) {
        const refPct = Math.round((data.referrers[topRef] / totalRef) * 100);
        parts.push(`${topRef} drove ${refPct}% of traffic`);
      }
    }

    // Session duration note
    if (avgSessionSec > 0) {
      parts.push(`avg session ${avgSessionSec}s`);
    }

    const summary = parts.join('. ') + '.';

    /* ── LLM advisory (Claude Haiku) ── */
    let advice = null;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_KEY;
    const _debug = { hasKey: !!ANTHROPIC_API_KEY, flagCount: flags.length };
    if (ANTHROPIC_API_KEY && flags.length > 0) {
      try {
        const bulletPoints = flags.map((f) => `- [${f.type}] ${f.text}`).join('\n');
        const userMessage = `Creator: ${CLIENT_NAME}\n\nHere are this week's data flags:\n${bulletPoints}\n\nWrite a short advisory paragraph — what should they focus on this week?`;

        const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            system: 'You are a concise brand strategist for a creator/influencer. Write in second person. Be specific — reference the actual numbers provided. Keep advice to 2-4 sentences. Speak like a smart friend who reads their data, not a marketing robot.\n\nIMPORTANT: NEVER suggest changes to the website itself — no layout changes, no reorganizing sections, no moving CTAs, no redesign suggestions. The website was custom-built by a professional and is not the creator\'s responsibility. Your advice should ONLY be about: when to post, where to post, what content to create, which platforms to focus on, what to promote, and how to use their audience data to grow. Focus on their actions as a creator, not the page structure.',
            messages: [{ role: 'user', content: userMessage }],
          }),
        });

        if (llmRes.ok) {
          const llmData = await llmRes.json();
          advice = llmData.content?.[0]?.text || null;
        } else {
          console.error('Briefing LLM error:', llmRes.status, await llmRes.text().catch(() => ''));
        }
      } catch (e) {
        console.error('Briefing LLM exception:', e);
        // Graceful fallback — advice stays null
      }
    }

    return new Response(JSON.stringify({
      weekRange: weekRange(todayDate),
      summary,
      advice,
      generatedAt: new Date().toISOString(),
      metrics,
      flags,
      _debug,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to load data' }), { status: 500 });
  }
}
