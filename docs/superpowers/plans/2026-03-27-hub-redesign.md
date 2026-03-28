# Hub Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `hub/index.html` as a parameterized command center template — dark gradient aesthetic, actionable AI briefings, content calendar, goal tracking, niche pulse, smart chat. All visuals driven by a CLIENT config so new creator clients can be deployed in minutes.

**Architecture:** Single-file vanilla HTML/CSS/JS page (`hub/index.html`) backed by Vercel Edge Functions (`api/briefing.js`, `api/chat.js`, `api/goal.js`). Data stored in Upstash Redis. AI powered by Claude Haiku. All visual identity (colors, gradients, particles, fonts) flows from a `CLIENT` config object at the top of the file.

**Tech Stack:** Vanilla HTML/CSS/JS, Vercel Edge Functions, Upstash Redis, Anthropic Claude Haiku API, Google Fonts

**Spec:** `docs/superpowers/specs/2026-03-27-hub-redesign-design.md`
**Reference mockup:** `.superpowers/brainstorm/5592-1774653264/content/dark-gradient-v6.html`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `hub/index.html` | Rewrite | Entire hub UI — CLIENT config, theme engine, login, all sections, particles, gradient, JS logic |
| `api/briefing.js` | Modify | Expand LLM prompt to return actionItems, calendar, nichePulse, proactiveInsight; add goal read; use CLIENT_NICHE env var |
| `api/chat.js` | Modify | Enhanced system prompt with calendar/goal/niche context; reference CLIENT_NICHE |
| `api/goal.js` | Create | New endpoint to set/get monthly goal target in Redis |

---

## Task 1: Create goal API endpoint

**Files:**
- Create: `api/goal.js`

Standalone endpoint — no dependencies on other tasks.

