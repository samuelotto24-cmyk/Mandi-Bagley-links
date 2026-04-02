export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';

// Stores a base64 image in Redis temporarily (1 hour TTL) and returns a public URL to serve it.
// This is needed because Instagram's Content Publishing API requires a publicly accessible image URL.

export default async function handler(req) {
  const url = new URL(req.url);

  // GET — serve a stored image
  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (!id || !/^[a-z0-9-]+$/.test(id)) {
      return new Response('Not found', { status: 404 });
    }

    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(PREFIX + 'tmp:img:' + id)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const data = await res.json();
    if (!data.result) {
      return new Response('Not found', { status: 404 });
    }

    const stored = JSON.parse(data.result);
    const imageBuffer = Uint8Array.from(atob(stored.data), c => c.charCodeAt(0));

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': stored.mediaType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // POST — store an image
  if (req.method === 'POST') {
    const authHeader = req.headers.get('authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token !== PASSWORD) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { image } = body;
    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    let mediaType = 'image/jpeg';
    let base64Data = image;
    if (image.startsWith('data:')) {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        mediaType = match[1];
        base64Data = match[2];
      }
    }

    const id = crypto.randomUUID();
    const key = PREFIX + 'tmp:img:' + id;

    // Parse optional TTL parameter (default 1 hour, max 7 days)
    const requestedTTL = parseInt(body.ttl, 10);
    const maxTTL = 604800; // 7 days
    const ttl = (requestedTTL > 0 && requestedTTL <= maxTTL) ? requestedTTL : 3600;

    // Store in Redis with configurable TTL
    await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['SET', key, JSON.stringify({ data: base64Data, mediaType }), 'EX', ttl],
      ]),
    });

    const origin = url.origin;
    const publicUrl = `${origin}/api/upload-image?id=${id}`;

    return new Response(JSON.stringify({ ok: true, url: publicUrl, id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
