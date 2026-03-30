# Engagement Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a ManyChat-alternative comment-to-customer automation system integrated into the Mandi Bagley creator hub — keyword comment triggers, auto-replies, DM responses, branded capture pages with email gates, and full funnel tracking.

**Architecture:** Edge-runtime API endpoints on Vercel, Redis (Upstash) for all state, Resend for freebie delivery emails, Instagram Graph API for comment/DM automation. The hub UI (hub/index.html) gets three new bento cards: Automations Manager, Conversion Funnel, and Recent Leads. Capture pages are dynamically generated from automation configs via a Vercel rewrite.

**Tech Stack:** Vanilla JS (hub/index.html), Vercel Edge Functions, Upstash Redis REST API, Resend API, Instagram Graph API (comment webhooks + messaging)

**Spec:** `docs/superpowers/specs/2026-03-30-engagement-engine-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `api/automations.js` | Create | CRUD for automation configs (keyword, templates, slug, freebie) |
| `api/capture.js` | Create | Serves branded capture pages (GET) + handles email submission (POST) |
| `api/leads.js` | Create | Lead data endpoint for hub (recent leads, funnel stats, CSV export) |
| `api/ig-auth.js` | Create | Instagram OAuth initiation (redirect to Meta) |
| `api/ig-callback.js` | Create | Instagram OAuth callback (exchange code, store token) |
| `api/ig-webhook.js` | Create | Instagram webhook receiver (comment + DM events) |
| `hub/index.html` | Modify | Add Automations card, Funnel card, Leads card to bento grid |
| `vercel.json` | Modify | Add `/g/:slug` rewrite + CSP update for graph.facebook.com |

---

### Task 1: Automations CRUD API

**Files:**
- Create: `api/automations.js`

This endpoint manages automation configs in Redis. Follows the same edge runtime + Redis pipeline + Bearer auth pattern as existing endpoints (`api/tiktok-stats.js`, `api/briefing.js`).

- [ ] **Step 1: Create `api/automations.js` with GET handler**

```js
export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

function auth(req) {
  const h = req.headers.get('authorization');
  const token = h && h.startsWith('Bearer ') ? h.slice(7) : null;
  return token === PASSWORD;
}

const AUTOMATIONS_KEY = `${PREFIX}automations`;

