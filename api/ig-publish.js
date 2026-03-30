export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { imageUrl, caption } = body;

    if (!imageUrl || !caption) {
      return new Response(JSON.stringify({ error: 'imageUrl and caption are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Instagram credentials from Redis
    const [igUserId, pageToken] = await Promise.all([
      redisGet(`${PREFIX}ig:user_id`),
      redisGet(`${PREFIX}ig:page_token`),
    ]);

    if (!igUserId || !pageToken) {
      return new Response(JSON.stringify({ error: 'Instagram not connected' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Create media container
    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption,
          access_token: pageToken,
        }),
      }
    );

    const containerData = await containerRes.json();

    if (containerData.error) {
      return new Response(JSON.stringify({
        error: 'Instagram API error',
        details: containerData.error.message,
      }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const containerId = containerData.id;
    if (!containerId) {
      return new Response(JSON.stringify({ error: 'Failed to create media container' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Wait for container to be ready (poll status)
    let ready = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(
        `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${pageToken}`
      );
      const statusData = await statusRes.json();
      if (statusData.status_code === 'FINISHED') {
        ready = true;
        break;
      }
      if (statusData.status_code === 'ERROR') {
        return new Response(JSON.stringify({ error: 'Instagram media processing failed' }), {
          status: 502, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!ready) {
      return new Response(JSON.stringify({ error: 'Media processing timed out' }), {
        status: 504, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: pageToken,
        }),
      }
    );

    const publishData = await publishRes.json();

    if (publishData.error) {
      return new Response(JSON.stringify({
        error: 'Publish failed',
        details: publishData.error.message,
      }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      mediaId: publishData.id,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Instagram publish error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
