export const config = { runtime: 'edge' };

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'Password2024';
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisSet(key, value, exSec) {
  await fetch(`${REDIS_URL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, value, 'EX', exSec]),
  });
}

export default async function handler(req) {
  const url = new URL(req.url);
  const authHeader = req.headers.get('authorization');
  const pw = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7) : null;

  if (pw !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!YOUTUBE_CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'YouTube not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Generate a random nonce instead of embedding password in state
  const nonce = crypto.randomUUID();
  const origin = url.origin;
  const redirectUri = origin + '/api/youtube/callback';

  // Store nonce in Redis with 10 min TTL
  await redisSet('oauth:yt:' + nonce, JSON.stringify({ origin }), 600);

  const state = encodeURIComponent(JSON.stringify({ nonce, origin }));

  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ].join(' ');

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: YOUTUBE_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    state: state,
  }).toString();

  // Return URL as JSON so the hub JS can navigate (fetch can't follow cross-origin redirects)
  return new Response(JSON.stringify({ url: authUrl }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