export default async function handler(req) {
  if (!auth(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const method = req.method;

  // GET — list all automations
  if (method === 'GET') {
    const raw = await redisGet(AUTOMATIONS_KEY);
    const automations = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify({ automations }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST — create automation
  if (method === 'POST') {
    const body = await req.json();
    const { keyword, commentReply, dmResponse, captureSlug, captureHeadline, captureDescription, freebieType, freebieValue, upsellUrl, upsellText } = body;

    if (!keyword || !commentReply || !dmResponse || !captureSlug || !captureHeadline || !freebieType || !freebieValue) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const raw = await redisGet(AUTOMATIONS_KEY);
    const automations = raw ? JSON.parse(raw) : [];
    const normalized = keyword.toUpperCase().trim();

    if (automations.find(a => a.keyword === normalized)) {
      return new Response(JSON.stringify({ error: 'Keyword already exists' }), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }

    const automation = {
      keyword: normalized,
      commentReply,
      dmResponse,
      captureSlug: captureSlug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      captureHeadline,
      captureDescription: captureDescription || '',
      freebieType,
      freebieValue,
      upsellUrl: upsellUrl || '',
      upsellText: upsellText || '',
      active: true,
      createdAt: new Date().toISOString(),
    };

    automations.push(automation);
    await redisSet(AUTOMATIONS_KEY, JSON.stringify(automations));

    return new Response(JSON.stringify({ ok: true, automation }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  }

  // PUT — update automation
  if (method === 'PUT') {
    const body = await req.json();
    const { keyword, ...updates } = body;

    if (!keyword) {
      return new Response(JSON.stringify({ error: 'keyword is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const raw = await redisGet(AUTOMATIONS_KEY);
    const automations = raw ? JSON.parse(raw) : [];
    const normalized = keyword.toUpperCase().trim();
    const idx = automations.findIndex(a => a.keyword === normalized);

    if (idx === -1) {
      return new Response(JSON.stringify({ error: 'Automation not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Allow updating any field except keyword
    const allowed = ['commentReply', 'dmResponse', 'captureSlug', 'captureHeadline', 'captureDescription', 'freebieType', 'freebieValue', 'upsellUrl', 'upsellText', 'active'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        automations[idx][key] = key === 'captureSlug'
          ? updates[key].toLowerCase().replace(/[^a-z0-9-]/g, '')
          : updates[key];
      }
    }

    await redisSet(AUTOMATIONS_KEY, JSON.stringify(automations));

    return new Response(JSON.stringify({ ok: true, automation: automations[idx] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // DELETE — remove automation
  if (method === 'DELETE') {
    const url = new URL(req.url);
    const keyword = (url.searchParams.get('keyword') || '').toUpperCase().trim();

    if (!keyword) {
      return new Response(JSON.stringify({ error: 'keyword query param required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const raw = await redisGet(AUTOMATIONS_KEY);
    const automations = raw ? JSON.parse(raw) : [];
    const filtered = automations.filter(a => a.keyword !== keyword);

    if (filtered.length === automations.length) {
      return new Response(JSON.stringify({ error: 'Automation not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    await redisSet(AUTOMATIONS_KEY, JSON.stringify(filtered));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Test locally with curl**

Start dev server:
```bash
cd /Users/samotto/mandi-bagley && npx vercel dev
```

Test CRUD operations:
```bash
# Create
curl -X POST http://localhost:3000/api/automations \
  -H "Authorization: Bearer Password2024" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"MEAL","commentReply":"DM me MEAL and I'\''ll send it! 🔥","dmResponse":"Here'\''s your free meal plan! 👉","captureSlug":"meal","captureHeadline":"Your Free 7-Day Meal Plan","captureDescription":"Simple, delicious meals to hit your macros","freebieType":"pdf_link","freebieValue":"https://example.com/meal-plan.pdf"}'

# Expected: {"ok":true,"automation":{...}}

# List
curl http://localhost:3000/api/automations \
  -H "Authorization: Bearer Password2024"

# Expected: {"automations":[{"keyword":"MEAL",...}]}

# Update (pause)
curl -X PUT http://localhost:3000/api/automations \
  -H "Authorization: Bearer Password2024" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"MEAL","active":false}'

# Expected: {"ok":true,"automation":{"keyword":"MEAL","active":false,...}}

# Delete
curl -X DELETE "http://localhost:3000/api/automations?keyword=MEAL" \
  -H "Authorization: Bearer Password2024"

# Expected: {"ok":true}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/automations.js
git commit -m "feat: add automations CRUD API endpoint"
```

---

### Task 2: Capture Page API + Vercel Rewrite

**Files:**
- Create: `api/capture.js`
- Modify: `vercel.json` — add rewrite rule for `/g/:slug`

The capture page is a single edge function that serves a branded HTML page (GET) and handles email submission (POST). The page is dynamically generated from the automation config in Redis, themed using Mandi's brand (cormorant font, dark background, white/cream accents).

- [ ] **Step 1: Add rewrite to `vercel.json`**

Add a `rewrites` array to `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/g/:slug", "destination": "/api/capture?slug=:slug" }
  ]
}
```

This goes at the top level of the JSON object, alongside the existing `crons` and `headers` keys.

- [ ] **Step 2: Create `api/capture.js`**

```js
export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const RESEND_KEY  = process.env.RESEND_API_KEY;
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';
const CLIENT_NAME = process.env.CLIENT_NAME || 'Mandi Bagley';
const FROM_EMAIL  = process.env.CONTACT_FROM_EMAIL || 'hub@mandibagley.com';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}

async function redisPipeline(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function findAutomationBySlug(automations, slug) {
  return automations.find(a => a.captureSlug === slug && a.active);
}

function renderCapturePage(automation, leadCount) {
  const { captureHeadline, captureDescription, captureSlug, upsellUrl, upsellText } = automation;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${captureHeadline} — ${CLIENT_NAME}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: #0A0A0A;
    color: #F0F0F0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .container {
    max-width: 440px;
    width: 100%;
    text-align: center;
  }
  .logo {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.12);
    margin: 0 auto 24px;
    background: #181818;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px;
    font-weight: 300;
    color: #fff;
  }
  h1 {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 400;
    font-size: 32px;
    line-height: 1.2;
    margin-bottom: 12px;
    letter-spacing: -0.01em;
  }
  .desc {
    color: rgba(255,255,255,0.5);
    font-size: 15px;
    line-height: 1.5;
    margin-bottom: 32px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }
  input[type="email"] {
    width: 100%;
    padding: 14px 18px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    background: #111;
    color: #F0F0F0;
    font-size: 16px;
    font-family: 'DM Sans', sans-serif;
    outline: none;
    transition: border-color 0.2s;
  }
  input[type="email"]:focus {
    border-color: rgba(255,255,255,0.3);
  }
  input[type="email"]::placeholder {
    color: rgba(255,255,255,0.25);
  }
  .btn {
    width: 100%;
    padding: 14px 24px;
    border: none;
    border-radius: 10px;
    background: #fff;
    color: #0A0A0A;
    font-size: 15px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .btn:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .social-proof {
    color: rgba(255,255,255,0.3);
    font-size: 13px;
    margin-top: 8px;
  }
  .error {
    color: #ff6b6b;
    font-size: 13px;
    margin-top: 8px;
    display: none;
  }
  /* Thank you state */
  .thank-you { display: none; }
  .thank-you.active { display: block; }
  .form-state.hidden { display: none; }
  .check-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  .upsell {
    margin-top: 32px;
    padding: 20px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    background: rgba(255,255,255,0.03);
  }
  .upsell a {
    color: #fff;
    text-decoration: none;
    font-weight: 500;
    display: inline-block;
    margin-top: 12px;
    padding: 10px 24px;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    transition: background 0.2s;
  }
  .upsell a:hover { background: rgba(255,255,255,0.06); }
  .footer {
    margin-top: 40px;
    color: rgba(255,255,255,0.2);
    font-size: 12px;
  }
  .footer a { color: rgba(255,255,255,0.3); text-decoration: none; }
</style>
</head>
<body>
<div class="container">
  <div class="form-state" id="formState">
    <div class="logo">${CLIENT_NAME.charAt(0)}</div>
    <h1>${captureHeadline}</h1>
    ${captureDescription ? `<p class="desc">${captureDescription}</p>` : ''}
    <form id="captureForm" onsubmit="return submitCapture(event)">
      <div class="form-group">
        <input type="email" id="emailInput" placeholder="your@email.com" required autocomplete="email">
        <button type="submit" class="btn" id="submitBtn">Send it to me &rarr;</button>
      </div>
    </form>
    <div class="error" id="errorMsg"></div>
    ${leadCount > 10 ? `<div class="social-proof">${leadCount.toLocaleString()} people grabbed this</div>` : ''}
  </div>

  <div class="thank-you" id="thankYou">
    <div class="check-icon">&#10003;</div>
    <h1>Check your email!</h1>
    <p class="desc">We just sent it over. Check your inbox (and spam folder, just in case).</p>
    ${upsellUrl ? `
    <div class="upsell">
      <p>${upsellText || 'Want to take it to the next level?'}</p>
      <a href="${upsellUrl}" target="_blank">Check it out &rarr;</a>
    </div>` : ''}
  </div>

  <div class="footer">
    <a href="https://mandibagley.com">@${CLIENT_NAME.toLowerCase().replace(/\s+/g, '')}</a>
  </div>
</div>
<script>
async function submitCapture(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const email = document.getElementById('emailInput').value.trim();
  const errorEl = document.getElementById('errorMsg');
  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Sending...';
  try {
    const res = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: '${captureSlug}', email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    document.getElementById('formState').classList.add('hidden');
    document.getElementById('thankYou').classList.add('active');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Send it to me →';
  }
}
</script>
</body>
</html>`;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  // Load automations
  const raw = await redisGet(`${PREFIX}automations`);
  const automations = raw ? JSON.parse(raw) : [];
  const automation = findAutomationBySlug(automations, slug);

  if (!automation) {
    return new Response('Not found', { status: 404 });
  }

  // GET — serve capture page
  if (req.method === 'GET') {
    // Track page view + get lead count
    const funnelKey = `${PREFIX}funnel:${automation.keyword}`;
    await redisPipeline([
      ['HINCRBY', funnelKey, 'clicks', 1],
    ]);

    // Get lead count for social proof
    const countRes = await fetch(`${REDIS_URL}/hget/${encodeURIComponent(funnelKey)}/captured`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const countData = await countRes.json();
    const leadCount = parseInt(countData.result || '0', 10);

    return new Response(renderCapturePage(automation, leadCount), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // POST — handle email submission
  if (req.method === 'POST') {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@') || !email.includes('.')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const funnelKey = `${PREFIX}funnel:${automation.keyword}`;
    const emailsKey = `${PREFIX}emails:${automation.captureSlug}`;
    const leadsKey = `${PREFIX}leads`;

    // Store email + update funnel + log lead event
    const leadEvent = JSON.stringify({
      step: 'captured',
      email,
      keyword: automation.keyword,
      slug: automation.captureSlug,
      timestamp: now,
    });

    await redisPipeline([
      ['HSET', emailsKey, email, JSON.stringify({ keyword: automation.keyword, capturedAt: now })],
      ['HINCRBY', funnelKey, 'captured', 1],
      ['LPUSH', leadsKey, leadEvent],
      ['LTRIM', leadsKey, 0, 999],
    ]);

    // Send freebie email via Resend
    if (RESEND_KEY) {
      const freebieHtml = automation.freebieType === 'discount_code'
        ? `<p>Here's your code: <strong>${automation.freebieValue}</strong></p>`
        : `<p><a href="${automation.freebieValue}" style="color:#000;background:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Get it here &rarr;</a></p>`;

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
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="font-size:24px;margin-bottom:16px">${automation.captureHeadline}</h2>
            ${automation.captureDescription ? `<p style="color:#666;margin-bottom:24px">${automation.captureDescription}</p>` : ''}
            ${freebieHtml}
            <p style="color:#999;font-size:12px;margin-top:32px">From ${CLIENT_NAME}</p>
          </div>`,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
```

- [ ] **Step 3: Test the capture page**

```bash
# First, create a test automation (if not already done from Task 1)
curl -X POST http://localhost:3000/api/automations \
  -H "Authorization: Bearer Password2024" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"MEAL","commentReply":"DM me MEAL!","dmResponse":"Here you go!","captureSlug":"meal","captureHeadline":"Your Free 7-Day Meal Plan","captureDescription":"Simple meals to hit your macros every day","freebieType":"pdf_link","freebieValue":"https://example.com/meal.pdf"}'

# Visit http://localhost:3000/g/meal in browser — should see branded capture page

# Test email submission
curl -X POST http://localhost:3000/api/capture?slug=meal \
  -H "Content-Type: application/json" \
  -d '{"slug":"meal","email":"test@example.com"}'

# Expected: {"ok":true}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/capture.js vercel.json
git commit -m "feat: add capture page API + /g/:slug rewrite"
```

---

### Task 3: Leads API

**Files:**
- Create: `api/leads.js`

Endpoint for the hub to fetch recent leads, funnel stats per automation, and export emails as CSV.

- [ ] **Step 1: Create `api/leads.js`**

```js
export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';

async function redisPipeline(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function auth(req) {
  const h = req.headers.get('authorization');
  const token = h && h.startsWith('Bearer ') ? h.slice(7) : null;
  return token === PASSWORD;
}

export default async function handler(req) {
  if (!auth(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get('export');

  // Load automations to know which funnels to query
  const automationsRes = await fetch(`${REDIS_URL}/get/${encodeURIComponent(`${PREFIX}automations`)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const automationsData = await automationsRes.json();
  const automations = automationsData.result ? JSON.parse(automationsData.result) : [];

  // Build pipeline: get recent leads + funnel stats for each automation
  const commands = [
    ['LRANGE', `${PREFIX}leads`, 0, 99],
  ];
  for (const a of automations) {
    commands.push(['HGETALL', `${PREFIX}funnel:${a.keyword}`]);
  }

  // If CSV export, also get all emails for each slug
  if (format === 'csv') {
    for (const a of automations) {
      commands.push(['HGETALL', `${PREFIX}emails:${a.captureSlug}`]);
    }
  }

  const results = await redisPipeline(commands);

  // Parse recent leads
  const leadsRaw = results[0]?.result || [];
  const recentLeads = leadsRaw.map(item => {
    try { return JSON.parse(item); } catch { return null; }
  }).filter(Boolean);

  // Parse funnel stats
  const funnels = {};
  for (let i = 0; i < automations.length; i++) {
    const funnelResult = results[1 + i]?.result || [];
    const stats = {};
    for (let j = 0; j < funnelResult.length; j += 2) {
      stats[funnelResult[j]] = parseInt(funnelResult[j + 1], 10) || 0;
    }
    funnels[automations[i].keyword] = {
      comments: stats.comments || 0,
      dms: stats.dms || 0,
      clicks: stats.clicks || 0,
      captured: stats.captured || 0,
    };
  }

  // CSV export
  if (format === 'csv') {
    let csv = 'email,keyword,slug,captured_at\n';
    const emailStartIdx = 1 + automations.length;
    for (let i = 0; i < automations.length; i++) {
      const emailResult = results[emailStartIdx + i]?.result || [];
      const slug = automations[i].captureSlug;
      const keyword = automations[i].keyword;
      for (let j = 0; j < emailResult.length; j += 2) {
        const email = emailResult[j];
        let meta = {};
        try { meta = JSON.parse(emailResult[j + 1]); } catch {}
        csv += `${email},${keyword},${slug},${meta.capturedAt || ''}\n`;
      }
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="leads.csv"',
      },
    });
  }

  // Total emails across all automations
  const totalEmails = Object.values(funnels).reduce((sum, f) => sum + f.captured, 0);

  return new Response(JSON.stringify({
    recentLeads,
    funnels,
    totalEmails,
    automationCount: automations.length,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Test the endpoint**

```bash
# Get leads data
curl http://localhost:3000/api/leads \
  -H "Authorization: Bearer Password2024"

# Expected: {"recentLeads":[...],"funnels":{"MEAL":{"comments":0,"dms":0,"clicks":1,"captured":1}},...}

# CSV export
curl "http://localhost:3000/api/leads?export=csv" \
  -H "Authorization: Bearer Password2024"

# Expected: CSV with email,keyword,slug,captured_at header + rows
```

- [ ] **Step 3: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/leads.js
git commit -m "feat: add leads API with funnel stats and CSV export"
```

---

### Task 4: Hub UI — Automations Card

**Files:**
- Modify: `hub/index.html`

Add the Automations bento card to the hub grid. This includes the card HTML, the creation/edit modal, CSS styles, and JavaScript for CRUD operations. Placed after the existing cards in the bento grid.

- [ ] **Step 1: Add Automations CSS**

Add these styles to the existing `<style>` block in `hub/index.html`, before the closing `</style>` tag. Find the last style block (there are multiple) — add before its `</style>`:

```css
/* ── Automations Card ── */
.automations-list { display: flex; flex-direction: column; gap: 10px; }
.automation-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.automation-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.automation-keyword {
  font-family: 'DM Sans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  background: var(--accent-pale);
  border: 1px solid var(--accent-border);
  padding: 3px 10px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}
.automation-status {
  font-size: 11px;
  color: var(--text-muted);
}
.automation-status.active { color: #4ade80; }
.automation-stats {
  font-size: 12px;
  color: var(--text-muted);
}
.automation-reply {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.automation-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.automation-actions button {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}
.automation-actions button:hover {
  background: var(--accent-pale);
  color: var(--text);
}
.automation-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 24px 16px;
}

/* ── Automation Modal ── */
.auto-modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  z-index: 9999;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.auto-modal-overlay.active { display: flex; }
.auto-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 28px;
  max-width: 480px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
}
.auto-modal h3 {
  font-family: var(--display-font);
  font-size: 22px;
  font-weight: 400;
  margin-bottom: 20px;
}
.auto-modal label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
  margin-top: 14px;
}
.auto-modal input, .auto-modal textarea, .auto-modal select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  font-family: 'DM Sans', sans-serif;
  outline: none;
}
.auto-modal textarea { resize: vertical; min-height: 60px; }
.auto-modal input:focus, .auto-modal textarea:focus, .auto-modal select:focus {
  border-color: var(--accent-border);
}
.auto-modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
  justify-content: flex-end;
}
.auto-modal-actions button {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
}
.auto-modal-save {
  background: var(--accent);
  color: var(--bg);
  font-weight: 600;
}
.auto-modal-cancel {
  background: transparent;
  border: 1px solid var(--border) !important;
  color: var(--text-muted);
}

/* ── Funnel Card ── */
.funnel-list { display: flex; flex-direction: column; gap: 12px; }
.funnel-row { display: flex; flex-direction: column; gap: 4px; }
.funnel-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.funnel-keyword {
  font-weight: 600;
  font-size: 13px;
}
.funnel-pct {
  font-size: 13px;
  color: var(--text-muted);
}
.funnel-bar-bg {
  height: 6px;
  background: var(--accent-pale);
  border-radius: 3px;
  overflow: hidden;
}
.funnel-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.4s ease;
}
.funnel-steps {
  font-size: 11px;
  color: var(--text-muted);
}
.funnel-total {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 8px;
  text-align: center;
}

/* ── Leads Card ── */
.leads-list { display: flex; flex-direction: column; gap: 6px; }
.lead-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.lead-item:last-child { border-bottom: none; }
.lead-time { color: var(--text-muted); font-size: 11px; min-width: 50px; }
.lead-user { font-weight: 500; }
.lead-keyword {
  font-size: 11px;
  background: var(--accent-pale);
  padding: 2px 6px;
  border-radius: 4px;
}
.lead-step {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}
.leads-export {
  display: block;
  margin: 12px auto 0;
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}
.leads-export:hover { background: var(--accent-pale); color: var(--text); }
```

- [ ] **Step 2: Add Automations HTML cards to the bento grid**

Find the last `</div><!-- /bento-card -->` before `</div><!-- /bento-grid -->` in `hub/index.html`. Add these three cards before the closing `</div>` of the bento-grid:

```html
    <!-- ROW: Automations (span-6) | Conversion Funnel (span-6) -->
    <div class="bento-card span-6" data-order="12">
      <div class="bento-card-header">
        <span class="bento-card-icon">&#129302;</span>
        <span class="bento-card-title">Automations</span>
        <button class="briefing-refresh" onclick="openAutomationModal()" title="New Automation" style="margin-left:auto;font-size:16px">+</button>
      </div>
      <div id="automationsList" class="automations-list">
        <div class="automation-empty">Loading...</div>
      </div>
    </div>

    <div class="bento-card span-6" data-order="13">
      <div class="bento-card-header">
        <span class="bento-card-icon">&#128202;</span>
        <span class="bento-card-title">Conversion Funnel</span>
      </div>
      <div id="funnelList" class="funnel-list">
        <div class="automation-empty">No automations yet</div>
      </div>
      <div class="funnel-total" id="funnelTotal"></div>
    </div>

    <!-- ROW: Recent Leads (span-12) -->
    <div class="bento-card span-12" data-order="14">
      <div class="bento-card-header">
        <span class="bento-card-icon">&#128293;</span>
        <span class="bento-card-title">Recent Leads</span>
      </div>
      <div id="leadsList" class="leads-list">
        <div class="automation-empty">No leads yet — create an automation to get started</div>
      </div>
      <button class="leads-export" id="leadsExportBtn" style="display:none" onclick="exportLeads()">Export Emails &#8595;</button>
    </div>
```

- [ ] **Step 3: Add the automation creation/edit modal HTML**

Add this just before the closing `</body>` tag (outside the bento-grid):

```html
<!-- Automation Modal -->
<div class="auto-modal-overlay" id="autoModalOverlay" onclick="if(event.target===this)closeAutomationModal()">
  <div class="auto-modal">
    <h3 id="autoModalTitle">New Automation</h3>
    <label>Keyword (what they comment)</label>
    <input type="text" id="autoKeyword" placeholder="MEAL" maxlength="30">
    <label>Comment Reply (auto-replied to their comment)</label>
    <textarea id="autoCommentReply" placeholder="DM me MEAL and I'll send it! 🔥"></textarea>
    <label>DM Response (sent when they DM the keyword)</label>
    <textarea id="autoDmResponse" placeholder="Here's your free meal plan! 👉"></textarea>
    <label>Capture Page URL Slug</label>
    <input type="text" id="autoCaptureSlug" placeholder="meal">
    <label>Capture Page Headline</label>
    <input type="text" id="autoCaptureHeadline" placeholder="Your Free 7-Day Meal Plan">
    <label>Description (optional)</label>
    <textarea id="autoCaptureDesc" placeholder="Simple, delicious meals to hit your macros"></textarea>
    <label>Freebie Type</label>
    <select id="autoFreebieType">
      <option value="pdf_link">PDF / Download Link</option>
      <option value="discount_code">Discount Code</option>
      <option value="video_link">Video Link</option>
      <option value="external_url">External URL</option>
    </select>
    <label>Freebie Value (URL or code)</label>
    <input type="text" id="autoFreebieValue" placeholder="https://... or CODE123">
    <label>Upsell URL (optional)</label>
    <input type="text" id="autoUpsellUrl" placeholder="https://...">
    <label>Upsell CTA Text (optional)</label>
    <input type="text" id="autoUpsellText" placeholder="Ready for the full program?">
    <div class="auto-modal-actions">
      <button class="auto-modal-cancel" onclick="closeAutomationModal()">Cancel</button>
      <button class="auto-modal-save" id="autoModalSave" onclick="saveAutomation()">Create</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Add JavaScript for automations management**

Add this `<script>` block before the closing `</body>`, after the modal HTML:

```html
<script>
/* ── Automations Engine ── */
let automationsData = [];
let editingKeyword = null;

async function loadAutomations() {
  try {
    const res = await fetch('/api/automations', {
      headers: { Authorization: `Bearer ${password}` },
    });
    const data = await res.json();
    automationsData = data.automations || [];
    renderAutomations();
  } catch { /* silent */ }
}

function renderAutomations() {
  const container = document.getElementById('automationsList');
  if (!automationsData.length) {
    container.innerHTML = '<div class="automation-empty">No automations yet — tap + to create one</div>';
    return;
  }
  container.innerHTML = automationsData.map(a => `
    <div class="automation-item">
      <div class="automation-item-header">
        <span class="automation-keyword">${a.keyword}</span>
        <span class="automation-status ${a.active ? 'active' : ''}">${a.active ? '● Active' : '○ Paused'}</span>
      </div>
      <div class="automation-reply">"${a.commentReply}"</div>
      <div class="automation-stats" id="autoStats_${a.keyword}"></div>
      <div class="automation-actions">
        <button onclick="editAutomation('${a.keyword}')">Edit</button>
        <button onclick="toggleAutomation('${a.keyword}', ${!a.active})">${a.active ? 'Pause' : 'Resume'}</button>
        <button onclick="deleteAutomation('${a.keyword}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function openAutomationModal(keyword) {
  editingKeyword = keyword || null;
  const overlay = document.getElementById('autoModalOverlay');
  document.getElementById('autoModalTitle').textContent = keyword ? 'Edit Automation' : 'New Automation';
  document.getElementById('autoModalSave').textContent = keyword ? 'Save' : 'Create';

  if (keyword) {
    const a = automationsData.find(x => x.keyword === keyword);
    if (a) {
      document.getElementById('autoKeyword').value = a.keyword;
      document.getElementById('autoKeyword').disabled = true;
      document.getElementById('autoCommentReply').value = a.commentReply;
      document.getElementById('autoDmResponse').value = a.dmResponse;
      document.getElementById('autoCaptureSlug').value = a.captureSlug;
      document.getElementById('autoCaptureHeadline').value = a.captureHeadline;
      document.getElementById('autoCaptureDesc').value = a.captureDescription || '';
      document.getElementById('autoFreebieType').value = a.freebieType;
      document.getElementById('autoFreebieValue').value = a.freebieValue;
      document.getElementById('autoUpsellUrl').value = a.upsellUrl || '';
      document.getElementById('autoUpsellText').value = a.upsellText || '';
    }
  } else {
    document.getElementById('autoKeyword').value = '';
    document.getElementById('autoKeyword').disabled = false;
    document.getElementById('autoCommentReply').value = '';
    document.getElementById('autoDmResponse').value = '';
    document.getElementById('autoCaptureSlug').value = '';
    document.getElementById('autoCaptureHeadline').value = '';
    document.getElementById('autoCaptureDesc').value = '';
    document.getElementById('autoFreebieType').value = 'pdf_link';
    document.getElementById('autoFreebieValue').value = '';
    document.getElementById('autoUpsellUrl').value = '';
    document.getElementById('autoUpsellText').value = '';
  }
  overlay.classList.add('active');
}

function closeAutomationModal() {
  document.getElementById('autoModalOverlay').classList.remove('active');
  editingKeyword = null;
}

function editAutomation(keyword) {
  openAutomationModal(keyword);
}

async function saveAutomation() {
  const payload = {
    keyword: document.getElementById('autoKeyword').value.trim(),
    commentReply: document.getElementById('autoCommentReply').value.trim(),
    dmResponse: document.getElementById('autoDmResponse').value.trim(),
    captureSlug: document.getElementById('autoCaptureSlug').value.trim(),
    captureHeadline: document.getElementById('autoCaptureHeadline').value.trim(),
    captureDescription: document.getElementById('autoCaptureDesc').value.trim(),
    freebieType: document.getElementById('autoFreebieType').value,
    freebieValue: document.getElementById('autoFreebieValue').value.trim(),
    upsellUrl: document.getElementById('autoUpsellUrl').value.trim(),
    upsellText: document.getElementById('autoUpsellText').value.trim(),
  };

  if (!payload.keyword || !payload.commentReply || !payload.dmResponse || !payload.captureSlug || !payload.captureHeadline || !payload.freebieValue) {
    alert('Please fill in all required fields');
    return;
  }

  const method = editingKeyword ? 'PUT' : 'POST';
  const res = await fetch('/api/automations', {
    method,
    headers: {
      Authorization: `Bearer ${password}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    closeAutomationModal();
    loadAutomations();
    loadLeads();
  } else {
    const err = await res.json();
    alert(err.error || 'Failed to save');
  }
}

async function toggleAutomation(keyword, active) {
  await fetch('/api/automations', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${password}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ keyword, active }),
  });
  loadAutomations();
}

async function deleteAutomation(keyword) {
  if (!confirm(`Delete the "${keyword}" automation?`)) return;
  await fetch(`/api/automations?keyword=${encodeURIComponent(keyword)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${password}` },
  });
  loadAutomations();
  loadLeads();
}

/* ── Leads + Funnel ── */
async function loadLeads() {
  try {
    const res = await fetch('/api/leads', {
      headers: { Authorization: `Bearer ${password}` },
    });
    const data = await res.json();
    renderFunnel(data.funnels || {});
    renderLeads(data.recentLeads || []);
    if (data.totalEmails > 0) {
      document.getElementById('leadsExportBtn').style.display = '';
    }
    // Update automation card stats
    for (const [keyword, f] of Object.entries(data.funnels || {})) {
      const el = document.getElementById(`autoStats_${keyword}`);
      if (el) {
        const pct = f.comments > 0 ? Math.round((f.captured / f.comments) * 100) : 0;
        el.textContent = `${f.comments} comments · ${f.captured} emails · ${pct}% conversion`;
      }
    }
  } catch { /* silent */ }
}

function renderFunnel(funnels) {
  const container = document.getElementById('funnelList');
  const entries = Object.entries(funnels);
  if (!entries.length) {
    container.innerHTML = '<div class="automation-empty">No data yet</div>';
    document.getElementById('funnelTotal').textContent = '';
    return;
  }

  let totalEmails = 0;
  container.innerHTML = entries.map(([keyword, f]) => {
    totalEmails += f.captured;
    const pct = f.comments > 0 ? Math.round((f.captured / f.comments) * 100) : 0;
    return `
      <div class="funnel-row">
        <div class="funnel-row-header">
          <span class="funnel-keyword">${keyword}</span>
          <span class="funnel-pct">${pct}%</span>
        </div>
        <div class="funnel-bar-bg"><div class="funnel-bar-fill" style="width:${pct}%"></div></div>
        <div class="funnel-steps">${f.comments} comments → ${f.dms} DMs → ${f.clicks} clicks → ${f.captured} emails</div>
      </div>`;
  }).join('');

  document.getElementById('funnelTotal').textContent = `${totalEmails} emails captured this period`;
}

function renderLeads(leads) {
  const container = document.getElementById('leadsList');
  if (!leads.length) {
    container.innerHTML = '<div class="automation-empty">No leads yet — create an automation to get started</div>';
    return;
  }

  const stepIcons = { comment: '💬', dm: '📩', click: '👁', captured: '✉' };
  const stepLabels = { comment: 'commented', dm: 'DM sent', click: 'clicked', captured: 'captured' };

  container.innerHTML = leads.slice(0, 20).map(l => {
    const ago = timeAgo(l.timestamp);
    const user = l.user || l.email || 'anonymous';
    return `
      <div class="lead-item">
        <span class="lead-time">${ago}</span>
        <span class="lead-user">${user}</span>
        <span class="lead-keyword">${l.keyword}</span>
        <span class="lead-step">${stepIcons[l.step] || ''} ${stepLabels[l.step] || l.step}</span>
      </div>`;
  }).join('');
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function exportLeads() {
  window.open(`/api/leads?export=csv&_auth=${encodeURIComponent(password)}`, '_blank');
}
</script>
```

- [ ] **Step 5: Wire loadAutomations + loadLeads into the hub's showHub() function**

Find the existing `showHub()` or main initialization function in `hub/index.html` (it's called after login). Add these two calls alongside the existing `loadQuickStats()`, `loadBriefing()`, etc.:

```js
loadAutomations();
loadLeads();
```

- [ ] **Step 6: Test in browser**

```
1. Run: cd /Users/samotto/mandi-bagley && npx vercel dev
2. Open http://localhost:3000/hub/
3. Log in with Password2024
4. Scroll down to see the three new cards: Automations, Conversion Funnel, Recent Leads
5. Click "+" to create a test automation with keyword MEAL
6. Verify it appears in the list
7. Visit http://localhost:3000/g/meal — verify capture page renders
8. Submit a test email on the capture page
9. Go back to hub — verify the lead appears in Recent Leads and the funnel shows 1 click + 1 captured
```

- [ ] **Step 7: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add hub/index.html
git commit -m "feat: add automations, funnel, and leads cards to hub UI"
```

---

### Task 5: Instagram OAuth Endpoints

**Files:**
- Create: `api/ig-auth.js`
- Create: `api/ig-callback.js`

Same OAuth pattern as `api/tiktok-auth.js` and `api/tiktok-callback.js`. These can be coded now and will work once Meta app is created and env vars are set.

- [ ] **Step 1: Create `api/ig-auth.js`**

```js
export const config = { runtime: 'edge' };

const APP_ID = process.env.INSTAGRAM_APP_ID;

export default async function handler(req) {
  if (!APP_ID) {
    return new Response(JSON.stringify({ error: 'Instagram not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const origin = url.origin;
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
```

- [ ] **Step 2: Create `api/ig-callback.js`**

```js
export const config = { runtime: 'edge' };

const APP_ID     = process.env.INSTAGRAM_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const REDIS_URL  = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX     = process.env.REDIS_PREFIX || 'stats:';

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
}

export default async function handler(req) {
  const url = new URL(req.url);
  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?instagram=error' },
    });
  }

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${url.origin}/api/ig-callback`,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/hub/?instagram=error' },
      });
    }

    // Exchange for long-lived token (60 days)
    const longRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokenData.access_token}`);
    const longData = await longRes.json();
    const accessToken = longData.access_token || tokenData.access_token;

    // Get Instagram Business Account ID via Facebook Pages
    const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`);
    const pagesData = await pagesRes.json();
    const page = pagesData.data?.[0];

    let igUserId = '';
    if (page) {
      const igRes = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`);
      const igData = await igRes.json();
      igUserId = igData.instagram_business_account?.id || '';
    }

    // Store in Redis
    await Promise.all([
      redisSet(`${PREFIX}ig:access_token`, accessToken),
      redisSet(`${PREFIX}ig:user_id`, igUserId),
      redisSet(`${PREFIX}ig:page_id`, page?.id || ''),
      redisSet(`${PREFIX}ig:page_token`, page?.access_token || accessToken),
      redisSet(`${PREFIX}ig:connected_at`, new Date().toISOString()),
    ]);

    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?instagram=connected' },
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: '/hub/?instagram=error' },
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/ig-auth.js api/ig-callback.js
git commit -m "feat: add Instagram OAuth auth + callback endpoints"
```

---

### Task 6: Instagram Webhook Handler

**Files:**
- Create: `api/ig-webhook.js`

Handles both webhook verification (GET) and incoming events (POST). Processes comment events (keyword matching + auto-reply) and messaging events (keyword matching + DM response with capture link).

- [ ] **Step 1: Create `api/ig-webhook.js`**

```js
export const config = { runtime: 'edge' };

const REDIS_URL    = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;
const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN;
const APP_SECRET   = process.env.INSTAGRAM_APP_SECRET;
const PREFIX       = process.env.REDIS_PREFIX || 'stats:';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}

async function redisPipeline(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

async function getAutomations() {
  const raw = await redisGet(`${PREFIX}automations`);
  return raw ? JSON.parse(raw) : [];
}

function matchKeyword(text, automations) {
  const normalized = (text || '').toUpperCase().trim();
  return automations.find(a => a.active && normalized.includes(a.keyword));
}

function logLead(step, keyword, user) {
  const event = JSON.stringify({
    step,
    keyword,
    user: user || 'unknown',
    timestamp: new Date().toISOString(),
  });
  const funnelKey = `${PREFIX}funnel:${keyword}`;
  const leadsKey = `${PREFIX}leads`;
  // Fire and forget
  redisPipeline([
    ['HINCRBY', funnelKey, step === 'comment' ? 'comments' : 'dms', 1],
    ['LPUSH', leadsKey, event],
    ['LTRIM', leadsKey, 0, 999],
  ]);
}

export default async function handler(req) {
  const url = new URL(req.url);

  // GET — webhook verification handshake
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST — incoming webhook event
  if (req.method === 'POST') {
    // Validate signature
    if (APP_SECRET) {
      const signature = req.headers.get('x-hub-signature-256');
      if (signature) {
        const body = await req.clone().text();
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(APP_SECRET),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
        const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (signature !== `sha256=${hex}`) {
          return new Response('Invalid signature', { status: 403 });
        }
      }
    }

    const payload = await req.json();
    const automations = await getAutomations();

    // Get stored tokens
    const pageToken = await redisGet(`${PREFIX}ig:page_token`);
    const igUserId = await redisGet(`${PREFIX}ig:user_id`);

    if (!pageToken || !automations.length) {
      return new Response('OK', { status: 200 });
    }

    const origin = url.origin;

    // Process each entry
    for (const entry of payload.entry || []) {
      // Comment events
      for (const change of entry.changes || []) {
        if (change.field === 'comments' && change.value) {
          const comment = change.value;
          const match = matchKeyword(comment.text, automations);
          if (match) {
            const username = comment.from?.username || 'someone';
            logLead('comment', match.keyword, `@${username}`);

            // Reply to comment
            await fetch(`https://graph.facebook.com/v21.0/${comment.id}/replies`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: match.commentReply,
                access_token: pageToken,
              }),
            });
          }
        }
      }

      // Messaging events
      for (const msg of entry.messaging || []) {
        if (msg.message?.text) {
          const match = matchKeyword(msg.message.text, automations);
          if (match) {
            const senderId = msg.sender?.id;
            logLead('dm', match.keyword, senderId);

            // Build DM response with capture link
            const captureUrl = `${origin}/g/${match.captureSlug}`;
            const dmText = `${match.dmResponse}\n\n${captureUrl}`;

            // Send DM via Instagram Messaging API
            await fetch(`https://graph.facebook.com/v21.0/${igUserId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { id: senderId },
                message: { text: dmText },
                access_token: pageToken,
              }),
            });
          }
        }
      }
    }

    return new Response('OK', { status: 200 });
  }

  return new Response('Method not allowed', { status: 405 });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/ig-webhook.js
git commit -m "feat: add Instagram webhook handler for comment + DM automation"
```

---

### Task 7: Update `vercel.json` CSP + Hub Instagram Connect

**Files:**
- Modify: `vercel.json` — add `graph.facebook.com` to CSP connect-src
- Modify: `hub/index.html` — add Instagram connect button to Platforms card

- [ ] **Step 1: Update CSP header in `vercel.json`**

In the CSP header value for `/hub(.*)`, add `https://graph.facebook.com` to the `connect-src` directive:

Change:
```
connect-src 'self' https://api.anthropic.com https://open.tiktokapis.com https://www.googleapis.com https://api.beehiiv.com https://api.resend.com
```
To:
```
connect-src 'self' https://api.anthropic.com https://open.tiktokapis.com https://www.googleapis.com https://api.beehiiv.com https://api.resend.com https://graph.facebook.com
```

- [ ] **Step 2: Add Instagram connect button to the Platforms card in hub**

Find the Instagram chip section in `hub/index.html` (search for "Instagram" or "ig" in the social chips area — it should have a "Coming Soon" state). Replace the "Coming Soon" content with a connect/connected state similar to the TikTok chip:

```html
<!-- Instagram chip -->
<div class="social-chip" id="igCard">
  <span class="social-chip-icon">&#128247;</span>
  <div class="social-chip-info">
    <span class="social-chip-name">Instagram</span>
    <span class="social-chip-status" id="igStatus">Not connected</span>
  </div>
  <button class="social-chip-btn" id="igConnectBtn" onclick="connectInstagram()">Connect</button>
</div>
```

Add the JavaScript function:

```js
function connectInstagram() {
  window.location.href = '/api/ig-auth';
}

// Check URL params for instagram connection status
(function checkIgConnection() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('instagram') === 'connected') {
    const el = document.getElementById('igStatus');
    if (el) el.textContent = 'Connected ✓';
    const btn = document.getElementById('igConnectBtn');
    if (btn) btn.textContent = 'Connected';
  }
})();
```

- [ ] **Step 3: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add vercel.json hub/index.html
git commit -m "feat: add Instagram connect button + update CSP for graph.facebook.com"
```

---

### Task 8: Wire Engagement Data into Briefing + Recap

**Files:**
- Modify: `api/briefing.js` — pull funnel data and include in AI briefing context
- Modify: `api/weekly-recap.js` — add automation performance section

- [ ] **Step 1: Add funnel data to briefing context**

In `api/briefing.js`, after the existing Redis pipeline commands that fetch analytics data, add commands to fetch automations and funnel data. Then include the results in the Claude prompt context.

Find where the Redis pipeline is built (the array of commands). Add:

```js
['GET', `${PREFIX}automations`],
```

After parsing the pipeline results, add:

```js
// Parse automations + funnels
const automationsRaw = results[N]?.result; // N = index of the new command
const automations = automationsRaw ? JSON.parse(automationsRaw) : [];
```

Then in the prompt/context string sent to Claude, add a section:

```js
const automationContext = automations.length > 0
  ? `\n\nEngagement Automations:\n${automations.map(a => `- ${a.keyword}: ${a.active ? 'active' : 'paused'}, capture page: /g/${a.captureSlug}`).join('\n')}`
  : '';
```

Include `automationContext` in the system or user prompt for the briefing.

- [ ] **Step 2: Add automation stats to weekly recap**

In `api/weekly-recap.js`, similarly fetch the automations and funnel data from Redis. Add a section to the email HTML:

```js
// After fetching automations + funnel data:
const automationSection = automations.length > 0 ? `
  <tr><td style="padding:24px 0 8px;font-size:18px;font-weight:600;border-top:1px solid #eee">Engagement Automations</td></tr>
  ${automations.map(a => {
    // Fetch funnel stats for this keyword from the pipeline results
    const f = funnelStats[a.keyword] || { comments: 0, dms: 0, clicks: 0, captured: 0 };
    const pct = f.comments > 0 ? Math.round((f.captured / f.comments) * 100) : 0;
    return `<tr><td style="padding:6px 0;font-size:14px">
      <strong>${a.keyword}</strong>: ${f.captured} emails captured (${pct}% conversion) — ${f.comments} comments → ${f.dms} DMs → ${f.clicks} clicks
    </td></tr>`;
  }).join('')}
` : '';
```

Insert `automationSection` into the email HTML template before the closing table tags.

- [ ] **Step 3: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/briefing.js api/weekly-recap.js
git commit -m "feat: wire engagement funnel data into AI briefing + weekly recap"
```

---

### Task 9: CSV Export Auth Fix + Final Polish

**Files:**
- Modify: `api/leads.js` — support auth via query param for CSV download
- Modify: `hub/index.html` — minor polish on empty states

- [ ] **Step 1: Add query param auth to leads.js**

The CSV export opens in a new tab via `window.open()`, so the Bearer header won't be sent. Add query param auth as a fallback in `api/leads.js`:

At the top of the handler, change the auth check to:

```js
const url = new URL(req.url);
const queryAuth = url.searchParams.get('_auth');

if (!auth(req) && queryAuth !== PASSWORD) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Test full flow end-to-end**

```
1. cd /Users/samotto/mandi-bagley && npx vercel dev
2. Open http://localhost:3000/hub/ and log in
3. Create automation: keyword MEAL, fill all fields
4. Visit http://localhost:3000/g/meal — verify capture page loads with correct branding
5. Submit email on capture page
6. Return to hub — verify:
   - Automation card shows "1 comments · 1 emails · 100% conversion" (the click incremented funnel)
   - Funnel card shows MEAL bar
   - Recent Leads card shows the captured email
7. Click Export Emails — verify CSV downloads with the test email
8. Edit the automation — verify modal pre-fills
9. Pause the automation — verify status changes
10. Visit /g/meal again — should return 404 since automation is paused
11. Resume — /g/meal works again
12. Delete the automation — verify it's removed
```

- [ ] **Step 3: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/leads.js hub/index.html
git commit -m "fix: add query param auth for CSV export + polish empty states"
```

---

## Post-Build Checklist

After all tasks are complete:

- [ ] Deploy to Vercel: `cd /Users/samotto/mandi-bagley && npx vercel --prod`
- [ ] Verify capture pages work on production: `https://mandibagley.com/g/[slug]`
- [ ] Verify hub loads with new cards on production
- [ ] **REMINDER for Sam:** Set up Instagram Meta app at developers.facebook.com:
  1. Create app → add Instagram Graph API + Messenger products
  2. Request permissions: `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`
  3. Set webhook callback URL: `https://mandibagley.com/api/ig-webhook`
  4. Generate a verify token and set as `INSTAGRAM_VERIFY_TOKEN` env var in Vercel
  5. Set `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` env vars in Vercel
  6. Record demo video showing the hub automations UI for Meta app review
  7. Submit app review
