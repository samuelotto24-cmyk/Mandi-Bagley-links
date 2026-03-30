# Hub Visual Overhaul — Design Spec

**Date:** 2026-03-30
**Project:** `/Users/samotto/mandi-bagley`
**Deployed:** mandibagley.com/hub

## Problem

The current hub has 14+ bento cards all competing for attention on a single scrollable page. It's cluttered and hard for a creator (not a power user) to find what matters. The layout pattern (bento grid) is a developer/dashboard pattern — not suited for someone who opens the hub to know what to do today and how things are going.

## Design Direction

**Sidebar navigation + guided Home view with Create Post as the hero element.** Two primary views plus a planner tab. Floating AI chat agent always accessible.

## Architecture: 3 Views + Floating Chat

### Sidebar (persistent, 64px wide)
- Icon-based vertical nav
- Three tabs: Home, Analytics, Planner
- Active state indicator (left bar)
- Logo/avatar at top

### View 1: Home (default)

Layout: 2-column grid, Create Post spans left 60% full height.

**Row 1 — Greeting:**
- "Good morning, Mandi" (Cormorant Garamond)
- Inline summary: new leads count, top platform trend, best time to post

**Row 2 — Primary Grid (2-column):**

Left column (spans 2 rows):
- **Create Post (hero card):**
  - Image upload zone (drag & drop)
  - Caption text area
  - Trending topic tags (Niche Pulse data surfaced here as suggestions — e.g. "morning routines", "faith + fitness")
  - "Generate Caption" button (AI-powered)
  - This is the largest, most prominent element on the page

Right column (stacked):
- **Today's Briefing:**
  - AI-generated daily content strategy text
  - "Trending in [niche]" insight block (Niche Pulse data baked in — trends inform the briefing and show as a callout)
- **Quick Stats:**
  - 2x2 grid: Followers, Engagement, Views (7d), Link Clicks
  - Each with value + weekly change indicator

**Row 3 — Goal Strip:**
- Horizontal bar: label ("Goal: 10K Followers") + progress bar + percentage
- Compact, single-line element

**Row 4 — Bottom Grid (2-column):**
- **Recent Leads:** List of latest leads with name, source, time
- **Brand Codes:** Quick view of affiliate codes with usage counts (MANDI15 / DFYNE — 47 uses, etc.)

### View 2: Analytics

Dedicated social platform deep-dive:
- TikTok, Instagram, YouTube sections (existing API integrations)
- Brand code performance detail (moved from Home — Home only shows summary)
- Charts, engagement breakdowns, follower growth
- This absorbs the current social analytics cards + brand code tracker

### View 3: Planner

Weekly content calendar:
- 7-day grid view
- Ability to add notes per day (what to post, when)
- Existing planner functionality preserved — people already use this as a standalone tool
- Potential: briefing suggestions pre-populated on empty days

### Floating Chat Agent

- Fixed FAB button (bottom-right corner)
- Opens a chat overlay/drawer on click
- AI advisor — always accessible from any view
- Not a sidebar tab; it floats on top of everything

## What Gets Cut / Reorganized

| Feature | Current State | New State |
|---------|--------------|-----------|
| Create Post | One bento card among many | Hero element, 60% of Home |
| Briefing | One bento card | Right column on Home, includes trend data |
| Stats tiles | 4 tiles in bento grid | 2x2 grid in right column on Home |
| Social Analytics | Bento cards | Own "Analytics" view |
| Leads | Bento card | Bottom row on Home |
| Goal tracking | Bento card | Compact progress strip on Home |
| Brand codes | Bento card | Summary on Home, detail in Analytics |
| Weekly Planner | Bento card | Own "Planner" view |
| Niche Pulse | Standalone card | Dissolved into Briefing + Create Post trending tags |
| Chat advisor | Bento card | Floating FAB, always accessible |
| Automations | Bento card | Cut from initial overhaul (re-evaluate later) |

## Visual Language

Preserved from current design:
- Dark theme: `#0A0A0A` background, `#111` surface
- Cormorant Garamond for display headings
- DM Sans for body/UI text
- Monochrome palette with white accents
- Subtle borders (`rgba(255,255,255,0.06)`)
- Smooth transitions and hover states

Changes:
- No more animated gradient mesh / aurora blobs (reduces visual noise)
- Cards get more breathing room (fewer, larger)
- Cleaner hierarchy: one hero element instead of a grid of equals
- Section labels (uppercase, spaced) for scannable structure

## Tech Approach

The hub is currently a single `hub/index.html` file (~3,400 lines) with inline CSS, inline JS, and Vercel serverless API routes. The overhaul restructures the HTML/CSS/JS within this same architecture — no framework migration.

Key changes:
- Replace bento grid CSS with sidebar + view-based layout
- Add view switching logic (show/hide sections based on active sidebar tab)
- Restructure card HTML into the new layout hierarchy
- Preserve all existing API integrations and data fetching
- Preserve PWA configuration
- Preserve CLIENT config object and theme engine

## Out of Scope

- Framework migration (staying vanilla HTML/CSS/JS)
- New API endpoints
- New features not already built
- Mobile-specific redesign (responsive will follow naturally from the new layout, but no mobile-first rethink)
- Automations card (cut for now — can be added to a future view if needed)