- [ ] **Step 1: Create `api/goal.js`**

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

  if (req.method === 'GET') {
    const results = await redis([
      ['GET', PREFIX + 'goal:target'],
      ['GET', PREFIX + 'goal:type'],
    ]);
    const target = results[0]?.result ? parseInt(results[0].result, 10) : null;
    const type = results[1]?.result || 'views';
    return new Response(JSON.stringify({ target, type }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const target = parseInt(body.target, 10);
    const type = body.type || 'views';
    if (!target || target < 1) {
      return new Response(JSON.stringify({ error: 'Invalid target' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    await redis([
      ['SET', PREFIX + 'goal:target', String(target)],
      ['SET', PREFIX + 'goal:type', type],
    ]);
    return new Response(JSON.stringify({ target, type }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
```

- [ ] **Step 2: Test manually**

Run: `curl "http://localhost:3000/api/goal?password=<pw>" -X POST -H "Content-Type: application/json" -d '{"target":1500}'`
Expected: `{"target":1500,"type":"views"}`

Run: `curl "http://localhost:3000/api/goal?password=<pw>"`
Expected: `{"target":1500,"type":"views"}`

- [ ] **Step 3: Commit**

```bash
git add api/goal.js
git commit -m "feat: add goal API endpoint for monthly target persistence"
```

---

## Task 2: Expand briefing API with actionItems, calendar, nichePulse, proactiveInsight

**Files:**
- Modify: `api/briefing.js`

- [ ] **Step 1: Add CLIENT_NICHE and goal reading**

At the top of `api/briefing.js`, after the existing constants, add:

```js
const CLIENT_NICHE = process.env.CLIENT_NICHE || 'Fitness · Faith · Food';
const CLIENT_DESCRIPTION = process.env.CLIENT_DESCRIPTION || 'Lifestyle fitness creator, recipe content, brand partnerships';
const PREFIX = process.env.REDIS_PREFIX || 'stats:';
```

Add two more commands to the end of the existing `redis([...])` call (around line 231):
```js
['GET', PREFIX + 'goal:target'],
['GET', PREFIX + 'goal:type'],
```

After the `const data = { ... }` block, parse them:
```js
const goalTarget = results[15]?.result ? parseInt(results[15].result, 10) : null;
const goalType = results[16]?.result || 'views';
```

Add to the `metrics` object:
```js
goalTarget,
goalType,
todayViews,
```

Also update all hardcoded `'stats:'` prefixes in the Redis pipeline to use the `PREFIX` variable. For example `['HGETALL', 'stats:pageviews']` becomes `['HGETALL', PREFIX + 'pageviews']`.

- [ ] **Step 2: Replace the LLM advisory section with structured JSON prompt**

Replace the entire `/* ── LLM advisory (Claude Haiku) ── */` section (the `let advice = null;` block through the closing `}`) with:

```js
    /* ── LLM: actionItems, calendar, nichePulse, proactiveInsight ── */
    let actionItems = [];
    let calendar = [];
    let nichePulse = [];
    let proactiveInsight = null;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_KEY;
    const _debug = { hasKey: !!ANTHROPIC_API_KEY, flagCount: flags.length };

    if (ANTHROPIC_API_KEY) {
      try {
        const bulletPoints = flags.map((f) => `- [${f.type}] ${f.text}`).join('\n');
        const clicksList = Object.entries(data.clicks)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => `- ${name}: ${count} clicks`)
          .join('\n');

        // Build calendar date range (Mon-Sun of current week)
        const todayD = new Date();
        const dayOfWeek = todayD.getDay(); // 0=Sun
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const calDays = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(todayD);
          d.setDate(d.getDate() + mondayOffset + i);
          calDays.push({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            date: d.toISOString().slice(0, 10),
            isToday: d.toISOString().slice(0, 10) === today,
          });
        }

        // Peak hours formatted
        const peakFormatted = Object.entries(byHour)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([h]) => { const hr = parseInt(h); return (hr % 12 || 12) + (hr >= 12 ? 'PM' : 'AM'); })
          .join(', ');

        const goalContext = goalTarget
          ? `\nGoal: ${metrics.thisMonthViews} / ${goalTarget} ${goalType} this month. ${Math.max(0, goalTarget - metrics.thisMonthViews)} remaining.`
          : '';

        const userMessage = `Creator: ${CLIENT_NAME} (${CLIENT_NICHE})
About: ${CLIENT_DESCRIPTION}

## This Week's Data Flags
${bulletPoints || 'No flags this week.'}

## Link Clicks (all time)
${clicksList || 'No click data yet.'}

## Key Metrics
- This week views: ${thisWeekViews}, last week: ${lastWeekViews}
- Week-over-week: ${metrics.weekOverWeek}
- Top referrer: ${metrics.topReferrer || 'none'}
- Avg session: ${avgSessionSec}s
- Peak hours: ${peakFormatted || 'not enough data'}
${goalContext}

## Calendar dates this week
${calDays.map(d => `- ${d.day} ${d.date}${d.isToday ? ' (TODAY)' : ''}`).join('\n')}

Respond with ONLY valid JSON (no markdown, no code fences) matching this exact structure:
{
  "actionItems": [
    { "priority": "high|medium|low", "action": "specific action", "reason": "data-backed reason", "suggestion": "caption idea or specific tip", "timeframe": "now|today|this_week" }
  ],
  "calendar": [
    { "day": "Mon", "date": "YYYY-MM-DD", "type": "reel|story|pin|post|rest", "time": "3 PM", "idea": "one-line concept" }
  ],
  "nichePulse": [
    { "icon": "emoji", "headline": "trend headline", "context": "1 sentence context", "meta": "source line", "chatPrompt": "question to ask advisor" }
  ],
  "proactiveInsight": { "message": "observation about their data", "actions": ["action 1", "action 2", "action 3"] } or null
}

Rules:
- 3 actionItems, prioritized high/medium/low, with specific times and caption ideas relevant to their niche
- 7 calendar days (Mon-Sun), mix of content types appropriate for their niche, use peak hours for timing, include one rest day
- 2-3 nichePulse items relevant to ${CLIENT_NICHE} creators, reference plausible trends in that space
- proactiveInsight: flag the most important data anomaly (0-click links, traffic drops >20% WoW, new referrers). null if nothing notable.
- NEVER suggest website layout changes
- Reference actual numbers from the data above`;

        const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            system: 'You are a JSON API. Respond with ONLY valid JSON. No markdown, no code fences, no explanation. Follow the exact structure requested.',
            messages: [{ role: 'user', content: userMessage }],
          }),
        });

        if (llmRes.ok) {
          const llmData = await llmRes.json();
          const text = llmData.content?.[0]?.text || '';
          try {
            const parsed = JSON.parse(text);
            actionItems = parsed.actionItems || [];
            calendar = parsed.calendar || [];
            nichePulse = parsed.nichePulse || [];
            proactiveInsight = parsed.proactiveInsight || null;
          } catch (parseErr) {
            console.error('Briefing JSON parse error:', parseErr, text.slice(0, 200));
          }
        } else {
          console.error('Briefing LLM error:', llmRes.status, await llmRes.text().catch(() => ''));
        }
      } catch (e) {
        console.error('Briefing LLM exception:', e);
      }
    }
```

- [ ] **Step 3: Update the response JSON**

Replace the final `return new Response(JSON.stringify({ ... }))`:

```js
    return new Response(JSON.stringify({
      weekRange: weekRange(todayDate),
      summary,
      actionItems,
      calendar,
      nichePulse,
      proactiveInsight,
      generatedAt: new Date().toISOString(),
      metrics,
      flags,
      _debug,
    }), { headers: { 'Content-Type': 'application/json' } });
```

- [ ] **Step 4: Test the endpoint**

Run: `curl "http://localhost:3000/api/briefing?password=<pw>" | jq '.actionItems, .calendar, .nichePulse'`
Expected: JSON arrays with structured data

- [ ] **Step 5: Commit**

```bash
git add api/briefing.js
git commit -m "feat: expand briefing API with actionItems, calendar, nichePulse, proactiveInsight"
```

---

## Task 3: Enhance chat API with richer context

**Files:**
- Modify: `api/chat.js`

- [ ] **Step 1: Add CLIENT_NICHE constants and briefingContext support**

At the top after existing constants, add:
```js
const CLIENT_NICHE = process.env.CLIENT_NICHE || 'Fitness · Faith · Food';
const CLIENT_DESCRIPTION = process.env.CLIENT_DESCRIPTION || 'Lifestyle fitness creator, recipe content, brand partnerships';
```

After `const question = body.question;` (line 68), add:
```js
    const briefingContext = body.briefingContext || null;
```

- [ ] **Step 2: Build briefing context section for the system prompt**

After the existing `dataContext` string (around line 177), add:

```js
    let briefingSection = '';
    if (briefingContext) {
      const bc = briefingContext;
      if (bc.actionItems && bc.actionItems.length) {
        briefingSection += '\n\n## This Week\'s Action Items (already shown to the creator)\n';
        briefingSection += bc.actionItems.map(a => `- [${a.timeframe}] ${a.action}: ${a.reason}`).join('\n');
      }
      if (bc.calendar && bc.calendar.length) {
        briefingSection += '\n\n## Content Calendar This Week\n';
        briefingSection += bc.calendar.map(d => `- ${d.day}: ${d.type} at ${d.time} — "${d.idea}"`).join('\n');
      }
      if (bc.nichePulse && bc.nichePulse.length) {
        briefingSection += '\n\n## Niche Trends (already shown)\n';
        briefingSection += bc.nichePulse.map(p => `- ${p.headline}: ${p.context}`).join('\n');
      }
      if (bc.goalTarget) {
        briefingSection += `\n\n## Monthly Goal\n- Target: ${bc.goalTarget} views\n- Current: ${bc.goalCurrent || '?'} views`;
      }
    }
```

- [ ] **Step 3: Update the system prompt**

Replace `${CLIENT_NAME}, a creator/influencer` with `${CLIENT_NAME}, a ${CLIENT_NICHE} creator/influencer. ${CLIENT_DESCRIPTION}`.

Add to the "Your role" bullet list:
```
- You can draft Instagram captions, Pinterest pin descriptions, pitch emails to brands, and content ideas.
- If the creator asks you to "write a caption" or "draft a pitch", produce ready-to-use copy, not just advice.
- You have full context of this week's content calendar and action items — reference them when relevant.
- Don't repeat what the briefing already told them. Build on it or go deeper.
```

Append `${briefingSection}` after `${dataContext}` at the end of the system prompt.

- [ ] **Step 4: Commit**

```bash
git add api/chat.js
git commit -m "feat: enhance chat with niche-aware prompts and briefing context"
```

---

## Task 4: Hub HTML — CLIENT config, theme engine, CSS foundation, gradient, particles

**Files:**
- Rewrite: `hub/index.html`

This task creates the new file from scratch. It contains the CLIENT config, the theme engine that applies it, all CSS, the gradient background, particles, and the floating action bar. No data sections yet.

- [ ] **Step 1: Write `hub/index.html` with CLIENT config + theme engine**

The file starts with the CLIENT config object (Mandi's values), then the theme engine that reads it and applies CSS custom properties + loads the right font + builds gradient colors. This replaces the old auto-theme system with the new enhanced version.

```html
<script>
  // ── Client config ──────────────────────────────────────────────
  const CLIENT = {
    name:   'Mandi Bagley',
    niche:  'fitness',
    nicheLabel: 'Fitness · Faith · Food',
    url:    'https://mandibagley.com',
    palette: {
      bg: '#0C0809',
      surface: '#141012',
      surfaceElevated: '#1A1416',
      border: 'rgba(255,255,255,0.07)',
      text: '#F5EBE6',
      textMuted: 'rgba(245,235,230,0.45)',
      accent: '#E8527A',
      accentGlow: '#FF2D78',
      accentPale: 'rgba(232,82,122,0.15)',
      accentBorder: 'rgba(232,82,122,0.25)',
    },
    gradient: 'neon-pink',
    particleColors: [
      { r: 255, g: 45, b: 120, weight: 0.4 },
      { r: 232, g: 82, b: 122, weight: 0.3 },
      { r: 255, g: 150, b: 180, weight: 0.15 },
      { r: 245, g: 235, b: 230, weight: 0.15 },
    ],
    font: 'cormorant',
    brandCodes: [
      { brand: 'DFYNE', code: 'MANDI15', linkPattern: 'dfyne' },
      { brand: 'Gymshark', code: 'MANDIB', linkPattern: 'gymshark' },
      { brand: 'Teveo', code: 'MANDIBAGLEY', linkPattern: 'teveo' },
    ],
    redisPrefix: 'stats:',
  };
  // ──────────────────────────────────────────────────────────────
</script>
```

Then the theme engine that runs immediately (before paint):

```html
<script>
  const GRADIENT_PRESETS = {
    'neon-pink': {
      mesh1: [
        'rgba(255,45,120,0.55)', 'rgba(232,82,122,0.45)',
        'rgba(255,80,150,0.35)', 'rgba(200,30,90,0.40)',
        'rgba(255,60,130,0.30)',
      ],
      mesh2: [
        'rgba(255,45,120,0.30)', 'rgba(200,30,100,0.25)',
        'rgba(255,80,140,0.20)',
      ],
      pulse: 'rgba(255,45,120,0.12)',
    },
    'warm-gold': {
      mesh1: [
        'rgba(212,165,116,0.55)', 'rgba(196,149,106,0.45)',
        'rgba(232,201,160,0.35)', 'rgba(180,130,80,0.40)',
        'rgba(220,180,130,0.30)',
      ],
      mesh2: [
        'rgba(212,165,116,0.30)', 'rgba(180,130,80,0.25)',
        'rgba(220,180,130,0.20)',
      ],
      pulse: 'rgba(212,165,116,0.12)',
    },
    'cool-blue': {
      mesh1: [
        'rgba(74,123,247,0.55)', 'rgba(107,143,255,0.45)',
        'rgba(61,92,201,0.35)', 'rgba(50,80,200,0.40)',
        'rgba(90,130,255,0.30)',
      ],
      mesh2: [
        'rgba(74,123,247,0.30)', 'rgba(61,92,201,0.25)',
        'rgba(107,143,255,0.20)',
      ],
      pulse: 'rgba(74,123,247,0.12)',
    },
    'aurora': {
      mesh1: [
        'rgba(123,74,226,0.55)', 'rgba(232,82,122,0.45)',
        'rgba(74,123,247,0.35)', 'rgba(150,60,200,0.40)',
        'rgba(100,180,255,0.30)',
      ],
      mesh2: [
        'rgba(123,74,226,0.30)', 'rgba(232,82,122,0.25)',
        'rgba(74,123,247,0.20)',
      ],
      pulse: 'rgba(123,74,226,0.12)',
    },
    'ember': {
      mesh1: [
        'rgba(232,92,58,0.55)', 'rgba(255,127,80,0.45)',
        'rgba(212,87,74,0.35)', 'rgba(200,60,40,0.40)',
        'rgba(255,100,60,0.30)',
      ],
      mesh2: [
        'rgba(232,92,58,0.30)', 'rgba(200,60,40,0.25)',
        'rgba(255,127,80,0.20)',
      ],
      pulse: 'rgba(232,92,58,0.12)',
    },
  };

  const FONT_MAP = {
    cormorant:  { family: "'Cormorant Garamond', Georgia, serif", url: "Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400" },
    playfair:   { family: "'Playfair Display', serif", url: "Playfair+Display:wght@400;500;600" },
    bebas:      { family: "'Bebas Neue', sans-serif", url: "Bebas+Neue" },
    'dm-serif': { family: "'DM Serif Display', serif", url: "DM+Serif+Display:ital@0;1" },
    inter:      { family: "'Inter', sans-serif", url: "Inter:wght@300;400;500;600" },
  };

  (function() {
    var p = CLIENT.palette;
    var f = FONT_MAP[CLIENT.font] || FONT_MAP.cormorant;
    var r = document.documentElement.style;

    // Apply palette as CSS custom properties
    r.setProperty('--bg', p.bg);
    r.setProperty('--surface', p.surface);
    r.setProperty('--surface-elevated', p.surfaceElevated);
    r.setProperty('--border', p.border);
    r.setProperty('--text', p.text);
    r.setProperty('--text-muted', p.textMuted);
    r.setProperty('--accent', p.accent);
    r.setProperty('--accent-glow', p.accentGlow);
    r.setProperty('--accent-pale', p.accentPale);
    r.setProperty('--accent-border', p.accentBorder);
    r.setProperty('--display-font', f.family);

    // Build gradient mesh CSS from preset
    var gp = GRADIENT_PRESETS[CLIENT.gradient] || GRADIENT_PRESETS['neon-pink'];
    var positions = [
      '35% 40% at 20% 30%', '30% 35% at 75% 65%',
      '40% 30% at 50% 10%', '25% 40% at 80% 20%',
      '35% 25% at 30% 75%',
    ];
    var mesh1 = gp.mesh1.map(function(c, i) {
      return 'radial-gradient(ellipse ' + positions[i] + ', ' + c + ' 0%, transparent 70%)';
    }).join(',\n      ');
    r.setProperty('--gradient-mesh-1', mesh1);

    var positions2 = ['45% 35% at 60% 40%', '30% 45% at 25% 60%', '35% 30% at 70% 80%'];
    var mesh2 = gp.mesh2.map(function(c, i) {
      return 'radial-gradient(ellipse ' + positions2[i] + ', ' + c + ' 0%, transparent 65%)';
    }).join(',\n      ');
    r.setProperty('--gradient-mesh-2', mesh2);
    r.setProperty('--gradient-pulse', 'radial-gradient(ellipse 50% 50% at 50% 50%, ' + gp.pulse + ' 0%, transparent 70%)');

    // Skeleton shimmer from surface colors
    r.setProperty('--skeleton', 'linear-gradient(90deg, ' + p.surface + ' 25%, ' + p.surfaceElevated + ' 50%, ' + p.surface + ' 75%)');

    // Load fonts
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + f.url + '&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap';
    document.head.appendChild(link);

    document.title = 'Hub — ' + CLIENT.name;
  })();
</script>
```

Then all CSS using `var(--*)` references instead of hardcoded values, followed by the body with gradient background divs, particle canvas, empty `.hub-inner`, and floating action bar.

The CSS for `.gradient-mesh` uses `background: var(--gradient-mesh-1)` etc. The particle JS reads from `CLIENT.particleColors` to select colors based on weights.

Use the mockup `.superpowers/brainstorm/5592-1774653264/content/dark-gradient-v6.html` as the reference for all CSS — but replace every hardcoded color with the corresponding `var(--*)`.

- [ ] **Step 2: Verify the page loads**

Open `hub/index.html` in browser. Should see: dark background, animated gradient (colors from preset), particles (colors from config), floating action bar. Change `CLIENT.gradient` to `'warm-gold'` and refresh — gradient should change to gold tones.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: hub template with CLIENT config, theme engine, gradient presets, particles"
```

---

## Task 5: Hub login screen

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add login screen HTML**

Add as first child of `<body>` (before `.hub-inner`):

```html
<div id="loginScreen">
  <div class="login-card">
    <span class="login-ornament"></span>
    <h1 class="login-title" id="loginTitle">Client Name</h1>
    <p class="login-sub">Creator Hub</p>
    <input type="password" id="pwInput" class="login-input" placeholder="Password" autocomplete="current-password" />
    <button class="login-btn" onclick="login()">Enter Hub</button>
    <p class="login-error" id="loginError">Incorrect password — try again.</p>
  </div>
</div>
```

Login CSS uses `var(--surface)`, `var(--border)`, `var(--accent)`, `var(--accent-glow)`, `var(--text)`, `var(--text-muted)` — all from the theme engine. Login title set from `CLIENT.name` via JS.

- [ ] **Step 2: Add login JS**

```js
document.getElementById('loginTitle').textContent = CLIENT.name;

async function login() {
  var pw = document.getElementById('pwInput').value.trim();
  var err = document.getElementById('loginError');
  err.style.display = 'none';
  if (!pw) { err.textContent = 'Please enter a password.'; err.style.display = 'block'; return; }
  try {
    var res = await fetch('/api/briefing?password=' + encodeURIComponent(pw));
    if (res.ok) {
      sessionStorage.setItem('hub_password', pw);
      document.getElementById('loginScreen').style.display = 'none';
      showHub();
    } else {
      err.textContent = 'Incorrect password — try again.';
      err.style.display = 'block';
    }
  } catch (e) {
    err.textContent = 'Connection error — please retry.';
    err.style.display = 'block';
  }
}

document.getElementById('pwInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') login();
});

// Auto-login
(async function() {
  var saved = sessionStorage.getItem('hub_password');
  if (saved) {
    try {
      var res = await fetch('/api/briefing?password=' + encodeURIComponent(saved));
      if (res.ok) {
        document.getElementById('loginScreen').style.display = 'none';
        showHub();
      }
    } catch (e) {}
  }
})();
```

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: dark-themed login screen driven by CLIENT config"
```

---

## Task 6: Greeting, health bar, stats, goal tracker

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add HTML for greeting row, health bar, stats grid, goal card**

Greeting row uses `CLIENT.name`, `CLIENT.url`. Nav links point to `CLIENT.url` and `/dashboard`. All styles reference CSS custom properties.

Include skeleton loading states for stats and goal. Include goal empty state ("Set a monthly goal") and goal edit modal.

- [ ] **Step 2: Add JS — showHub, loadGoal, saveGoal, stats population**

`showHub()` populates greeting from `CLIENT.name`, date, site links from `CLIENT.url`, then calls `loadBriefing()` and `loadGoal()`.

`loadGoal()` fetches `/api/goal?password=`, populates goal card or empty state. Calculates pace: `(target - current) / daysRemainingInMonth`.

`saveGoal()` POSTs to `/api/goal`, refreshes display.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: greeting, stats, goal tracker with CLIENT config"
```

---

## Task 7: Game plan (actionable briefing)

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add briefing card HTML**

Section label "YOUR GAME PLAN", card with two-column layout, skeleton state, empty state, flag pills row, refresh button + notification badge.

- [ ] **Step 2: Add loadBriefing() JS**

Fetches `/api/briefing?password=`, populates:
- Summary + metric pills (left)
- Action items with priority dots + tags (right)
- Flag pills
- Health bar status
- Stats tiles (calls back to populate stats from metrics)
- Notification badge
- Stores response as `window.lastBriefing` for chat context
- Also triggers `populateCalendar()`, `populateLinks()`, `populateNichePulse()`, `populateProactiveChat()`

`refreshBriefing()` spins the refresh button and re-calls `loadBriefing()`.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: actionable game plan briefing"
```

---

## Task 8: Content calendar, top links, brand codes

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add calendar strip + paired row HTML**

Calendar: 7-day grid with skeleton state. Links: ranked list. Brand codes: list with `CLIENT.brandCodes` for matching.

- [ ] **Step 2: Add populateCalendar() and populateLinks() JS**

`populateCalendar(data)` renders the 7 `data.calendar` entries. Marks today with `.today` class by comparing dates.

`populateLinks(data)` renders top clicked links from `data.metrics` click data (already in briefing response). Renders brand codes by matching `CLIENT.brandCodes[].linkPattern` against click keys — shows brand name, code text, and usage count.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: content calendar and top links / brand codes"
```

---

## Task 9: Niche pulse

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add niche pulse HTML**

Section label uses `CLIENT.nicheLabel`: `"NICHE PULSE · " + CLIENT.nicheLabel.toUpperCase() + " CREATORS THIS WEEK"`.

3 insight cards with skeleton + empty states.

- [ ] **Step 2: Add populateNichePulse() and askFromPulse() JS**

```js
function populateNichePulse(items) {
  var el = document.getElementById('nichePulseContent');
  if (!items || !items.length) {
    el.innerHTML = '<p class="empty-state">Trend insights will generate once we have a week of data</p>';
    return;
  }
  el.innerHTML = items.map(function(p) {
    return '<div class="pulse-item">'
      + '<div class="pulse-icon">' + p.icon + '</div>'
      + '<div><div class="pulse-text"><strong>' + p.headline + '</strong> ' + p.context + '</div>'
      + '<div class="pulse-meta">' + p.meta + '</div>'
      + '<button class="pulse-cta" onclick="askFromPulse(\'' + p.chatPrompt.replace(/'/g, "\\'") + '\')">Ask advisor for a content angle →</button>'
      + '</div></div>';
  }).join('');
}

function askFromPulse(prompt) {
  var chatSection = document.querySelector('.chat-section');
  chatSection.scrollIntoView({ behavior: 'smooth' });
  setTimeout(function() {
    document.getElementById('chatInput').value = prompt;
    document.getElementById('chatInput').focus();
  }, 500);
}
```

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: niche pulse with chat integration"
```

---

## Task 10: Smart AI advisor chat

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add chat section HTML**

Full standout chat section: outer glow, animated border glow, inner card, header with LIVE dot, messages area, prompt pills, input row. All accent colors via `var(--accent)`, `var(--accent-glow)`, etc.

- [ ] **Step 2: Add chat JS — streaming, markdown, timestamps, proactive insights**

`sendChat(e)`: streaming SSE handler. POST body includes `briefingContext: window.lastBriefing`. Renders markdown incrementally.

`renderMarkdown(text)`: bold, italic, code, lists, paragraphs.

`createMsgEl(role)`: creates message div + timestamp.

`populateProactiveChat(insight)`: renders the proactive insight bubble with action buttons from `data.proactiveInsight`. Each action button sends that text as a chat message.

Prompt pills: "Write me a caption for today", "What should I post this weekend?", "How do I grow faster?", "Draft a pitch to a brand".

- [ ] **Step 3: Add mobile sticky chat input**

IntersectionObserver on `.chat-section` — adds `.sticky` class to chat input row when viewport ≤ 640px.

- [ ] **Step 4: Commit**

```bash
git add hub/index.html
git commit -m "feat: smart AI advisor chat with streaming and proactive insights"
```

---

## Task 11: Contact modal + floating action bar wiring

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add contact modal HTML**

Dark-themed modal: overlay, card with header/form/SMS fallback. All colors from CSS custom properties.

- [ ] **Step 2: Add modal JS**

`openModal(type)`, `closeModal()`, `submitModal(e)` — posts to `/api/contact`. FAB buttons already have `onclick` handlers from Task 4.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: dark-themed contact modal"
```

---

## Task 12: Scroll animations, skeletons, empty states

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add IntersectionObserver for fade-up**

```js
function initScrollAnimations() {
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-up').forEach(function(el) { observer.observe(el); });
}
```

Call `initScrollAnimations()` at the end of `showHub()`. Add `.fade-up` class to each section wrapper with stagger delays on paired sections.

- [ ] **Step 2: Verify all skeleton + empty states**

Each section has a skeleton div (shown while loading) and an empty state (shown when data is empty/null). Skeleton shimmer uses `var(--skeleton)` from theme engine.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: scroll animations, loading skeletons, empty states"
```

---

## Task 13: Responsive design

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add responsive breakpoints**

```css
@media (max-width: 960px) {
  .paired-row { grid-template-columns: 1fr; }
  .stats-goal-row { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .greeting-row { grid-template-columns: 1fr; gap: 16px; }
  .greeting-nav-left, .greeting-nav-right { justify-self: center; }
  .briefing-cols { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .hub-inner { padding: 40px 20px 100px; }
  .greeting h1 { font-size: 40px; }
  .stat-value { font-size: 28px; }
  .calendar-strip { display: flex; overflow-x: auto; gap: 8px; padding-bottom: 8px; }
  .cal-day { min-width: 100px; flex-shrink: 0; }
  .nav-grid { grid-template-columns: 1fr; }
  .chat-input-row.sticky {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 99;
    border-radius: 0; padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
    background: rgba(20,16,18,0.95); backdrop-filter: blur(12px);
    border-top: 1px solid var(--accent-border);
  }
  .fab-bar { bottom: 70px; }
}
@media (max-width: 480px) {
  .greeting h1 { font-size: 34px; }
  .login-card { padding: 40px 24px; }
  .login-title { font-size: 32px; }
}
```

- [ ] **Step 2: Test at all breakpoints**

Verify at 1200px, 960px, 640px, 480px. Paired sections stack, stats go 2x2, calendar scrolls horizontally, FAB stays accessible.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: responsive design for tablet and mobile"
```

---

## Task 14: Integration test + deploy

- [ ] **Step 1: Full manual test**

1. Open `/hub/` — verify login screen (dark, gradient, particles, CLIENT.name)
2. Log in — skeleton shimmer → data loads
3. Verify greeting shows CLIENT.name and CLIENT.url links
4. Set a goal → verify persistence
5. Verify briefing with action items, metric pills, flags
6. Verify calendar renders 7 days with today highlighted
7. Verify top links + brand codes (matched from CLIENT.brandCodes)
8. Verify niche pulse renders, CTA scrolls to chat
9. Send chat message → streaming response with markdown
10. Verify proactive insight with action buttons
11. Test FAB → contact modal → submit
12. Resize → responsive works
13. Change `CLIENT.gradient` to `'warm-gold'` → verify gradient changes
14. Change `CLIENT.font` to `'playfair'` → verify font changes

- [ ] **Step 2: Add CLIENT_NICHE and CLIENT_DESCRIPTION env vars to Vercel**

```bash
vercel env add CLIENT_NICHE
# Value: Fitness · Faith · Food
vercel env add CLIENT_DESCRIPTION
# Value: Lifestyle fitness creator, recipe content, brand partnerships with DFYNE and Gymshark
```

- [ ] **Step 3: Commit final fixes and push**

```bash
git add -A
git commit -m "fix: final integration fixes"
git push origin main
```

Verify at https://mandibagley.com/hub/
