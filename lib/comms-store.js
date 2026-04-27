// Reads/writes editable copy overrides in Redis, merging with defaults.
// Edge-runtime safe — no Node.js APIs used.

import { COMMS_DEFAULTS, flattenDefaults } from './comms-defaults.js';
import { CLIENT_BRAND } from './client-config.js';

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
    if (REDIS_URL && REDIS_TOKEN) {
      try {
        const res = await redis([
          ['HGETALL', `${PREFIX}${kind}`],
          ['GET',     `${PREFIX}${kind}:updated_at`],
        ]);
        const arr = res?.[0]?.result || [];
        for (let i = 0; i < arr.length; i += 2) overrides[arr[i]] = arr[i + 1];
        result[kind] = {
          label: def.label,
          summary: def.summary,
          when: def.when,
          icon: def.icon,
          fields: def.fields,
          values: { ...flat, ...overrides },
          edited: Object.keys(overrides),
          updatedAt: res?.[1]?.result || null,
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
