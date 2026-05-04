export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import { studioKey, redisPipeline } from '../../lib/studio/redis.js';

// GET /api/studio/usage?days=7
//   Reads the last N days of ai_log:<YYYY-MM-DD> sorted sets and returns
//   aggregated totals + breakdowns by op, model, and day.
//
//   Defaults to 7 days. Hard cap at 60 days to keep payloads bounded.
//
//   Response shape:
//   {
//     ok: true,
//     days: 7,
//     range: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' },
//     totals: { calls, in, out, cw, cr, mc, errors },
//     byDay:   [ { day, calls, in, out, cw, cr, mc } ],
//     byOp:    { <op>:    { calls, in, out, cw, cr, mc } },
//     byModel: { <model>: { calls, in, out, cw, cr, mc } },
//   }

export default async function handler(req) {
  if (!authed(req)) return unauthorized();
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const url = new URL(req.url);
  let days = Number(url.searchParams.get('days') || 7);
  if (!Number.isFinite(days) || days < 1) days = 7;
  if (days > 60) days = 60;

  // Compute the list of UTC date keys to query
  const todayMs = Date.now();
  const oneDay = 86400000;
  const dayKeys = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(todayMs - i * oneDay).toISOString().slice(0, 10);
    dayKeys.push(d);
  }
  dayKeys.reverse(); // oldest → newest

  // Fetch all in one pipeline. ZRANGE 0 -1 returns all members ordered by score.
  let pipeOut;
  try {
    pipeOut = await redisPipeline(
      dayKeys.map(d => ['ZRANGE', studioKey(`ai_log:${d}`), '0', '-1'])
    );
  } catch (e) {
    return json({ error: 'redis_error', detail: String(e.message || e) }, 502);
  }

  const totals  = { calls: 0, in: 0, out: 0, cw: 0, cr: 0, mc: 0, errors: 0 };
  const byDay   = [];
  const byOp    = {};
  const byModel = {};

  function emptyBucket() { return { calls: 0, in: 0, out: 0, cw: 0, cr: 0, mc: 0 }; }

  for (let i = 0; i < dayKeys.length; i++) {
    const day = dayKeys[i];
    const result = pipeOut?.[i]?.result;
    const members = Array.isArray(result) ? result : [];
    const dayBucket = { day, ...emptyBucket() };

    for (const raw of members) {
      let e;
      try { e = JSON.parse(raw); } catch { continue; }
      const calls = 1;
      const inT  = Number(e.in || 0);
      const outT = Number(e.out || 0);
      const cwT  = Number(e.cw || 0);
      const crT  = Number(e.cr || 0);
      const mc   = Number(e.mc || 0);

      totals.calls += calls;
      totals.in    += inT;
      totals.out   += outT;
      totals.cw    += cwT;
      totals.cr    += crT;
      totals.mc    += mc;
      if (e.ok === false) totals.errors += 1;

      dayBucket.calls += calls;
      dayBucket.in    += inT;
      dayBucket.out   += outT;
      dayBucket.cw    += cwT;
      dayBucket.cr    += crT;
      dayBucket.mc    += mc;

      const op = e.op || 'unknown';
      if (!byOp[op]) byOp[op] = emptyBucket();
      byOp[op].calls += calls;
      byOp[op].in    += inT;
      byOp[op].out   += outT;
      byOp[op].cw    += cwT;
      byOp[op].cr    += crT;
      byOp[op].mc    += mc;

      const model = e.model || 'unknown';
      if (!byModel[model]) byModel[model] = emptyBucket();
      byModel[model].calls += calls;
      byModel[model].in    += inT;
      byModel[model].out   += outT;
      byModel[model].cw    += cwT;
      byModel[model].cr    += crT;
      byModel[model].mc    += mc;
    }

    byDay.push(dayBucket);
  }

  return json({
    ok: true,
    days,
    range: { from: dayKeys[0], to: dayKeys[dayKeys.length - 1] },
    totals,
    byDay,
    byOp,
    byModel,
  });
}
