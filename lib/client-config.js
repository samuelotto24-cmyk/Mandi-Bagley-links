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
};
