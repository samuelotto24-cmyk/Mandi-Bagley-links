# Hub Referral Section & Private Packages Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a referral program section to the Hub so existing clients can refer other creators, and build a private packages page for sales follow-up.

**Architecture:** Two independent deliverables sharing the same project. The Hub referral section adds a new HTML section + CSS + JS to the existing monolithic `hub/index.html`, backed by a new `/api/referral.js` Edge Function that reads/writes referral data in Upstash Redis. The packages page is a standalone `packages/index.html` — a dark-themed, mobile-first sales page reusing the portfolio's design language (Cormorant Garamond + DM Sans, warm dark palette, fade-up animations).

**Tech Stack:** Static HTML/CSS/JS, Vercel Edge Functions, Upstash Redis

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `api/referral.js` | Edge Function — GET/POST referral data from Redis |
| Modify | `hub/index.html` | Add referral section HTML, CSS, and JS |
| Create | `packages/index.html` | Standalone private packages/sales page |

---

## Task 1: Referral API Endpoint

**Files:**
- Create: `api/referral.js`

This endpoint lets the Hub read referral stats and lets Sam manually update referral counts via POST.

- [ ] **Step 1: Create `api/referral.js`**

```js
export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';

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
  if (url.searchParams.get('password') !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET — read referral stats for this client
  if (req.method === 'GET') {
    const results = await redis([
      ['GET', PREFIX + 'referral:code'],
      ['GET', PREFIX + 'referral:count'],
      ['GET', PREFIX + 'referral:freeMonths'],
    ]);
    const code = results[0]?.result || '';
    const count = results[1]?.result ? parseInt(results[1].result, 10) : 0;
    const freeMonths = results[2]?.result ? parseInt(results[2].result, 10) : 0;
    return new Response(JSON.stringify({ code, count, freeMonths }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST — Sam manually updates referral data
  if (req.method === 'POST') {
    const body = await req.json();
    const commands = [];
    if (body.code !== undefined) commands.push(['SET', PREFIX + 'referral:code', body.code]);
    if (body.count !== undefined) commands.push(['SET', PREFIX + 'referral:count', String(body.count)]);
    if (body.freeMonths !== undefined) commands.push(['SET', PREFIX + 'referral:freeMonths', String(body.freeMonths)]);
    if (commands.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    await redis(commands);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
```

- [ ] **Step 2: Seed initial referral data for Mandi**

Run this curl command (or equivalent) to set Mandi's referral code:

```bash
curl -X POST "https://mandibagley.com/api/referral?password=PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"code":"MANDI","count":0,"freeMonths":0}'
```

Replace `PASSWORD` with the actual dashboard password. The code `MANDI` is what referred clients will mention.

- [ ] **Step 3: Verify the GET endpoint returns the seeded data**

```bash
curl "https://mandibagley.com/api/referral?password=PASSWORD"
```

Expected: `{"code":"MANDI","count":0,"freeMonths":0}`

- [ ] **Step 4: Commit**

```bash
git add api/referral.js
git commit -m "feat: add referral API endpoint for Hub referral tracking"
```

---

## Task 2: Hub Referral Section — CSS

**Files:**
- Modify: `hub/index.html` (CSS section)

Add styles for the referral card. These go in the existing `<style>` block alongside the other Hub section styles.

- [ ] **Step 1: Add referral section CSS to `hub/index.html`**

Add before the closing `</style>` tag (find the last CSS rule and add after it):

