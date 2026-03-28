# Creator Platform Template System

> A template repo and generation workflow that lets Sam spin up a complete client platform (website, Hub, Dashboard, packages page, API) by providing a config file + a conversation with Claude.

---

## Goal

Eliminate manual duplication work. New clients go from "signed" to "live" by filling out 10 config fields, running a generator, and customizing the website content. Hub, Dashboard, packages page, and all API endpoints work out of the box. Template updates can be pushed to existing clients without touching their website customizations.

---

## Architecture

### Repos

- **`creator-platform-template`** — master template repo (own GitHub repo)
- **`client-name-platform`** — per-client generated repos (one per client, e.g., `mandi-bagley-platform`)

### Template Repo Structure

```
creator-platform-template/
├── client.config.json          ← 10 fields + about/research notes
├── generate.js                 ← reads config, derives palette, injects into all files
├── template/
│   ├── index.html              ← starter website (demo values, customizable after gen)
│   ├── hub/index.html          ← master Hub
│   ├── dashboard/index.html    ← master Dashboard
│   ├── packages/index.html     ← master Packages page
│   └── api/
│       ├── briefing.js
│       ├── chat.js
│       ├── goal.js
│       ├── referral.js
│       ├── stats.js
│       ├── track.js
│       ├── subscribe.js
│       └── contact.js
└── README.md
```

The `template/` folder is a working site with demo/default values. It can be opened and tested as-is.

---

## Client Config

`client.config.json`:

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
    { "brand": "Gymshark", "code": "MANDIB", "linkPattern": "gymshark" }
  ],
  "bookingLink": "https://calendly.com/samuelotto24/30min",
  "referralCode": "MANDI",
  "dashboardPassword": "Mandi2026",
  "about": "Free-text notes + online research summary. Fed into AI advisor context."
}
```

### Palette Derivation

Only one color is specified (`accent`). The `generate.js` script derives the full 10-color palette automatically:

- **bg** — near-black with a warm tint from the accent hue
- **surface** — slightly elevated from bg
- **surfaceElevated** — one more step up
- **border** — warm white at 7% opacity
- **text** — warm cream (#F5EBE6)
- **textMuted** — text at 45% opacity
- **accent** — the input color as-is
- **accentGlow** — brighter, more saturated version (+20% lightness)
- **accentPale** — accent at 15% opacity
- **accentBorder** — accent at 25% opacity

The matching gradient preset is selected via the `gradient` field (one of: neon-pink, warm-gold, cool-blue, aurora, ember). In the future, gradient presets could also be auto-derived from the accent, but for now the 5 presets cover the common creator aesthetics.

---

## Generate Script (`generate.js`)

Node.js script that:

1. Reads `client.config.json`
2. Derives full palette from accent color
3. Copies `template/` to output folder
4. Builds the CLIENT config objects (Hub format + Dashboard format) from the config
5. Injects CLIENT objects into `hub/index.html` and `dashboard/index.html` — replaces the demo CLIENT block with the real one
6. Injects API constants into `briefing.js` and `chat.js` — replaces `CLIENT_NAME`, `CLIENT_NICHE`, `CLIENT_DESCRIPTION` with config values
7. Injects booking link into `packages/index.html` — replaces all Calendly URLs
8. Updates the starter `index.html` website with client name, colors, fonts
9. Writes the final `client.config.json` into the output for reference

The script uses simple string replacement — finds known marker patterns in the template files and replaces them. No templating engine, no build tools.

### Marker Patterns

Template files use real, working demo values (not `{{PLACEHOLDERS}}`). The generate script knows the exact demo values to find and replace:

- In Hub/Dashboard JS: `const CLIENT = {` block — replaced entirely
- In API files: `const CLIENT_NAME = 'Demo Creator';` — replaced with real name
- In API files: `const CLIENT_NICHE = 'Demo Niche';` — replaced
- In API files: `const CLIENT_DESCRIPTION = 'Demo description';` — replaced
- In packages page: `https://calendly.com/demo/30min` — replaced with real booking link
- In website: demo name, demo colors — replaced with real values

---

## Generation Workflow (via Claude)

### New Client

1. **Sam says:** "Create a new client"
2. **Claude asks** for the 10 config fields (name, niche, nicheLabel, domain, accent, gradient, font, brandCodes, bookingLink, referralCode, password)
3. **Claude asks:** "Anything else I should know about them?"
4. **Claude researches** the client online — Instagram, TikTok, website, Linktree — summarizes follower counts, platforms, content style, brand partnerships, audience
5. **Claude shows** the full config + research and asks Sam to confirm
6. **Claude generates:** clones template, fills config, runs generate.js, outputs ready-to-deploy folder
7. **Claude deploys:** creates GitHub repo, pushes, helps connect Vercel + set env vars, seeds referral code in Redis
8. **Sam customizes:** adds client images, tweaks website copy and sections

### Update Existing Client from Template

1. **Sam says:** "Update Mandi's Hub from the template" or "Push latest Hub to all clients"
2. **Claude copies** the updated Hub/Dashboard/packages/API from the template
3. **Claude re-applies** that client's config (re-runs generate for those files only)
4. **Claude commits and deploys** — website customizations are never touched

### Add Feature to Template

1. **Sam says:** "Add [feature] to the Hub" (working in the template repo)
2. **Claude builds** the feature in `creator-platform-template/template/hub/index.html`
3. Feature is now in the template for all future clients
4. Sam decides when/whether to push it to existing clients (see update flow above)

---

## Migration Plan

To get from current state to template system:

1. **Create `creator-platform-template` repo** — extract the current Mandi files as the master template, replace Mandi-specific values with demo values
2. **Write `generate.js`** — palette derivation + file injection
3. **Write `client.config.json`** with demo values
4. **Test:** generate a Mandi config and verify the output matches the current live site
5. **Mandi's repo stays as-is** — it's already live and deployed. Future updates to Mandi come through the "update existing client" flow.

---

## What's Client-Specific vs. Shared

| Component | Shared (template) | Client-specific |
|-----------|-------------------|-----------------|
| Hub | Structure, features, all sections | CLIENT config values only |
| Dashboard | Structure, charts, all sections | CLIENT config values only |
| Packages page | Layout, tiers, referral banner | Booking link, referral code |
| API endpoints | All logic, rule engine, AI prompts | CLIENT_NAME, CLIENT_NICHE, CLIENT_DESCRIPTION (injected) |
| Website | Starter layout, color/font system | Images, copy, sections, custom content |
| Environment vars | Same keys for all clients | Different values (Redis URL, API keys, password, domain) |

---

## Environment Variables (per client, set in Vercel)

These are NOT in the config file — they're set in Vercel's dashboard or via `vercel env`:

- `UPSTASH_REDIS_REST_URL` — client's Redis instance
- `UPSTASH_REDIS_REST_TOKEN` — Redis auth
- `REDIS_PREFIX` — namespace (e.g., `stats:`)
- `DASHBOARD_PASSWORD` — Hub/Dashboard login
- `ANTHROPIC_API_KEY` — for AI advisor
- `CLIENT_NICHE` — used by API (also baked into files for redundancy)
- `CLIENT_DESCRIPTION` — used by API

---

## Scope

**In scope for this build:**
- Create the template repo with master files
- Write the generate script (palette derivation + injection)
- Write the client.config.json format
- Test by generating a Mandi config and verifying output
- Document the workflow in README.md

**Out of scope:**
- Auto-creating Vercel projects (manual for now)
- Auto-provisioning Redis instances (manual for now)
- Visual client intake form / web UI
- Auto-detecting gradient preset from accent color
