export const config = { runtime: 'edge' };

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX = process.env.REDIS_PREFIX || 'stats:';

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
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

  await redis([
    ['DEL', PREFIX + 'youtube:tokens'],
    ['DEL', PREFIX + 'youtube:channel'],
    ['DEL', PREFIX + 'youtube:videos'],
    ['DEL', PREFIX + 'youtube:analytics'],
  ]);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
