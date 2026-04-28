// Reads/writes editable copy overrides in Redis, merging with defaults.
// Edge-runtime safe — no Node.js APIs used.

import { COMMS_DEFAULTS, flattenDefaults } from './comms-defaults.js';
import { CLIENT_BRAND } from './client-config.js';
import { getBrand } from './brand-store.js';

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX      = CLIENT_BRAND.redisPrefix + 'comms:';

async function redis(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) return [];
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  return res.json();
}

// Returns merged copy {field: value} for one communication.
// Redis hash overrides defaults field-by-field.
export async function getCopy(kind) {
  const defaults = flattenDefaults(kind);
  if (!REDIS_URL || !REDIS_TOKEN) return defaults;

  try {
    const res = await redis([['HGETALL', `${PREFIX}${kind}`]]);
    const arr = res?.[0]?.result || [];
    const overrides = {};
    for (let i = 0; i < arr.length; i += 2) overrides[arr[i]] = arr[i + 1];
    return { ...defaults, ...overrides };
  } catch (_) {
    return defaults;
  }
}

// Returns merged copy + override flags for every communication.
// Used by the hub to render the editor.
export async function getAllCopy() {
  const result = {};
  for (const kind of Object.keys(COMMS_DEFAULTS)) {
    const def = COMMS_DEFAULTS[kind];
    const flat = flattenDefaults(kind);

    let overrides = {};
    let designOverride = null;
    let signoffOverride = null;
    if (REDIS_URL && REDIS_TOKEN) {
      try {
        const res = await redis([
          ['HGETALL', `${PREFIX}${kind}`],
          ['GET',     `${PREFIX}${kind}:updated_at`],
          ['GET',     `${PREFIX}${kind}:design`],
        ]);
        const arr = res?.[0]?.result || [];
        for (let i = 0; i < arr.length; i += 2) overrides[arr[i]] = arr[i + 1];
        const rawDesign = res?.[2]?.result;
        if (rawDesign) {
          try {
            const parsed = JSON.parse(rawDesign);
            designOverride  = cleanDesign(parsed.design);
            signoffOverride = cleanSignoff(parsed.signoff);
          } catch (_) {}
        }
        result[kind] = {
          label: def.label,
          summary: def.summary,
          when: def.when,
          icon: def.icon,
          fields: def.fields,
          values: { ...flat, ...overrides },
          edited: Object.keys(overrides),
          updatedAt: res?.[1]?.result || null,
          design:  designOverride,
          signoff: signoffOverride,
        };
        continue;
      } catch (_) { /* fall through */ }
    }
    result[kind] = {
      label: def.label,
      summary: def.summary,
      when: def.when,
      icon: def.icon,
      fields: def.fields,
      values: flat,
      edited: [],
      updatedAt: null,
      design:  null,
      signoff: null,
    };
  }
  return result;
}

// Save one or more field overrides for a kind.
// Removes the override entirely if the new value matches the default
// (so the "edited" badge clears when she undoes a change).
export async function saveCopy(kind, fields) {
  if (!COMMS_DEFAULTS[kind]) throw new Error('unknown_kind');
  if (!fields || typeof fields !== 'object') throw new Error('bad_fields');
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('no_redis');

  const defaults = flattenDefaults(kind);
  const setEntries = [];
  const delEntries = [];
  const allowedFields = new Set(Object.keys(COMMS_DEFAULTS[kind].fields));

  for (const [k, v] of Object.entries(fields)) {
    if (!allowedFields.has(k)) continue;
    const next = String(v == null ? '' : v);
    if (next === defaults[k]) {
      delEntries.push(k);
    } else {
      setEntries.push(k, next);
    }
  }

  const cmds = [];
  if (setEntries.length) cmds.push(['HSET', `${PREFIX}${kind}`, ...setEntries]);
  if (delEntries.length) cmds.push(['HDEL', `${PREFIX}${kind}`, ...delEntries]);
  cmds.push(['SET', `${PREFIX}${kind}:updated_at`, String(Date.now())]);

  await redis(cmds);
  return { ok: true, set: setEntries.length / 2, reset: delEntries.length };
}