```css
/* ── Referral Section ── */
.referral-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  transition: border-color 0.22s ease;
}
.referral-card:hover {
  border-color: var(--accent-border);
}
.referral-header {
  display: flex;
  align-items: center;
  gap: 14px;
}
.referral-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--accent-pale);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.referral-header-text h3 {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 500;
  color: var(--text);
  margin: 0;
}
.referral-header-text p {
  font-size: 13px;
  color: var(--text-muted);
  margin: 4px 0 0;
  line-height: 1.4;
}
.referral-stats-row {
  display: flex;
  gap: 16px;
}
.referral-stat {
  flex: 1;
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}
.referral-stat-value {
  font-family: var(--serif);
  font-size: 28px;
  font-weight: 600;
  color: var(--text);
}
.referral-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-top: 4px;
}
.referral-code-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 18px;
}
.referral-code-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  white-space: nowrap;
}
.referral-code-value {
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 600;
  color: var(--accent);
  flex: 1;
}
.referral-copy-btn {
  background: var(--accent-pale);
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  color: var(--accent);
  font-size: 13px;
  font-family: var(--sans);
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.22s ease, box-shadow 0.22s ease;
  white-space: nowrap;
}
.referral-copy-btn:hover {
  background: var(--accent);
  color: var(--bg);
  box-shadow: 0 0 20px var(--accent-pale);
}
.referral-reward {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.6;
  text-align: center;
  padding: 12px 0 0;
  border-top: 1px solid var(--border);
}
.referral-reward strong {
  color: var(--accent);
  font-weight: 500;
}
@media (max-width: 640px) {
  .referral-card { padding: 24px 20px; }
  .referral-stats-row { gap: 10px; }
  .referral-stat { padding: 12px 8px; }
  .referral-stat-value { font-size: 22px; }
  .referral-code-row { flex-wrap: wrap; gap: 10px; }
  .referral-code-value { font-size: 18px; }
}
```

- [ ] **Step 2: Commit**

```bash
git add hub/index.html
git commit -m "feat: add referral section CSS to Hub"
```

---

## Task 3: Hub Referral Section — HTML

**Files:**
- Modify: `hub/index.html` (HTML section)

Add the referral section HTML between the Niche Pulse section and the AI Advisor Chat section (after the divider on line 689).

- [ ] **Step 1: Add referral HTML to `hub/index.html`**

Find this block (around line 689):

```html
  <div class="divider"></div>

  <!-- AI Advisor Chat -->
```

Insert the referral section between them:

```html
  <div class="divider"></div>

  <!-- Referral Program -->
  <div class="fade-up">
    <div class="section-label">Referral Program</div>
    <div class="referral-card" id="referralCard">
      <div class="referral-header">
        <div class="referral-icon">&#127873;</div>
        <div class="referral-header-text">
          <h3>Share the Platform</h3>
          <p>Refer a creator — every signup earns you a free month.</p>
        </div>
      </div>

      <div class="referral-stats-row">
        <div class="referral-stat">
          <div class="referral-stat-value" id="referralCount">—</div>
          <div class="referral-stat-label">Creators Referred</div>
        </div>
        <div class="referral-stat">
          <div class="referral-stat-value" id="referralFreeMonths">—</div>
          <div class="referral-stat-label">Free Months Earned</div>
        </div>
      </div>

      <div class="referral-code-row">
        <span class="referral-code-label">Your Code</span>
        <span class="referral-code-value" id="referralCode">—</span>
        <button class="referral-copy-btn" id="referralCopyBtn" onclick="copyReferralCode()">Copy</button>
      </div>

      <div class="referral-reward">
        When a creator signs up with your code, <strong>you get one month free</strong> and <strong>they get $100 off</strong> their setup.
      </div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- AI Advisor Chat -->
```

- [ ] **Step 2: Commit**

```bash
git add hub/index.html
git commit -m "feat: add referral section HTML to Hub"
```

---

## Task 4: Hub Referral Section — JavaScript

**Files:**
- Modify: `hub/index.html` (JS section)

Add the fetch logic and copy-to-clipboard function. This goes in the existing `<script>` block at the bottom of the file, alongside the other data-loading functions.

- [ ] **Step 1: Add referral JS to `hub/index.html`**

Find the section where other API calls are made (look for the `loadBriefing` or `loadGoal` function). Add the following functions nearby:

```js
/* ── Referral ── */
async function loadReferral() {
  try {
    const res = await fetch('/api/referral?password=' + encodeURIComponent(PW));
    if (!res.ok) return;
    const data = await res.json();
    if (data.code) {
      document.getElementById('referralCode').textContent = data.code;
    }
    document.getElementById('referralCount').textContent = data.count || 0;
    document.getElementById('referralFreeMonths').textContent = data.freeMonths || 0;
  } catch (e) {
    console.error('Referral load failed:', e);
  }
}

function copyReferralCode() {
  const code = document.getElementById('referralCode').textContent;
  if (!code || code === '—') return;
  const msg = "Hey! I use this platform for my brand — custom site, analytics, and an AI strategist that reads my actual data. Use my code " + code + " and you'll get $100 off. Check it out: https://samotto.dev";
  navigator.clipboard.writeText(msg).then(() => {
    const btn = document.getElementById('referralCopyBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
}
```

