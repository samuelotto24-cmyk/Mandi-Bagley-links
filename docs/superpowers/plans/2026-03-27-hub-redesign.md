# Hub Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `hub/index.html` as Mandi Bagley's branded command center with dark gradient aesthetic, actionable AI briefings, content calendar, goal tracking, niche pulse, and smart proactive chat.

**Architecture:** Single-file vanilla HTML/CSS/JS page (`hub/index.html`) backed by two Vercel Edge Functions (`api/briefing.js`, `api/chat.js`). Data stored in Upstash Redis. AI powered by Claude Haiku via Anthropic API. No framework — pure HTML with inline styles and scripts.

**Tech Stack:** Vanilla HTML/CSS/JS, Vercel Edge Functions, Upstash Redis, Anthropic Claude Haiku API, Google Fonts (Cormorant Garamond + DM Sans)

**Spec:** `docs/superpowers/specs/2026-03-27-hub-redesign-design.md`
**Reference mockup:** `.superpowers/brainstorm/5592-1774653264/content/dark-gradient-v6.html`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `hub/index.html` | Rewrite | Entire hub UI — login, all sections, particles, gradient, JS logic |
| `api/briefing.js` | Modify | Expand LLM prompt to return actionItems, calendar, nichePulse, proactiveInsight; add goal read |
| `api/chat.js` | Modify | Enhanced system prompt with calendar/goal/niche context; proactive insight logic |
| `api/goal.js` | Create | New endpoint to set/get monthly goal target in Redis |

---

## Task 1: Create goal API endpoint

**Files:**
- Create: `api/goal.js`

This is a standalone endpoint — no dependencies on other tasks.

- [ ] **Step 1: Create `api/goal.js`**

```js
export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';

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
      ['GET', 'stats:goal:target'],
      ['GET', 'stats:goal:type'],
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
      ['SET', 'stats:goal:target', String(target)],
      ['SET', 'stats:goal:type', type],
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

- [ ] **Step 1: Add goal reading to briefing handler**

In `api/briefing.js`, after the existing `const metrics = { ... };` block (around line 302), add goal data reading. Add to the Redis pipeline at the top of the handler (line 231-247) two more commands:

Add these two commands to the end of the existing `redis([...])` call:
```js
['GET', 'stats:goal:target'],
['GET', 'stats:goal:type'],
```

Then after the `const data = { ... }` block, parse them:
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

- [ ] **Step 2: Replace the LLM advisory prompt with expanded structured prompt**

Replace the entire `/* ── LLM advisory (Claude Haiku) ── */` section (lines 346-380) with a new prompt that returns JSON with `actionItems`, `calendar`, `nichePulse`, and `proactiveInsight`.

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

        const todayDate2 = new Date();
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const calDays = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(todayDate2);
          d.setDate(d.getDate() - d.getDay() + 1 + i); // Mon=0 ... Sun=6
          calDays.push({
            day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
            date: d.toISOString().slice(0, 10),
            isToday: d.toISOString().slice(0, 10) === today,
          });
        }

        const goalContext = goalTarget
          ? `\nGoal: ${metrics.thisMonthViews} / ${goalTarget} ${goalType} this month. ${Math.round(goalTarget - metrics.thisMonthViews)} remaining.`
          : '';

        const userMessage = `Creator: ${CLIENT_NAME} (Fitness · Faith · Food)
Niche: fitness creator, recipe content, brand partnerships (DFYNE, Gymshark, Teveo)

## This Week's Data
${bulletPoints}

## Link Clicks (all time)
${clicksList}

## Key Metrics
- This week views: ${thisWeekViews}, last week: ${lastWeekViews}
- Week-over-week: ${metrics.weekOverWeek}
- Top referrer: ${metrics.topReferrer}
- Avg session: ${avgSessionSec}s
- Peak hours: ${Object.entries(byHour).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => { const hr = parseInt(h); return (hr % 12 || 12) + (hr >= 12 ? 'PM' : 'AM'); }).join(', ')}
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
- 3 actionItems, prioritized high/medium/low, with specific times and caption ideas
- 7 calendar days (Mon-Sun), mix of content types, use peak hours for timing, include one rest day
- 2-3 nichePulse items relevant to fitness/food creators, reference plausible trends
- proactiveInsight: flag the most important data anomaly (0-click links, traffic drops, new referrers). null if nothing notable.
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

