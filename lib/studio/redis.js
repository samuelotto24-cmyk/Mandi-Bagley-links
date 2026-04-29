// Studio-scoped Redis helper.
// All Studio keys live under `<redisPrefix>studio:<suffix>` where redisPrefix
// already ends with `:` (e.g. "mandibagley:").
//
// Exposed surface:
//   - studioKey(suffix)             → fully namespaced key string
//   - redisPipeline([[cmd, ...]])  → fetch wrapper, returns parsed JSON
//   - redisCmd(cmd, ...args)        → single-command convenience
//
// Higher-level data accessors live next to the resources they read/write
// (e.g. lib/studio/drops-store.js). Keep this file generic.

import { CLIENT_BRAND } from '../client-config.js';

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const PREFIX = (CLIENT_BRAND.redisPrefix || '').endsWith(':')
  ? CLIENT_BRAND.redisPrefix
  : `${CLIENT_BRAND.redisPrefix}:`;

export function studioKey(suffix) {
  return `${PREFIX}studio:${suffix}`;
}

export async function redisPipeline(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error('redis_not_configured');
  }
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`redis_${res.status}:${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function redisCmd(...args) {
  const out = await redisPipeline([args]);
  return Array.isArray(out) ? out[0]?.result : null;
}

export const REDIS_AVAILABLE = Boolean(REDIS_URL && REDIS_TOKEN);
