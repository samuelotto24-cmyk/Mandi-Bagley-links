export const config = { runtime: 'edge' };

const APP_ID = process.env.INSTAGRAM_APP_ID;

export default async function handler(req) {
  const url = new URL(req.url);
  const origin = url.origin;

  // CSRF state token
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: `${origin}/api/instagram-callback`,
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_manage_messages',
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://www.instagram.com/oauth/authorize?${params}`,
      'Set-Cookie': `ig_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`,
    },
  });
}
