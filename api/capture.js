export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';
const CLIENT_NAME = process.env.CLIENT_NAME || 'Mandi Bagley';
const FROM_EMAIL  = process.env.CONTACT_FROM_EMAIL || 'hub@mandibagley.com';
const RESEND_KEY  = process.env.RESEND_API_KEY;

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}

async function redisCommand(args) {
  const res = await fetch(`${REDIS_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  return res.json();
}

async function redisPipeline(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function findAutomation(slug) {
  const raw = await redisGet(PREFIX + 'automations');
  if (!raw) return null;
  const automations = JSON.parse(raw);
  return automations.find(a => a.captureSlug === slug && a.active) || null;
}

function renderCapturePage(automation, leadCount) {
  const headline = escapeHtml(automation.captureHeadline);
  const description = automation.captureDescription ? escapeHtml(automation.captureDescription) : '';
  const upsellUrl = automation.upsellUrl ? escapeHtml(automation.upsellUrl) : '';
  const upsellText = automation.upsellText ? escapeHtml(automation.upsellText) : 'Check this out';
  const slug = escapeHtml(automation.captureSlug);
  const initial = CLIENT_NAME.charAt(0).toUpperCase();
  const socialProof = leadCount > 10 ? `${leadCount} people grabbed this` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline} — ${escapeHtml(CLIENT_NAME)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0A0A0A;
      color: #F0F0F0;
      font-family: 'DM Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 440px;
      width: 100%;
      text-align: center;
    }
    .logo {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #F0F0F0, #C0C0C0);
      color: #0A0A0A;
      font-family: 'Cormorant Garamond', serif;
      font-size: 26px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 28px;
    }
    h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 28px;
      font-weight: 600;
      line-height: 1.25;
      margin-bottom: 12px;
      color: #F0F0F0;
    }
    .description {
      font-size: 15px;
      color: #A0A0A0;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    input[type="email"] {
      width: 100%;
      padding: 14px 16px;
      border-radius: 10px;
      border: 1px solid #2A2A2A;
      background: #141414;
      color: #F0F0F0;
      font-family: 'DM Sans', sans-serif;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="email"]:focus {
      border-color: #F0F0F0;
    }
    input[type="email"]::placeholder {
      color: #666;
    }
    button {
      width: 100%;
      padding: 14px 16px;
      border-radius: 10px;
      border: none;
      background: #F0F0F0;
      color: #0A0A0A;
      font-family: 'DM Sans', sans-serif;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .social-proof {
      margin-top: 16px;
      font-size: 13px;
      color: #777;
    }
    .thank-you { display: none; }
    .thank-you.visible { display: block; }
    .form-state.hidden { display: none; }
    .checkmark {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #1a3a1a;
      color: #4ade80;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .thank-you h2 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .thank-you p {
      font-size: 14px;
      color: #A0A0A0;
      line-height: 1.5;
    }
    .upsell-card {
      margin-top: 28px;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #2A2A2A;
      background: #141414;
    }
    .upsell-card a {
      display: inline-block;
      margin-top: 12px;
      padding: 10px 24px;
      border-radius: 8px;
      background: #F0F0F0;
      color: #0A0A0A;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .upsell-card a:hover { opacity: 0.9; }
    .footer {
      margin-top: 48px;
      font-size: 12px;
      color: #555;
    }
    .footer a { color: #777; text-decoration: none; }
    .footer a:hover { color: #F0F0F0; }
    .error-msg {
      color: #f87171;
      font-size: 13px;
      margin-top: 8px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">${initial}</div>

    <div id="formState" class="form-state">
      <h1>${headline}</h1>
      ${description ? `<p class="description">${description}</p>` : ''}
      <form id="captureForm" class="form-group" onsubmit="return false;">
        <input type="email" id="emailInput" placeholder="Your email address" required autocomplete="email" />
        <button type="submit" id="submitBtn">Send it to me</button>
        <div id="errorMsg" class="error-msg"></div>
      </form>
      ${socialProof ? `<p class="social-proof">${socialProof}</p>` : ''}
    </div>

    <div id="thankYou" class="thank-you">
      <div class="checkmark">&#10003;</div>
      <h2>Check your inbox!</h2>
      <p>We just sent it to your email. If you don't see it, check your spam folder.</p>
      ${upsellUrl ? `
      <div class="upsell-card">
        <p style="font-size:14px;color:#A0A0A0;">${upsellText}</p>
        <a href="${upsellUrl}" target="_blank" rel="noopener">Take a look &rarr;</a>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <a href="https://instagram.com/mandibagley" target="_blank" rel="noopener">@mandibagley</a>
    </div>
  </div>

  <script>
    (function() {
      var form = document.getElementById('captureForm');
      var emailInput = document.getElementById('emailInput');
      var submitBtn = document.getElementById('submitBtn');
      var errorMsg = document.getElementById('errorMsg');
      var formState = document.getElementById('formState');
      var thankYou = document.getElementById('thankYou');

      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var email = emailInput.value.trim();
        if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
          errorMsg.textContent = 'Please enter a valid email address.';
          errorMsg.style.display = 'block';
          return;
        }
        errorMsg.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        fetch('/api/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: '${slug}', email: email })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.ok) {
            formState.classList.add('hidden');
            thankYou.classList.add('visible');
          } else {
            errorMsg.textContent = data.error || 'Something went wrong. Please try again.';
            errorMsg.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send it to me';
          }
        })
        .catch(function() {
          errorMsg.textContent = 'Something went wrong. Please try again.';
          errorMsg.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send it to me';
        });
      });
    })();
  </script>