Replace the existing `return new Response(JSON.stringify({ ... }))` at the end:

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

Note: `advice` field is removed, replaced by `actionItems`.

- [ ] **Step 4: Test the endpoint**

Run: `curl "http://localhost:3000/api/briefing?password=<pw>" | jq '.actionItems, .calendar, .nichePulse, .proactiveInsight'`
Expected: JSON arrays with structured data (or empty arrays if no API key / no data)

- [ ] **Step 5: Commit**

```bash
git add api/briefing.js
git commit -m "feat: expand briefing API with actionItems, calendar, nichePulse, proactiveInsight"
```

---

## Task 3: Enhance chat API with richer context and proactive behavior

**Files:**
- Modify: `api/chat.js`

- [ ] **Step 1: Update the system prompt to include briefing context**

The chat endpoint already receives `question` and `history` in the POST body. Add an optional `briefingContext` field that the frontend will pass (containing the last briefing response). Update the system prompt construction (around line 180-194) to append this context.

After the existing `${dataContext}` in the system prompt string, add:

```js
    // Briefing context (passed from frontend)
    let briefingSection = '';
    if (body.briefingContext) {
      const bc = body.briefingContext;
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

Then append `briefingSection` to the end of the systemPrompt:

```js
    const systemPrompt = `You are a personal brand strategist...
...
${dataContext}
${briefingSection}`;
```

- [ ] **Step 2: Add proactive capabilities to the system prompt**

Update the system prompt "Your role" section to add:

```
- You can draft Instagram captions, Pinterest pin descriptions, pitch emails to brands, and content ideas.
- If the creator asks you to "write a caption" or "draft a pitch", produce ready-to-use copy, not just advice.
- You have full context of this week's content calendar and action items — reference them when relevant.
- Don't repeat what the briefing already told them. Build on it or go deeper.
```

- [ ] **Step 3: Read briefingContext from request body**

After `const question = body.question;` (line 68), add:

```js
    const briefingContext = body.briefingContext || null;
```

Pass it through to the prompt construction.

- [ ] **Step 4: Commit**

```bash
git add api/chat.js
git commit -m "feat: enhance chat system prompt with briefing context and content drafting"
```

---

## Task 4: Rewrite hub HTML — CSS foundation + gradient background + particles

**Files:**
- Rewrite: `hub/index.html`

This task creates the new file from scratch with the CSS foundation, animated gradient, and particle canvas. No sections yet — just the shell.

- [ ] **Step 1: Create the new `hub/index.html` with CSS + gradient + particles**

Write the complete `<head>` section with all CSS variables, gradient styles, particle canvas styles, and all component CSS classes from the mockup. Include the `<body>` with:
- Gradient background divs (`.gradient-bg > .gradient-mesh + .gradient-mesh-2 + .gradient-pulse`)
- Particle canvas (`<canvas id="particles">`)
- Empty `.hub-inner` container
- Floating action bar (FAB) with "Message Sam" and "Request Update"
- The particle JS at the bottom

Use the mockup file `.superpowers/brainstorm/5592-1774653264/content/dark-gradient-v6.html` as the exact reference for all CSS values, keyframes, and particle code.

Key CSS sections to include:
- All CSS custom properties (`:root`)
- Gradient background layers + keyframes (`meshDrift`, `meshDrift2`, `pulse`)
- Particle canvas styles
- Floating action bar styles (`.fab-bar`, `.fab-btn`)
- Hub inner container
- Section label, divider, card base styles
- Greeting styles (`.greeting-row`, `.greeting-nav`, `.greeting`, `.greeting-label`)
- Health bar
- Stats grid + goal card
- Briefing card + action items + flags
- Calendar strip
- List items (paired sections)
- Niche pulse
- Chat section (all glow/animation styles)
- Contact modal (dark-themed version of existing)
- Skeleton shimmer animation
- Responsive breakpoints (960px, 640px, 480px)
- Scroll `fade-up` animation

- [ ] **Step 2: Verify the page loads**

Open `hub/index.html` in a browser. Should see: dark background, animated pink gradient, floating particles, empty content area, floating action bar at bottom.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: hub CSS foundation with dark gradient, particles, and FAB"
```

