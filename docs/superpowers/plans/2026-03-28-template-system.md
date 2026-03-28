# Creator Platform Template System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a template repo and generate script that lets Sam spin up a complete client platform by providing a config file.

**Architecture:** A new repo (`creator-platform-template`) contains master template files + a Node.js generate script. The script reads `client.config.json`, derives a full color palette from a single accent hex, and injects config values into all template files to produce a deploy-ready client project. Template files use demo values that get replaced during generation.

**Tech Stack:** Node.js (generate script), Static HTML/CSS/JS (template files)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `creator-platform-template/client.config.json` | Demo client config with all fields |
| Create | `creator-platform-template/generate.js` | Reads config, derives palette, injects into template files |
| Create | `creator-platform-template/template/` | Complete set of template files (copied from mandi-bagley with demo values) |
| Create | `creator-platform-template/README.md` | Usage documentation |

---

## Task 1: Create Template Repo and Copy Master Files

**Files:**
- Create: `~/creator-platform-template/` (new directory, will become a git repo)
- Create: `~/creator-platform-template/template/` (copied from mandi-bagley)

- [ ] **Step 1: Create the template repo directory**

```bash
mkdir -p ~/creator-platform-template/template
```

- [ ] **Step 2: Copy all files from mandi-bagley into template/**

```bash
cp -r /Users/samotto/mandi-bagley/hub ~/creator-platform-template/template/
cp -r /Users/samotto/mandi-bagley/dashboard ~/creator-platform-template/template/
cp -r /Users/samotto/mandi-bagley/packages ~/creator-platform-template/template/
cp -r /Users/samotto/mandi-bagley/api ~/creator-platform-template/template/
cp /Users/samotto/mandi-bagley/index.html ~/creator-platform-template/template/
```

Do NOT copy: `.vercel/`, `.claude/`, `.git/`, `docs/`, `.superpowers/`, image files (*.jpg, *.png). The website images are client-specific — each client will add their own.

- [ ] **Step 3: Initialize git repo**

```bash
cd ~/creator-platform-template
git init
```

- [ ] **Step 4: Commit the raw copy**

```bash
git add -A
git commit -m "chore: initial copy of template files from mandi-bagley"
```

---

## Task 2: Replace Mandi-Specific Values with Demo Defaults

**Files:**
- Modify: `~/creator-platform-template/template/hub/index.html`
- Modify: `~/creator-platform-template/template/dashboard/index.html`
- Modify: `~/creator-platform-template/template/packages/index.html`
- Modify: `~/creator-platform-template/template/api/briefing.js`
- Modify: `~/creator-platform-template/template/api/chat.js`

Replace all Mandi-specific values with demo defaults so the template works standalone.

- [ ] **Step 1: Replace CLIENT config in hub/index.html**

Find the `const CLIENT = {` block (starts around line 22) and replace it with:

```js
const CLIENT = {
  name: 'Demo Creator',
  niche: 'lifestyle',
  nicheLabel: 'Lifestyle · Content · Creator',
  url: 'https://demo-creator.com',
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
    { brand: 'BrandOne', code: 'DEMO10', linkPattern: 'brandone' },
    { brand: 'BrandTwo', code: 'DEMO20', linkPattern: 'brandtwo' },
  ],
  redisPrefix: 'stats:',
};
```

Also find `<meta name="apple-mobile-web-app-title" content="Mandi Hub">` and replace with `<meta name="apple-mobile-web-app-title" content="Creator Hub">`.

- [ ] **Step 2: Replace CLIENT config in dashboard/index.html**

Find the `const CLIENT = {` block and replace with:

```js
    const CLIENT = {
      name: 'Demo Creator',
      niche: 'lifestyle',
      nicheLabel: 'Lifestyle · Content · Creator',
      url: 'https://demo-creator.com',
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

- [ ] **Step 3: Replace booking links in packages/index.html**

Find all instances of `https://calendly.com/samuelotto24/30min` and replace with `https://calendly.com/demo/30min`.

- [ ] **Step 4: Replace client constants in api/briefing.js**

Find:
```js
const CLIENT_NAME = 'Mandi Bagley';
```
Replace with:
```js
const CLIENT_NAME = 'Demo Creator';
```

Find the default values for CLIENT_NICHE and CLIENT_DESCRIPTION:
```js
const CLIENT_NICHE = process.env.CLIENT_NICHE || 'Fitness · Faith · Food';
const CLIENT_DESCRIPTION = process.env.CLIENT_DESCRIPTION || 'Lifestyle fitness creator, recipe content, brand partnerships';
```
Replace with:
```js
const CLIENT_NICHE = process.env.CLIENT_NICHE || 'Lifestyle · Content · Creator';
const CLIENT_DESCRIPTION = process.env.CLIENT_DESCRIPTION || 'Content creator and influencer';
```

- [ ] **Step 5: Replace client constants in api/chat.js**

Same changes as briefing.js:
- `CLIENT_NAME = 'Mandi Bagley'` → `CLIENT_NAME = 'Demo Creator'`
- Default CLIENT_NICHE → `'Lifestyle · Content · Creator'`
- Default CLIENT_DESCRIPTION → `'Content creator and influencer'`

- [ ] **Step 6: Replace hardcoded prefix in api/stats.js**

Read `api/stats.js` and find any hardcoded `'stats:'` prefix. Replace with:
```js
const PREFIX = process.env.REDIS_PREFIX || 'stats:';
```
Then update all Redis commands to use `PREFIX + 'pageviews'` instead of `'stats:pageviews'`, etc. (Match the pattern used in briefing.js.)

- [ ] **Step 7: Commit**

```bash
cd ~/creator-platform-template
git add -A
git commit -m "refactor: replace Mandi-specific values with demo defaults"
```

---

## Task 3: Create the Demo Client Config

**Files:**
- Create: `~/creator-platform-template/client.config.json`

- [ ] **Step 1: Create client.config.json**

```json
{
  "name": "Demo Creator",
  "niche": "lifestyle",
  "nicheLabel": "Lifestyle · Content · Creator",
  "description": "Content creator and influencer",
  "domain": "demo-creator.com",
  "url": "https://demo-creator.com",
  "accent": "#E8527A",
  "gradient": "neon-pink",
  "font": "cormorant",
  "brandCodes": [
    { "brand": "BrandOne", "code": "DEMO10", "linkPattern": "brandone" },
    { "brand": "BrandTwo", "code": "DEMO20", "linkPattern": "brandtwo" }
  ],
  "bookingLink": "https://calendly.com/demo/30min",
  "referralCode": "DEMO",
  "dashboardPassword": "Demo2026",
  "about": ""
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/creator-platform-template
git add client.config.json
git commit -m "feat: add demo client config"
```

---

## Task 4: Write the Generate Script — Palette Derivation

**Files:**
- Create: `~/creator-platform-template/generate.js`

This is the core of the system. Split into two tasks — this one handles palette derivation, the next handles file injection.

- [ ] **Step 1: Create generate.js with palette derivation**

```js
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ── Read config ──
const configPath = path.join(__dirname, 'client.config.json');
if (!fs.existsSync(configPath)) {
  console.error('Error: client.config.json not found');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// ── Validate required fields ──
const required = ['name', 'niche', 'nicheLabel', 'domain', 'url', 'accent', 'gradient', 'font', 'bookingLink', 'referralCode', 'dashboardPassword'];
for (const field of required) {
  if (!config[field]) {
    console.error(`Error: missing required field "${field}" in client.config.json`);
    process.exit(1);
  }
}

// ── Palette derivation from accent hex ──
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const r1 = r / 255, g1 = g / 255, b1 = b / 255;
  const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r1: h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6; break;
      case g1: h = ((b1 - r1) / d + 2) / 6; break;
      case b1: h = ((r1 - g1) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function derivePalette(accentHex) {
  const { r, g, b } = hexToRgb(accentHex);
  const { h, s } = hexToHsl(accentHex);

  // Bg: near-black with warm tint from accent hue
  const bgHex = hslToHex(h, Math.min(s, 15), 3);
  // Surface: slightly elevated
  const surfaceHex = hslToHex(h, Math.min(s, 12), 5);
  // Surface elevated: one more step
  const surfaceElevatedHex = hslToHex(h, Math.min(s, 10), 7);

  // Glow: brighter version of accent
  const glowHex = hslToHex(h, Math.min(s + 10, 100), Math.min(hexToHsl(accentHex).l + 15, 65));

  return {
    bg: bgHex,
    surface: surfaceHex,
    surfaceElevated: surfaceElevatedHex,
    border: 'rgba(255,255,255,0.07)',
    text: '#F5EBE6',
    textMuted: 'rgba(245,235,230,0.45)',
    accent: accentHex,
    accentGlow: glowHex,
    accentPale: `rgba(${r},${g},${b},0.15)`,
    accentBorder: `rgba(${r},${g},${b},0.25)`,
  };
}

// ── Derive particle colors from accent ──
function deriveParticleColors(accentHex) {
  const { r, g, b } = hexToRgb(accentHex);
  const glowRgb = hexToRgb(derivePalette(accentHex).accentGlow);
  return [
    { r: glowRgb.r, g: glowRgb.g, b: glowRgb.b, weight: 0.4 },
    { r, g, b, weight: 0.3 },
    { r: Math.min(r + 50, 255), g: Math.min(g + 68, 255), b: Math.min(b + 58, 255), weight: 0.15 },
    { r: 245, g: 235, b: 230, weight: 0.15 },
  ];
}

const palette = derivePalette(config.accent);
const particleColors = deriveParticleColors(config.accent);

console.log('Palette derived from accent ' + config.accent + ':');
console.log(JSON.stringify(palette, null, 2));

// ── Output directory ──
const outputDir = process.argv[2] || path.join(__dirname, 'output', config.domain.replace(/\./g, '-'));
const templateDir = path.join(__dirname, 'template');

if (!fs.existsSync(templateDir)) {
  console.error('Error: template/ directory not found');
  process.exit(1);
}

// ── Copy template to output ──
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying template to ' + outputDir + '...');
if (fs.existsSync(outputDir)) {
  console.error('Error: output directory already exists: ' + outputDir);
  console.error('Delete it first or choose a different output path.');
  process.exit(1);
}
copyDir(templateDir, outputDir);

// ── File injection helpers ──
function readFile(relPath) {
  return fs.readFileSync(path.join(outputDir, relPath), 'utf8');
}
function writeFile(relPath, content) {
  fs.writeFileSync(path.join(outputDir, relPath), content, 'utf8');
}
function replaceInFile(relPath, find, replace) {
  let content = readFile(relPath);
  if (typeof find === 'string') {
    if (!content.includes(find)) {
      console.warn('Warning: pattern not found in ' + relPath + ': ' + find.slice(0, 60) + '...');
      return;
    }
    content = content.replace(find, replace);
  } else {
    content = content.replace(find, replace);
  }
  writeFile(relPath, content);
}

// ── Build CLIENT config strings ──

// Hub CLIENT (includes particleColors, brandCodes, redisPrefix)
const hubClient = `const CLIENT = {
  name: '${config.name}',
  niche: '${config.niche}',
  nicheLabel: '${config.nicheLabel}',
  url: '${config.url}',
  palette: {
    bg: '${palette.bg}',
    surface: '${palette.surface}',
    surfaceElevated: '${palette.surfaceElevated}',
    border: '${palette.border}',
    text: '${palette.text}',
    textMuted: '${palette.textMuted}',
    accent: '${palette.accent}',
    accentGlow: '${palette.accentGlow}',
    accentPale: '${palette.accentPale}',
    accentBorder: '${palette.accentBorder}',
  },
  gradient: '${config.gradient}',
  particleColors: ${JSON.stringify(particleColors, null, 4).replace(/\n/g, '\n  ')},
  font: '${config.font}',
  brandCodes: ${JSON.stringify(config.brandCodes || [], null, 4).replace(/\n/g, '\n  ')},
  redisPrefix: 'stats:',
};`;

// Dashboard CLIENT (no particleColors or brandCodes)
const dashClient = `    const CLIENT = {
      name: '${config.name}',
      niche: '${config.niche}',
      nicheLabel: '${config.nicheLabel}',
      url: '${config.url}',
      palette: {
        bg: '${palette.bg}',
        surface: '${palette.surface}',
        surfaceElevated: '${palette.surfaceElevated}',
        border: '${palette.border}',
        text: '${palette.text}',
        textMuted: '${palette.textMuted}',
        accent: '${palette.accent}',
        accentGlow: '${palette.accentGlow}',
        accentPale: '${palette.accentPale}',
        accentBorder: '${palette.accentBorder}',
      },
      gradient: '${config.gradient}',
      font: '${config.font}',
    };`;

// ── Inject into files ──

// Hub
console.log('Injecting into hub/index.html...');
let hubContent = readFile('hub/index.html');
hubContent = hubContent.replace(
  /const CLIENT = \{[\s\S]*?\n\};/,
  hubClient
);
hubContent = hubContent.replace(
  /content="[^"]*Hub"/,
  `content="${config.name.split(' ')[0]} Hub"`
);
writeFile('hub/index.html', hubContent);

// Dashboard
console.log('Injecting into dashboard/index.html...');
let dashContent = readFile('dashboard/index.html');
dashContent = dashContent.replace(
  /const CLIENT = \{[\s\S]*?\n    \};/,
  dashClient
);
writeFile('dashboard/index.html', dashContent);

// Packages page — booking links
console.log('Injecting into packages/index.html...');
let pkgContent = readFile('packages/index.html');
pkgContent = pkgContent.split('https://calendly.com/demo/30min').join(config.bookingLink);
writeFile('packages/index.html', pkgContent);

// API: briefing.js
console.log('Injecting into api/briefing.js...');
replaceInFile('api/briefing.js', "const CLIENT_NAME = 'Demo Creator';", `const CLIENT_NAME = '${config.name}';`);
replaceInFile('api/briefing.js',
  "const CLIENT_NICHE = process.env.CLIENT_NICHE || 'Lifestyle · Content · Creator';",
  `const CLIENT_NICHE = process.env.CLIENT_NICHE || '${config.nicheLabel}';`
);
replaceInFile('api/briefing.js',
  "const CLIENT_DESCRIPTION = process.env.CLIENT_DESCRIPTION || 'Content creator and influencer';",
  `const CLIENT_DESCRIPTION = process.env.CLIENT_DESCRIPTION || '${config.description}${config.about ? '. ' + config.about : ''}';`
);

// API: chat.js
console.log('Injecting into api/chat.js...');
replaceInFile('api/chat.js', "const CLIENT_NAME = 'Demo Creator';", `const CLIENT_NAME = '${config.name}';`);
replaceInFile('api/chat.js',
  "const CLIENT_NICHE = process.env.CLIENT_NICHE || 'Lifestyle · Content · Creator';",
  `const CLIENT_NICHE = process.env.CLIENT_NICHE || '${config.nicheLabel}';`
);
replaceInFile('api/chat.js',
  "const CLIENT_DESCRIPTION = process.env.CLIENT_DESCRIPTION || 'Content creator and influencer';",
  `const CLIENT_DESCRIPTION = process.env.CLIENT_DESCRIPTION || '${config.description}${config.about ? '. ' + config.about : ''}';`
);

// ── Write config to output for reference ──
fs.copyFileSync(configPath, path.join(outputDir, 'client.config.json'));

console.log('');
console.log('✓ Client project generated at: ' + outputDir);
console.log('');
console.log('Next steps:');
console.log('  1. cd ' + outputDir);
console.log('  2. Add client images (hero.jpg, etc.) and customize index.html');
console.log('  3. git init && git add -A && git commit -m "Initial client setup"');
console.log('  4. Create GitHub repo and push');
console.log('  5. Connect to Vercel, set environment variables:');
console.log('     - UPSTASH_REDIS_REST_URL');
console.log('     - UPSTASH_REDIS_REST_TOKEN');
console.log('     - REDIS_PREFIX=stats:');
console.log('     - DASHBOARD_PASSWORD=' + config.dashboardPassword);
console.log('     - ANTHROPIC_API_KEY');
console.log('     - CLIENT_NICHE=' + config.nicheLabel);
console.log('     - CLIENT_DESCRIPTION=' + config.description);
console.log('  6. Seed referral code:');
console.log('     curl -X POST "https://' + config.domain + '/api/referral?password=' + config.dashboardPassword + '" \\');
console.log('       -H "Content-Type: application/json" \\');
console.log('       -d \'{"code":"' + config.referralCode + '","count":0,"freeMonths":0}\'');
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x ~/creator-platform-template/generate.js
```

- [ ] **Step 3: Commit**

```bash
cd ~/creator-platform-template
git add generate.js
git commit -m "feat: add generate script with palette derivation and file injection"
```

---

## Task 5: Test with Mandi's Config

**Files:**
- Modify: `~/creator-platform-template/client.config.json` (temporarily)

- [ ] **Step 1: Write Mandi's config**

Replace `client.config.json` with Mandi's real values:

```json
{
  "name": "Mandi Bagley",
  "niche": "fitness",
  "nicheLabel": "Fitness · Faith · Food",
  "description": "Lifestyle fitness creator, recipe content, brand partnerships",
  "domain": "mandibagley.com",
  "url": "https://mandibagley.com",
  "accent": "#E8527A",
  "gradient": "neon-pink",
  "font": "cormorant",
  "brandCodes": [
    { "brand": "DFYNE", "code": "MANDI15", "linkPattern": "dfyne" },
    { "brand": "Gymshark", "code": "MANDIB", "linkPattern": "gymshark" },
    { "brand": "Teveo", "code": "MANDIBAGLEY", "linkPattern": "teveo" }
  ],
  "bookingLink": "https://calendly.com/samuelotto24/30min",
  "referralCode": "MANDI",
  "dashboardPassword": "Mandi2026",
  "about": "Fitness/Faith/Food creator. Posts workout content, faith-based motivation, and healthy recipes. Partners with DFYNE, Gymshark, and Teveo."
}
```

- [ ] **Step 2: Run the generator**

```bash
cd ~/creator-platform-template
node generate.js
```

Expected output: a folder at `~/creator-platform-template/output/mandibagley-com/` with all files injected.

- [ ] **Step 3: Verify the generated hub**

Open `output/mandibagley-com/hub/index.html` and verify:
- CLIENT.name is "Mandi Bagley"
- CLIENT.palette.accent is "#E8527A"
- CLIENT.brandCodes includes DFYNE, Gymshark, Teveo
- CLIENT.gradient is "neon-pink"

- [ ] **Step 4: Verify the generated dashboard**

Open `output/mandibagley-com/dashboard/index.html` and verify:
- CLIENT.name is "Mandi Bagley"
- CLIENT.palette matches Hub palette

- [ ] **Step 5: Verify the generated API files**

Check `output/mandibagley-com/api/briefing.js`:
- CLIENT_NAME is "Mandi Bagley"
- CLIENT_NICHE default is "Fitness · Faith · Food"

Check `output/mandibagley-com/api/chat.js`:
- Same values

- [ ] **Step 6: Verify the packages page**

Check `output/mandibagley-com/packages/index.html`:
- All Calendly links point to `https://calendly.com/samuelotto24/30min`

- [ ] **Step 7: Restore demo config and clean up**

```bash
cd ~/creator-platform-template
rm -rf output/
```

Restore `client.config.json` to the demo values (the original demo config from Task 3).

- [ ] **Step 8: Commit**

```bash
cd ~/creator-platform-template
git add -A
git commit -m "test: verify generation with Mandi config — passed"
```

---

## Task 6: Write README

**Files:**
- Create: `~/creator-platform-template/README.md`

- [ ] **Step 1: Create README.md**

```markdown
# Creator Platform Template

Master template for generating client platforms. Each client gets: a custom website, Hub (command center), analytics Dashboard, packages page, and AI-powered API endpoints — all branded to their aesthetic.

## Quick Start

1. Edit `client.config.json` with the new client's information
2. Run `node generate.js`
3. Output folder is a complete, deploy-ready project

## Config Fields

| Field | Description | Example |
|-------|-------------|---------|
| name | Client's full name | "Mandi Bagley" |
| niche | Short niche keyword | "fitness" |
| nicheLabel | Display niche label | "Fitness · Faith · Food" |
| description | One-line description for AI context | "Lifestyle fitness creator..." |
| domain | Client's domain (no https://) | "mandibagley.com" |
| url | Full URL with https:// | "https://mandibagley.com" |
| accent | Single hex color — full palette derived from this | "#E8527A" |
| gradient | Gradient preset (neon-pink, warm-gold, cool-blue, aurora, ember) | "neon-pink" |
| font | Display font (cormorant, playfair, bebas, dm-serif, inter) | "cormorant" |
| brandCodes | Array of affiliate brand codes | See example config |
| bookingLink | Calendly or Cal.com URL | "https://calendly.com/..." |
| referralCode | Code for the referral program | "MANDI" |
| dashboardPassword | Hub/Dashboard login password | "Mandi2026" |
| about | Free-text notes about the client for AI context | "Posts workout content..." |

## After Generation

1. Add client images to the output folder (hero.jpg, recipe photos, etc.)
2. Customize `index.html` (website) with client-specific content
3. Initialize git repo and push to GitHub
4. Connect to Vercel and set environment variables (listed in generate output)
5. Seed referral code in Redis (command printed by generate script)

## Updating Existing Clients

To push a template update to an existing client:
1. Update the template files in `template/`
2. Set `client.config.json` to that client's config
3. Run `node generate.js /path/to/existing/client`
4. Review changes and commit

**Note:** The website (index.html) should be updated manually per client to preserve customizations.

## Gradient Presets

- **neon-pink** — Rose/pink tones (fitness, beauty, lifestyle)
- **warm-gold** — Gold/amber tones (luxury, coaching, wellness)
- **cool-blue** — Blue/purple tones (tech, education, professional)
- **aurora** — Purple/pink/blue (creative, artistic, fashion)
- **ember** — Red/orange tones (food, energy, sports)
```

- [ ] **Step 2: Add .gitignore**

Create `~/creator-platform-template/.gitignore`:

```
output/
node_modules/
.DS_Store
```

- [ ] **Step 3: Commit**

```bash
cd ~/creator-platform-template
git add README.md .gitignore
git commit -m "docs: add README and gitignore"
```

---

## Task 7: Push to GitHub

- [ ] **Step 1: Create GitHub repo**

```bash
gh repo create samuelotto24-cmyk/creator-platform-template --private --source=~/creator-platform-template --push
```

(Adjust the GitHub username if different.)

- [ ] **Step 2: Verify repo is on GitHub**

```bash
cd ~/creator-platform-template
git log --oneline
```

Should show all commits from Tasks 1-6.
