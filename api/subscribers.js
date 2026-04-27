export const config = { runtime: 'edge' };

import { CLIENT_BRAND } from '../lib/client-config.js';

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || '__DASHBOARD_PASSWORD__';
const PREFIX      = CLIENT_BRAND.redisPrefix;

function authed(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  return token === PASSWORD;
}

async function redis(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) return [];
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseHashNumbers(item) {
  if (!item || !item.result) return {};
  const obj = {};
  for (let i = 0; i < item.result.length; i += 2) {
    obj[item.result[i]] = parseInt(item.result[i + 1], 10) || 0;
  }
  return obj;
}

export default async function handler(req) {
  if (!authed(req)) return json({ error: 'Unauthorized' }, 401);

  try {
    const results = await redis([
      ['LRANGE',  `${PREFIX}newsletter_subscribers`, '0', '199'],  // recent 200
      ['HGETALL', `${PREFIX}newsletter_daily`],                    // YYYY-MM-DD: count
      ['HGET',    `${PREFIX}leads`, 'newsletter'],                 // cumulative counter (counts all-time)
    ]);

    const rawList = results?.[0]?.result || [];
    const dailyHash = parseHashNumbers(results?.[1]);
    const cumulative = parseInt(results?.[2]?.result, 10) || 0;

    // Parse + dedupe by email (most recent ts wins)
    const seen = new Map();
    for (const raw of rawList) {
      try {
        const obj = JSON.parse(raw);
        if (!obj.email) continue;
        const e = String(obj.email).toLowerCase();
        if (!seen.has(e) || (obj.ts || 0) > (seen.get(e).ts || 0)) {
          seen.set(e, { email: e, ts: obj.ts || 0 });
        }
      } catch (_) {}
    }
    const subscribers = Array.from(seen.values()).sort((a, b) => b.ts - a.ts);

    // Build last-30-days daily series (today → 30 days ago)
    const today = new Date();
    const series = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: dailyHash[key] || 0 });
    }

    const last7  = series.slice(-7).reduce((s, x) => s + x.count, 0);
    const last30 = series.reduce((s, x) => s + x.count, 0);
    const prior7 = series.slice(-14, -7).reduce((s, x) => s + x.count, 0);
    const weekDelta = prior7 === 0 ? null : Math.round(((last7 - prior7) / prior7) * 100);

    // Total: prefer the cumulative counter (counts every signup ever, including
    // those that fell off the LPUSH window). Fall back to dedupe count if 0.
    const total = cumulative || subscribers.length;

    return json({
      ok: true,
      total,
      last7,
      last30,
      weekDelta,
      series,                                // [{date, count}] for the last 30 days
      recent: subscribers.slice(0, 12),      // most recent 12 signups
    });
  } catch (e) {
    return json({ error: 'subscribers_failed', detail: String(e?.message || e) }, 500);
  }
}