---

## Task 5: Hub login screen

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add login screen HTML inside `.hub-inner`**

Add the login screen as the first child of `<body>` (before `.hub-inner`):

```html
<div id="loginScreen">
  <div class="login-card">
    <span class="login-ornament"></span>
    <h1 class="login-title">Mandi Bagley</h1>
    <p class="login-sub">Creator Hub</p>
    <input type="password" id="pwInput" class="login-input" placeholder="Password" autocomplete="current-password" />
    <button class="login-btn" onclick="login()">Enter Hub</button>
    <p class="login-error" id="loginError">Incorrect password — try again.</p>
  </div>
</div>
```

Login CSS (dark-themed):
```css
#loginScreen {
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; padding: 24px;
  position: relative; z-index: 1;
}
.login-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-md); padding: 56px 48px;
  width: 100%; max-width: 400px; text-align: center;
  animation: login-entrance 0.6s cubic-bezier(0.23,1,0.32,1) forwards;
}
@keyframes login-entrance { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.login-ornament { display: block; width: 40px; height: 2px; background: var(--rose); margin: 0 auto 24px; box-shadow: 0 0 10px rgba(232,82,122,0.3); }
.login-title { font-family: var(--serif); font-size: 38px; font-weight: 300; color: var(--text); margin-bottom: 4px; }
.login-sub { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 36px; }
.login-input { width: 100%; padding: 13px 16px; border: 1.5px solid var(--border); border-radius: 8px; background: var(--surface-elevated); font-family: var(--sans); font-size: 14px; color: var(--text); outline: none; transition: border-color 0.2s; margin-bottom: 12px; text-align: center; letter-spacing: 0.08em; }
.login-input::placeholder { color: var(--text-muted); }
.login-input:focus { border-color: var(--rose); }
.login-btn { width: 100%; padding: 13px; background: linear-gradient(135deg, var(--rose), var(--rose-glow)); color: #fff; border: none; border-radius: 8px; font-family: var(--sans); font-size: 13px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; box-shadow: 0 0 20px rgba(232,82,122,0.25); transition: box-shadow 0.2s; }
.login-btn:hover { box-shadow: 0 0 32px rgba(232,82,122,0.4); }
.login-error { font-size: 12px; color: #ef4444; margin-top: 12px; display: none; }
```

- [ ] **Step 2: Add login JS**

Add the login function, Enter key handler, and auto-login from sessionStorage (same logic as existing, referencing `/api/briefing?password=`).

- [ ] **Step 3: Test login flow**

Open hub in browser, enter password, verify login screen disappears and hub appears.

- [ ] **Step 4: Commit**

```bash
git add hub/index.html
git commit -m "feat: dark-themed login screen for hub"
```

---

## Task 6: Hub sections — greeting, health bar, stats, goal tracker

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add greeting row HTML**

Inside `#hub` div, add:
- Greeting row with flanking nav links ("View My Site" left, "Full Analytics" right)
- "mandibagley.com / backstage" label, "Hey, Mandi" h1, date + "Your Command Center"
- Health status bar pill

- [ ] **Step 2: Add stats grid + goal tracker HTML**

Stats grid (4 tiles with skeleton loading state) + goal tracker card (with skeleton and empty state).

- [ ] **Step 3: Add goal modal HTML**

Simple modal for setting the goal target — input field + save button. Triggered by "Edit ›" or "Set Goal" buttons.

- [ ] **Step 4: Add JS for showHub, stats population, goal loading/saving**

- `showHub()`: populates greeting, date, site links, calls `loadBriefing()` and `loadGoal()`
- `loadGoal()`: fetches `/api/goal?password=`, populates goal card or shows empty state
- `saveGoal()`: POST to `/api/goal`, updates display
- Goal pace calculation: `(target - current) / daysRemaining`

- [ ] **Step 5: Test stats + goal display**

Verify stats populate from briefing data, goal loads from Redis, empty state shows when no goal set.

- [ ] **Step 6: Commit**

```bash
git add hub/index.html
git commit -m "feat: greeting, stats, goal tracker sections"
```

