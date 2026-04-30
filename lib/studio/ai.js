// AI helper module — Anthropic streaming, voice prompt assembly,
// per-client rate-limit guardrails.
//
// Public surface:
//   buildVoicePrompt({ sectionType?, currentDraft?, recentSections? })
//     → system prompt string with voice guide + 3-5 voice samples + section guidance
//
//   streamAnthropic({ system, messages, model?, maxTokens? })
//     → Response with text/event-stream body that yields { text } chunks
//
//   nonStreamAnthropic({ system, messages, model?, maxTokens? })
//     → { text } — collected response, used for short suggestions
//
//   incrementAndCheckCap()
//     → { ok, count, cap } — call this BEFORE any AI request; if !ok, refuse
//
// All template-level — voice + samples come from CLIENT_BRAND, prompts come
// from the section type registry.

import { CLIENT_BRAND } from '../client-config.js';
import { SECTION_TYPES } from './section-types.js';
import { studioKey, redisCmd, redisPipeline } from './redis.js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_KEY;

const MODEL_FAST = 'claude-haiku-4-5-20251001';
const MODEL_DEEP = 'claude-sonnet-4-6';

// Pick a few random distinct items from an array.
function pickRandom(arr, n) {
  const a = [...arr];
  const out = [];
  while (a.length && out.length < n) {
    const i = Math.floor(Math.random() * a.length);
    out.push(a.splice(i, 1)[0]);
  }
  return out;
}

// Build the system prompt for any AI call. The shape is:
//   1. Identity ("You are writing in the voice of {name}.")
//   2. Voice guide (CLIENT_BRAND.voiceGuide)
//   3. 3-5 random voice samples (if any seeded)
//   4. Section type guidance (if a section type is provided)
//   5. Cross-section context (if recentSections provided)
//   6. Output rules (return only the copy, no preamble)
export function buildVoicePrompt({
  sectionType = null,
  currentDraft = '',
  recentSections = [],
  task = 'generate',
} = {}) {
  const brand = CLIENT_BRAND;
  const samples = Array.isArray(brand.voiceSamples) ? brand.voiceSamples : [];
  const picked = pickRandom(samples, Math.min(5, samples.length));

  const lines = [];
  lines.push(`You are a personal writing assistant for ${brand.name}. ${brand.role ? '(' + brand.role + ')' : ''}`);
  lines.push('');
  lines.push('VOICE GUIDE');
  lines.push('-----------');
  lines.push(brand.voiceGuide || '(no voice guide set)');

  if (picked.length) {
    lines.push('');
    lines.push('VOICE SAMPLES (her actual writing — match this register, not generic warmth):');
    lines.push('-----------');
    picked.forEach((s, i) => {
      lines.push(`Sample ${i + 1}:`);
      lines.push(`"""${s}"""`);
      lines.push('');
    });
  }

  if (sectionType && SECTION_TYPES[sectionType]) {
    const t = SECTION_TYPES[sectionType];
    if (t.aiPrompt) {
      lines.push('SECTION TYPE: ' + t.label);
      lines.push('-----------');
      lines.push(t.aiPrompt);
      lines.push('');
    }
  }

  if (recentSections && recentSections.length) {
    lines.push('CONTEXT — earlier sections in this same letter (avoid repeating their angle/framing):');
    lines.push('-----------');
    recentSections.forEach((s, i) => {
      lines.push(`Section ${i + 1} (${s.type || 'unknown'}): ${s.summary || '(no summary)'}`);
    });
    lines.push('');
  }

  if (currentDraft) {
    lines.push('CURRENT DRAFT (modify this, don\'t replace it from scratch unless asked):');
    lines.push('-----------');
    lines.push(`"""${currentDraft}"""`);
    lines.push('');
  }

  lines.push('OUTPUT RULES');
  lines.push('-----------');
  if (task === 'polish') {
    lines.push('- Return ONLY the rewritten copy. No preamble. No "here\'s a version". No quote marks around it.');
    lines.push('- Keep approximately the same length unless instructed otherwise.');
  } else if (task === 'topics') {
    lines.push('- Return 3-5 short topic ideas, one per line, no numbering or bullets.');
    lines.push('- Each topic should be a specific angle, not a generic theme.');
    lines.push('- Match her voice — these are titles she would actually use.');
  } else if (task === 'subjects') {
    lines.push('- Return 3 subject lines, one per line, plus a one-line preheader after a blank line.');
    lines.push('- Format exactly: 3 subject lines, blank line, "Preheader: ..." line.');
    lines.push('- No numbering. No quotes. No commentary.');
  } else if (task === 'sanity') {
    lines.push('- Return a JSON array of issues, max 5. Each issue: {section: <number>, kind: <string>, note: <one-sentence>}.');
    lines.push('- Only include real issues (repeated framings, broken tone, too many CTAs, etc). Empty array if everything reads well.');
    lines.push('- No commentary outside the JSON.');
  } else {
    lines.push('- Return ONLY the section body content (no headers, no labels, no "here\'s a version", no preamble).');
    lines.push('- Plain text only. No HTML tags whatsoever (no <em>, <strong>, <p>, <br>, etc). Just clean prose.');
    lines.push('- Double-newlines between paragraphs.');
    lines.push('- No markdown. No bullet lists unless the section type explicitly calls for them.');
    lines.push('- No emoji unless she already uses one in the voice samples.');
  }
  lines.push('- Stay in her voice. Don\'t over-warm; don\'t use generic "creator" phrasing ("excited to share", "you got this", etc).');

  return lines.join('\n');
}

