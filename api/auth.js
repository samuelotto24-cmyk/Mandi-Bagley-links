export const config = { runtime: 'edge' };

const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const MAX_ATTEMPTS = 3;      // max failures per window
const WINDOW_SEC   = 600;    // 10-minute window
const LOCKOUT_SEC  = 3600;   // 1-hour lockout after max failures

async function redisCmd(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export default async function handler(req) {
  const ip = getClientIP(req);
  const rateLimitKey = `auth:ratelimit:${ip}`;
  const lockoutKey = `auth:lockout:${ip}`;

  // Check lockout first
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const [lockout] = await redisCmd([['GET', lockoutKey]]);
      if (lockout?.result) {
        const ttl = await redisCmd([['TTL', lockoutKey]]);
        const remaining = ttl?.[0]?.result || LOCKOUT_SEC;
        return new Response(JSON.stringify({
          error: 'Too many attempts. Try again in ' + Math.ceil(remaining / 60) + ' minutes.',
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(remaining) },
        });
      }
    } catch (e) {
      console.error('Rate limit check failed:', e);
      // Redis error — block login to be safe
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable. Try again shortly.' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token !== PASSWORD) {
    // Track failed attempt
    if (REDIS_URL && REDIS_TOKEN) {
      try {
        const results = await redisCmd([
          ['INCR', rateLimitKey],
          ['EXPIRE', rateLimitKey, String(WINDOW_SEC)],
        ]);
        const attempts = results?.[0]?.result || 0;
        if (attempts >= MAX_ATTEMPTS) {
          // Set lockout
          await redisCmd([
            ['SET', lockoutKey, '1', 'EX', String(LOCKOUT_SEC)],
            ['DEL', rateLimitKey],
          ]);
        }
      } catch (e) {
        console.error('Rate limit tracking failed:', e);
      }
    }

    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Successful login — clear any rate limit counters
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      await redisCmd([['DEL', rateLimitKey], ['DEL', lockoutKey]]);
    } catch (e) { /* ignore */ }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
