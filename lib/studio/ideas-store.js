// Ideas inbox store — quick-capture thoughts that can be expanded into sections.
//
// Storage shape:
//   studio:ideas             LIST   newest at index 0 (LPUSH on add)
//   each entry is JSON: { id, text, type, createdAt, status }
//   status: "raw" | "expanded" | "used"
//
// We keep the inbox capped at 200 entries (LTRIM after every push). Older
// ideas roll off — Mandi can either use them, expand them, or they go.

import { studioKey, redisPipeline, redisCmd } from './redis.js';
import { isValidSectionTypeId } from './section-types.js';

const KEY = studioKey('ideas');
const CAP = 200;

function newId() {
  return `i_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function parse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

export async function listIdeas() {
  const raw = await redisCmd('LRANGE', KEY, 0, CAP - 1);
  return (raw || []).map(parse).filter(Boolean);
}

export async function addIdea({ text, type } = {}) {
  const cleanText = String(text || '').trim().slice(0, 2000);
  if (!cleanText) throw new Error('text_required');
  const cleanType = isValidSectionTypeId(type) ? type : null;

  const idea = {
    id: newId(),
    text: cleanText,
    type: cleanType,
    createdAt: Date.now(),
    status: 'raw',
  };
  await redisPipeline([
    ['LPUSH', KEY, JSON.stringify(idea)],
    ['LTRIM', KEY, '0', String(CAP - 1)],
  ]);
  return idea;
}

export async function updateIdeaStatus(id, status) {
  if (!['raw', 'expanded', 'used'].includes(status)) throw new Error('bad_status');
  // LRANGE all, find, mutate, LSET back. The list is small (≤200), this is fine.
  const raw = await redisCmd('LRANGE', KEY, 0, CAP - 1);
  if (!raw) return null;
  for (let i = 0; i < raw.length; i++) {
    const idea = parse(raw[i]);
    if (!idea || idea.id !== id) continue;
    idea.status = status;
    await redisCmd('LSET', KEY, String(i), JSON.stringify(idea));
    return idea;
  }
  return null;
}

export async function deleteIdea(id) {
  const raw = await redisCmd('LRANGE', KEY, 0, CAP - 1);
  if (!raw) return false;
  for (const entry of raw) {
    const idea = parse(entry);
    if (idea && idea.id === id) {
      // LREM removes by value match — use the exact JSON string we read
      await redisCmd('LREM', KEY, '1', entry);
      return true;
    }
  }
  return false;
}
