# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the analytics dashboard to match the Hub's premium dark aesthetic — gradient meshes, glassmorphism cards, client-branded colors/fonts — while keeping all data and charts intact.

**Architecture:** Single-file modification of `dashboard/index.html`. Replace the simple CLIENT config + THEMES system with the Hub's full CLIENT config + GRADIENT_PRESETS + FONT_MAP. Restyle all CSS to use the new palette. Update Chart.js theme references from `THEMES[CLIENT.mode]` to inline palette values.

**Tech Stack:** HTML/CSS/JS (single file), Chart.js, Three.js (globe), D3 (map)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `dashboard/index.html` | Full visual restyle — config, CSS, JS theme references |

---

## Task 1: Replace CLIENT Config & Theme Engine

**Files:**
- Modify: `dashboard/index.html` (lines 17-91)

Replace the dashboard's simple CLIENT config, THEMES object, and FONT_MAP with the Hub's full versions. This is the foundation — everything else builds on it.

- [ ] **Step 1: Replace the CLIENT config block**

Find this block (starts around line 17):

```js
    const CLIENT = {
      name:   'Mandi Bagley',
      accent: '#B76E79',
      mode:   'light',        // 'light' or 'dark'
      font:   'cormorant',    // 'cormorant' | 'playfair' | 'bebas' | 'dm-serif'
    };
```

Replace with:

```js
    const CLIENT = {
      name: 'Mandi Bagley',
      niche: 'fitness',
      nicheLabel: 'Fitness · Faith · Food',
      url: 'https://mandibagley.com',
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
      font: 'cormorant',
    };
```

- [ ] **Step 2: Replace THEMES + FONT_MAP + theme application block**

Find the entire block from `const THEMES = {` through the closing `})();` of the auto-theme system (lines ~29-91). Replace it all with:

