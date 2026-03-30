export const config = { runtime: 'edge' };

const APP_ID       = process.env.INSTAGRAM_APP_ID;
const APP_SECRET   = process.env.INSTAGRAM_APP_SECRET;
const REDIS_URL    = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX       = process.env.REDIS_PREFIX || 'stats:';

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
}

export default async function handler(req) {
  const url   = new URL(req.url);
  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?instagram=error' },
    });
  }

  try {
    // 1. Exchange code for short-lived token
    const tokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${url.origin}/api/ig-callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/hub/?instagram=error' },
      });
    }

    // 2. Exchange for long-lived token
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const longData = await longRes.json();
    const longToken = longData.access_token || tokenData.access_token;

    // 3. Get Facebook Pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${longToken}`
    );
    const pagesData = await pagesRes.json();
    const page = pagesData.data && pagesData.data[0];

    if (!page) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/hub/?instagram=error' },
      });
    }

    // 4. Get Instagram Business Account from first page
    const igRes = await fetch(
      `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${longToken}`
    );
    const igData = await igRes.json();
    const igAccountId = igData.instagram_business_account && igData.instagram_business_account.id;

    if (!igAccountId) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/hub/?instagram=error' },
      });
    }

    // 5. Store in Redis
    await Promise.all([
      redisSet(`${PREFIX}ig:access_token`, longToken),
      redisSet(`${PREFIX}ig:user_id`, igAccountId),
      redisSet(`${PREFIX}ig:page_id`, page.id),
      redisSet(`${PREFIX}ig:page_token`, page.access_token || longToken),
      redisSet(`${PREFIX}ig:connected_at`, new Date().toISOString()),
    ]);

    // 6. Fetch and store recent Instagram captions for voice training
    try {
      const mediaRes = await fetch(
        `https://graph.facebook.com/v21.0/${igAccountId}/media?fields=caption,timestamp&limit=30&access_token=${longToken}`
      );
      const mediaData = await mediaRes.json();
      const captions = (mediaData.data || [])
        .map(m => m.caption)
        .filter(Boolean)
        .filter(c => c.length > 20);
      if (captions.length) {
        await redisSet(`${PREFIX}ig:captions`, JSON.stringify(captions));
      }
    } catch {} // Non-critical — don't block the redirect

    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?instagram=connected' },
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?instagram=error' },
    });
  }
}
