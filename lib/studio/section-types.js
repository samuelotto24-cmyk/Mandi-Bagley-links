// Section type registry — TEMPLATE LEVEL (identical for every client).
//
// Each section type defines:
//   - id         : stable identifier used in studioConfig.sectionTypes
//   - label      : human-readable name shown in the section library
//   - emoji      : tiny visual cue in the section picker
//   - kind       : 'editorial' | 'structured' | 'auto'
//                   editorial  → freeform body, AI-expandable
//                   structured → fields the user fills in
//                   auto       → data pulled from another store (drops, recap, qa)
//   - fields     : field schema for structured/editorial sections
//   - aiPrompt   : section-specific system-prompt fragment (used in Phase 3)
//   - render     : (placeholder for Phase 2 — section→HTML renderer)
//
// Per-client opt-in is via CLIENT_BRAND.studioConfig.sectionTypes.
// No Mandi-specific strings live in this file — anything client-varying
// is read from CLIENT_BRAND or studioConfig at runtime.

export const SECTION_TYPES = {
  devotional: {
    id: 'devotional',
    label: 'Devotional',
    emoji: '📖',
    kind: 'editorial',
    fields: [
      { key: 'scripture',   label: 'Scripture reference', placeholder: 'Philippians 4:13' },
      { key: 'verseText',   label: 'Verse text',          multiline: true, placeholder: 'I can do all things through Christ who strengthens me.' },
      { key: 'reflection',  label: 'Reflection',          multiline: true, aiExpandable: true },
    ],
    aiPrompt: `Write a short devotional reflection (~120 words). Tie the scripture to a real moment from this week, never preachy. Open with the moment, land on the verse. Match the creator's voice exactly.`,
  },

  realtalk: {
    id: 'realtalk',
    label: 'Real Talk',
    emoji: '💬',
    kind: 'editorial',
    fields: [
      { key: 'topic',  label: 'Topic',  placeholder: 'discipline vs motivation' },
      { key: 'body',   label: 'Body',   multiline: true, aiExpandable: true },
    ],
    aiPrompt: `Write a Real Talk section (~250 words). Honest, specific, lived-in. No platitudes. Open with a concrete moment or observation. Avoid bullet points; this is a letter, not a listicle. Match the creator's voice exactly.`,
  },

  recipe: {
    id: 'recipe',
    label: 'Recipe',
    emoji: '🍽️',
    kind: 'structured',
    fields: [
      { key: 'title',        label: 'Recipe title',     placeholder: 'Browned-butter banana muffins' },
      { key: 'photo',        label: 'Photo',            type: 'image' },
      { key: 'intro',        label: 'One-line intro',   placeholder: 'Sunday-morning energy.' },
      { key: 'ingredients',  label: 'Ingredients',      multiline: true, placeholder: 'one per line' },
      { key: 'steps',        label: 'Steps',            multiline: true, placeholder: 'one per line' },
    ],
    aiPrompt: `Tighten the recipe copy. Keep the creator's voice. Don't add ingredients or steps that weren't there. Trim filler.`,
  },

  drops: {
    id: 'drops',
    label: 'Drops',
    emoji: '🏷️',
    kind: 'auto',
    dataSource: 'drops',
    fields: [
      { key: 'intro', label: 'Intro line (optional)', placeholder: 'A few things dropping this week:' },
      { key: 'selectedDropIds', label: '(internal — drop IDs included)', hidden: true },
    ],
    aiPrompt: null, // drops content is structured, not generated
  },

  favorites: {
    id: 'favorites',
    label: 'Favorites',
    emoji: '⭐',
    kind: 'structured',
    fields: [
      { key: 'intro', label: 'Intro (optional)', placeholder: 'Things I keep reaching for:' },
      { key: 'items', label: 'Favorites list', type: 'list', itemFields: [
        { key: 'label', label: 'Label',      placeholder: 'Foam roller' },
        { key: 'link',  label: 'Link',       placeholder: 'https://…' },
        { key: 'photo', label: 'Photo',      type: 'image' },
        { key: 'note',  label: 'Why',        multiline: true, aiExpandable: true },
      ]},
    ],
    aiPrompt: `Write short, honest "why I love this" blurbs (1-2 sentences each). No marketing language; sound like a friend recommending something. Match the creator's voice exactly.`,
  },

  qa: {
    id: 'qa',
    label: 'Q&A',
    emoji: '❓',
    kind: 'structured',
    dataSource: 'qa_inbox',
    fields: [
      { key: 'intro', label: 'Intro (optional)', placeholder: 'You asked. I answered.' },
      { key: 'pairs', label: 'Q&A pairs', type: 'list', itemFields: [
        { key: 'question',     label: 'Question',     multiline: true },
        { key: 'askerLabel',   label: 'Asker (e.g. "Jess from TX")', placeholder: 'first name + state, optional' },
        { key: 'answer',       label: 'Answer',       multiline: true, aiExpandable: true },
      ]},
    ],
    aiPrompt: `Answer the question in the creator's voice. Be specific, not generic. If the answer needs a caveat (talk to a doctor, etc.) include it briefly. Avoid lists — answer like a friend texting back.`,
  },

  recap: {
    id: 'recap',
    label: 'Content Recap',
    emoji: '📱',
    kind: 'auto',
    dataSource: 'social_recent',
    fields: [
      { key: 'intro', label: 'Intro line', placeholder: 'In case you missed it:' },
      { key: 'postIds', label: '(internal — post IDs included)', hidden: true },
    ],
    aiPrompt: null,
  },

  giveaway: {
    id: 'giveaway',
    label: 'Giveaway',
    emoji: '🎁',
    kind: 'structured',
    rateLimit: 'giveawayCadenceCap',
    fields: [
      { key: 'prize',     label: 'Prize',          placeholder: 'A box of my favorite supplements' },
      { key: 'rules',     label: 'How to enter',   multiline: true },
      { key: 'deadline',  label: 'Entry deadline', placeholder: 'this Sunday at midnight CT' },
      { key: 'cta',       label: 'CTA text',       placeholder: 'Reply with the word "yes"' },
    ],
    aiPrompt: null,
  },

  freeletter: {
    id: 'freeletter',
    label: 'Free Letter',
    emoji: '✍️',
    kind: 'editorial',
    fields: [
      { key: 'body', label: 'Body', multiline: true, aiExpandable: true },
    ],
    aiPrompt: `Write a short letter section (~200 words) in the creator's voice. Take the prompt as a starting point and run with it. No headers; flowing prose.`,
  },
};

// Resolve the section types this client has enabled. Returns array of full
// section type defs in the order specified by studioConfig.sectionTypes.
export function getEnabledSectionTypes(studioConfig) {
  const ids = (studioConfig && studioConfig.sectionTypes) || [];
  return ids.map(id => SECTION_TYPES[id]).filter(Boolean);
}

// Stable ID validator for any id passed in via API.
export function isValidSectionTypeId(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(SECTION_TYPES, id);
}
