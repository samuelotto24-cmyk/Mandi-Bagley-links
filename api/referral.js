export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

export default async function handler(req) {
  const url = new URL(req.url);
  if (url.searchParams.get('password') !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET — read referral stats for this client
  if (req.method === 'GET') {
    const results = await redis([
      ['GET', PREFIX + 'referral:code'],
      ['GET', PREFIX + 'referral:count'],
      ['GET', PREFIX + 'referral:freeMonths'],
    ]);
    const code = results[0]?.result || '';
    const count = results[1]?.result ? parseInt(results[1].result, 10) : 0;
    const freeMonths = results[2]?.result ? parseInt(results[2].result, 10) : 0;
    return new Response(JSON.stringify({ code, count, freeMonths }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST — Sam manually updates referral data
  if (req.method === 'POST') {
    const body = await req.json();
    const commands = [];
    if (body.code !== undefined) commands.push(['SET', PREFIX + 'referral:code', body.code]);
    if (body.count !== undefined) commands.push(['SET', PREFIX + 'referral:count', String(body.count)]);
    if (body.freeMonths !== undefined) commands.push(['SET', PREFIX + 'referral:freeMonths', String(body.freeMonths)]);
    if (commands.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    await redis(commands);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
