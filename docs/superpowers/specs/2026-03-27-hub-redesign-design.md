# Hub Redesign — Mandi Bagley Command Center

**Date:** 2026-03-27
**Project:** mandibagley.com/hub
**Status:** Design approved, ready for implementation planning

---

## Overview

Complete redesign of Mandi Bagley's private hub from a generic creator dashboard template into a branded personal command center. The hub shifts from passive reporting ("here's what happened") to active coaching ("here's what to do today").

**Core value proposition:** The hub justifies a monthly upkeep fee by being a personal brand strategist — not just analytics, but actionable daily guidance, content planning, trend intelligence, and a smart AI advisor.

**Reference mockup:** `.superpowers/brainstorm/5592-1774653264/content/dark-gradient-v6.html`

---

## Visual Identity

### Dark gradient aesthetic
- **Background:** Near-black (#0C0809) with animated neon pink gradient
- **Gradient layers:**
  - Primary mesh: 5 radial gradients, blurred 80px, drifting on a 20s animation loop (translate + rotate + scale)
  - Secondary mesh: 3 radial gradients, blurred 100px, independent 28s loop for depth
  - Pulse layer: Centered radial gradient that breathes (opacity 0.4→1.0) on a 6s cycle
- **Floating particles:** 60 canvas-drawn particles drifting upward with:
  - Mixed colors: neon pink (40%), rose (30%), soft pink (15%), warm white (15%)
  - Gentle sine-wave wobble, variable speeds
  - Glow halos on particles > 1.5px radius
  - Faint connection lines between particles within 100px
  - Mouse repulsion (120px radius, 0.5 force)
- **Cards:** Solid opaque (#141012) — NO backdrop-filter, NO gradient bleed-through. The gradient shows between and around cards.
- **Borders:** rgba(255,255,255,0.07) default, rgba(232,82,122,0.25) on hover
- **Text:** #F5EBE6 primary, rgba(245,235,230,0.45) muted
- **Accent:** #E8527A (rose), #FF2D78 (neon glow)

### Typography
- **Display/headers:** Cormorant Garamond, weight 300-400, same as main site
- **Body/UI:** DM Sans, same as main site
- **Section labels:** DM Sans 10.5px, weight 600, letter-spacing 0.2em, uppercase, rose color (matching main site's section label pattern)

### Animations
- Scroll-triggered `fade-up` reveals via IntersectionObserver (matching main site)
- Staggered delays for sibling groups
- Entrance animations on cards
- All status dots have glow box-shadows

---

## Layout

### Structure
Single-column editorial scroll (desktop-first, responsive to mobile). Max-width 960px, centered.

### Responsive behavior
- **Desktop (960px+):** Full layout as designed — paired sections side by side, 4-col stats, 7-col calendar
- **Tablet (640-960px):** Paired sections stack, stats go 2x2, calendar scrolls horizontally
- **Mobile (<640px):** Everything single column, stats 2x2, calendar horizontal scroll, chat input sticky at bottom when chat is in view

---

## Sections (scroll order)

### 1. Greeting header
- Top bar label: `mandibagley.com / backstage` (small uppercase, "backstage" in rose)
- Center: "Hey, Mandi" in Cormorant 56px
- Below: "March 27, 2026 · Your Command Center"
- **Flanking nav links:** "View My Site" (left) and "Full Analytics" (right) — pill-shaped buttons with icons, hover glow, and arrows. Prominent and obvious.

### 2. Health status bar
- Centered pill: green/amber/red dot + text summary
- Logic: 3+ warnings = red, 1-2 = amber, 0 = green

### 3. Quick stats + Goal tracker (side by side)
**Stats grid (left, 4 columns):**
- Today's views, This Week (with trend badge), This Month, Top Source
- Each in a solid card tile

**Goal tracker (right, 280px):**
- Header: "MONTHLY GOAL" label + "Edit ›" button
- Current vs target: "842 / 1,500 views"
- Progress bar: rose-to-neon gradient fill with glow
- Pace text: "You need 165/day to hit your goal. Currently averaging 31/day"
- Goal target stored in Redis (key: `stats:goal` or similar), editable via a simple modal
- **Empty state:** "Set a monthly goal to track your progress" with a "Set Goal" button

### 4. Game Plan (actionable briefing)
**Left column — "What happened":**
- Narrative summary from briefing API (deterministic, data-backed)
- Metric pills below (this week count, week-over-week %, avg session)

**Right column — "Do this today":**
- 3 prioritized action items, each with:
  - Priority dot (red/amber/green with glow)
  - Bold action statement + data-backed reasoning + specific suggestion (caption ideas, timing, etc.)
  - Priority tag: NOW / TODAY / THIS WEEK
- Action items are AI-generated from the briefing data + rules engine flags
- The AI prompt instructs: give specific actions, reference real numbers, include caption/content ideas, never suggest website layout changes

**Bottom:** Flag pills (same as current briefing)

**Refresh button** in header (spins while loading)
**Notification badge** showing warning count

### 5. Content calendar (compact strip)
- 7-day horizontal grid (Mon–Sun)
- Each day shows: day name, date number, content type badge (Reel/Story/Pin/Post/Rest), optimal time, one-line concept
- Today highlighted with rose border + glow
- Content type color coding: Reel=purple, Story=blue, Post=rose, Pin=red, Rest=muted
- **Phase 1:** AI-generated from briefing API — calendar data included in the briefing response. The AI considers peak hours, trending content types, and data flags to suggest the week's plan.
- **Phase 2:** Clickable days that expand to show full caption + hashtag suggestions

### 6. Top Links + Brand Codes (paired row)
**Top Links (left):**
- Ranked list of clicked links with counts in rose
- 0-click links shown at reduced opacity with amber count
- Data source: existing `stats:clicks` Redis hash

**Brand Codes (right):**
- Each row: brand name, code text (muted), usage count in a rose pill
- 0-use codes shown with amber pill
- Data source: derived from `stats:clicks` — links that match known brand code patterns
- **Phase 2:** Click-to-copy on code text (matching main site pattern)

### 7. Niche Pulse
- Section label: "Niche Pulse · Fitness Creators This Week"
- 3 insight cards, each with: emoji icon, bold trend headline, context paragraph, metadata line, CTA button
- CTA buttons ("Ask advisor for a content angle →") scroll to chat and pre-fill the input
- **Phase 1:** AI-generated from the briefing API. The prompt includes instructions to generate 2-3 niche-relevant trend observations based on general fitness/food creator knowledge and the client's data patterns. The AI uses its training data to reference plausible trends — not scraped or real-time data.
- **Phase 2:** Integration with real trend data sources (social media APIs, trend aggregators) for verified, real-time niche intelligence

### 8. AI Advisor Chat (standout section)
**Visual treatment (stands out from all other sections):**
- Animated glowing pink border (gradient shifts along edge, 4s cycle)
- Radial glow halo behind the card (pulses, 4s cycle)
- Animated accent line at top (gradient shifts, 3s cycle)
- Icon badge with rose glow
- "LIVE" indicator with pulsing pink dot

**Smart chat behavior:**
- Opens with a **proactive insight** instead of a generic greeting
- Proactive insights are triggered by rules:
  - Link with 0 clicks for 7+ days
  - Traffic drop >20% week-over-week
  - New referrer source detected
  - Goal pace significantly behind
  - Brand code usage spike
- Each proactive message includes **action buttons** (e.g., "Suggest a replacement" / "Remove it" / "Ignore")
- Suggested prompts are actionable: "Write me a caption for today", "What should I post this weekend?", "Draft a pitch to a brand", "How do I grow faster?"

**Chat system prompt enhancements:**
- The advisor knows about the content calendar, goal progress, and niche trends (all injected into the system prompt)
- It proactively suggests actions, not just answers questions
- It can draft captions, pitch emails, content ideas
- It references specific data: "your DFYNE code has 48 clicks, post about it at 3 PM when your audience peaks"
- CRITICAL RULE maintained: never suggest website layout changes

**Technical:** Streaming responses (already implemented), markdown rendering (already implemented), timestamps (already implemented)

### 9. Floating action bar (always visible)
- Fixed to bottom center of screen, z-index 100
- Frosted dark pill with backdrop-filter blur
- Two buttons: "Message Sam" (primary/rose) and "Request Update"
- Shadow + subtle rose glow
- Triggers the existing contact modal

---

## Login Screen

Redesigned to match the dark gradient aesthetic:
- Same animated gradient background + particles
- Centered card: solid #141012, rounded corners
- Cormorant title (client name), rose accent ornament
- "Creator Hub" subtitle in small uppercase
- Password input: dark surface background, rose focus border
- Rose gradient submit button with glow
- Error state in red

---

## Loading & Empty States

### Loading skeletons
All data sections show shimmer skeletons while loading:
- Stats: 4 skeleton tiles (shimmer rectangle for value, shorter for label)
- Goal: skeleton bar + text lines
- Briefing: skeleton header + two-column skeleton text blocks + skeleton pills
- Calendar: 7 skeleton day tiles
- Top links / Brand codes: skeleton list items
- Niche pulse: skeleton cards
- Chat: skeleton bubble

Skeleton animation: `linear-gradient(90deg, #141012 25%, #1A1416 50%, #141012 75%)` sliding, 1.6s cycle

### Empty states (first-time / no data)
- **Stats:** "No traffic data yet — check back once your site is live"
- **Goal:** "Set a monthly goal to track your progress" + "Set Goal" button
- **Briefing:** "Welcome to your command center! Once traffic starts flowing, you'll see your game plan here."
- **Calendar:** Still shows the 7-day grid but with "—" content and "Set up" links
- **Top links:** "Link click tracking will appear as visitors interact with your page"
- **Niche pulse:** "Trend insights will generate once we have a week of data"
- **Chat:** Standard greeting (no proactive insight if no data to analyze)

---

## API Changes

### `/api/briefing` — Expanded response
Add to the existing response:
```json
{
  "weekRange": "Mar 21–27",
  "summary": "...",
  "advice": "...",         // REMOVED — replaced by actionItems
  "actionItems": [
    {
      "priority": "high",
      "action": "Post a DFYNE try-on reel at 3 PM",
      "reason": "Your code has 48 clicks and peak traffic is 2–5 PM",
      "suggestion": "Caption idea: \"my everyday gym fit 🤍 code MANDI15 for 15% off\"",
      "timeframe": "now"
    }
  ],
  "calendar": [
    {
      "day": "Mon",
      "date": "2026-03-24",
      "type": "reel",
      "time": "3 PM",
      "idea": "DFYNE try-on"
    }
  ],
  "nichePulse": [
    {
      "icon": "📈",
      "headline": "\"Protein ice cream\" reels averaging 45K views",
      "context": "Up 200% from last month among fitness creators",
      "meta": "Trending on Instagram Reels · Your audience overlaps 72%",
      "chatPrompt": "Give me a content angle for protein ice cream that ties into my brand"
    }
  ],
  "proactiveInsight": {
    "message": "Your Gymshark link has had 0 clicks for 14 days...",
    "actions": ["Suggest a replacement", "Remove it", "Ignore for now"]
  },
  "generatedAt": "...",
  "metrics": { ... },      // existing, plus todayViews
  "flags": [ ... ]          // existing
}
```

The LLM prompt for generating `actionItems`, `calendar`, and `nichePulse` will include:
- All existing analytics data (pageviews, clicks, referrers, hourly, etc.)
- The data flags from the rules engine
- The client's niche (fitness/faith/food)
- Instructions to be specific, actionable, and data-referenced
- Instructions to generate a 7-day content calendar based on peak hours and content type variety
- Instructions to generate 2-3 niche trend observations

### `/api/chat` — Enhanced system prompt
Add to the existing chat system prompt context:
- Current week's action items
- Content calendar for the week
- Niche pulse insights
- Goal progress (current vs target, pace)
- Proactive insight triggers

This gives the advisor full context about what was already recommended, so it doesn't repeat the briefing but can elaborate on any item.

### Goal persistence
- Store in Redis: `stats:goal:target` (number), `stats:goal:type` (string, e.g., "views")
- New endpoint or parameter on existing endpoint to set/update the goal
- Read on briefing load, calculate pace from current month data

---

## Phase Plan

### Phase 1 — Visual redesign + layout restructure
- Dark gradient background with particles
- New login screen
- Greeting with flanking nav links
- Stats + goal tracker
- Actionable briefing (game plan with action items)
- Content calendar strip
- Top links + brand codes (paired)
- Niche pulse (AI-generated from briefing prompt)
- Smart chat with proactive insights
- Floating action bar
- Loading skeletons + empty states
- Scroll animations
- Responsive (desktop-first, graceful mobile)

### Phase 2 — Enhanced intelligence (future)
- Clickable calendar days with full caption/hashtag expansion
- Click-to-copy on brand codes
- Real trend data sources for niche pulse (social APIs)
- Revenue estimation from brand code clicks
- Monthly recap PDF generation for brand partners
- Weekly email newsletter to clients (auto-generated from briefing data)
- Goal history / progress over time chart

---

## Technical Notes

- This is a vanilla HTML/CSS/JS project (not React/Next.js). All changes are to `hub/index.html` and API files in `api/`.
- The hub is password-protected (existing system, no changes needed)
- All data comes from Upstash Redis via existing pipeline pattern
- AI features use Claude Haiku via Anthropic API (existing pattern)
- Chat streaming is already implemented
- The generic auto-theme system (CLIENT config, THEMES, FONT_MAP) will be removed — the hub becomes Mandi-specific with hardcoded styles
- `.superpowers/` should be added to `.gitignore`