/* ───────────────────────────────────────────────
   Per-kind design + signoff overrides
   ─────────────────────────────────────────────── */

const DESIGN_KEYS = ['accentColor','bgColor','displayFont','bodyFont','headlineSize','showPullQuote','showSecondaryCta'];
const SIGNOFF_KEYS = ['closing','name','role'];

function cleanDesign(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const k of DESIGN_KEYS) {
    const v = input[k];
    if (v === null || v === undefined || v === '') continue;
    if (k === 'accentColor' || k === 'bgColor') {
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v;
    } else if (k === 'headlineSize') {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n >= 24 && n <= 80) out[k] = n;
    } else if (k === 'showPullQuote' || k === 'showSecondaryCta') {
      out[k] = !!v;
    } else if (typeof v === 'string') {
      out[k] = v.slice(0, 200);
    }
  }
  return Object.keys(out).length ? out : null;
}

function cleanSignoff(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const k of SIGNOFF_KEYS) {
    if (typeof input[k] === 'string' && input[k].trim()) out[k] = input[k].slice(0, 200);
  }
  return Object.keys(out).length ? out : null;
}

// Returns { design, signoff } for one kind (or null fields if none set).
export async function getCommsDesign(kind) {
  if (!COMMS_DEFAULTS[kind]) return { design: null, signoff: null };
  if (!REDIS_URL || !REDIS_TOKEN) return { design: null, signoff: null };
  try {
    const r = await redis([['GET', `${PREFIX}${kind}:design`]]);
    if (!r?.[0]?.result) return { design: null, signoff: null };
    const parsed = JSON.parse(r[0].result);
    return {
      design:  cleanDesign(parsed.design),
      signoff: cleanSignoff(parsed.signoff),
    };
  } catch (_) {
    return { design: null, signoff: null };
  }
}

// Save per-kind design + signoff overrides. Pass null to clear.
export async function saveCommsDesign(kind, { design, signoff } = {}) {
  if (!COMMS_DEFAULTS[kind]) throw new Error('unknown_kind');
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('no_redis');
  const cleanD = cleanDesign(design);
  const cleanS = cleanSignoff(signoff);
  const payload = { design: cleanD, signoff: cleanS };
  if (!cleanD && !cleanS) {
    await redis([['DEL', `${PREFIX}${kind}:design`]]);
    return { ok: true, design: null, signoff: null };
  }
  await redis([['SET', `${PREFIX}${kind}:design`, JSON.stringify(payload)]]);
  return { ok: true, design: cleanD, signoff: cleanS };
}

// Returns the live brand (Design Studio merged) plus per-kind design overrides
// applied on top. Senders call this instead of getBrand() so each automated
// email can have its own colours/fonts/headline size.
export async function getBrandForKind(kind) {
  const brand = await getBrand().catch(() => ({ ...CLIENT_BRAND }));
  if (!COMMS_DEFAULTS[kind]) return brand;
  const { design, signoff } = await getCommsDesign(kind);
  const out = { ...brand };
  if (design) {
    if (design.accentColor) {
      out.accent = design.accentColor;
      out.ctaBg  = design.accentColor;
    }
    if (design.bgColor)     out.bg = design.bgColor;
    if (design.displayFont) out.displayFont = design.displayFont;
    if (design.bodyFont)    out.bodyFont = design.bodyFont;
    if (typeof design.headlineSize === 'number') out.headlineSize = design.headlineSize;
    if (design.showPullQuote === false) out.hidePullQuote = true;
    if (design.showSecondaryCta === false) out.hideSecondaryCta = true;
  }
  if (signoff) out.signoff = signoff;
  return out;
}

// Reset a single field (or whole communication if field is null) to default.
export async function resetCopy(kind, field) {
  if (!COMMS_DEFAULTS[kind]) throw new Error('unknown_kind');
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('no_redis');

  if (field) {
    await redis([
      ['HDEL', `${PREFIX}${kind}`, field],
      ['SET',  `${PREFIX}${kind}:updated_at`, String(Date.now())],
    ]);
  } else {
    await redis([
      ['DEL', `${PREFIX}${kind}`],
      ['DEL', `${PREFIX}${kind}:updated_at`],
    ]);
  }
  return { ok: true };
}
