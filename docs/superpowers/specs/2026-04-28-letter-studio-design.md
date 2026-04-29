# The Letter Studio — Design Spec

**Date:** 2026-04-28
**First implementation:** Mandi Bagley hub (`~/mandi-bagley/`)
**Backports to:** `~/cassandra-morales/` (canonical), `~/creator-template/`
**Status:** Approved · build in progress

## 1. Goal

A full-screen, three-pane authoring app inside every creator hub. Lets the creator capture ideas, AI-expand them into their voice, compose multi-section letters, and send via Resend (mirrored to Beehiiv for archive). Designed so a creator can author and send a newsletter solo, on impulse or on schedule, without leaving the hub.

**Primary job:** audience bonding. Drops/affiliate codes are present but never the spine.

**Cadence:** biweekly "Lock-In Letter" preset (auto-assembled draft, human-approved before send) + ad-hoc blasts whenever the creator has something to say.

## 2. Information architecture

- Entry: existing **Design Studio** button on the Messages tab routes to `/hub/studio`.
- Studio is chromeless full-page (single "← Hub" link top-left). Leaves the hub's bottom tab bar behind.
- The Messages tab continues to handle operational messaging (broadcast list, sent letters, schedule view).

### Three-pane layout (desktop ≥ 1280px)

```
┌──────────────┬──────────────────────┬──────────────────┐
│ Left rail    │  Current Letter      │  Live Preview    │
│              │                      │                  │
│ Ideas Inbox  │  drag sections in,   │  exact rendered  │
│ Section Lib  │  AI-expand inline,   │  HTML in 600px   │
│ Sub-pages:   │  reorder, edit       │  email frame     │
│  ✉ Letters   │                      │                  │
│  💡 Ideas    │  [▶ Send / Schedule] │  [📱 Mobile view]│
│  🏷 Drops    │                      │                  │
│  ❓ Q&A      │                      │                  │
│  ⚙ Settings  │                      │                  │
└──────────────┴──────────────────────┴──────────────────┘
```

### Mobile (≤ 900px)

- Three panes collapse into a swipe tab bar: **Ideas · Letter · Preview**.
- Capture FAB sticky bottom-right of Ideas pane.
- Section editing is fullscreen with bottom-drawer AI assist.
- Preview renders inside a 375px frame even on phone (so the creator sees what subscribers see).
- Send is sticky bottom of Letter pane, with confirmation drawer.

## 3. Section types (9)

The Studio composer assembles letters out of typed section blocks. All defined in a template-level registry; each client toggles which they use.

| Type | Shape | AI mode |
|---|---|---|
| `devotional` | scripture ref + reflection (~120 words) | partial — AI drafts reflection |
| `realtalk` | topic + body (~250 words) | full — AI expands topic into voice |
| `recipe` | title + ingredients + steps + photo | partial — AI tightens copy |
| `drops` | auto-pulled list from Drops Manager | fully auto — toggle which to include |
| `favorites` | 3-5 items (label, link, optional photo) | partial — AI writes blurbs |
| `qa` | 1-3 (question, answer) pairs from Q&A Inbox | partial — AI helps draft answers |
| `recap` | 2-3 recent IG/TikTok posts | fully auto — opt-in toggle per letter |
| `giveaway` | prize + rules + entry CTA | manual; rate-limited (1 per N letters) |
| `freeletter` | freeform body | wildcard — AI assists from one-line prompt |

**Design principle:** `recap` is *not* auto-included in the Lock-In preset. Bonding-first design. Creator adds it deliberately when there's something genuinely worth recapping.

## 4. Replicability

**Per-client (`lib/client-config.js`):**