```js
    /* ── Gradient Presets ── */
    const GRADIENT_PRESETS = {
      'neon-pink': {
        mesh1: ['rgba(255,45,120,0.55)','rgba(232,82,122,0.45)','rgba(255,80,150,0.35)','rgba(200,30,90,0.40)','rgba(255,60,130,0.30)'],
        mesh2: ['rgba(255,45,120,0.30)','rgba(200,30,100,0.25)','rgba(255,80,140,0.20)'],
        pulse: 'rgba(255,45,120,0.08)',
      },
      'warm-gold': {
        mesh1: ['rgba(200,160,80,0.50)','rgba(180,130,60,0.40)','rgba(220,180,100,0.30)','rgba(160,120,50,0.35)','rgba(200,150,70,0.25)'],
        mesh2: ['rgba(200,160,80,0.25)','rgba(180,130,60,0.20)','rgba(220,180,100,0.15)'],
        pulse: 'rgba(200,160,80,0.08)',
      },
      'cool-blue': {
        mesh1: ['rgba(60,100,255,0.50)','rgba(80,120,232,0.40)','rgba(40,80,200,0.35)','rgba(100,140,255,0.30)','rgba(60,90,220,0.25)'],
        mesh2: ['rgba(60,100,255,0.25)','rgba(80,120,232,0.20)','rgba(40,80,200,0.15)'],
        pulse: 'rgba(60,100,255,0.08)',
      },
      'aurora': {
        mesh1: ['rgba(120,60,200,0.50)','rgba(200,80,180,0.40)','rgba(60,120,255,0.35)','rgba(160,40,220,0.30)','rgba(100,80,240,0.25)'],
        mesh2: ['rgba(120,60,200,0.25)','rgba(200,80,180,0.20)','rgba(60,120,255,0.15)'],
        pulse: 'rgba(120,60,200,0.08)',
      },
      'ember': {
        mesh1: ['rgba(255,80,40,0.50)','rgba(232,120,60,0.40)','rgba(200,60,30,0.35)','rgba(255,100,50,0.30)','rgba(220,80,40,0.25)'],
        mesh2: ['rgba(255,80,40,0.25)','rgba(232,120,60,0.20)','rgba(200,60,30,0.15)'],
        pulse: 'rgba(255,80,40,0.08)',
      },
    };

    const FONT_MAP = {
      cormorant:  { family: "'Cormorant Garamond', Georgia, serif", url: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400' },
      playfair:   { family: "'Playfair Display', Georgia, serif", url: 'Playfair+Display:wght@400;500;600;700' },
      bebas:      { family: "'Bebas Neue', Impact, sans-serif", url: 'Bebas+Neue&display=swap' },
      'dm-serif': { family: "'DM Serif Display', Georgia, serif", url: 'DM+Serif+Display&display=swap' },
      inter:      { family: "'Inter', system-ui, sans-serif", url: 'Inter:wght@300;400;500;600;700' },
    };

    // Apply theme immediately (before paint)
    (function() {
      const p = CLIENT.palette;
      const f = FONT_MAP[CLIENT.font] || FONT_MAP.cormorant;
      const r = document.documentElement.style;

      // Core palette
      r.setProperty('--bg', p.bg);
      r.setProperty('--surface', p.surface);
      r.setProperty('--surface-elevated', p.surfaceElevated);
      r.setProperty('--border', p.border);
      r.setProperty('--text', p.text);
      r.setProperty('--text-muted', p.textMuted);
      r.setProperty('--muted', p.textMuted);
      r.setProperty('--accent', p.accent);
      r.setProperty('--accent-glow', p.accentGlow);
      r.setProperty('--accent-pale', p.accentPale);
      r.setProperty('--accent-border', p.accentBorder);

      // Derived accent opacities
      r.setProperty('--accent-10', p.accent + '1a');
      r.setProperty('--accent-20', p.accent + '33');
      r.setProperty('--accent-40', p.accent + '66');

      // Typography
      r.setProperty('--display-font', f.family);
      r.setProperty('--sans', "'DM Sans', system-ui, sans-serif");
      r.setProperty('--serif', f.family);

      // Surfaces for legacy references
      r.setProperty('--shadow', '0 1px 3px rgba(0,0,0,0.20), 0 4px 20px rgba(0,0,0,0.25)');
      r.setProperty('--shadow-hover', '0 4px 8px rgba(0,0,0,0.30), 0 12px 32px rgba(0,0,0,0.40)');
      r.setProperty('--grid-line', 'rgba(255,255,255,0.05)');
      r.setProperty('--tooltip-bg', 'rgba(12,8,9,0.95)');
      r.setProperty('--tooltip-border', p.accentBorder);

      // Map colors
      r.setProperty('--map-bg', p.bg);
      r.setProperty('--map-country', 'rgba(255,255,255,0.04)');
      r.setProperty('--map-stroke', 'rgba(255,255,255,0.09)');

      // Load fonts
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + f.url + '&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap';
      document.head.appendChild(link);

      document.title = 'Analytics — ' + CLIENT.name;
    })();
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/index.html
git commit -m "refactor: replace dashboard theme system with Hub's full CLIENT config"
```

---

## Task 2: Add Gradient Mesh Background

**Files:**
- Modify: `dashboard/index.html` (HTML body section + CSS)

Add the gradient mesh layers to the page, and update the login screen and body CSS.

- [ ] **Step 1: Update body and login CSS**

Find:
```css
    body {
      font-family: 'DM Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
```

Replace with:
```css
    body {
      font-family: 'DM Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
```

Find:
```css
    #loginScreen {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px;
      background: var(--login-bg);
    }
```

Replace with:
```css
    #loginScreen {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px;
      position: relative; z-index: 1;
    }
```

- [ ] **Step 2: Update login card CSS for glassmorphism**

Find:
```css
    .login-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 56px 48px;
      width: 100%; max-width: 400px; box-shadow: var(--shadow); text-align: center;
      animation: login-entrance 0.6s cubic-bezier(0.23,1,0.32,1) forwards;
    }
```

Replace with:
```css
    .login-card {
      background: rgba(20,16,18,0.75); backdrop-filter: blur(20px);
      border: 1px solid var(--border); border-radius: 18px; padding: 56px 48px;
      width: 100%; max-width: 400px; box-shadow: var(--shadow); text-align: center;
      animation: login-entrance 0.6s cubic-bezier(0.23,1,0.32,1) forwards;
    }
```

- [ ] **Step 3: Update login input for dark theme**

Find:
```css
    .login-input:focus { border-color: var(--accent); background: var(--input-focus); }
```

Replace with:
```css
    .login-input { background: rgba(12,8,9,0.6); }
    .login-input:focus { border-color: var(--accent); background: rgba(12,8,9,0.8); }
```

