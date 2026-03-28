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
      ['GET', PREFIX + 'goal:views:target'],
      ['GET', PREFIX + 'goal:followers:target'],
      ['GET', PREFIX + 'goal:conversions:target'],
    ]);
    const goals = {
      views:       results[0]?.result ? parseInt(results[0].result, 10) : null,
      followers:   results[1]?.result ? parseInt(results[1].result, 10) : null,
      conversions: results[2]?.result ? parseInt(results[2].result, 10) : null,
    };
    return new Response(JSON.stringify({ goals }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const type = body.type || 'views';
    const target = parseInt(body.target, 10);
    if (!target || target < 1) {
      return new Response(JSON.stringify({ error: 'Invalid target' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    await redis([
      ['SET', PREFIX + 'goal:' + type + ':target', String(target)],
    ]);
    // Return all goals
    const results = await redis([
      ['GET', PREFIX + 'goal:views:target'],
      ['GET', PREFIX + 'goal:followers:target'],
      ['GET', PREFIX + 'goal:conversions:target'],
    ]);
    const goals = {
      views:       results[0]?.result ? parseInt(results[0].result, 10) : null,
      followers:   results[1]?.result ? parseInt(results[1].result, 10) : null,
      conversions: results[2]?.result ? parseInt(results[2].result, 10) : null,
    };
    return new Response(JSON.stringify({ goals }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
