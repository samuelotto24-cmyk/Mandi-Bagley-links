# Engagement Engine — Design Spec

**Date:** 2026-03-30
**Project:** mandi-bagley (mandibagley.com)
**Goal:** ManyChat-alternative that turns social media commenters into captured leads, integrated into the existing creator hub.

---

## Overview

When a follower comments a keyword on one of Mandi's Instagram posts, the system:
1. Auto-replies to the comment: "DM me [KEYWORD] and I'll send it!"
2. When the follower DMs the keyword, auto-responds with a link to a branded capture page
3. Capture page gates the freebie behind an email form
4. Email is collected, freebie delivered via Resend, lead tracked in the hub

Instagram-first. TikTok comment monitoring (manual reply queue) can be added later when their API supports it.

---

## Architecture

```
Instagram Webhook (comment event)
        │
        ▼
api/ig-webhook.js ──→ Match keyword against automations in Redis
        │                     │
        │ (match found)       │ (no match) → ignore
        ▼
api/ig-comment-reply.js ──→ Reply to comment: "DM me X!"
        │
        ▼
Instagram Webhook (DM event — user-initiated)
        │
        ▼
api/ig-webhook.js ──→ Match DM text against keywords
        │
        ▼
api/ig-dm-respond.js ──→ Send DM with capture page link
        │
        ▼
/g/[slug] (capture page) ──→ Email form
        │
        ▼
api/capture.js ──→ Store email in Redis, send freebie via Resend
        │
        ▼
Hub displays lead in real-time feed + funnel metrics
```

All data stored in Redis under `stats:` prefix (consistent with existing hub data).

---

## Components

### 1. Hub UI — Automations Card

New bento card in `hub/index.html`.

**List view:**
- Shows all automations with keyword, status (active/paused), and quick stats (comments, emails, conversion %)
- [+ New] button opens creation modal
- Each automation has [Edit] and [Pause/Resume] actions

**Creation/Edit modal fields:**
- `keyword` — trigger word, case-insensitive (e.g., "MEAL")
- `commentReply` — template for the comment auto-reply (e.g., "DM me MEAL and I'll send it!")
- `dmResponse` — template for the DM auto-response (e.g., "Here's your free meal plan!")
- `captureSlug` — URL slug for the capture page (e.g., "meal" → mandibagley.com/g/meal)
- `captureHeadline` — headline on the capture page (e.g., "Your Free 7-Day Meal Plan")
- `captureDescription` — short description below headline
- `freebieType` — one of: `pdf_link`, `discount_code`, `video_link`, `external_url`
- `freebieValue` — the actual URL, code, or link to deliver
- `upsellUrl` — optional link shown on thank-you screen (e.g., link to full program)
- `upsellText` — optional CTA text for upsell
- `active` — boolean, default true

### 2. Hub UI — Conversion Funnel Card

New bento card showing per-automation funnel:

```
MEAL: 142 comments → 89 DMs → 67 clicks → 51 emails (36%)
CODE: 67 comments → 41 DMs → 30 clicks → 19 emails (28%)
```

Visual bar chart with four stages. "This week" total at the bottom.

### 3. Hub UI — Recent Leads Card

Live feed of lead events:
- Username, keyword, current funnel stage, timestamp
- [Export Emails] button downloads CSV of all captured emails
- Shows most recent 20 leads, sorted by time

### 4. API — `api/automations.js`

CRUD endpoint for automation configs.

**Auth:** `Authorization: Bearer {password}` (same as existing hub auth)

**Methods:**
- `GET` — returns all automations from Redis
- `POST` — create new automation, validate keyword uniqueness
- `PUT` — update existing automation (by keyword)
- `DELETE` — delete automation (by keyword)

**Redis key:** `stats:automations` — JSON array of automation objects

### 5. API — `api/ig-webhook.js`

Instagram webhook receiver. Handles two event types:

**Comment events (`field: "comments"`):**
1. Extract comment text from webhook payload
2. Normalize: lowercase, trim, check if it matches any active automation keyword
3. If match: call Instagram Graph API to reply to the comment with the automation's `commentReply` template
4. Log lead event: `{step: "comment", user: username, keyword, post_id, timestamp}`

**Messaging events (`field: "messages"`):**
1. Extract message text from webhook payload
2. Normalize and match against active automation keywords
3. If match: call Instagram Send API to respond with the automation's `dmResponse` (including capture page link)
4. Log lead event: `{step: "dm", user: username, keyword, timestamp}`

**Webhook verification:**
- GET requests return the `hub.verify_token` challenge (Meta webhook setup handshake)
- POST requests validate the `X-Hub-Signature-256` header against the app secret

### 6. API — `api/capture.js`

Serves the capture page AND handles email submission.