// ── Rate-limit guard ───────────────────────────────────────────────────
//
// Increments `<prefix>:studio:ai_calls_today` (24h TTL) and refuses if the
// per-client cap has been reached. Returns { ok, count, cap, remaining }.
// cap === null means unlimited (Mandi).
export async function incrementAndCheckCap() {
  const cap = CLIENT_BRAND.studioConfig?.aiCallsCap;
  // Unlimited → still increment for telemetry, but never refuse
  const key = studioKey('ai_calls_today');
  const out = await redisPipeline([
    ['INCR', key],
    ['EXPIRE', key, '86400', 'NX'], // set TTL only on first creation
  ]);
  const count = Number(out?.[0]?.result || 0);
  if (cap == null || cap === 0) {
    return { ok: true, count, cap: null, remaining: null };
  }
  return {
    ok: count <= cap,
    count,
    cap,
    remaining: Math.max(0, cap - count),
  };
}

// ── Streaming proxy ────────────────────────────────────────────────────
//
// Sends a streaming Anthropic request and returns a Response with an SSE
// body that yields `data: {"text":"..."}` chunks (one per Anthropic content
// block delta). Ends with `data: [DONE]`.
export async function streamAnthropic({
  system,
  messages,
  model = MODEL_DEEP,
  maxTokens = 800,
}) {
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'ai_not_configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, system, messages }),
  });

  if (!llmRes.ok) {
    const txt = await llmRes.text().catch(() => '');
    return new Response(JSON.stringify({ error: 'ai_upstream', detail: txt.slice(0, 400) }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = llmRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const j = line.slice(6).trim();
          if (j === '[DONE]') continue;
          try {
            const evt = JSON.parse(j);
            if (evt.type === 'content_block_delta' && evt.delta?.text) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text: evt.delta.text })}\n\n`));
            }
          } catch { /* skip malformed */ }
        }
      }
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (e) {
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`)); } catch {}
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ── Non-streaming (used for short suggestions) ─────────────────────────
export async function nonStreamAnthropic({
  system,
  messages,
  model = MODEL_FAST,
  maxTokens = 300,
}) {
  if (!ANTHROPIC_KEY) throw new Error('ai_not_configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`ai_upstream:${res.status}:${txt.slice(0, 240)}`);
  }
  const data = await res.json();
  const text = (data?.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
  return { text };
}

export const AI_MODELS = { fast: MODEL_FAST, deep: MODEL_DEEP };
