// Per-client runtime brand overrides — Redis-backed, merges over client-config.js.
// Replicable across clients: every site that imports CLIENT_BRAND gets a Design
// Studio "for free" — the only thing that's per-client is which preset is the
// default and what swatches show in the picker.

import { CLIENT_BRAND } from './client-config.js';
import { THEME_PRESETS, DISPLAY_FONTS, BODY_FONTS } from './brand-presets.js';

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY         = CLIENT_BRAND.redisPrefix + 'brand:overrides';

async function redis(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) return [];
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

// Merge override on top of CLIENT_BRAND. Returns the full effective brand
// object templates use at render time. Order:
// 1. CLIENT_BRAND defaults
// 2. Preset palette (if presetId)
// 3. customPalette individual hex overrides
// 4. displayFont / bodyFont selections
// 5. voiceGuide override
// 6. headlineSize override
export function applyOverrides(over) {
  if (!over) return { ...CLIENT_BRAND };
  const out = { ...CLIENT_BRAND };
  if (over.presetId && THEME_PRESETS[over.presetId]) {
    Object.assign(out, THEME_PRESETS[over.presetId].palette);
  }
  if (over.customPalette && typeof over.customPalette === 'object') {
    for (const [k, v] of Object.entries(over.customPalette)) {
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) {
        out[k] = v;
      }
    }
  }
  if (over.displayFontId && DISPLAY_FONTS[over.displayFontId]) {
    out.displayFont = DISPLAY_FONTS[over.displayFontId].family;
  }
  if (over.bodyFontId && BODY_FONTS[over.bodyFontId]) {
    out.bodyFont = BODY_FONTS[over.bodyFontId].family;
  }
  if (over.voiceGuide && typeof over.voiceGuide === 'string' && over.voiceGuide.trim()) {
    out.voiceGuide = over.voiceGuide;
  }
  if (typeof over.headlineSize === 'number' && over.headlineSize >= 24 && over.headlineSize <= 80) {
    out.headlineSize = over.headlineSize;
  }
  if (typeof over.hideWebsiteLink === 'boolean') {
    out.hideWebsiteLink = over.hideWebsiteLink;
  }
  return out;
}

// Fetch the current effective brand (merged) — used by senders.
export async function getBrand() {
  const over = await getOverrides();
  return applyOverrides(over);
}

// Fetch raw override state (or null) — used by the Design Studio UI.
export async function getOverrides() {
  if (!REDIS_URL) return null;
  try {
    const r = await redis([['GET', KEY]]);
    return r?.[0]?.result ? JSON.parse(r[0].result) : null;
  } catch { return null; }
}

export async function saveOverrides(over) {
  if (!REDIS_URL) throw new Error('no_redis');
  // Read existing overrides so partial updates don't blow away other fields
  const current = (await getOverrides()) || {};

  // Clean per-token customPalette: only allow valid hex strings, only known keys
  const PALETTE_KEYS = ['bg','surface','surfaceAlt','border','borderSoft','text','textSoft','muted','accent','ctaBg','ctaFg'];
  let cleanPalette = current.customPalette || null;
  if (over?.customPalette !== undefined) {
    cleanPalette = {};
    for (const k of PALETTE_KEYS) {
      const v = over.customPalette?.[k];
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) cleanPalette[k] = v;
    }
    if (Object.keys(cleanPalette).length === 0) cleanPalette = null;
  }

  let cleanHeadlineSize = current.headlineSize ?? null;
  if (over?.headlineSize !== undefined) {
    const n = parseInt(over.headlineSize, 10);
    cleanHeadlineSize = (Number.isFinite(n) && n >= 24 && n <= 80) ? n : null;
  }

  const clean = {
    presetId:      over?.presetId      ?? current.presetId      ?? null,
    displayFontId: over?.displayFontId ?? current.displayFontId ?? null,
    bodyFontId:    over?.bodyFontId    ?? current.bodyFontId    ?? null,
    customPalette: cleanPalette,
    headlineSize:  cleanHeadlineSize,
    voiceGuide:    over?.voiceGuide    !== undefined
                     ? (typeof over.voiceGuide === 'string' ? over.voiceGuide.slice(0, 4000) : null)
                     : (current.voiceGuide || null),
    hideWebsiteLink: over?.hideWebsiteLink !== undefined
                       ? !!over.hideWebsiteLink
                       : (current.hideWebsiteLink ?? false),
    updatedAt:     Date.now(),
  };
  await redis([['SET', KEY, JSON.stringify(clean)]]);
  return clean;
}

export async function resetOverrides() {
  if (!REDIS_URL) throw new Error('no_redis');
  await redis([['DEL', KEY]]);
  return { ok: true };
}
