export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import { CLIENT_BRAND } from '../../lib/client-config.js';
import { redisPipeline, redisCmd } from '../../lib/studio/redis.js';

// One-time bulk import of Beehiiv subscribers into the hub's Redis list.
// Hub uses `<prefix>:newsletter_subscribers` (LIST) as the source of truth
// for sends + nurture + dashboard counts. This pulls every active sub from
// Beehiiv, dedups against what's already local, and LPUSHes the new ones.
//
// POST /api/studio/import-beehiiv
//   { dryRun?: boolean }   → if true, returns what would be imported, doesn't write
//
// Returns: { ok, totalBeehiiv, alreadyLocal, imported, skipped, capacity, dryRun }
//
// Idempotent: running it twice doesn't double-import (dedup by lowercased email).

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const PUB_ID          = process.env.BEEHIIV_PUBLICATION_ID;

const PREFIX = (CLIENT_BRAND.redisPrefix || '').replace(/:$/, '');
const SUBS_KEY = `${PREFIX}:newsletter_subscribers`;
const HARD_CAP = 5000; // bumped from 500 for the real subscriber base

async function fetchBeehiivPage(page, perPage = 100) {
  const url = `https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions?limit=${perPage}&page=${page}&status=active`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`beehiiv_${res.status}: ${detail.slice(0, 240)}`);
  }
  return res.json();
}

export default async function handler(req) {
  if (!authed(req)) return unauthorized();
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!BEEHIIV_API_KEY || !PUB_ID) {
    return json({ error: 'beehiiv_not_configured' }, 503);
  }

  let body = {};
  try { body = await req.json(); } catch { /* allow empty body */ }
  const dryRun = body.dryRun === true;

  // 1. Pull all pages from Beehiiv (active subs only)
  const beehiivEmails = [];
  const beehiivRows = [];
  let page = 1;
  while (page <= 60) { // 60 pages × 100 = 6000 max — enough headroom
    let pageData;
    try { pageData = await fetchBeehiivPage(page); }
    catch (e) { return json({ error: String(e.message || e) }, 502); }

    const items = Array.isArray(pageData?.data) ? pageData.data : [];
    if (!items.length) break;

    for (const sub of items) {
      const email = String(sub.email || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      const ts = sub.subscribed_at
        ? Number(sub.subscribed_at) * (Number(sub.subscribed_at) < 1e12 ? 1000 : 1)
        : Date.now();
      beehiivEmails.push(email);
      beehiivRows.push({ email, ts, source: 'beehiiv' });
    }

    // Stop if we got fewer than a full page (last page)
    if (items.length < 100) break;
    page++;
  }

  // 2. Read existing local subs and build a Set for dedup
  const existingRaw = await redisCmd('LRANGE', SUBS_KEY, 0, HARD_CAP);
  const existingEmails = new Set();
  for (const raw of (existingRaw || [])) {
    try {
      const obj = JSON.parse(raw);
      if (obj && obj.email) existingEmails.add(String(obj.email).toLowerCase());
    } catch { /* skip malformed */ }
  }

  // 3. Decide what's new
  const toImport = [];
  let skipped = 0;
  for (const row of beehiivRows) {
    if (existingEmails.has(row.email)) { skipped++; continue; }
    existingEmails.add(row.email);
    toImport.push(row);
  }

  if (dryRun) {
    return json({
      ok: true,
      dryRun: true,
      totalBeehiiv: beehiivEmails.length,
      alreadyLocal: existingEmails.size - toImport.length,
      wouldImport: toImport.length,
      skipped,
      sample: toImport.slice(0, 5).map(r => r.email),
    });
  }

  // 4. LPUSH the new ones in batches of 100 (Upstash pipeline cap), then LTRIM
  if (toImport.length) {
    for (let i = 0; i < toImport.length; i += 100) {
      const chunk = toImport.slice(i, i + 100);
      const cmd = ['LPUSH', SUBS_KEY, ...chunk.map(r => JSON.stringify(r))];
      await redisPipeline([cmd]);
    }
    await redisPipeline([['LTRIM', SUBS_KEY, '0', String(HARD_CAP - 1)]]);
  }

  return json({
    ok: true,
    dryRun: false,
    totalBeehiiv: beehiivEmails.length,
    alreadyLocal: existingEmails.size - toImport.length,
    imported: toImport.length,
    skipped,
    capacity: HARD_CAP,
    note: toImport.length === 0 ? 'Nothing to import — local list already has everyone.' : `Added ${toImport.length} new subscribers. Local count is now at most ${HARD_CAP}.`,
  });
}
