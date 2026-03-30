export const config = { runtime: 'edge' };

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'Password2024';

export default async function handler(req) {
  const url = new URL(req.url);
  // Accept either Authorization header (fetch) or query param (browser redirect)
  const authHeader = req.headers.get('authorization');
  const pw = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7) : url.searchParams.get('password');

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

  const origin = url.origin;
  const redirectUri = origin + '/api/youtube/callback';
  const state = encodeURIComponent(JSON.stringify({ password: pw, origin: origin }));

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

  return Response.redirect(authUrl, 302);
}
