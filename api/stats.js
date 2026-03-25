export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD;

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
    ]);

    return new Response(JSON.stringify({
      pageviews: parseHash(results[0]),
      referrers: parseHash(results[1]),
      countries: parseHash(results[2]),
      clicks:    parseHash(results[3]),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to load data' }), { status: 500 });
  }
}