```js
voiceGuide: '...',          // already exists
voiceSamples: [...],         // 5-15 of their best captions/past letters (manually seeded; never auto-grown)
studioConfig: {
  sectionTypes: ['devotional','realtalk','recipe','drops','favorites','qa','recap','giveaway','freeletter'],
  lockInPreset: ['devotional','realtalk','recipe','drops','favorites'],
  giveawayCadenceCap: 4,    // max 1 giveaway per 4 letters
  maxDropsPerLetter: 4,
  aiCallsCap: 100,           // null = unlimited (Mandi: null)
  lockInCadenceWeeks: 2,
}
```

**Template-level (lives in canonical hub repo, identical for every client):**
- Studio UI (three panes, drag-drop, preview)
- All section type definitions (render template + AI prompt template) in `lib/studio/section-types.js`
- Drops Manager UI + schema
- Q&A Inbox UI + schema
- Send pipeline (Resend + Beehiiv mirror)
- Redis key shapes (always `<prefix>:studio:...`)

**Anti-pattern:** no Mandi-specific strings ("Lock-In Letter", her brand names, faith phrasing) inside `lib/studio/` or `hub/studio/`. Everything client-varying goes through `CLIENT_BRAND` or `studioConfig`.

## 5. Data model (Redis)

All keys under `<redisPrefix>:studio:` (Mandi: `mandibagley:studio:`).

```
ideas                       LIST   { id, text, type?, createdAt, status }
idea:<id>:expanded          STRING (cached AI-expanded HTML body)

letters                     ZSET   <letterId> scored by createdAt
letter:<id>                 HASH   { name, status, subject, preheader,
                                     createdAt, updatedAt, sentAt?,
                                     scheduleFor?, segment? }
letter:<id>:sections        LIST   ordered section JSON blobs
                                   { id, type, fields, sourceIdeaId? }

drops                       ZSET   <dropId> scored by createdAt (active)
drops:archive               ZSET   expired drops
drop:<id>                   HASH   { brand, code, link, image, description,
                                     expiresAt, status }

qa_inbox                    LIST   { id, question, name?, email,
                                     source, createdAt, status }

ai_calls_today              STRING TTL 24h, increments per AI call
ai_calls_limit_hit          STRING TTL 24h, set when cap reached
```

## 6. AI assistant (touchpoints)

| # | Trigger | Model |
|---|---|---|
| A | "Expand" idea → section | Sonnet, streaming |
| B | "Generate" section from prompt | Sonnet, streaming |
| C | "Polish/rewrite" selected text | Haiku, streaming |
| D | "Suggest a topic" for empty section | Haiku |
| E | "Suggest subject + preheader" | Haiku |
| F | Pre-send sanity check | Sonnet |
| G | Free Letter quick-draft | Sonnet, streaming |

**System prompt assembly (every call):**

```
[CLIENT_BRAND.voiceGuide]
+ [3-5 random samples from voiceSamples]   ← rotation prevents over-fit
+ [SECTION_TYPES[type].aiPrompt]
+ [recent-letter context, if cross-section]
```