Then find the initialization block (where `loadBriefing()`, `loadGoal()`, etc. are called on page load) and add:

```js
loadReferral();
```

- [ ] **Step 2: Verify the referral section renders in the Hub**

Open the Hub in a browser, confirm:
- The referral card appears between Niche Pulse and AI Advisor
- Stats show "0" for both counts (or whatever was seeded)
- The referral code displays
- Copy button copies the pre-written share message to clipboard

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: add referral section JS — loads data and copy-to-clipboard"
```

---

## Task 5: Private Packages Page

**Files:**
- Create: `packages/index.html`

Standalone sales follow-up page. Dark theme matching portfolio aesthetic. Not linked from any public page — Sam shares the URL directly.

- [ ] **Step 1: Create `packages/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Creator Platforms — Packages</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #090907;
  --surface: #0E0D0B;
  --surface-hi: #171512;
  --border: rgba(255,248,220,0.09);
  --border-mid: rgba(255,248,220,0.16);
  --accent: #10B981;
  --accent-light: #34D399;
  --accent-glow: rgba(16,185,129,0.14);
  --accent-border: rgba(16,185,129,0.25);
  --text: #EBE7DF;
  --text-sub: rgba(235,231,223,0.72);
  --text-muted: rgba(235,231,223,0.42);
  --serif: 'Cormorant Garamond', Georgia, serif;
  --sans: 'DM Sans', system-ui, sans-serif;
  --max-w: 960px;
  --px: clamp(20px, 5vw, 60px);
  --r: 14px;
}

html { scroll-behavior: smooth; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }

.inner { max-width: var(--max-w); margin: 0 auto; padding: 0 var(--px); }

/* ── Hero ── */
.hero {
  padding: 100px 0 60px;
  text-align: center;
}
.hero-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--accent);
  margin-bottom: 20px;
}
.hero h1 {
  font-family: var(--serif);
  font-size: clamp(36px, 6vw, 60px);
  font-weight: 500;
  line-height: 1.15;
  color: var(--text);
  margin-bottom: 20px;
}
.hero p {
  font-size: 17px;
  color: var(--text-sub);
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.7;
}

/* ── Tiers ── */
.tiers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 40px 0 60px;
}
.tier {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 36px 32px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.22s ease;
}
.tier:hover { border-color: var(--border-mid); }
.tier.featured {
  border-color: var(--accent-border);
  position: relative;
}
.tier.featured::before {
  content: 'MOST POPULAR';
  position: absolute;
  top: -12px;
  left: 32px;
  background: var(--accent);
  color: var(--bg);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 4px 14px;
  border-radius: 20px;
}
.tier-name {
  font-family: var(--serif);
  font-size: 26px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 6px;
}
.tier-tagline {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 24px;
}
.tier-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 6px;
}
.tier-price-amount {
  font-family: var(--serif);
  font-size: 40px;
  font-weight: 600;
  color: var(--text);
}
.tier-price-period {
  font-size: 14px;
  color: var(--text-muted);
}
.tier-setup {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 28px;
}
.tier-divider {
  height: 1px;
  background: var(--border);
  margin-bottom: 24px;
}
.tier-features {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}
.tier-features li {
  font-size: 14px;
  color: var(--text-sub);
  padding-left: 24px;
  position: relative;
  line-height: 1.5;
}
.tier-features li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: 600;
}
.tier-cta {
  display: block;
  margin-top: 32px;
  padding: 14px 0;
  text-align: center;
  border-radius: 10px;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.22s ease, box-shadow 0.22s ease, color 0.22s ease;
  border: none;
}
.tier-cta.primary {
  background: var(--accent);
  color: var(--bg);
}
.tier-cta.primary:hover {
  box-shadow: 0 0 30px var(--accent-glow);
}
.tier-cta.secondary {
  background: transparent;
  border: 1px solid var(--border-mid);
  color: var(--text);
}
.tier-cta.secondary:hover {
  border-color: var(--accent-border);
  color: var(--accent);
}

