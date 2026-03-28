# Pricing, Packaging & Referral Strategy

> Design spec for Sam's creator platform business — pricing tiers, referral program, and sales positioning.

---

## Target Market

- **Primary:** Established creators (100K+ followers, treat brand as a business)
- **Secondary:** Mid-tier creators (10K–100K, making real money from brand deals/affiliates)
- **Cost structure:** Labor-dominant with manageable per-client hosting/API costs
- **Delivery speed:** Full platform live in 72 hours

---

## Package Tiers

Two tiers. Lead with the flagship everywhere.

### Full Platform — "The whole system"

- **Setup:** $1,500–$2,000 (one-time)
- **Monthly:** $150/mo
- **Includes:**
  - Custom branded website with domain
  - Affiliate codes (tap-to-copy) and social links
  - Analytics dashboard (traffic trends, conversions, link clicks, geography, referrer sources)
  - The Hub (personal command center — stats, briefing, AI advisor, branded dark aesthetic)
  - AI Strategist (Claude-powered weekly briefings + real-time strategy chat fed by actual analytics data)
  - Same-day updates, maintenance, priority support

### Brand Site — "Start here"

- **Setup:** $400–$500 (one-time)
- **Monthly:** $49/mo
- **Includes:**
  - Custom branded website with domain
  - Affiliate codes (tap-to-copy) and social links
  - Maintenance and same-day updates

### Upgrade Path

Brand Site clients can upgrade to Full Platform at any time:

- Pay the difference in setup fees (~$1,000–$1,500)
- Monthly jumps from $49 to $150
- No rebuild — analytics pipeline, Hub, and AI layer are added on top of the existing site

---

## Referral Program — "Share the Platform"

Peer-to-peer: creators referring other creators.

### For the Referrer

- **1 free month of their retainer** per referred client who signs any tier
  - Full Platform client refers someone: $150 month free
  - Brand Site client refers someone: $49 month free
- **Months stack** — 3 referrals = 3 free months
- Talking point: "I haven't paid for my platform in months because I keep telling people about it"

### For the Referred

- **$100 off setup fee** on any tier
- Makes it two-sided so creators don't feel weird pitching friends
- "Hey, I can get you $100 off — just tell him I sent you"

### Tracking (Phase 1)

- Simple: referred client mentions who sent them or uses a referral name/code
- No complex tracking system needed at current scale
- Formalize with automated tracking if volume warrants it later

---

## Sales & Positioning Strategy

### Sales Flow

1. Creator sees portfolio or gets a referral from another creator
2. Portfolio has a clear "Book a Call" CTA — links to scheduling tool (Calendly/Cal.com)
3. Sam closes on the call (strong closer — the call is the conversion engine)
4. After the call or in DMs: send the private packages page URL as follow-up
5. If they hesitate on price: "Start with the Brand Site, upgrade anytime — your site carries over"
6. If they sign Full Platform: deliver in 72 hours, the Hub wows them, they tell their friends

### Pricing is NOT public

- No pricing on the portfolio — keeps it premium, drives calls
- Pricing lives on a **private packages page** (e.g., `yoursite.com/packages`) — a branded, mobile-friendly page Sam can share via DM or after a call
- Not indexed, not linked from the portfolio — just a URL to send when the moment is right

### Private Packages Page — Contents

- Two tiers side by side with what's included
- Screen recording or live demo of the Hub (best selling point)
- The referral offer ("Know a creator? Get them $100 off, get a free month")
- "Book a Call" CTA
- Key one-liners from the sales language below
- Reuses portfolio assets (screen recordings, brand aesthetic, copy)

### Key Selling Language

- **Against Linktree/Beacons:** "They give you links. I give you a strategist."
- **The hook:** "Your brand doesn't fit a template. Your platform shouldn't either."
- **The closer:** "Live in 72 hours. $100 off if someone sent you."
- **The elevator pitch:** "Most creators have a Linktree, a Google Analytics they never check, and no idea what's actually converting. I replace all of that with one platform — a branded website, a private analytics dashboard, and an AI advisor that reads their real traffic data and gives them specific strategy. Built from scratch, live in 72 hours."

---

## Revenue Projections (Illustrative)

| Scenario | Setup Revenue | Monthly MRR |
|----------|--------------|-------------|
| 5 Full Platform clients | $7,500–$10,000 | $750/mo |
| 10 Full Platform clients | $15,000–$20,000 | $1,500/mo |
| 10 Full + 5 Brand Site | $17,000–$22,500 | $1,745/mo |
| 20 Full Platform clients | $30,000–$40,000 | $3,000/mo |

---

## Build Plan (Two Deliverables)

### Deliverable 1: Hub Referral Section

Add a referral section to the existing Hub (`/hub`) for current clients:

- Referral code or shareable link unique to the client
- Count of successful referrals
- Free months earned / applied
- Clear CTA: "Refer a creator — get a free month"
- Fits the existing Hub dark aesthetic (cosmic/aurora gradient, rose accents)

### Deliverable 2: Private Packages Page

A standalone branded page (not linked from portfolio) for sales follow-up:

- URL: private, shareable (e.g., `yoursite.com/packages`)
- Two tiers side by side
- Hub demo / screen recording embed
- Referral offer callout
- "Book a Call" CTA
- Mobile-first (creators live on their phones)
- Same brand aesthetic as the portfolio

### Build Order

1. Hub referral section first (existing clients start referring immediately)
2. Private packages page second (sales follow-up tool)

---

## Future Considerations (Out of Scope)

- Newsletter integration add-on (pricing TBD)
- Automated referral tracking system (when volume warrants)
- Agency/manager referral partnerships
- Annual pricing discounts
