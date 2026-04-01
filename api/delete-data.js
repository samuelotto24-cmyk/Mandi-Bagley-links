export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';
const APP_SECRET  = process.env.INSTAGRAM_APP_SECRET;

// Meta sends a signed request for data deletion callbacks
async function parseSignedRequest(signedRequest) {
  if (!signedRequest || !APP_SECRET) return null;
  const [encodedSig, payload] = signedRequest.split('.');
  if (!payload) return null;
  try {
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return data;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  // POST — Meta data deletion callback
  if (req.method === 'POST') {
    const contentType = req.headers.get('content-type') || '';
    let userId = null;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const body = await req.text();
      const params = new URLSearchParams(body);
      const signedRequest = params.get('signed_request');
      const data = await parseSignedRequest(signedRequest);
      userId = data?.user_id;
    } else {
      const body = await req.json().catch(() => ({}));
      userId = body.user_id;
    }

    // Generate a confirmation code
    const confirmationCode = crypto.randomUUID();
    const statusUrl = `https://mandibagley.com/api/delete-data?code=${confirmationCode}`;

    // If we have a user ID, clean up their data from Redis
    if (userId) {
      const commands = [
        ['DEL', `${PREFIX}ig:user:${userId}`],
      ];
      await fetch(`${REDIS_URL}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commands),
      }).catch(() => {});
    }

    // Return the response Meta expects
    return new Response(JSON.stringify({
      url: statusUrl,
      confirmation_code: confirmationCode,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET — status check or user-facing deletion page
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (code) {
    return new Response(JSON.stringify({
      status: 'completed',
      confirmation_code: code,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // User-facing page
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Delete My Data — Mandi Bagley</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: sans-serif; background: #0A0A0A; color: #F0F0F0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .container { max-width: 480px; text-align: center; }
  h1 { font-size: 24px; margin-bottom: 16px; }
  p { color: rgba(255,255,255,0.6); font-size: 15px; line-height: 1.6; margin-bottom: 16px; }
  a { color: #fff; }
</style>
</head>
<body>
<div class="container">
  <h1>Request Data Deletion</h1>
  <p>To delete all data associated with your account, please email <a href="mailto:hello@bysamotto.com">hello@bysamotto.com</a> with the subject line "Data Deletion Request".</p>
  <p>We will process your request and remove all personal data within 30 days.</p>
</div>
</body>
</html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
