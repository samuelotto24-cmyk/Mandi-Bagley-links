export const config = { runtime: 'edge' };

const APP_ID = process.env.INSTAGRAM_APP_ID;

export default async function handler(req) {
  if (!APP_ID) {
    return new Response(JSON.stringify({ error: 'Instagram not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const origin = url.origin;

  // CSRF state token
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: `${origin}/api/ig-callback`,
    scope: 'instagram_basic,instagram_manage_comments,instagram_manage_messages',
    response_type: 'code',
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://www.facebook.com/v21.0/dialog/oauth?${params}`,
      'Set-Cookie': `ig_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`,
    },
  });
}
