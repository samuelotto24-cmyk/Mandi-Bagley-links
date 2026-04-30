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
  accent:           '#DC2626',  // her public-site green

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
- Plain text only — no markdown, no HTML tags (no <em>, no <strong>, no <p>). Just clean prose.
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

    // Preset starter prompts that appear in the Studio's "+ Preset" insert
    // menu. AI uses each prompt to draft a section in this creator's voice.
    // Per-client because a fitness creator's prompts ≠ a coach's prompts ≠ a
    // food creator's prompts.
    presetIdeas: [
      { type: 'realtalk',   label: 'Discipline vs motivation', prompt: 'Why discipline beats motivation, with a Tuesday-morning example.' },
      { type: 'realtalk',   label: 'Body image — the honest version', prompt: 'How my relationship with my body has evolved over the last year.' },
      { type: 'devotional', label: 'A scripture I keep coming back to', prompt: 'A short reflection tied to a verse I lean on right now.' },
      { type: 'recipe',     label: 'A weeknight family dinner', prompt: 'A simple, high-protein dinner the kids actually eat.' },
      { type: 'favorites',  label: '5 things I am reaching for', prompt: 'Five things — gear, food, books, anything — I am loving this month.' },
      { type: 'freeletter', label: 'A note from this week', prompt: 'A real moment from this week and what it taught me.' },
      { type: 'realtalk',   label: 'Showing up when you do not feel ready', prompt: 'Why ready is a feeling that rarely shows up on time.' },
      { type: 'devotional', label: 'A waiting season', prompt: 'A reflection on faith during a season where nothing seems to move.' },
    ],
  },

  // ── Color scheme — controls the email's `color-scheme` meta tag ──
  // 'light' for cream/white-bg brands (Mandi). 'dark' for espresso-bg brands
  // (Cass). Email clients respect this and stop trying to invert.
  colorScheme: 'light',
};
