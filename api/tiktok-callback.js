export const config = { runtime: 'edge' };

const CLIENT_KEY    = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIS_URL     = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN   = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
}

export default async function handler(req) {
  const url = new URL(req.url);
  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?tiktok=error' },
    });
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${url.origin}/api/tiktok-callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/hub/?tiktok=error' },
      });
    }

    // Store tokens in Redis
    await Promise.all([
      redisSet('stats:tiktok:access_token', tokenData.access_token),
      redisSet('stats:tiktok:refresh_token', tokenData.refresh_token || ''),
      redisSet('stats:tiktok:open_id', tokenData.open_id || ''),
      redisSet('stats:tiktok:connected_at', new Date().toISOString()),
    ]);

    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?tiktok=connected' },
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?tiktok=error' },
    });
  }
}