/* ── What's Included (Full Platform detail) ── */
.included {
  padding: 60px 0;
  border-top: 1px solid var(--border);
}
.included h2 {
  font-family: var(--serif);
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 500;
  text-align: center;
  margin-bottom: 16px;
}
.included > p {
  text-align: center;
  color: var(--text-sub);
  font-size: 15px;
  max-width: 520px;
  margin: 0 auto 48px;
}
.included-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}
.included-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 28px 24px;
}
.included-item-icon {
  font-size: 24px;
  margin-bottom: 14px;
}
.included-item h4 {
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 8px;
}
.included-item p {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}

/* ── Referral Banner ── */
.referral-banner {
  padding: 60px 0;
  border-top: 1px solid var(--border);
  text-align: center;
}
.referral-banner h2 {
  font-family: var(--serif);
  font-size: clamp(24px, 4vw, 36px);
  font-weight: 500;
  margin-bottom: 16px;
}
.referral-banner p {
  font-size: 16px;
  color: var(--text-sub);
  max-width: 480px;
  margin: 0 auto;
  line-height: 1.7;
}
.referral-highlight {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
  padding: 20px 32px;
  background: var(--surface);
  border: 1px solid var(--accent-border);
  border-radius: 14px;
  font-size: 15px;
  color: var(--text-sub);
}
.referral-highlight strong {
  color: var(--accent-light);
  font-weight: 600;
}

/* ── CTA Footer ── */
.cta-footer {
  padding: 80px 0;
  text-align: center;
  border-top: 1px solid var(--border);
}
.cta-footer h2 {
  font-family: var(--serif);
  font-size: clamp(28px, 5vw, 44px);
  font-weight: 500;
  margin-bottom: 16px;
}
.cta-footer p {
  font-size: 15px;
  color: var(--text-muted);
  margin-bottom: 32px;
}
.cta-btn {
  display: inline-block;
  padding: 16px 40px;
  background: var(--accent);
  color: var(--bg);
  font-family: var(--sans);
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  transition: box-shadow 0.22s ease;
}
.cta-btn:hover {
  box-shadow: 0 0 40px var(--accent-glow);
}

/* ── Fade-up ── */
.fade-up {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.fade-up.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .tiers { grid-template-columns: 1fr; }
  .included-grid { grid-template-columns: 1fr; }
  .referral-highlight { flex-direction: column; gap: 8px; text-align: center; }
}
</style>
</head>
<body>

