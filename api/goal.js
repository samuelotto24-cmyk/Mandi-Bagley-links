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

  if (req.method === 'GET') {
    const results = await redis([
      ['GET', PREFIX + 'goal:target'],
      ['GET', PREFIX + 'goal:type'],
    ]);
    const target = results[0]?.result ? parseInt(results[0].result, 10) : null;
    const type = results[1]?.result || 'views';
    return new Response(JSON.stringify({ target, type }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const target = parseInt(body.target, 10);
    const type = body.type || 'views';
    if (!target || target < 1) {
      return new Response(JSON.stringify({ error: 'Invalid target' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    await redis([
      ['SET', PREFIX + 'goal:target', String(target)],
      ['SET', PREFIX + 'goal:type', type],
    ]);
    return new Response(JSON.stringify({ target, type }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