(Note: this replaces the existing `.login-input:focus` and adds a base `.login-input` background override. The original `.login-input` rules stay — just the `background` on the base and focus states change.)

- [ ] **Step 4: Add gradient mesh HTML**

Find `<body>` tag. Immediately after it, add:

```html
<!-- Gradient Mesh Background -->
<div id="gradientMesh" style="position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;">
  <div id="mesh1" style="position:absolute;width:200%;height:200%;top:-50%;left:-30%;filter:blur(80px);animation:meshDrift1 20s ease-in-out infinite alternate;"></div>
  <div id="mesh2" style="position:absolute;width:180%;height:180%;top:-40%;left:-40%;filter:blur(100px);animation:meshDrift2 28s ease-in-out infinite alternate;"></div>
  <div id="meshPulse" style="position:absolute;inset:-20%;filter:blur(80px);animation:meshPulse 6s ease-in-out infinite;"></div>
</div>
```

- [ ] **Step 5: Add mesh CSS animations**

Add after the `:root` rule (before `body`):

```css
    @keyframes meshDrift1 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(-5%,3%) scale(1.05); } }
    @keyframes meshDrift2 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(4%,-3%) scale(1.03); } }
    @keyframes meshPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
```

- [ ] **Step 6: Add JS to populate gradient meshes**

At the bottom of the theme application IIFE (inside the `(function() { ... })()` block, before the closing `})()`), add:

```js
      // Build gradient mesh backgrounds
      var gp = GRADIENT_PRESETS[CLIENT.gradient] || GRADIENT_PRESETS['neon-pink'];
      var mesh1Bg = gp.mesh1.map(function(c, i) {
        var positions = ['25% 25%','75% 20%','50% 75%','20% 60%','80% 50%'];
        return 'radial-gradient(ellipse at ' + positions[i % 5] + ', ' + c + ' 0%, transparent 50%)';
      }).join(',');
      var mesh2Bg = gp.mesh2.map(function(c, i) {
        var positions = ['60% 30%','30% 70%','70% 60%'];
        return 'radial-gradient(ellipse at ' + positions[i % 3] + ', ' + c + ' 0%, transparent 45%)';
      }).join(',');
      document.getElementById('mesh1').style.background = mesh1Bg;
      document.getElementById('mesh2').style.background = mesh2Bg;
      document.getElementById('meshPulse').style.background = 'radial-gradient(ellipse at 50% 50%, ' + gp.pulse + ' 0%, transparent 70%)';
```

- [ ] **Step 7: Ensure all content sits above the mesh**

Find `#loginScreen` and `#dashboard` in CSS. Add `position: relative; z-index: 1;` to `#dashboard`:

Find:
```css
    #dashboard { display: none; }
```

Replace with:
```css
    #dashboard { display: none; position: relative; z-index: 1; }
```

- [ ] **Step 8: Commit**

```bash
git add dashboard/index.html
git commit -m "feat: add gradient mesh background to dashboard"
```

---

## Task 3: Restyle Cards to Glassmorphism

**Files:**
- Modify: `dashboard/index.html` (CSS section)

Restyle summary cards, chart cards, and two-column layouts.

- [ ] **Step 1: Restyle summary cards**

Find:
```css
    .s-card {
      background: var(--surface); border: 1px solid var(--border);
      border-bottom: 2px solid var(--accent); border-radius: var(--radius);
      padding: 24px 24px 20px; box-shadow: var(--shadow);
      transition: transform 0.35s cubic-bezier(0.23,1,0.32,1), box-shadow 0.35s ease, border-color 0.3s;
      opacity: 0; transform: translateY(20px);
      position: relative; overflow: hidden;
    }
    .s-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, var(--accent), var(--accent-40), transparent);
      opacity: 0; transition: opacity 0.3s;
    }
    .s-card:hover::before { opacity: 1; }
    .s-card.visible { opacity: 1; transform: translateY(0); transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.23,1,0.32,1); }
    .s-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-hover); border-color: var(--accent-20); }
```