</body>
</html>`;
}

function renderFreebieEmail(automation) {
  const headline = escapeHtml(automation.captureHeadline);
  const description = automation.captureDescription ? escapeHtml(automation.captureDescription) : '';
  const freebieValue = automation.freebieValue;
  const isCode = automation.freebieType === 'discount_code';

  let freebieBlock;
  if (isCode) {
    freebieBlock = `
      <div style="margin:24px 0;padding:20px;background:#f5f5f5;border-radius:8px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:#666;">Your code:</p>
        <p style="margin:0;font-size:24px;font-weight:700;letter-spacing:2px;color:#0A0A0A;">${escapeHtml(freebieValue)}</p>
      </div>`;
  } else {
    freebieBlock = `
      <div style="margin:24px 0;text-align:center;">
        <a href="${escapeHtml(freebieValue)}" style="display:inline-block;padding:14px 32px;background:#0A0A0A;color:#F0F0F0;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Get your freebie &rarr;</a>
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px;text-align:center;">
      <h1 style="margin:0 0 12px;font-size:22px;color:#0A0A0A;">${headline}</h1>
      ${description ? `<p style="margin:0 0 8px;font-size:14px;color:#666;line-height:1.5;">${description}</p>` : ''}
      ${freebieBlock}
      <p style="margin:24px 0 0;font-size:12px;color:#999;">Sent by ${escapeHtml(CLIENT_NAME)}</p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req) {
  const url = new URL(req.url);

  // ---------- GET — serve capture page ----------
  if (req.method === 'GET') {
    const slug = url.searchParams.get('slug');
    if (!slug) {
      return new Response('Not found', { status: 404 });
    }

    const automation = await findAutomation(slug);
    if (!automation) {
      return new Response('Not found', { status: 404 });
    }

    // Increment clicks
    const funnelKey = `${PREFIX}funnel:${automation.keyword}`;
    await redisCommand(['HINCRBY', funnelKey, 'clicks', '1']);

    // Get captured count for social proof
    const capturedRes = await redisCommand(['HGET', funnelKey, 'captured']);
    const leadCount = parseInt(capturedRes.result, 10) || 0;

    const html = renderCapturePage(automation, leadCount);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // ---------- POST — handle email submission ----------
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { slug, email } = body;

      if (!slug || !email) {
        return json({ ok: false, error: 'Missing slug or email' }, 400);
      }

      // Validate email
      if (!email.includes('@') || !email.includes('.')) {
        return json({ ok: false, error: 'Invalid email address' }, 400);
      }

      const automation = await findAutomation(slug);
      if (!automation) {
        return json({ ok: false, error: 'Automation not found' }, 404);
      }

      const keyword = automation.keyword;
      const now = new Date().toISOString();

      // Store email, increment funnel, push lead event
      await redisPipeline([
        ['HSET', `${PREFIX}emails:${slug}`, email, JSON.stringify({ keyword, capturedAt: now })],
        ['HINCRBY', `${PREFIX}funnel:${keyword}`, 'captured', '1'],
        ['LPUSH', `${PREFIX}leads`, JSON.stringify({ slug, email, keyword, capturedAt: now })],
        ['LTRIM', `${PREFIX}leads`, '0', '999'],
      ]);

      // Send freebie email via Resend
      if (RESEND_KEY) {
        const emailHtml = renderFreebieEmail(automation);
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${CLIENT_NAME} <${FROM_EMAIL}>`,
            to: [email],
            subject: automation.captureHeadline,
            html: emailHtml,
          }),
        });
      }

      return json({ ok: true });
    } catch {
      return json({ ok: false, error: 'Server error' }, 500);
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