---

## Task 7: Hub sections — game plan (actionable briefing)

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add briefing card HTML**

- Section label "YOUR GAME PLAN"
- Card with header row (title + badge + refresh button)
- Two-column grid: "What happened" (left) + "Do this today" (right)
- Skeleton loading state
- Flag pills row at bottom
- Empty state for no data

- [ ] **Step 2: Add briefing JS**

- `loadBriefing()`: fetches `/api/briefing?password=`, populates:
  - Summary text + metric pills (left column)
  - Action items with priority dots, text, and timeframe tags (right column)
  - Flag pills
  - Health bar status
  - Stats tiles
  - Notification badge count
  - Stores briefing response in `window.lastBriefing` for chat context
- `refreshBriefing()`: spins refresh button, re-calls `loadBriefing()`

- [ ] **Step 3: Test briefing display**

Verify briefing loads, action items render with correct priority colors and tags, flags show.

- [ ] **Step 4: Commit**

```bash
git add hub/index.html
git commit -m "feat: actionable game plan briefing section"
```

---

## Task 8: Hub sections — content calendar + top links + brand codes

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add content calendar HTML**

- Section label "THIS WEEK'S CONTENT PLAN"
- 7-day horizontal grid
- Each day: day name, date number, content type badge (color-coded), time, one-line idea
- Today gets `.today` class (rose border + glow)
- Skeleton state: 7 shimmer tiles

- [ ] **Step 2: Add top links + brand codes paired row HTML**

- Two-column grid
- Top links: ranked list items with click counts
- Brand codes: list items with brand name, code text, usage pill
- 0-value items get reduced opacity + amber coloring

- [ ] **Step 3: Add JS to populate calendar and links from briefing data**

Calendar populated from `data.calendar` array. Links populated from `data.metrics` (clicks data is already in the briefing). Brand codes derived from known brand code link names in the clicks hash.

- [ ] **Step 4: Commit**

```bash
git add hub/index.html
git commit -m "feat: content calendar strip and top links / brand codes"
```

---

## Task 9: Hub sections — niche pulse

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add niche pulse HTML**

- Section label "NICHE PULSE · FITNESS CREATORS THIS WEEK"
- 3 insight cards: emoji icon, bold headline, context text, meta line, CTA button
- Skeleton state: 3 shimmer cards
- Empty state text

- [ ] **Step 2: Add JS to populate from briefing data and wire CTA buttons**

Each CTA button scrolls to the chat section and pre-fills the chat input with the item's `chatPrompt` value:

```js
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
git commit -m "feat: niche pulse section with chat integration"
```

---

## Task 10: Hub sections — smart AI advisor chat

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add chat section HTML**

Full chat section with all standout visual elements:
- Outer glow div + animated border glow div + inner card
- Header with icon badge, title, subtitle, LIVE dot
- Messages area with proactive insight bubble (action buttons)
- Suggested prompt pills
- Input row with text input + send button
- All CSS animations (chatBorderShift, chatPulse, chatLineShift, livePulse)

- [ ] **Step 2: Add chat JS**

- `sendChat(e)`: streaming handler (already implemented pattern from previous work, adapt to new HTML structure). Passes `briefingContext: window.lastBriefing` in the POST body.
- `appendMsg(role, text, isTyping)` + `createMsgEl(role)`: with timestamps and markdown rendering
- `renderMarkdown(text)`: bold, italic, code, lists, paragraphs
- `askPrompt(btn)`: prompt pill click handler
- Proactive insight action buttons: each calls `sendChat` with the action text as the question
- Proactive insight rendering from `data.proactiveInsight` on briefing load

- [ ] **Step 3: Add mobile sticky chat input**

IntersectionObserver on `.chat-section` — adds `.sticky` class to chat input row on mobile.

- [ ] **Step 4: Commit**

```bash
git add hub/index.html
git commit -m "feat: smart AI advisor chat with proactive insights and streaming"
```

---

## Task 11: Contact modal + floating action bar wiring

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add contact modal HTML (dark-themed)**

Same structure as existing modal but dark-themed:
- Modal overlay + card
- Header with title + close button
- Form: type select + message textarea + submit button
- Status text
- SMS fallback link
- Dark surface backgrounds, rose accent, border styling matching hub theme

