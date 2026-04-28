// Redis-backed CRUD for broadcast drafts and sent records.

import { CLIENT_BRAND } from './client-config.js';

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX      = CLIENT_BRAND.redisPrefix + 'broadcasts:';

async function redis(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) return [];
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function validHex(v) {
  if (!v) return null;
  const s = String(v).trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : null;
}

function clampInt(v, min, max) {
  const n = parseInt(v, 10);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  return null;
}

export async function listDrafts() {
  if (!REDIS_URL) return [];
  try {
    const res = await redis([['LRANGE', `${PREFIX}drafts`, '0', '49']]);
    const ids = res?.[0]?.result || [];
    if (!ids.length) return [];
    const reads = await redis(ids.map(id => ['GET', `${PREFIX}draft:${id}`]));
    return reads.map((r, i) => {
      try { return r?.result ? JSON.parse(r.result) : null; }
      catch { return null; }
    }).filter(Boolean);
  } catch (_) { return []; }
}

export async function getDraft(id) {
  if (!REDIS_URL || !id) return null;
  try {
    const res = await redis([['GET', `${PREFIX}draft:${id}`]]);
    return res?.[0]?.result ? JSON.parse(res[0].result) : null;
  } catch (_) { return null; }
}

export async function saveDraft(draft) {
  if (!REDIS_URL) throw new Error('no_redis');
  const now = Date.now();
  const id = draft.id || newId();
  // Sanitize design overrides (any field can be null = "use theme default").
  const d = draft.design || {};
  const cleanDesign = {
    accentColor:  validHex(d.accentColor),                                          // null | "#RRGGBB"
    bgColor:      validHex(d.bgColor),
    displayFont:  d.displayFont ? String(d.displayFont).slice(0, 200)  : null,      // CSS font-family
    bodyFont:     d.bodyFont    ? String(d.bodyFont).slice(0, 200)     : null,
    headlineSize: clampInt(d.headlineSize, 28, 72),                                 // px
    showPullQuote:    d.showPullQuote    !== false,                                 // default true
    showSecondaryCta: d.showSecondaryCta !== false,                                 // default true
  };

  // Sanitize per-broadcast signoff overrides
  const s = draft.signoff || {};
  const cleanSignoff = {
    closing: String(s.closing || '').slice(0, 60),     // line above the name (e.g. "until next time", "xx,")
    name:    String(s.name    || '').slice(0, 100),    // default = brand.name
    role:    String(s.role    || '').slice(0, 100),    // default = brand.role
  };

  // Custom HTML — set when she imports a designed-in-Claude artifact.
  // When present, the renderer uses this directly and ignores field-based content.
  const customHtml      = draft.customHtml ? String(draft.customHtml).slice(0, 500_000) : null;
  const customHtmlMeta  = draft.customHtmlMeta || null;  // { source, importedAt, warnings, bytes }

  const obj = {
    id,
    subject:    String(draft.subject    || '').slice(0, 300),
    kicker:     String(draft.kicker     || '').slice(0, 120),
    headline:   String(draft.headline   || '').slice(0, 240),
    subhead:    String(draft.subhead    || '').slice(0, 240),
    body:       String(draft.body       || '').slice(0, 12000),
    pull_quote: String(draft.pull_quote || '').slice(0, 600),
    cta_label:  String(draft.cta_label  || '').slice(0, 80),
    cta_url:    String(draft.cta_url    || '').slice(0, 600),
    cta_secondary_label: String(draft.cta_secondary_label || '').slice(0, 80),
    cta_secondary_url:   String(draft.cta_secondary_url   || '').slice(0, 600),
    design:     cleanDesign,
    signoff:    cleanSignoff,
    customHtml,
    customHtmlMeta,
    createdAt:  draft.createdAt || now,
    updatedAt:  now,
    status:     draft.status || 'draft',
  };
  const cmds = [['SET', `${PREFIX}draft:${id}`, JSON.stringify(obj)]];
  if (!draft.id) {
    cmds.push(['LPUSH', `${PREFIX}drafts`, id]);
    cmds.push(['LTRIM', `${PREFIX}drafts`, '0', '99']);
  }
  await redis(cmds);
  return obj;
}

export async function deleteDraft(id) {
  if (!REDIS_URL || !id) throw new Error('no_redis_or_id');
  await redis([
    ['DEL', `${PREFIX}draft:${id}`],
    ['LREM', `${PREFIX}drafts`, '0', id],
  ]);
  return { ok: true };
}

export async function listSubscribers(limit = 1000) {
  if (!REDIS_URL) return [];
  try {
    const res = await redis([['LRANGE', `${CLIENT_BRAND.redisPrefix}newsletter_subscribers`, '0', String(limit - 1)]]);
    const items = res?.[0]?.result || [];
    const out = [];
    for (const raw of items) {
      try {
        const obj = JSON.parse(raw);
        if (obj && obj.email) out.push(obj.email);
      } catch (_) {}
    }
    return Array.from(new Set(out));  // dedupe
  } catch (_) { return []; }
}

export async function recordSent({ id, draft, recipientCount }) {
  if (!REDIS_URL) return;
  const record = {
    id,
    subject: draft.subject,
    headline: draft.headline,
    sentAt: Date.now(),
    recipientCount,
  };
  await redis([
    ['SET',   `${PREFIX}sent:${id}`, JSON.stringify(record)],
    ['LPUSH', `${PREFIX}sent`, id],
    ['LTRIM', `${PREFIX}sent`, '0', '99'],
  ]);
}
