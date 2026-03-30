export const config = { runtime: 'edge' };

const APP_ID     = process.env.INSTAGRAM_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const REDIS_URL  = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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
      headers: { Location: '/hub/?instagram=error' },
    });
  }

  try {
    // Exchange code for short-lived access token
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: `${url.origin}/api/instagram-callback`,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Instagram token exchange failed:', JSON.stringify(tokenData));
      return new Response(null, {
        status: 302,
        headers: { Location: '/hub/?instagram=error' },
      });
    }

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${APP_SECRET}&access_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedRes.json();

    const accessToken = longLivedData.access_token || tokenData.access_token;
    const userId = tokenData.user_id;

    // Store tokens in Redis
    await Promise.all([
      redisSet('stats:instagram:access_token', accessToken),
      redisSet('stats:instagram:user_id', String(userId)),
      redisSet('stats:instagram:connected_at', new Date().toISOString()),
    ]);

    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?instagram=connected' },
    });
  } catch (e) {
    console.error('Instagram callback error:', e.message);
    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?instagram=error' },
    });
  }
}
