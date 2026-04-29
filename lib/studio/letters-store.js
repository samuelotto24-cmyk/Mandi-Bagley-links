// Letters store — CRUD for draft + sent letters.
//
// Storage shape:
//   studio:letters              ZSET   <id> scored by createdAt
//   studio:letter:<id>          HASH   { name, status, subject, preheader,
//                                        createdAt, updatedAt, sentAt?,
//                                        scheduleFor?, segment? }
//   studio:letter:<id>:sections LIST   ordered section JSON blobs
//                                       { id, type, fields: {...}, sourceIdeaId? }
//
// Sections list is rewritten as a whole on save (RPUSH after DEL). Sections
// are short — a 10-section letter is < 50KB. Optimizing per-section diffs
// isn't worth the complexity.

import { studioKey, redisPipeline, redisCmd } from './redis.js';
import { isValidSectionTypeId } from './section-types.js';

const INDEX_KEY     = studioKey('letters');
const letterKey     = (id) => studioKey(`letter:${id}`);
const sectionsKey   = (id) => studioKey(`letter:${id}:sections`);

const LETTER_FIELDS = [
  'name', 'status', 'subject', 'preheader',
  'createdAt', 'updatedAt', 'sentAt', 'scheduleFor', 'segment',
  'type', 'customHtml',
];

// Letter `type`:
//   'sections' (default)  → renderer iterates letter.sections
//   'custom'              → renderer outputs letter.customHtml directly
//                           (used by Design with Claude → Import HTML flow)

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function hashArrayToObject(arr) {
  if (!Array.isArray(arr)) return null;
  const out = {};
  for (let i = 0; i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
  return out;
}

function sanitizeLetter(input = {}) {
  const out = {};
  if (input.name      !== undefined) out.name      = String(input.name).trim().slice(0, 120);
  if (input.subject   !== undefined) out.subject   = String(input.subject).trim().slice(0, 200);
  if (input.preheader !== undefined) out.preheader = String(input.preheader).trim().slice(0, 200);
  if (input.segment   !== undefined) out.segment   = (input.segment === null || input.segment === '') ? '' : String(input.segment).trim().slice(0, 60);
  if (input.scheduleFor !== undefined) {
    const v = input.scheduleFor;
    out.scheduleFor = (v === null || v === '') ? '' : String(v).slice(0, 32);
  }
  if (input.type !== undefined) {
    out.type = (input.type === 'custom') ? 'custom' : 'sections';
  }
  if (input.customHtml !== undefined) {
    out.customHtml = (input.customHtml === null) ? '' : String(input.customHtml).slice(0, 500_000);
  }
  return out;
}

function sanitizeSection(s) {
  if (!s || typeof s !== 'object') return null;
  const id = typeof s.id === 'string' && s.id ? s.id : newId('s');
  const type = String(s.type || '');
  if (!isValidSectionTypeId(type)) return null;
  const fields = (s.fields && typeof s.fields === 'object') ? s.fields : {};
  const out = { id, type, fields };
  if (s.sourceIdeaId) out.sourceIdeaId = String(s.sourceIdeaId).slice(0, 64);
  return out;
}

export async function listLetters({ limit = 50 } = {}) {
  const ids = await redisCmd('ZREVRANGE', INDEX_KEY, 0, Math.max(0, limit - 1));
  if (!ids || !ids.length) return [];
  const cmds = ids.map(id => ['HGETALL', letterKey(id)]);
  const results = await redisPipeline(cmds);
  return results.map((r, i) => {
    const obj = hashArrayToObject(r?.result);
    if (!obj || !obj.createdAt) return null;
    return { id: ids[i], ...obj };
  }).filter(Boolean);
}

export async function getLetter(id, { withSections = true } = {}) {
  const cmds = [['HGETALL', letterKey(id)]];
  if (withSections) cmds.push(['LRANGE', sectionsKey(id), 0, -1]);
  const out = await redisPipeline(cmds);

  const meta = hashArrayToObject(out?.[0]?.result);
  if (!meta || !meta.createdAt) return null;

  let sections = [];
  if (withSections) {
    const raw = out?.[1]?.result || [];
    sections = raw.map(s => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);
  }
  return { id, ...meta, sections };
}

export async function createLetter(input = {}) {
  const id = newId('l');
  const now = String(Date.now());
  const fields = sanitizeLetter(input);

  const data = {
    name:        fields.name      || 'Untitled letter',
    status:      'draft',
    subject:     fields.subject   || '',
    preheader:   fields.preheader || '',
    createdAt:   now,
    updatedAt:   now,
    sentAt:      '',
    scheduleFor: fields.scheduleFor || '',
    segment:     fields.segment   || '',
    type:        fields.type      || 'sections',
    customHtml:  fields.customHtml || '',
  };

  const hsetArgs = ['HSET', letterKey(id)];
  for (const k of LETTER_FIELDS) hsetArgs.push(k, data[k]);

  const cmds = [hsetArgs, ['ZADD', INDEX_KEY, now, id]];

  // If the caller passed initial sections, push them too.
  if (Array.isArray(input.sections) && input.sections.length) {
    const valid = input.sections.map(sanitizeSection).filter(Boolean);
    if (valid.length) cmds.push(['RPUSH', sectionsKey(id), ...valid.map(s => JSON.stringify(s))]);
  }

  await redisPipeline(cmds);
  return { id, ...data, sections: [] };
}

export async function updateLetter(id, input = {}) {
  const existing = await getLetter(id, { withSections: false });
  if (!existing) throw new Error('not_found');

  const fields = sanitizeLetter(input);
  const now = String(Date.now());
  const merged = { ...existing, ...fields, updatedAt: now };

  const hsetArgs = ['HSET', letterKey(id)];
  for (const k of LETTER_FIELDS) {
    if (merged[k] === undefined || merged[k] === null) continue;
    hsetArgs.push(k, String(merged[k]));
  }

  const cmds = [hsetArgs];

  // If sections were provided, rewrite the list as a whole.
  if (Array.isArray(input.sections)) {
    const valid = input.sections.map(sanitizeSection).filter(Boolean);
    cmds.push(['DEL', sectionsKey(id)]);
    if (valid.length) cmds.push(['RPUSH', sectionsKey(id), ...valid.map(s => JSON.stringify(s))]);
  }

  await redisPipeline(cmds);
  return getLetter(id);
}

export async function markLetterSent(id, { sentAt = Date.now() } = {}) {
  const now = String(sentAt);
  await redisPipeline([
    ['HSET', letterKey(id), 'status', 'sent', 'sentAt', now, 'updatedAt', now],
  ]);
}

export async function deleteLetter(id) {
  await redisPipeline([
    ['DEL', letterKey(id)],
    ['DEL', sectionsKey(id)],
    ['ZREM', INDEX_KEY, id],
  ]);
}
