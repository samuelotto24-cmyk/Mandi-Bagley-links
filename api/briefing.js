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
const CLIENT_NICHE = process.env.CLIENT_NICHE || 'Fitness · Faith · Food';
const CLIENT_DESCRIPTION = process.env.CLIENT_DESCRIPTION || 'Lifestyle fitness creator, recipe content, brand partnerships';
const PREFIX = process.env.REDIS_PREFIX || 'stats:';

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

  // 4. Scroll depth — highlight strong engagement (never criticize)
  const scrollEntries = Object.entries(data.scroll);
  const scroll50 = scrollEntries.find(([k]) => k === '50');
  const totalViews = metrics.thisWeekViews + metrics.lastWeekViews || Object.values(data.pageviews).reduce((s, v) => s + v, 0);
  if (scroll50 && totalViews > 0 && scroll50[1] >= totalViews * 0.4) {
    flags.push({ type: 'positive', text: `${Math.round((scroll50[1] / totalViews) * 100)}% of visitors engage past the midpoint` });
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

  // 6. Top performing link (celebrate wins, never flag dead links)
  if (clickEntries.length > 0) {
    const activeLinks = clickEntries.filter(([, v]) => v > 0);
    if (activeLinks.length > 1) {
      flags.push({ type: 'positive', text: `${activeLinks.length} links are actively driving clicks` });
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
    if (avgSessionSec > 30) {
      flags.push({ type: 'positive', text: `Average session is ${avgSessionSec}s — visitors are spending quality time on your page` });
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

  // 14. TikTok engagement trending down (recent half vs older half)
  if (metrics.tiktokMetrics && metrics.tiktokMetrics.recentVideoCount >= 4) {
    const vids = metrics.tiktokMetrics.videos;
    const half = Math.floor(vids.length / 2);
    const newerHalf = vids.slice(0, half);
    const olderHalf = vids.slice(half);
    const newerAvg = newerHalf.reduce((s, v) => s + (v.view_count || 0), 0) / newerHalf.length;
    const olderAvg = olderHalf.reduce((s, v) => s + (v.view_count || 0), 0) / olderHalf.length;
    if (olderAvg > 0 && newerAvg < olderAvg * 0.8) {
      const dropPct = Math.round(((olderAvg - newerAvg) / olderAvg) * 100);
      flags.push({ type: 'warning', text: `TikTok engagement trending down — recent videos averaging ${dropPct}% fewer views` });
    } else if (olderAvg > 0 && newerAvg > olderAvg * 1.2) {
      const gainPct = Math.round(((newerAvg - olderAvg) / olderAvg) * 100);
      flags.push({ type: 'positive', text: `TikTok engagement trending up — recent videos averaging ${gainPct}% more views` });
    }
  }

  // 15. TikTok viral video (>10x average views)
  if (metrics.tiktokMetrics && metrics.tiktokMetrics.topVideo && metrics.tiktokMetrics.avgViews > 0) {
    const topViews = metrics.tiktokMetrics.topVideo.views;
    const avg = metrics.tiktokMetrics.avgViews;
    if (topViews > avg * 10) {
      const multiplier = Math.round(topViews / avg);
      flags.push({ type: 'positive', text: `TikTok viral hit! "${metrics.tiktokMetrics.topVideo.title}" has ${multiplier}x your average views` });
    }
  }

  return { flags, avgSessionSec };
}

const CACHE_TTL = 3600; // 1 hour in seconds

/* ── Handler ── */
export default async function handler(req) {
  const url = new URL(req.url);
  if (url.searchParams.get('password') !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check for cached briefing (skip if ?refresh=1)
  const forceRefresh = url.searchParams.get('refresh') === '1';
  if (!forceRefresh) {
    try {
      const cached = await redis([['GET', PREFIX + 'briefing:cache']]);
      if (cached[0]?.result) {
        const parsed = JSON.parse(cached[0].result);
        const age = (Date.now() - new Date(parsed.generatedAt).getTime()) / 1000;
        if (age < CACHE_TTL) {
          parsed._cached = true;
          parsed._cacheAge = Math.round(age);
          return new Response(JSON.stringify(parsed), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    } catch (e) { /* cache miss, continue */ }
  }

  try {
    const results = await redis([
      ['HGETALL', PREFIX + 'pageviews'],
      ['HGETALL', PREFIX + 'referrers'],
      ['HGETALL', PREFIX + 'countries'],
      ['HGETALL', PREFIX + 'clicks'],
      ['HGETALL', PREFIX + 'hourly'],
      ['HGETALL', PREFIX + 'devices'],
      ['HGETALL', PREFIX + 'browsers'],
      ['HGETALL', PREFIX + 'os'],
      ['HGETALL', PREFIX + 'cities'],
      ['HGETALL', PREFIX + 'languages'],
      ['HGETALL', PREFIX + 'visitors'],
      ['HGETALL', PREFIX + 'scroll'],
      ['HGETALL', PREFIX + 'duration'],
      ['HGETALL', PREFIX + 'duration_count'],
      ['HGETALL', PREFIX + 'conversions'],
      ['GET', PREFIX + 'goal:target'],
      ['GET', PREFIX + 'goal:type'],
      ['GET', PREFIX + 'youtube:channel'],
      ['GET', PREFIX + 'youtube:videos'],
      ['GET', PREFIX + 'youtube:analytics'],
      ['GET', PREFIX + 'tiktok:access_token'],
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

    const goalTarget = results[15]?.result ? parseInt(results[15].result, 10) : null;
    const goalType = results[16]?.result || 'views';

    // YouTube data (if connected)
    const ytChannelRaw = results[results.length - 4]?.result;
    const ytVideosRaw = results[results.length - 3]?.result;
    const ytAnalyticsRaw = results[results.length - 2]?.result;
    let youtubeContext = '';
    if (ytChannelRaw) {
      const ytChannel = JSON.parse(ytChannelRaw);
      const ytVideos = ytVideosRaw ? JSON.parse(ytVideosRaw) : [];
      const ytAnalytics = ytAnalyticsRaw ? JSON.parse(ytAnalyticsRaw) : {};
      youtubeContext = '\n\n## YouTube Analytics\n';
      youtubeContext += '- Subscribers: ' + (ytChannel.subscriberCount || 0).toLocaleString() + '\n';
      youtubeContext += '- Total channel views: ' + (ytChannel.viewCount || 0).toLocaleString() + '\n';
      if (ytAnalytics.views30d) youtubeContext += '- Views (30d): ' + ytAnalytics.views30d.toLocaleString() + '\n';
      if (ytAnalytics.watchTime30d) youtubeContext += '- Watch time (30d): ' + Math.round(ytAnalytics.watchTime30d / 60) + ' hours\n';
      if (ytAnalytics.demographics && ytAnalytics.demographics.genderSplit) {
        var genders = Object.entries(ytAnalytics.demographics.genderSplit).map(function(e) { return e[0] + ': ' + Math.round(e[1]) + '%'; }).join(', ');
        youtubeContext += '- Gender: ' + genders + '\n';
      }
      if (ytAnalytics.trafficSources) {
        var sources = Object.entries(ytAnalytics.trafficSources).sort(function(a,b){return b[1]-a[1];}).slice(0,3).map(function(e){return e[0]+': '+e[1];}).join(', ');
        youtubeContext += '- Top YT traffic sources: ' + sources + '\n';
      }
      if (ytAnalytics.countries) {
        var topC = Object.entries(ytAnalytics.countries).sort(function(a,b){return b[1]-a[1];}).slice(0,3).map(function(e){return e[0]+': '+e[1];}).join(', ');
        youtubeContext += '- Top YT countries: ' + topC + '\n';
      }
      if (ytVideos.length) {
        youtubeContext += '\n### Recent YouTube Videos\n';
        ytVideos.forEach(function(v) {
          youtubeContext += '- "' + v.title + '" — ' + (v.views||0).toLocaleString() + ' views, ' + (v.likes||0).toLocaleString() + ' likes, ' + (v.comments||0).toLocaleString() + ' comments (' + (v.publishedAt||'').split('T')[0] + ')\n';
        });
      }
    }

    // TikTok data (if connected)
    const tiktokAccessToken = results[results.length - 1]?.result;
    let tiktokContext = '';
    let tiktokMetrics = null;
    if (tiktokAccessToken) {
      try {
        const [ttUserRes, ttVideosRes] = await Promise.all([
          fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count', {
            headers: { Authorization: `Bearer ${tiktokAccessToken}` },
          }),
          fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,view_count,like_count,comment_count,share_count,create_time', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tiktokAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ max_count: 20 }),
          }),
        ]);

        const ttUserData = await ttUserRes.json();
        const ttVideosData = await ttVideosRes.json();
        const ttUser = ttUserData?.data?.user || {};
        const ttVideos = ttVideosData?.data?.videos || [];

        let ttTotalViews = 0, ttTotalLikes = 0, ttTotalComments = 0, ttTotalShares = 0;
        let ttTopVideo = null;

        for (const v of ttVideos) {
          ttTotalViews    += v.view_count || 0;
          ttTotalLikes    += v.like_count || 0;
          ttTotalComments += v.comment_count || 0;
          ttTotalShares   += v.share_count || 0;
          if (!ttTopVideo || (v.view_count || 0) > (ttTopVideo.view_count || 0)) {
            ttTopVideo = v;
          }
        }

        const ttAvgViews = ttVideos.length > 0 ? Math.round(ttTotalViews / ttVideos.length) : 0;

        tiktokMetrics = {
          followers: ttUser.follower_count || 0,
          totalLikes: ttUser.likes_count || 0,
          videoCount: ttUser.video_count || 0,
          recentVideoCount: ttVideos.length,
          totalViews: ttTotalViews,
          totalRecentLikes: ttTotalLikes,
          totalComments: ttTotalComments,
          totalShares: ttTotalShares,
          avgViews: ttAvgViews,
          topVideo: ttTopVideo ? {
            title: ttTopVideo.title || '(untitled)',
            views: ttTopVideo.view_count || 0,
            likes: ttTopVideo.like_count || 0,
          } : null,
          videos: ttVideos,
        };

        tiktokContext = '\n\n## TikTok Analytics\n';
        tiktokContext += '- Followers: ' + (ttUser.follower_count || 0).toLocaleString() + '\n';
        tiktokContext += '- Total profile likes: ' + (ttUser.likes_count || 0).toLocaleString() + '\n';
        tiktokContext += '- Videos published: ' + (ttUser.video_count || 0).toLocaleString() + '\n';
        tiktokContext += '- Recent ' + ttVideos.length + ' videos — total views: ' + ttTotalViews.toLocaleString() + ', likes: ' + ttTotalLikes.toLocaleString() + ', comments: ' + ttTotalComments.toLocaleString() + ', shares: ' + ttTotalShares.toLocaleString() + '\n';
        tiktokContext += '- Average views per recent video: ' + ttAvgViews.toLocaleString() + '\n';
        if (ttTopVideo) {
          tiktokContext += '- Top performing video: "' + (ttTopVideo.title || 'untitled') + '" — ' + (ttTopVideo.view_count || 0).toLocaleString() + ' views, ' + (ttTopVideo.like_count || 0).toLocaleString() + ' likes\n';
        }
        if (ttVideos.length > 0) {
          tiktokContext += '\n### Recent TikTok Videos\n';
          ttVideos.slice(0, 10).forEach(function(v) {
            const created = v.create_time ? new Date(v.create_time * 1000).toISOString().split('T')[0] : '';
            tiktokContext += '- "' + (v.title || 'untitled') + '" — ' + (v.view_count || 0).toLocaleString() + ' views, ' + (v.like_count || 0).toLocaleString() + ' likes, ' + (v.comment_count || 0).toLocaleString() + ' comments (' + created + ')\n';
          });
        }
      } catch (e) {
        // TikTok token expired or API error — skip silently
        console.error('Briefing TikTok fetch error:', e);
      }
    }

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

    const todayViews = data.pageviews[today] || 0;

    const metrics = {
      clientName: CLIENT_NAME,
      today,
      todayViews,
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
      goalTarget,
      goalType,
    };

    /* ── Cold start check ── */
    if (thisWeekViews === 0 && lastWeekViews === 0) {
      return new Response(JSON.stringify({
        weekRange: weekRange(todayDate),
        summary: `Welcome to your ${CLIENT_NAME} growth engine! No data yet — connect your platforms and check back once your site is live.`,
        actionItems: [],
        calendar: [],
        nichePulse: [],  // deprecated
        proactiveInsight: null,
        generatedAt: new Date().toISOString(),
        metrics,
        flags: [],
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    /* ── Rule engine ── */
    metrics.tiktokMetrics = tiktokMetrics;
    const { flags, avgSessionSec } = runRules(data, metrics);

    /* ── Deterministic summary (growth-focused) ── */
    const parts = [];

    // Lead with cross-platform follower/view totals if available
    const ttFollowers = tiktokMetrics?.followers || 0;
    const ytSubscribers = ytChannelRaw ? JSON.parse(ytChannelRaw).subscriberCount || 0 : 0;
    const totalFollowers = ttFollowers + ytSubscribers;
    if (totalFollowers > 0) {
      parts.push(`${totalFollowers.toLocaleString('en-US')} followers across your platforms`);
    }

    // Total views across platforms
    const ytViews30d = ytAnalyticsRaw ? (JSON.parse(ytAnalyticsRaw).views30d || 0) : 0;
    const ttViews = tiktokMetrics?.totalViews || 0;
    const totalCrossViews = thisWeekViews + ttViews + ytViews30d;
    if (totalCrossViews > 0) {
      parts.push(`${totalCrossViews.toLocaleString('en-US')} total views this period`);
    } else {
      parts.push(`${thisWeekViews.toLocaleString('en-US')} site views this week`);
    }
    if (lastWeekViews > 0) {
      parts.push(`site traffic ${pctChange(thisWeekViews, lastWeekViews)} vs last week`);
    }

    // Link activity
    const totalClicks = Object.values(data.clicks).reduce((s, v) => s + v, 0);
    if (totalClicks > 0) {
      parts.push(`${totalClicks.toLocaleString('en-US')} link clicks driving action`);
    }

    const summary = parts.join('. ') + '.';

    /* ── Compute byHour for LLM context ── */
    const byHour = {};
    Object.entries(data.hourly).forEach(([key, val]) => {
      const hr = key.includes(':') ? parseInt(key.split(':').pop(), 10) : parseInt(key, 10);
      if (!isNaN(hr)) byHour[hr] = (byHour[hr] || 0) + val;
    });

    /* ── LLM: actionItems, calendar, nichePulse, proactiveInsight ── */
    let actionItems = [];
    let calendar = [];
    // nichePulse removed from UI
    let proactiveInsight = null;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_KEY;
    let _debug = { hasKey: !!ANTHROPIC_API_KEY, flagCount: flags.length };

    if (ANTHROPIC_API_KEY) {
      try {
        const bulletPoints = flags.map((f) => `- [${f.type}] ${f.text}`).join('\n');
        const clicksList = Object.entries(data.clicks)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => `- ${name}: ${count} clicks`)
          .join('\n');

        // Build calendar date range (Mon-Sun of current week)
        const todayD = new Date();
        const dayOfWeek = todayD.getDay(); // 0=Sun
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const calDays = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(todayD);
          d.setDate(d.getDate() + mondayOffset + i);
          calDays.push({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            date: d.toISOString().slice(0, 10),
            isToday: d.toISOString().slice(0, 10) === today,
          });
        }

        // Peak hours formatted
        const peakFormatted = Object.entries(byHour)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([h]) => { const hr = parseInt(h); return (hr % 12 || 12) + (hr >= 12 ? 'PM' : 'AM'); })
          .join(', ');

        const goalContext = goalTarget
          ? `\nGoal: ${metrics.thisMonthViews} / ${goalTarget} ${goalType} this month. ${Math.max(0, goalTarget - metrics.thisMonthViews)} remaining.`
          : '';

        const userMessage = `Creator: ${CLIENT_NAME} (${CLIENT_NICHE})
About: ${CLIENT_DESCRIPTION}

## Growth Signals
${bulletPoints || 'No flags this week.'}

## Link & Code Performance (all time)
${clicksList || 'No click data yet.'}

## Cross-Platform Metrics
- Total followers: ${totalFollowers.toLocaleString()} (TikTok: ${ttFollowers.toLocaleString()}, YouTube: ${ytSubscribers.toLocaleString()})
- Site views this week: ${thisWeekViews}, last week: ${lastWeekViews} (${metrics.weekOverWeek})
- Total link clicks: ${totalClicks.toLocaleString()}
- Top referrer: ${metrics.topReferrer || 'none'}
- Peak hours: ${peakFormatted || 'not enough data'}
${goalContext}

## Calendar dates this week
${calDays.map(d => `- ${d.day} ${d.date}${d.isToday ? ' (TODAY)' : ''}`).join('\n')}

Respond with ONLY valid JSON (no markdown, no code fences) matching this exact structure:
{
  "actionItems": [
    { "priority": "high|medium|low", "headline": "5-6 word action title", "dataPoint": "one line with a specific number from the data", "caption": "ready-to-paste caption for Instagram/TikTok with emojis", "timeframe": "now|today|this_week", "time": "8 PM" }
  ],
  "calendar": [
    { "day": "Mon", "date": "YYYY-MM-DD", "type": "reel|story|pin|post|rest", "time": "3 PM", "idea": "one-line concept" }
  ],
  "proactiveInsight": { "message": "observation about their data", "actions": ["action 1", "action 2", "action 3"] } or null
}

Rules:
- 3 actionItems focused on GROWTH. Prioritized high/medium/low. Each MUST have: a short headline (5-6 words max), a dataPoint referencing a real number, a ready-to-paste caption with emojis, a timeframe, and a specific time
- Headlines must be SPECIFIC CONTENT IDEAS, not vague strategy. Good: "Post DFYNE workout reel at peak" or "Share meal prep transformation story". Bad: "Bridge conversion gap", "Optimize engagement metrics", "Leverage cross-platform synergy"
- Captions must sound like a REAL PERSON wrote them — conversational, authentic to the creator's voice. No corporate marketing speak. No "tag someone who needs this". No "let's finish strong together". Write like the creator actually talks to their audience.
- dataPoint should cite a specific number from the data and explain WHY the action matters (e.g., "Your last fitness reel got 12K views — 3x your average")
- Action items should reference cross-platform data when available
- NEVER reference internal goals, conversion gaps, or dashboard metrics in headlines or captions. The creator posts content, they don't "bridge gaps"
- 7 calendar days (Mon-Sun), mix of content types appropriate for their niche, use peak hours for timing, include one rest day
- proactiveInsight: flag the most important growth opportunity or anomaly. null if nothing notable.
- NEVER suggest website layout changes
- NEVER criticize performance metrics. Frame ALL data positively: celebrate wins, suggest growth strategies, highlight what's working
- Reference actual numbers from the data above${youtubeContext}${tiktokContext}`;

        const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 3000,
            system: 'You are a JSON API. Respond with ONLY valid JSON. No markdown, no code fences, no explanation. Follow the exact structure requested.',
            messages: [{ role: 'user', content: userMessage }],
          }),
        });

        if (llmRes.ok) {
          const llmData = await llmRes.json();
          let text = llmData.content?.[0]?.text || '';
          const stopReason = llmData.stop_reason || 'unknown';
          _debug.llmTextLen = text.length;
          _debug.stopReason = stopReason;
          // Strip markdown code fences if present
          text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
          try {
            const parsed = JSON.parse(text);
            actionItems = parsed.actionItems || [];
            calendar = parsed.calendar || [];
            // nichePulse removed — absorbed into action items
            proactiveInsight = parsed.proactiveInsight || null;
          } catch (parseErr) {
            // Try to extract JSON from mixed response
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
              try {
                const parsed = JSON.parse(match[0]);
                actionItems = parsed.actionItems || [];
                calendar = parsed.calendar || [];
                // nichePulse removed — absorbed into action items
                proactiveInsight = parsed.proactiveInsight || null;
              } catch (e2) {
                _debug.llmParseError = text.slice(0, 500);
              }
            } else {
              _debug.llmParseError = text.slice(0, 500);
            }
          }
        } else {
          const errBody = await llmRes.text().catch(() => '');
          _debug.llmError = { status: llmRes.status, body: errBody.slice(0, 300) };
        }
      } catch (e) {
        console.error('Briefing LLM exception:', e);
      }
    }

    // Build sorted click list for frontend
    const clickList = Object.entries(data.clicks)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, clicks: count }));

    const response = {
      weekRange: weekRange(todayDate),
      summary,
      actionItems,
      calendar,
      nichePulse: [], // deprecated, kept for backwards compat
      proactiveInsight,
      generatedAt: new Date().toISOString(),
      metrics,
      flags,
      clickList,
      _debug,
    };

    // Cache the response in Redis (fire and forget)
    redis([['SET', PREFIX + 'briefing:cache', JSON.stringify(response), 'EX', String(CACHE_TTL)]]).catch(() => {});

    return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to load data' }), { status: 500 });
  }
}