**GET `/api/capture?slug=meal`:**
- Look up automation config by slug from Redis
- Return branded HTML capture page (dynamically generated)
- Page themed to Mandi's brand (cormorant font, cream/rose palette)
- Includes: headline, description, email form, social proof counter
- Tracks page view as lead event: `{step: "click", keyword, timestamp}`

**POST `/api/capture`:**
- Body: `{slug, email}`
- Validate email format
- Store in Redis: `stats:emails:{slug}` (hash: email → metadata JSON)
- Store lead event: `{step: "captured", email, keyword, timestamp}`
- Send freebie email via Resend API (subject: automation's captureHeadline, body: link/code)
- Return success JSON (client-side swaps to thank-you view with optional upsell)

### 7. API — `api/leads.js`

Read-only endpoint for the hub to fetch lead data.

**Auth:** `Authorization: Bearer {password}`

**GET `/api/leads`:**
- Returns: recent lead events (last 100), per-automation funnel counts, total emails captured
- Aggregates from Redis lead event lists

**GET `/api/leads?export=csv`:**
- Returns CSV download of all captured emails with metadata

### 8. Capture Page — `/g/[slug]`

Not a separate HTML file. Vercel rewrite rule sends `/g/*` to `api/capture.js` which generates the page.

**vercel.json addition:**
```json
{ "source": "/g/:slug", "destination": "/api/capture?slug=:slug" }
```

**Page structure:**
- Mandi's photo/logo at top
- Headline + description from automation config
- Email input + submit button
- Social proof: "[N] people grabbed this"
- After submit: thank-you message + optional upsell CTA
- Footer: @mandibagley social links

**Themed using CLIENT config values** — same colors, fonts, and feel as the main site.

---

## Redis Schema

All keys use the existing `stats:` prefix.

| Key | Type | Contents |
|-----|------|----------|
| `stats:automations` | String (JSON) | Array of automation config objects |
| `stats:leads` | List | JSON lead event objects `{step, user, keyword, post_id, email, timestamp}` |
| `stats:funnel:{keyword}` | Hash | `{comments: N, dms: N, clicks: N, captured: N}` |
| `stats:emails:{slug}` | Hash | `{email → JSON metadata (keyword, source, date)}` |
| `stats:ig:access_token` | String | Instagram OAuth access token |
| `stats:ig:user_id` | String | Instagram user ID |
| `stats:ig:connected_at` | String | Connection timestamp |

---

## Instagram OAuth Flow

Same pattern as existing TikTok OAuth:

1. `api/ig-auth.js` — redirects to Meta OAuth URL with scopes: `instagram_basic, instagram_manage_comments, instagram_manage_messages`
2. `api/ig-callback.js` — exchanges code for long-lived token, stores in Redis, redirects to hub
3. Hub shows "Instagram connected" state with disconnect option

---

## Vercel Configuration Changes

**vercel.json additions:**
- Rewrite: `/g/:slug` → `/api/capture?slug=:slug`
- CSP header update: allow Resend API domain

**Environment variables needed (post Meta-approval):**
- `INSTAGRAM_APP_ID` — Meta app client ID
- `INSTAGRAM_APP_SECRET` — Meta app secret
- `INSTAGRAM_VERIFY_TOKEN` — webhook verification token (we generate this)

---

## Integration with Existing Hub Features

**AI Briefing (`api/briefing.js`):**
- Pull funnel data from Redis
- Include in briefing context: "MEAL automation: 51 new emails this week, 36% conversion"

**Weekly Recap (`api/weekly-recap.js`):**
- Add automation performance section to the email

**Growth Scoreboard:**
- Count captured emails as conversions in the existing scoreboard totals

---

## Build Order

1. **Redis schema + `api/automations.js`** — CRUD for automations, no external deps
2. **Hub UI — Automations card** — create/edit/list automations, modal form
3. **`api/capture.js` + vercel.json rewrite** — capture page template + email submission + Resend delivery
4. **Hub UI — Funnel card + Leads card** — display metrics and lead feed, export CSV
5. **`api/leads.js`** — lead data endpoint for hub
6. **Instagram OAuth** — `api/ig-auth.js` + `api/ig-callback.js` + hub connect button
7. **`api/ig-webhook.js`** — comment + DM webhook handler with auto-reply logic
8. **Integration** — wire funnel data into briefing, recap, and scoreboard

Steps 1-5 can be built and tested today (no Instagram API needed).
Steps 6-7 need Meta app credentials but can be coded now.
Step 8 connects everything to existing features.

---

## Out of Scope (for now)

- TikTok comment automation (API doesn't support auto-reply/DM)
- Multi-step drip sequences (one response per automation is enough to start)
- A/B testing different reply templates
- Paid ad comment monitoring
- SMS capture (email only for now)
