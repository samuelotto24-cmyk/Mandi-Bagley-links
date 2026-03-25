export const config = { runtime: 'edge' };

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const PUBLICATION_ID  = 'pub_13341f5c-e6d3-411a-b7cc-e8d2916cebd5';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { email } = await req.json();
    if (!email) return new Response('Missing email', { status: 400 });

    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email: true,
        }),
      }
    );

    const ok = res.status === 200 || res.status === 201;

    return new Response(JSON.stringify({ ok }), {
      status: ok ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