<div class="inner">

  <!-- Hero -->
  <section class="hero fade-up">
    <div class="hero-label">Creator Platforms by Sam Otto</div>
    <h1>Your brand doesn't fit a template.<br>Your platform shouldn't either.</h1>
    <p>A custom website, built-in analytics, and an AI strategist that reads your real data and tells you what's working — built from scratch, live in 72 hours.</p>
  </section>

  <!-- Tiers -->
  <section class="tiers">
    <div class="tier featured fade-up">
      <div class="tier-name">Full Platform</div>
      <div class="tier-tagline">The whole system — your brand, your data, your strategist.</div>
      <div class="tier-price">
        <span class="tier-price-amount">$150</span>
        <span class="tier-price-period">/ month</span>
      </div>
      <div class="tier-setup">One-time setup from $1,500</div>
      <div class="tier-divider"></div>
      <ul class="tier-features">
        <li>Custom branded website with your domain</li>
        <li>Tap-to-copy affiliate codes &amp; smart link buttons</li>
        <li>Private analytics dashboard — traffic, conversions, geography</li>
        <li>The Hub — your personal command center</li>
        <li>AI Strategist — weekly briefings + real-time strategy chat</li>
        <li>Same-day updates &amp; priority support</li>
        <li>Live in 72 hours</li>
      </ul>
      <a href="https://calendly.com/YOURLINK" class="tier-cta primary">Book a Call</a>
    </div>

    <div class="tier fade-up">
      <div class="tier-name">Brand Site</div>
      <div class="tier-tagline">Start with a custom site — upgrade anytime.</div>
      <div class="tier-price">
        <span class="tier-price-amount">$49</span>
        <span class="tier-price-period">/ month</span>
      </div>
      <div class="tier-setup">One-time setup from $400</div>
      <div class="tier-divider"></div>
      <ul class="tier-features">
        <li>Custom branded website with your domain</li>
        <li>Tap-to-copy affiliate codes &amp; smart link buttons</li>
        <li>Maintenance &amp; same-day updates</li>
        <li>Live in 72 hours</li>
      </ul>
      <a href="https://calendly.com/YOURLINK" class="tier-cta secondary">Book a Call</a>
    </div>
  </section>

  <!-- What's Included -->
  <section class="included fade-up">
    <h2>What the Full Platform gives you</h2>
    <p>Everything you need to run your brand online — in one system, built around your aesthetic.</p>

    <div class="included-grid">
      <div class="included-item">
        <div class="included-item-icon">&#127912;</div>
        <h4>Your Brand, Your Design</h4>
        <p>Colors, fonts, layout, domain — unmistakably yours. Not a template. Not a Linktree.</p>
      </div>
      <div class="included-item">
        <div class="included-item-icon">&#128200;</div>
        <h4>Private Analytics</h4>
        <p>See exactly who's visiting, what they're clicking, and where they're coming from. No Google Analytics required.</p>
      </div>
      <div class="included-item">
        <div class="included-item-icon">&#129302;</div>
        <h4>AI Strategist</h4>
        <p>Weekly briefings and a real-time chat advisor that reads your actual data — not generic tips from ChatGPT.</p>
      </div>
      <div class="included-item">
        <div class="included-item-icon">&#128640;</div>
        <h4>The Hub</h4>
        <p>Your personal command center. Stats, briefings, content calendar, and your AI advisor — all in one branded dashboard.</p>
      </div>
      <div class="included-item">
        <div class="included-item-icon">&#128176;</div>
        <h4>Revenue Tools</h4>
        <p>Tap-to-copy affiliate codes, program showcases, and link click tracking so you know what's making you money.</p>
      </div>
      <div class="included-item">
        <div class="included-item-icon">&#9889;</div>
        <h4>72-Hour Delivery</h4>
        <p>Live in 3 days. Same-day updates after that. A direct line to me — no tickets, no waiting.</p>
      </div>
    </div>
  </section>

  <!-- Referral Banner -->
  <section class="referral-banner fade-up">
    <h2>Know a creator?</h2>
    <p>Every creator you refer gets $100 off their setup. And you get a free month on your plan — months stack, no limit.</p>
    <div class="referral-highlight">
      <span>&#127873; <strong>You get:</strong> 1 free month per referral</span>
      <span>&#127381; <strong>They get:</strong> $100 off setup</span>
    </div>
  </section>

  <!-- CTA Footer -->
  <section class="cta-footer fade-up">
    <h2>Ready to stop using tools<br>that weren't built for you?</h2>
    <p>They give you links. I give you a strategist.</p>
    <a href="https://calendly.com/YOURLINK" class="cta-btn">Book a Call</a>
  </section>

</div>

<script>
// Fade-up on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.15 });
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
</script>

</body>
</html>
```

- [ ] **Step 2: Update the Calendly/booking links**

Replace all three instances of `https://calendly.com/YOURLINK` with Sam's actual booking link.

- [ ] **Step 3: Verify the packages page renders correctly**

Open `packages/index.html` in a browser and verify:
- Both tiers display side by side (single column on mobile)
- "MOST POPULAR" badge appears on Full Platform
- Feature checkmarks are green
- Referral banner is visible
- All "Book a Call" buttons link correctly
- Fade-up animations trigger on scroll
- Page is not indexed (`noindex, nofollow` meta tag)

- [ ] **Step 4: Commit**

```bash
git add packages/index.html
git commit -m "feat: add private packages page for sales follow-up"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Verify Hub referral section end-to-end**

1. Open the Hub with the correct password
2. Confirm the referral section appears between Niche Pulse and AI Advisor
3. Confirm referral code, count, and free months display from the API
4. Click "Copy" — paste somewhere and confirm the pre-written share message is in clipboard
5. Confirm mobile layout looks correct (stack stats vertically if needed)

- [ ] **Step 2: Verify packages page end-to-end**

1. Open `/packages` directly — page loads
2. Confirm it's not linked from the main site or portfolio
3. Test on mobile viewport — tiers stack, included grid stacks
4. Confirm "Book a Call" buttons work

- [ ] **Step 3: Final commit with both deliverables**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: polish referral section and packages page"
```