Replace with:
```css
    .s-card {
      background: rgba(20,16,18,0.75); backdrop-filter: blur(20px);
      border: 1px solid var(--border); border-radius: 16px;
      padding: 24px 24px 20px;
      transition: transform 0.35s cubic-bezier(0.23,1,0.32,1), border-color 0.3s;
      opacity: 0; transform: translateY(20px);
      position: relative; overflow: hidden;
    }
    .s-card.visible { opacity: 1; transform: translateY(0); transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.23,1,0.32,1); }
    .s-card:hover { transform: translateY(-3px); border-color: var(--accent-border); }
```

- [ ] **Step 2: Restyle chart cards**

Find:
```css
    .chart-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 26px 28px; box-shadow: var(--shadow);
      opacity: 0; transform: translateY(18px);
      transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.23,1,0.32,1), box-shadow 0.3s, border-color 0.3s;
    }
    .chart-card.revealed { opacity: 1; transform: translateY(0); }
    .chart-card:hover { border-color: var(--accent-20); box-shadow: var(--shadow-hover); }
```

Replace with:
```css
    .chart-card {
      background: rgba(20,16,18,0.75); backdrop-filter: blur(20px);
      border: 1px solid var(--border); border-radius: 16px; padding: 26px 28px;
      opacity: 0; transform: translateY(18px);
      transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.23,1,0.32,1), border-color 0.3s;
    }
    .chart-card.revealed { opacity: 1; transform: translateY(0); }
    .chart-card:hover { border-color: var(--accent-border); }
```

- [ ] **Step 3: Restyle skeleton cards**

Find:
```css
    .skeleton-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
```

Replace with:
```css
    .skeleton-card { background: rgba(20,16,18,0.75); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }
```

- [ ] **Step 4: Update skeleton shimmer for dark theme**

Find:
```css
    @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
    .skeleton { background: var(--skeleton); background-size: 600px 100%; animation: shimmer 1.6s infinite linear; border-radius: 6px; }
```

Replace with:
```css
    @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
    .skeleton { background: linear-gradient(90deg, rgba(20,16,18,0.8) 25%, rgba(40,32,36,0.8) 50%, rgba(20,16,18,0.8) 75%); background-size: 600px 100%; animation: shimmer 1.6s infinite linear; border-radius: 6px; }
```

- [ ] **Step 5: Restyle referral management card**

Find:
```css
    .referral-mgmt-stat {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 20px 24px; text-align: center;
    }
```

Replace with:
```css
    .referral-mgmt-stat {
      background: rgba(26,20,22,0.8); border: 1px solid var(--border);
      border-radius: 14px; padding: 20px 24px; text-align: center;
    }
```

- [ ] **Step 6: Commit**

```bash
git add dashboard/index.html
git commit -m "feat: restyle dashboard cards to glassmorphism"
```

---

## Task 4: Restyle Header & Footer

**Files:**
- Modify: `dashboard/index.html` (CSS + HTML)

- [ ] **Step 1: Restyle header CSS**

Find:
```css
    .dash-header-bar {
      background: var(--header-bg); position: relative; overflow: hidden;
      width: 100%; border-bottom: 1px solid var(--border);
    }
    .dash-header-bar::after {
      content: ''; position: absolute; inset: 0;
      background: radial-gradient(ellipse at 100% 0%, var(--accent-20) 0%, transparent 60%);
      pointer-events: none;
    }
```

Replace with:
```css
    .dash-header-bar {
      background: rgba(12,8,9,0.5); backdrop-filter: blur(20px);
      position: relative; overflow: hidden;
      width: 100%; border-bottom: 1px solid var(--border);
      z-index: 2;
    }
    .dash-header-bar::after {
      content: ''; position: absolute; inset: 0;
      background: radial-gradient(ellipse at 100% 0%, var(--accent-20) 0%, transparent 60%);
      pointer-events: none;
    }
```

- [ ] **Step 2: Update header text colors**

Find:
```css
    .dash-brand {
      font-family: var(--display-font); font-size: 36px; font-weight: 400;
      color: var(--header-text); letter-spacing: 0.03em; line-height: 1; margin-bottom: 8px;
    }
```

Replace with:
```css
    .dash-brand {
      font-family: var(--display-font); font-size: 36px; font-weight: 400;
      color: var(--text); letter-spacing: 0.03em; line-height: 1; margin-bottom: 8px;
    }
```

- [ ] **Step 3: Add "Back to Hub" link to header HTML**