**Cross-section awareness:** when generating section N, the system prompt includes ~50-word summaries of sections 1..N-1 (cached on each section's `fields.summary`, regenerated by Haiku on save). Prevents repeated framings across sections.

**Voice samples are manually seeded only.** Never auto-grown from sends. (Per explicit decision, 2026-04-28 — auto-grow felt creepy.)

**Cost guardrails:**
- Per-client cap: `studioConfig.aiCallsCap` (default 100/day, null = unlimited).
- Hard token caps: 800 (full section), 200 (polish), 100 (suggestion).
- Streaming aborts if user navigates away.

## 7. Send pipeline

```
[Studio: Send / Schedule]
  → POST /api/studio/send { letterId, mode, segment? }
  → Load letter + sections
  → Render to final HTML (template iterates sections, calls each SECTION_TYPES.render)
  → Resolve recipients ("all" or segmentId → Redis SET of emails)
  → Resend batch send (8 at a time, paced — same approach as broadcast.js)
  → Beehiiv post (creates web archive page; does NOT send the email)
  → Mark letter status: sent
  → Append to studio:letters sent index
```

- **Resend** does the actual delivery (better fidelity than Beehiiv's editor for custom HTML).
- **Beehiiv** mirrors as a web archive entry only — the creator keeps her existing list-growth tools without losing styling.
- **Scheduled sends** write `scheduleFor` to the letter HASH; existing `publish-scheduled` cron (every 15 min) picks them up.

### Segmentation (v1)

Tag-at-subscribe-time only. Lead capture pages (`/g/:slug`) tag the subscriber on signup → `studio:segments:<segmentId>` SET. Studio's send modal lets the creator pick a segment. No manual segment builder in v1.

## 8. Lock-In Letter biweekly preset

A cron pre-assembles a *draft* letter on a configurable cadence (`studioConfig.lockInCadenceWeeks`, default 2). It never auto-sends.

```
Cron (Sun 6pm, every N weeks): /api/studio/lockin-suggest
  1. Pull fresh ideas (status="raw" | "expanded")
  2. Group by section type
  3. Pull active drops + 1-3 most-recent unanswered Q&A
  4. Assemble a draft following studioConfig.lockInPreset section order
  5. Save as letter status="draft", name="Lock-In Letter — [date]"
  6. Notify creator (hub notification + email)
```

Skip behavior: if she dismisses, next assembly fires on schedule with the same fresh-ideas pool.

## 9. Drops Manager

Sub-page of Studio at `/hub/studio/drops`. Card grid; each card = one drop (brand, code, image, expiry chip, status toggle). Modal for add/edit. Image upload via existing `/api/upload-image` (Vercel Blob). Expired drops move to `studio:drops:archive` for stats.

## 10. Q&A Inbox

Sub-page of Studio at `/hub/studio/qa`. List view of incoming questions. Filter chips: New / Answered / Used in letter. Star to flag for next letter; "Use in letter" opens Studio with that question pre-filled.

**Inbound channel for v1:** public form on creator's main site at `/ask` (route added to creator-template, inherited by every client). Form is honeypotted, rate-limited 1/email/24h. Asking a question soft-subscribes (clearly disclosed).

**v2 channel (deferred):** reply-to-newsletter capture via Resend inbound webhooks.

## 11. v1 scope

**In v1:**
- Studio three-pane app (desktop + mobile)
- Ideas Inbox — text capture only
- All 9 section types with renderers + AI prompts
- AI assistant touchpoints A–G
- Drops Manager
- Q&A Inbox + `/ask` form
- Send pipeline (Resend + Beehiiv mirror)
- Subscribe-time tag segmentation
- Lock-In Letter biweekly draft cron
- Sent Letter archive in Messages tab
- Per-client `studioConfig` schema

**Deferred to v2:**
- Voice memo capture (Whisper)
- Email-in / IG inbound channels for ideas
- Reply-to-newsletter Q&A capture
- Manual segment builder
- A/B subject testing
- Multi-creator collab

**Cut entirely (not even v2):**
- Auto-grow voice samples from best-performing sends — felt creepy, manual seeding only

## 12. Implementation phases

1. **Foundation** — Redis schemas, `studioConfig` field on `CLIENT_BRAND`, section-type registry, Drops Manager (proves the pattern end-to-end before bigger pieces)
2. **Studio composer** — three-pane app, Ideas Inbox, all 9 section types, send pipeline
3. **Intelligence layer** — AI assistant touchpoints, Q&A Inbox + `/ask` form, Lock-In biweekly cron

## 13. Backporting

Build entirely in `~/mandi-bagley/`. After ~1-2 weeks of real-world use, port the Studio surface as a single PR to `~/cassandra-morales/` (canonical) and `~/creator-template/`. Studio code is namespaced (`lib/studio/`, `api/studio/`, `hub/studio/`, `studioConfig`) so the port is mechanical. Cass and Stef get Studio on their next deploy. Future clients inherit it from `node ~/new-client.js`.
