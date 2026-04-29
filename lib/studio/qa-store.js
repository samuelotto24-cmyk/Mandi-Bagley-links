// Q&A inbox store — incoming questions from the public /ask form.
//
// Storage shape:
//   studio:qa_inbox    LIST   newest first (LPUSH on submit; cap 500)
//     { id, question, name?, email, source, createdAt, status }
//     status: 'new' | 'starred' | 'used' | 'archived'
//
// Q&A submission also rate-limited per email to 1/24h via:
//   studio:qa_ratelimit:<emailHash>  STRING  TTL 24h

import { studioKey, redisCmd, redisPipeline } from './redis.js';

const KEY = studioKey('qa_inbox');
const CAP = 500;

function newId() {
  return `q_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function parse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

// 32-bit FNV-1a — fast, deterministic, safe for rate-limit key (not security).
function emailHash(email) {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export async function listQa() {
  const raw = await redisCmd('LRANGE', KEY, 0, CAP - 1);
  return (raw || []).map(parse).filter(Boolean);
}

export async function submitQa({ question, email, name = '' }) {
  const q = String(question || '').trim().slice(0, 1000);
  const e = String(email || '').trim().toLowerCase().slice(0, 200);
  const n = String(name || '').trim().slice(0, 80);

  if (!q) throw new Error('question_required');
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('invalid_email');

  // Per-email rate limit: 1 question per 24h
  const rlKey = studioKey(`qa_ratelimit:${emailHash(e)}`);
  const exists = await redisCmd('EXISTS', rlKey);
  if (exists === 1) throw new Error('rate_limited');

  const entry = {
    id: newId(),
    question: q,
    email: e,
    name: n,
    source: 'ask_form',
    createdAt: Date.now(),
    status: 'new',
  };
  await redisPipeline([
    ['LPUSH', KEY, JSON.stringify(entry)],
    ['LTRIM', KEY, '0', String(CAP - 1)],
    ['SET', rlKey, '1', 'EX', '86400'],
  ]);
  return entry;
}

export async function updateQaStatus(id, status) {
  const allowed = ['new', 'starred', 'used', 'archived'];
  if (!allowed.includes(status)) throw new Error('bad_status');
  const raw = await redisCmd('LRANGE', KEY, 0, CAP - 1);
  if (!raw) return null;
  for (let i = 0; i < raw.length; i++) {
    const q = parse(raw[i]);
    if (!q || q.id !== id) continue;
    q.status = status;
    await redisCmd('LSET', KEY, String(i), JSON.stringify(q));
    return q;
  }
  return null;
}

export async function deleteQa(id) {
  const raw = await redisCmd('LRANGE', KEY, 0, CAP - 1);
  if (!raw) return false;
  for (const entry of raw) {
    const q = parse(entry);
    if (q && q.id === id) {
      await redisCmd('LREM', KEY, '1', entry);
      return true;
    }
  }
  return false;
}