Find in the HTML:
```html
      <div class="dash-updated" id="updatedAt"></div>
    </div>
  </div>
```

Replace with:
```html
      <div style="text-align:right;">
        <a href="/hub" style="font-size:12px;color:var(--text-muted);text-decoration:none;transition:color 0.2s;"
           onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-muted)'">&larr; Back to Hub</a>
        <div class="dash-updated" id="updatedAt" style="margin-top:4px;"></div>
      </div>
    </div>
  </div>
```

- [ ] **Step 4: Update footer ornament color**

Find:
```css
    .footer-ornament { display: inline-block; width: 24px; height: 1px; background: var(--accent); vertical-align: middle; margin: 0 12px; }
```

Replace with:
```css
    .footer-ornament { display: inline-block; width: 24px; height: 1px; background: var(--accent-pale); vertical-align: middle; margin: 0 12px; }
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/index.html
git commit -m "feat: restyle dashboard header and footer"
```

---

## Task 5: Update Chart.js Theme References

**Files:**
- Modify: `dashboard/index.html` (JS section)

The charts currently reference `THEMES[CLIENT.mode]` for colors. Replace these with CSS variable values and inline palette references.

- [ ] **Step 1: Remove the THEMES reference in chart code**

Find (in the render function, around the pageviews chart):
```js
    var t = THEMES[CLIENT.mode] || THEMES.light;
    new Chart(pvCtx, {
```

Replace with:
```js
    var t = {
      surface: CLIENT.palette.surface,
      text: CLIENT.palette.text,
      muted: CLIENT.palette.textMuted,
      tooltipBg: 'rgba(12,8,9,0.95)',
      tooltipBorder: CLIENT.palette.accentBorder,
      gridLine: 'rgba(255,255,255,0.05)',
    };
    new Chart(pvCtx, {
```

- [ ] **Step 2: Update chart gradient**

Find:
```js
    grad.addColorStop(0, CLIENT.accent + '40');
    grad.addColorStop(1, CLIENT.accent + '00');
```

Replace with:
```js
    grad.addColorStop(0, CLIENT.palette.accent + '40');
    grad.addColorStop(1, CLIENT.palette.accent + '00');
```

- [ ] **Step 3: Update chart dataset colors**

Find:
```js
        datasets: [{ data: pvByDay, borderColor: CLIENT.accent, backgroundColor: grad,
          borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0,
          pointHoverRadius: 5, pointHoverBackgroundColor: CLIENT.accent,
          pointHoverBorderColor: t.surface, pointHoverBorderWidth: 2 }],
```

Replace with:
```js
        datasets: [{ data: pvByDay, borderColor: CLIENT.palette.accent, backgroundColor: grad,
          borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0,
          pointHoverRadius: 5, pointHoverBackgroundColor: CLIENT.palette.accent,
          pointHoverBorderColor: t.surface, pointHoverBorderWidth: 2 }],
```

- [ ] **Step 4: Update DONUT_COLORS reference**

Find:
```js
  const DONUT_COLORS = generatePalette(CLIENT.accent, 10);
```

Replace with:
```js
  const DONUT_COLORS = generatePalette(CLIENT.palette.accent, 10);
```

- [ ] **Step 5: Search for any remaining `CLIENT.accent` references and update to `CLIENT.palette.accent`**

There may be other references to `CLIENT.accent` throughout the JS (in renderGauge, renderFunnel, renderClockHeatmap, etc.). Find all instances of `CLIENT.accent` and replace with `CLIENT.palette.accent`.

- [ ] **Step 6: Update the CLIENT config injection at the top of the script**

Find the block that sets `loginTitle` and `dashBrand`:
```js
  document.getElementById('loginTitle').textContent = CLIENT.name;
  if (f.uppercase) document.getElementById('loginTitle').style.textTransform = 'uppercase';
  document.getElementById('dashBrand').textContent  = CLIENT.name;
  if (f.uppercase) document.getElementById('dashBrand').style.textTransform = 'uppercase';
```

