export const config = { runtime: 'edge' };

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
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
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response('<html><body><h2>YouTube connection cancelled.</h2><p><a href="/hub">Back to Hub</a></p></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code || !stateRaw) {
    return new Response('Missing code or state', { status: 400 });
  }

  let state;
  try {
    state = JSON.parse(decodeURIComponent(stateRaw));
  } catch (e) {
    return new Response('Invalid state', { status: 400 });
  }

  const origin = state.origin || url.origin;
  const redirectUri = origin + '/api/youtube/callback';

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: YOUTUBE_CLIENT_ID,
      client_secret: YOUTUBE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Token exchange failed:', errText);
    return new Response('<html><body><h2>Connection failed.</h2><p>Could not connect YouTube. <a href="/hub">Try again</a></p></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const tokens = await tokenRes.json();

  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const channelData = await channelRes.json();
  const channelId = channelData.items?.[0]?.id || '';
  const channelTitle = channelData.items?.[0]?.snippet?.title || '';

  const tokenData = JSON.stringify({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in * 1000),
    channelId: channelId,
    channelTitle: channelTitle,
    connectedAt: new Date().toISOString(),
  });

  await redis([
    ['SET', PREFIX + 'youtube:tokens', tokenData],
  ]);

  return Response.redirect(origin + '/hub', 302);
}
