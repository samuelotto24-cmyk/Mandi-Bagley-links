# Dashboard Redesign — Hub-Styled, Data-Focused

> Restyle the analytics dashboard to match the Hub's premium dark aesthetic while keeping it readable and data-dense.

---

## Goal

The Hub and Dashboard should feel like the same product. Currently they look like two different tools. This redesign brings the dashboard's visual language in line with the Hub: gradient mesh backgrounds, glassmorphism cards, client-branded colors/fonts — but without particles or heavy animations, because this is a data page that needs to stay readable.

---

## Scope

**In scope:**
- Replace dashboard CLIENT config with Hub's full config (palette, gradients, fonts)
- Add gradient mesh background (animated, blurred, fixed position)
- Restyle all cards to glassmorphism (transparent bg, backdrop blur, rounded corners)
- Restyle charts to use client accent colors with dark-friendly styling
- Restyle header, login screen, and footer
- Remove the light/dark theme toggle — always dark, driven by CLIENT palette

**Out of scope:**
- Particles or floating canvas effects
- Heavy scroll animations (fade-up, etc.)
- Glow effects on interactive elements
- Changing what data is displayed or how it's calculated
- Changing the 3D globe (already dark-styled)

---

## Design Decisions

### 1. Shared CLIENT Config

Replace the dashboard's simple config:
```js
// OLD
const CLIENT = {
  name: 'Mandi Bagley',
  accent: '#B76E79',
  mode: 'light',
  font: 'cormorant',
};
```

With the Hub's full config:
```js
// NEW — same object as hub/index.html
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

Remove the `THEMES` object (light/dark) entirely. All colors come from `CLIENT.palette`. Remove the `mode` field — dashboard is always dark.

### 2. Gradient Mesh Background

Port the Hub's gradient mesh system:
- `GRADIENT_PRESETS` object with all 5 presets (neon-pink, warm-gold, cool-blue, aurora, ember)
- Two mesh layers (`mesh1` with 5 radial gradients, `mesh2` with 3), both with `filter: blur(80-100px)`
- Pulse overlay layer (6s breathing animation)
- `position: fixed; inset: 0` behind all content
- Mesh animations: 20s drift on mesh1, 28s on mesh2
- No particles

### 3. Cards — Glassmorphism

All dashboard cards (`.s-card`, `.chart-card`, `.map-card`, `.skeleton-card`) get:
- `background: rgba(20, 16, 18, 0.75)` (surface with transparency)
- `backdrop-filter: blur(20px)`
- `border: 1px solid var(--border)` (from CLIENT palette)
- `border-radius: 16px` (up from current ~8px)
- Hover: `border-color: var(--accent-border)`
- Remove the bottom accent stripe from `.s-card`
- Remove the `::before` gradient accent line on hover

Summary card values: display serif font from CLIENT config, same size (44px for numbers, 20px for text values).

### 4. Charts & Data Visualization

**Chart.js configuration changes:**
- Line/bar fill: accent color with gradient to transparent
- Line stroke: accent color
- Gridlines: `rgba(255, 255, 255, 0.05)`
- Tick labels: `var(--text-muted)`
- Tooltip: dark surface bg, accent border, backdrop blur

**Bar lists (`.bar-fill`):**
- `background: linear-gradient(90deg, var(--accent), var(--accent-pale))`

**Conversion rate badges:**
- Keep semantic green/yellow/red colors but adjust for dark backgrounds:
  - High: `color: #4ade80; background: rgba(74, 222, 128, 0.12)`
  - Mid: `color: #fbbf24; background: rgba(251, 191, 36, 0.12)`
  - Low: `color: #f87171; background: rgba(248, 113, 113, 0.12)`
  - Default: `color: var(--accent); background: var(--accent-pale)`

**Doughnut charts:**
- Color palette derived from accent at different opacities (100%, 70%, 45%, 25%, 15%)

**Heatmap cells:**
- Scale from `var(--border)` (no data) to `var(--accent)` (max data)

**3D Globe:** No changes — already has dark styling in `.map-card`.

### 5. Header

- `background: rgba(12, 8, 9, 0.5)` with `backdrop-filter: blur(20px)`
- `border-bottom: 1px solid var(--border)`
- Client name in display serif font
- Accent line above name (30px wide, 1px, accent color)
- "Analytics" subtitle label
- "Back to Hub" link on the right side
- "Updated Xm ago" timestamp

### 6. Login Screen

- Gradient mesh background (same as dashboard)
- Login card: glassmorphism treatment (transparent bg, backdrop blur, 18px radius)
- Title in display serif font
- Submit button: `background: var(--accent)`
- Error text: warm red that fits the palette

### 7. Footer

- Accent ornament lines (short horizontal rules in accent color at 30% opacity)
- Client name in uppercase, muted text color
- Same pattern as current but using palette colors

---

## CSS Variables

The dashboard will use these CSS custom properties (set from CLIENT.palette in JS before first paint):

```
--bg, --surface, --surface-elevated, --border
--text, --text-muted
--accent, --accent-glow, --accent-pale, --accent-border
--serif (display font), --sans (body font)
```

Derived variables computed in JS:
```
--accent-10 (10% opacity), --accent-20 (20%), --accent-40 (40%)
```

---

## What Gets Removed

- `THEMES` object (light/dark theme definitions)
- `CLIENT.mode` field
- All light-theme color references
- The `--header-bg`, `--header-text`, `--login-bg` variables (replaced by glassmorphism)
- `.s-card::before` gradient line
- `.s-card` bottom accent border stripe
- Any reference to `THEMES[CLIENT.mode]`

---

## Duplication Story

When Sam creates a new client, he copies the project and changes the `CLIENT` object in both `hub/index.html` and `dashboard/index.html`. Both files use the same config shape, so the entire visual identity — colors, gradients, fonts — changes in one place per file. The gradient preset (e.g., "warm-gold" for a gold-themed creator) drives the mesh background, and the palette drives every surface, border, and text color.