This references `f` from the old FONT_MAP. Update to use the new one:
```js
  var dashFont = FONT_MAP[CLIENT.font] || FONT_MAP.cormorant;
  document.getElementById('loginTitle').textContent = CLIENT.name;
  if (dashFont.url && dashFont.url.includes('Bebas')) document.getElementById('loginTitle').style.textTransform = 'uppercase';
  document.getElementById('dashBrand').textContent  = CLIENT.name;
  if (dashFont.url && dashFont.url.includes('Bebas')) document.getElementById('dashBrand').style.textTransform = 'uppercase';
```

- [ ] **Step 7: Commit**

```bash
git add dashboard/index.html
git commit -m "feat: update chart theme references to use CLIENT.palette"
```

---

## Task 6: Final Polish & Verification

**Files:**
- Modify: `dashboard/index.html` (minor CSS tweaks)

- [ ] **Step 1: Update the map card to use new palette variables**

Find:
```css
    .map-card .card-title { color: #FDF9F5; }
```

Replace with:
```css
    .map-card .card-title { color: var(--text); }
```

- [ ] **Step 2: Update tooltip colors for dark theme**

Find:
```css
    .map-tooltip {
      position: absolute; background: var(--tooltip-bg); border: 1px solid var(--tooltip-border);
      border-radius: 8px; padding: 8px 14px; font-family: 'DM Sans', sans-serif;
      font-size: 12px; color: #EEF2FF; pointer-events: none; opacity: 0;
```

Replace with:
```css
    .map-tooltip {
      position: absolute; background: var(--tooltip-bg); backdrop-filter: blur(12px);
      border: 1px solid var(--tooltip-border);
      border-radius: 8px; padding: 8px 14px; font-family: 'DM Sans', sans-serif;
      font-size: 12px; color: var(--text); pointer-events: none; opacity: 0;
```

Do the same for `.clock-tooltip` — add `backdrop-filter: blur(12px)` and change `color: #EEF2FF` to `color: var(--text)`.

- [ ] **Step 3: Update conversion rate badge colors for dark backgrounds**

Find:
```css
    .conv-rate.rate-high { color: #16a34a; background: rgba(22,163,74,0.12); }
    .conv-rate.rate-mid  { color: #ca8a04; background: rgba(202,138,4,0.12); }
    .conv-rate.rate-low  { color: #ef4444; background: rgba(239,68,68,0.12); }
```

Replace with:
```css
    .conv-rate.rate-high { color: #4ade80; background: rgba(74,222,128,0.12); }
    .conv-rate.rate-mid  { color: #fbbf24; background: rgba(251,191,36,0.12); }
    .conv-rate.rate-low  { color: #f87171; background: rgba(248,113,113,0.12); }
```

- [ ] **Step 4: Update bar fill gradient**

Find:
```css
    .bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-40)); border-radius: 3px; transition: width 0.9s cubic-bezier(0.16,1,0.3,1); }
```

Replace with:
```css
    .bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-pale)); border-radius: 3px; transition: width 0.9s cubic-bezier(0.16,1,0.3,1); }
```

- [ ] **Step 5: Update bar track for dark theme**

Find:
```css
    .bar-track { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
```

Replace with:
```css
    .bar-track { flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; }
```

- [ ] **Step 6: Update scroll depth bar track**

Find:
```css
    .scroll-bar-track { flex: 1; height: 22px; background: var(--border); border-radius: 6px; overflow: hidden; position: relative; }
    .scroll-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-40)); border-radius: 6px; transition: width 1s cubic-bezier(0.16,1,0.3,1); display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; }
```

Replace with:
```css
    .scroll-bar-track { flex: 1; height: 22px; background: rgba(255,255,255,0.05); border-radius: 6px; overflow: hidden; position: relative; }
    .scroll-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-pale)); border-radius: 6px; transition: width 1s cubic-bezier(0.16,1,0.3,1); display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; }
```

- [ ] **Step 7: Verify dashboard loads correctly**

Open the dashboard in a browser and check:
- Login screen has gradient mesh background and glassmorphism card
- After login, gradient mesh is visible behind all content
- All cards have frosted glass appearance
- Charts use accent color with dark-friendly styling
- Header has backdrop blur and "Back to Hub" link
- 3D Globe still renders correctly
- Referral management card matches new style
- Mobile layout still works (check at 480px and 800px)

- [ ] **Step 8: Commit and push**

```bash
git add dashboard/index.html
git commit -m "feat: final polish — tooltips, badges, bars, verification"
git push origin main
```
