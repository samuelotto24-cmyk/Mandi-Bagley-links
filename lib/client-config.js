// Single source of truth for brand identity.
// Mandi Bagley — Fitness · Faith · Food.
// Cream + black + green accent — matches her public site and hub palette.

export const CLIENT_BRAND = {
  // ── Identity ─────────────────────────────────────────────
  name:             'Mandi Bagley',
  role:             'Fitness · Faith · Food',
  domain:           'mandibagley.com',
  siteUrl:          'https://mandibagley.com',
  applyUrl:         'https://mandibagley.com#programs',
  unsubscribeUrl:   'https://mandibagley.com/unsubscribe',

  // ── Cookbook waitlist + monthly notes (no separate lead-magnet PDF) ──
  // Email links can still reference "the cookbook" once it's live.
  leadMagnetPath:   '#newsletter',
  leadMagnetTitle:  'The Cookbook',

  // ── Redis namespace ──────────────────────────────────────
  // All keys get prefixed. Set REDIS_PREFIX env var to override (already set in Vercel).
  redisPrefix:      process.env.REDIS_PREFIX || 'mandibagley:',

  // ── Email palette — Cream Salon with Mandi's signature green accent ──
  bg:               '#FAF8F5',  // warm cream
  surface:          '#FFFFFF',
  surfaceAlt:       '#F3F0EC',
  border:           '#E5DFD3',
  borderSoft:       '#EFE9DC',
  text:             '#000000',  // pure black, like her hub
  textSoft:         '#3A3631',
  muted:            '#8A857B',
  accent:           '#10B981',  // her public-site green

  // CTA primary (filled button) — black with cream text, mirrors hub buttons
  ctaBg:            '#000000',
  ctaFg:            '#FAF8F5',

  // ── Typography ───────────────────────────────────────────
  // Cormorant Garamond — matches her hub display font
  displayFont:      "'Cormorant Garamond', Georgia, serif",
  bodyFont:         "'DM Sans', 'Helvetica Neue', Arial, sans-serif",

  // ── Voice guide — used by AI writing assistant + Design with Claude ──
  voiceGuide: `Mandi Bagley is a fitness creator + coach in the Fitness · Faith · Food space.
A working cookbook is in progress; her programs are Reset & Rebuild and Lock In & Level Up.
Her voice rules:
- Warm, real, community-minded. Sounds like a thoughtful friend, not a brand.
- Faith woven in naturally — never preachy. Never quotes scripture out of nowhere.
- Real life over performative — recipes her family actually eats, workouts she actually does.
- Encouraging without empty hype. "You showed up" beats "You crushed it."
- Genuine excitement when something's launching. Doesn't fake urgency.
- Plain text only — no markdown. <em> and <strong> are fine inline.
- Sign off with first name only.
- No emojis unless she's already using one.`,

  // ── Voice samples — used as few-shot examples in AI generation ────────
  // 5-15 of her best captions / past newsletter sections. Manually seeded
  // only — never auto-grown from sends. Sam: as Mandi sends real letters
  // and the best ones land, copy them in here verbatim.
  //
  // The first three below come from her tuned welcome-email copy, which
  // she signed off on. They're real Mandi-voice in the register we want
  // the AI to mimic. Add more from her IG captions when convenient.
  voiceSamples: [
    "It's the same 7-day glute and core primer I run my 1:1 coaching clients on for their first week. Save it, print it, take it to the gym, and use it honestly for one week.",
    "If you can do these seven days exactly as written, you're ready for what comes next.",
    "If after the 7 days you're ready to go further, apply for 1:1 coaching. I read every application personally.",
  ],

  // ── Studio config — Letter Studio per-client knobs ───────────────────
  studioConfig: {
    sectionTypes: ['devotional','realtalk','recipe','drops','favorites','qa','recap','giveaway','freeletter'],
    lockInPreset: ['devotional','realtalk','recipe','drops','favorites'],
    lockInLetterName: 'Lock-In Letter',
    lockInCadenceWeeks: 2,
    giveawayCadenceCap: 4,
    maxDropsPerLetter: 4,
    aiCallsCap: null, // null = unlimited (Mandi); default for new clients is 100

    // Brand templates that appear as one-click prefills on the Drops Manager
    // empty state. Saves the creator from a blank page on first run.
    brandTemplates: [
      { brand: 'Gymshark', placeholder: 'GYMSHARK20' },
      { brand: 'Dfyne',    placeholder: 'MANDI20' },
      { brand: 'Ghost',    placeholder: 'MANDI' },
      { brand: 'Teveo',    placeholder: 'MANDI20' },
    ],
  },
};
