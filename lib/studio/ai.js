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

// Per-million-token prices in USD cents. Update if Anthropic changes pricing.
// cacheWrite = ~1.25× input. cacheRead = ~0.10× input.
const MODEL_PRICES = {
  'claude-haiku-4-5-20251001': { input: 100, output: 500, cacheWrite: 125, cacheRead: 10 },
  'claude-sonnet-4-6':         { input: 300, output: 1500, cacheWrite: 375, cacheRead: 30 },
  'claude-opus-4-7':            { input: 1500, output: 7500, cacheWrite: 1875, cacheRead: 150 },
};

// Compute cost in millicents (1/1000 of a cent) for ledger precision.
// Returns 0 if model unknown rather than throwing.
function computeCostMillicents(model, usage) {
  const p = MODEL_PRICES[model];
  if (!p) return 0;
  const inT  = Number(usage?.input_tokens || 0);
  const outT = Number(usage?.output_tokens || 0);
  const cwT  = Number(usage?.cache_creation_input_tokens || 0);
  const crT  = Number(usage?.cache_read_input_tokens || 0);
  // price is cents-per-million-tokens; multiply by 1000 to get millicents
  return Math.round(
    (inT * p.input * 1000 +
     outT * p.output * 1000 +
     cwT * p.cacheWrite * 1000 +
     crT * p.cacheRead * 1000) / 1_000_000
  );
}

// Awaitable log of a single AI call. Never throws — metering must not break
// user-facing AI requests. Returns a Promise that callers can await to ensure
// the log lands before the Edge function exits (Edge cancels in-flight fetches
// when the response finishes).
//
//   key:   <prefix>studio:ai_log:<YYYY-MM-DD>  (sorted set, score=timestamp ms)
//   value: JSON { ts, op, model, ok, in, out, cw, cr, mc, err? }
//
// Reading: ZRANGE <key> 0 -1 WITHSCORES, parse each value.
// Pruning: 95-day TTL refreshed on every write, so an active day always has buffer.
async function logUsage({ op, model, ok, usage, error }) {
  try {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const key = studioKey(`ai_log:${day}`);
    const entry = {
      ts: now,
      op: String(op || 'unknown'),
      model: String(model || ''),
      ok: !!ok,
      in: Number(usage?.input_tokens || 0),
      out: Number(usage?.output_tokens || 0),
      cw: Number(usage?.cache_creation_input_tokens || 0),
      cr: Number(usage?.cache_read_input_tokens || 0),
      mc: computeCostMillicents(model, usage),
    };
    if (error) entry.err = String(error).slice(0, 200);
    await redisPipeline([
      ['ZADD', key, String(now), JSON.stringify(entry)],
      ['EXPIRE', key, '8208000'],
    ]);
  } catch {
    // Logging must never break the user-facing flow.
  }
}

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
  op = 'unknown',
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
    await logUsage({ op, model, ok: false, usage: {}, error: `upstream_${llmRes.status}:${txt.slice(0, 120)}` });
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
    // Accumulate usage across stream events: input/cache fields arrive in
    // message_start, final output_tokens arrives in message_delta.
    const usage = {
      input_tokens: 0, output_tokens: 0,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    };
    let streamError = null;
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
            } else if (evt.type === 'message_start' && evt.message?.usage) {
              const u = evt.message.usage;
              usage.input_tokens                = Number(u.input_tokens || 0);
              usage.cache_creation_input_tokens = Number(u.cache_creation_input_tokens || 0);
              usage.cache_read_input_tokens     = Number(u.cache_read_input_tokens || 0);
              usage.output_tokens               = Number(u.output_tokens || 0);
            } else if (evt.type === 'message_delta' && evt.usage) {
              // Final output token count
              usage.output_tokens = Number(evt.usage.output_tokens || usage.output_tokens);
            }
          } catch { /* skip malformed */ }
        }
      }
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (e) {
      streamError = e;
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`)); } catch {}
    } finally {
      // Await the metering log BEFORE closing the writer. Edge runtime can
      // cancel in-flight fetches once the response stream ends, and content
      // has already been delivered to the client at this point — the log
      // wait does not affect user-perceived latency.
      await logUsage({ op, model, ok: !streamError, usage, error: streamError });
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
  op = 'unknown',
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
    await logUsage({ op, model, ok: false, usage: {}, error: `upstream_${res.status}:${txt.slice(0, 120)}` });
    throw new Error(`ai_upstream:${res.status}:${txt.slice(0, 240)}`);
  }
  const data = await res.json();
  const text = (data?.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
  await logUsage({ op, model, ok: true, usage: data?.usage || {} });
  return { text };
}

export const AI_MODELS = { fast: MODEL_FAST, deep: MODEL_DEEP };
