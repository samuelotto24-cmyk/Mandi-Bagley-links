// Drops store — CRUD for the Drops Manager.
// Storage shape:
//   studio:drops             ZSET   <id> scored by createdAt (active)
//   studio:drops:archive     ZSET   <id> scored by archivedAt (expired/manually archived)
//   studio:drop:<id>         HASH   { brand, code, link, image, description,
//                                     expiresAt, status, createdAt, updatedAt }

import { studioKey, redisPipeline, redisCmd } from './redis.js';

const ACTIVE_KEY  = studioKey('drops');
const ARCHIVE_KEY = studioKey('drops:archive');
const dropKey     = (id) => studioKey(`drop:${id}`);

const FIELDS = [
  'brand', 'code', 'link', 'image', 'description',
  'expiresAt', 'status', 'createdAt', 'updatedAt',
];

function generateId() {
  // crypto.randomUUID is available in edge runtime
  return `d_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function sanitize(input = {}) {
  const out = {};
  if (input.brand       !== undefined) out.brand       = String(input.brand).trim().slice(0, 80);
  if (input.code        !== undefined) out.code        = String(input.code).trim().slice(0, 40);
  if (input.link        !== undefined) out.link        = String(input.link).trim().slice(0, 500);
  if (input.image       !== undefined) out.image       = String(input.image).trim().slice(0, 500);
  if (input.description !== undefined) out.description = String(input.description).trim().slice(0, 240);
  if (input.expiresAt   !== undefined) {
    const v = input.expiresAt;
    out.expiresAt = (v === '' || v === null) ? '' : String(v).slice(0, 32);
  }
  return out;
}

function hashArrayToObject(arr) {
  // Upstash returns HGETALL as flat [k1, v1, k2, v2, ...]
  if (!Array.isArray(arr)) return null;
  const out = {};
  for (let i = 0; i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
  return out;
}

export async function listDrops({ archived = false } = {}) {
  const indexKey = archived ? ARCHIVE_KEY : ACTIVE_KEY;
  // Newest first (ZREVRANGE → high scores first)
  const ids = await redisCmd('ZREVRANGE', indexKey, 0, 199);
  if (!ids || ids.length === 0) return [];

  const cmds = ids.map(id => ['HGETALL', dropKey(id)]);
  const results = await redisPipeline(cmds);

  return results.map((r, i) => {
    const obj = hashArrayToObject(r?.result);
    if (!obj || !obj.brand) return null;
    return { id: ids[i], ...obj };
  }).filter(Boolean);
}

export async function getDrop(id) {
  const arr = await redisCmd('HGETALL', dropKey(id));
  const obj = hashArrayToObject(arr);
  if (!obj || !obj.brand) return null;
  return { id, ...obj };
}

export async function createDrop(input) {
  const fields = sanitize(input);
  if (!fields.brand) throw new Error('brand_required');
  if (!fields.code)  throw new Error('code_required');

  const id = generateId();
  const now = String(Date.now());
  const data = {
    brand:       fields.brand,
    code:        fields.code,
    link:        fields.link || '',
    image:       fields.image || '',
    description: fields.description || '',
    expiresAt:   fields.expiresAt || '',
    status:      'active',
    createdAt:   now,
    updatedAt:   now,
  };

  const hsetArgs = ['HSET', dropKey(id)];
  for (const k of FIELDS) hsetArgs.push(k, data[k]);

  await redisPipeline([
    hsetArgs,
    ['ZADD', ACTIVE_KEY, now, id],
  ]);

  return { id, ...data };
}

export async function updateDrop(id, input) {
  const existing = await getDrop(id);
  if (!existing) throw new Error('not_found');

  const fields = sanitize(input);
  const now = String(Date.now());
  const merged = { ...existing, ...fields, updatedAt: now };

  const hsetArgs = ['HSET', dropKey(id)];
  for (const k of FIELDS) {
    if (merged[k] === undefined || merged[k] === null) continue;
    hsetArgs.push(k, String(merged[k]));
  }

  await redisPipeline([hsetArgs]);
  return merged;
}

export async function expireDrop(id) {
  const existing = await getDrop(id);
  if (!existing) throw new Error('not_found');

  const now = String(Date.now());
  await redisPipeline([
    ['HSET', dropKey(id), 'status', 'expired', 'updatedAt', now],
    ['ZREM', ACTIVE_KEY, id],
    ['ZADD', ARCHIVE_KEY, now, id],
  ]);
  return { ...existing, status: 'expired', updatedAt: now };
}

export async function restoreDrop(id) {
  const existing = await getDrop(id);
  if (!existing) throw new Error('not_found');

  const now = String(Date.now());
  await redisPipeline([
    ['HSET', dropKey(id), 'status', 'active', 'updatedAt', now],
    ['ZREM', ARCHIVE_KEY, id],
    ['ZADD', ACTIVE_KEY, now, id],
  ]);
  return { ...existing, status: 'active', updatedAt: now };
}

export async function deleteDrop(id) {
  await redisPipeline([
    ['DEL', dropKey(id)],
    ['ZREM', ACTIVE_KEY, id],
    ['ZREM', ARCHIVE_KEY, id],
  ]);
}