- [ ] **Step 2: Add modal JS**

`openModal(type)`, `closeModal()`, `submitModal(e)` — same logic as existing, adapted to new element IDs. The FAB buttons already have `onclick="openModal('message')"` and `onclick="openModal('update')"`.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: dark-themed contact modal and FAB wiring"
```

---

## Task 12: Scroll animations + loading skeletons + empty states

**Files:**
- Modify: `hub/index.html`

- [ ] **Step 1: Add scroll animation observer**

```js
var fadeObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-up').forEach(function(el) {
  fadeObserver.observe(el);
});
```

Add `.fade-up` class to each section wrapper. Add stagger delays to paired sections.

- [ ] **Step 2: Verify all skeleton states**

Each data section should show skeleton shimmer while loading:
- Stats: 4 skeleton tiles
- Goal: skeleton bar + lines
- Briefing: two-column skeleton
- Calendar: 7 skeleton day tiles
- Links/codes: skeleton list items
- Niche pulse: skeleton cards
- Chat: skeleton bubble

All skeletons use the dark shimmer: `linear-gradient(90deg, #141012 25%, #1A1416 50%, #141012 75%)`

- [ ] **Step 3: Verify all empty states**

Test with no data (fresh Redis). Each section should show its empty state message from the spec.

- [ ] **Step 4: Commit**

```bash
git add hub/index.html
git commit -m "feat: scroll animations, loading skeletons, and empty states"
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
  .calendar-strip { grid-template-columns: repeat(7, 1fr); overflow-x: auto; }
  .greeting-row { grid-template-columns: 1fr; gap: 16px; }
  .greeting-nav-left, .greeting-nav-right { justify-self: center; }
  .briefing-cols { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .hub-inner { padding: 40px 20px 100px; }
  .greeting h1 { font-size: 40px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .stat-value { font-size: 28px; }
  .calendar-strip { display: flex; overflow-x: auto; gap: 8px; padding-bottom: 8px; }
  .cal-day { min-width: 100px; flex-shrink: 0; }
  .nav-grid { grid-template-columns: 1fr; }
  .greeting-row { grid-template-columns: 1fr; }
  .greeting-nav { justify-content: center; }
  /* Mobile sticky chat input */
  .chat-input-row.sticky {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 99;
    border-radius: 0;
    padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
    background: rgba(20,16,18,0.95);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--rose-border);
  }
  /* Move FAB above sticky input when both active */
  .fab-bar { bottom: 70px; }
}

@media (max-width: 480px) {
  .greeting h1 { font-size: 34px; }
  .login-card { padding: 40px 24px; }
  .login-title { font-size: 32px; }
}
```

- [ ] **Step 2: Test at all breakpoints**

Open browser, resize to 1200px, 960px, 640px, 480px, 320px. Verify:
- Paired sections stack below 960px
- Stats go 2x2 below 960px
- Calendar scrolls horizontally below 640px
- Chat input sticks on mobile
- FAB stays accessible at all sizes
- No horizontal overflow at 320px

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat: responsive design for tablet and mobile"
```

---

## Task 14: Final integration test + deploy

**Files:**
- All modified files

- [ ] **Step 1: Full manual test**

1. Open `/hub/` — verify login screen (dark theme, gradient, particles)
2. Log in — verify hub loads with skeleton shimmer
3. Verify all sections populate with real data
4. Test goal: set a goal, refresh, verify it persists
5. Test briefing refresh button
6. Test content calendar rendering
7. Test niche pulse CTA → scrolls to chat and pre-fills input
8. Test chat: send a message, verify streaming response with markdown
9. Test proactive insight action buttons
10. Test FAB: Message Sam → modal opens; Request Update → modal opens
11. Test contact modal: submit a message
12. Test flanking nav links: View My Site, Full Analytics
13. Resize browser: verify responsive at 960px, 640px, 480px
14. Test empty states: with no Redis data, sections show fallback messages

- [ ] **Step 2: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final integration fixes"
```

- [ ] **Step 3: Push and deploy**

```bash
git push origin main
```

Vercel auto-deploys from main. Verify at https://mandibagley.com/hub/
