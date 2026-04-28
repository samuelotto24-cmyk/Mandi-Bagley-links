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

// Merge a {presetId, displayFontId, bodyFontId, voiceGuide} override on top
// of CLIENT_BRAND. Returns the full effective brand object that templates use
// at render time.
export function applyOverrides(over) {
  if (!over) return { ...CLIENT_BRAND };
  const out = { ...CLIENT_BRAND };
  if (over.presetId && THEME_PRESETS[over.presetId]) {
    Object.assign(out, THEME_PRESETS[over.presetId].palette);
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
  const clean = {
    presetId:      over?.presetId      ?? current.presetId      ?? null,
    displayFontId: over?.displayFontId ?? current.displayFontId ?? null,
    bodyFontId:    over?.bodyFontId    ?? current.bodyFontId    ?? null,
    voiceGuide:    over?.voiceGuide    !== undefined
                     ? (typeof over.voiceGuide === 'string' ? over.voiceGuide.slice(0, 4000) : null)
                     : (current.voiceGuide || null),
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
