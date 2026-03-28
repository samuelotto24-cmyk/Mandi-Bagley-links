export const config = { runtime: 'edge' };

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;

export default async function handler(req) {
  const url = new URL(req.url);
  const origin = url.origin;

  // CSRF state token
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_key: CLIENT_KEY,
    scope: 'user.info.basic,video.list',
    response_type: 'code',
    redirect_uri: `${origin}/api/tiktok-callback`,
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://www.tiktok.com/v2/auth/authorize/?${params}`,
      'Set-Cookie': `tiktok_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`,
    },
  });
}
