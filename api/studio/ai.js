export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import {
  buildVoicePrompt,
  streamAnthropic,
  nonStreamAnthropic,
  incrementAndCheckCap,
  AI_MODELS,
} from '../../lib/studio/ai.js';
import { SECTION_TYPES } from '../../lib/studio/section-types.js';

// All AI touchpoints under one endpoint, dispatched by `?op=`.
//
//   ?op=expand      POST { ideaText, sectionType }
//                   → SSE stream of section body in voice
//
//   ?op=generate    POST { sectionType, prompt, currentDraft?, recentSections? }
//                   → SSE stream
//
//   ?op=polish      POST { text, instruction }
//                   → SSE stream of revised text
//
//   ?op=subject     POST { letter }
//                   → JSON { subjects: [...], preheader }
//
//   ?op=topics      POST { sectionType, recentLetters? }
//                   → JSON { topics: [...] }
//
// All ops auth + rate-limit before dispatching.

export default async function handler(req) {
  if (!authed(req)) return unauthorized();
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const url = new URL(req.url);
  const op = url.searchParams.get('op') || '';

  // Rate-limit guardrail
  const gate = await incrementAndCheckCap().catch(() => ({ ok: true }));
  if (!gate.ok) {
    return json({
      error: 'ai_cap_reached',
      message: `You've hit today's AI assist limit (${gate.cap}). Manual editing still works — try again tomorrow.`,
      count: gate.count, cap: gate.cap,
    }, 429);
  }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'bad_json' }, 400); }

  // Dispatch
  switch (op) {
    case 'expand':   return opExpand(body);
    case 'generate': return opGenerate(body);
    case 'polish':   return opPolish(body);
    case 'subject':  return opSubject(body);
    case 'topics':   return opTopics(body);
    case 'sanity':   return opSanity(body);
    default:
      return json({ error: 'unknown_op', op }, 400);
  }
}

// ─────────────────────────────────────────────────────────────────
async function opExpand(body) {
  const ideaText    = String(body.ideaText || '').trim();
  const sectionType = String(body.sectionType || '').trim();
  if (!ideaText) return json({ error: 'ideaText_required' }, 400);
  if (!SECTION_TYPES[sectionType]) return json({ error: 'unknown_section_type' }, 400);

  const system = buildVoicePrompt({ sectionType, task: 'generate' });
  const messages = [{
    role: 'user',
    content: `Take this raw idea and expand it into a full ${SECTION_TYPES[sectionType].label} section, in the voice rules above:\n\n"""${ideaText}"""\n\nReturn just the section body content. No labels, no preamble, no quotes.`,
  }];
  return streamAnthropic({ system, messages, model: AI_MODELS.deep, maxTokens: 800 });
}

// ─────────────────────────────────────────────────────────────────
async function opGenerate(body) {
  const sectionType    = String(body.sectionType || '').trim();
  const prompt         = String(body.prompt || '').trim();
  const currentDraft   = String(body.currentDraft || '').trim();
  const recentSections = Array.isArray(body.recentSections) ? body.recentSections.slice(0, 8) : [];
  if (!SECTION_TYPES[sectionType]) return json({ error: 'unknown_section_type' }, 400);
  if (!prompt && !currentDraft) return json({ error: 'prompt_or_draft_required' }, 400);

  const system = buildVoicePrompt({ sectionType, currentDraft, recentSections, task: 'generate' });
  const userMsg = prompt
    ? `Write the section based on this prompt:\n\n"""${prompt}"""`
    : `Refine and complete the current draft above into a polished ${SECTION_TYPES[sectionType].label} section.`;
  return streamAnthropic({
    system,
    messages: [{ role: 'user', content: userMsg }],
    model: AI_MODELS.deep,
    maxTokens: 800,
  });
}

// ─────────────────────────────────────────────────────────────────
async function opPolish(body) {
  const text        = String(body.text || '').trim();
  const instruction = String(body.instruction || 'Polish this — tighten the writing, keep the meaning, keep her voice').trim();
  if (!text) return json({ error: 'text_required' }, 400);

  const system = buildVoicePrompt({ currentDraft: text, task: 'polish' });
  const messages = [{
    role: 'user',
    content: `Instruction: ${instruction}\n\nReturn ONLY the revised version — no preamble, no commentary, no quotes.`,
  }];
  return streamAnthropic({
    system,
    messages,
    model: AI_MODELS.fast,
    maxTokens: 400,
  });
}

// ─────────────────────────────────────────────────────────────────
async function opSubject(body) {
  const letter = body.letter;
  if (!letter || !Array.isArray(letter.sections)) {
    return json({ error: 'invalid_letter' }, 400);
  }
  const summary = letter.sections
    .map((s, i) => {
      const t = SECTION_TYPES[s.type];
      const label = t?.label || s.type;
      const snippet = pickSnippet(s.fields || {}).slice(0, 200);
      return `${i + 1}. ${label}: ${snippet}`;
    })
    .join('\n');

  const system = buildVoicePrompt({ task: 'subjects' });
  const messages = [{
    role: 'user',
    content: `Suggest 3 subject lines for this letter, plus a one-line preheader.\n\nLetter outline:\n${summary}\n\nFormat:\n<subject 1>\n<subject 2>\n<subject 3>\n\nPreheader: <one-line preheader>\n\nNo numbering, no quotes, no commentary.`,
  }];

  let out;
  try { out = await nonStreamAnthropic({ system, messages, model: AI_MODELS.fast, maxTokens: 240 }); }
  catch (e) { return json({ error: String(e.message || e) }, 502); }

  const lines = out.text.split('\n').map(l => l.trim()).filter(Boolean);
  const preheaderLine = lines.find(l => /^preheader\s*[:\-]/i.test(l)) || '';
  const preheader = preheaderLine.replace(/^preheader\s*[:\-]\s*/i, '').trim();
  const subjects = lines.filter(l => l !== preheaderLine && !/^preheader/i.test(l)).slice(0, 3);

  return json({ ok: true, subjects, preheader });
}

// ─────────────────────────────────────────────────────────────────
async function opTopics(body) {
  const sectionType    = String(body.sectionType || '').trim();
  const recentLetters  = Array.isArray(body.recentLetters) ? body.recentLetters.slice(0, 4) : [];
  if (!SECTION_TYPES[sectionType]) return json({ error: 'unknown_section_type' }, 400);

  const recent = recentLetters
    .map((l, i) => `Letter ${i + 1}: ${l.name || ''} — ${(l.subject || '').slice(0, 80)}`)
    .join('\n');

  const system = buildVoicePrompt({ sectionType, task: 'topics' });
  const messages = [{
    role: 'user',
    content: `Suggest 3-5 topic ideas for a ${SECTION_TYPES[sectionType].label} section.\n${recent ? `\nRecent letters (avoid repeating):\n${recent}\n` : ''}\nReturn each topic on its own line, no numbering or bullets. Each should be a specific angle she could write about, not a generic theme.`,
  }];

  let out;
  try { out = await nonStreamAnthropic({ system, messages, model: AI_MODELS.fast, maxTokens: 200 }); }
  catch (e) { return json({ error: String(e.message || e) }, 502); }

  const topics = out.text.split('\n')
    .map(l => l.replace(/^[-*•\d.\s]+/, '').trim())
    .filter(l => l.length > 4 && l.length < 200)
    .slice(0, 5);

  return json({ ok: true, topics });
}

// ─────────────────────────────────────────────────────────────────
async function opSanity(body) {
  const letter = body.letter;
  if (!letter || !Array.isArray(letter.sections)) {
    return json({ error: 'invalid_letter' }, 400);
  }
  if (letter.sections.length < 2) {
    // With only one section, cross-section issues can't exist.
    return json({ ok: true, issues: [] });
  }

  // Build a compact representation of each section
  const summary = letter.sections.map((s, i) => {
    const t = SECTION_TYPES[s.type];
    const f = s.fields || {};
    const body = pickSnippet(f).slice(0, 600);
    return `Section ${i + 1} (${t?.label || s.type}):\n${body || '(empty)'}`;
  }).join('\n\n');

  const system = buildVoicePrompt({ task: 'sanity' });
  const messages = [{
    role: 'user',
    content: `Review this letter for issues that would distract a reader. Look for:
- Two sections that hit the same angle/framing
- Tone breaks (one section sounds different from the rest)
- Too many CTAs or asks in one letter
- Empty or placeholder-feeling sections
- Specific phrases that read AI-generated or generic-creator (we want it to sound like ${CLIENT_BRAND.name})

Return ONLY a JSON array (no commentary). Each entry: {section: <number>, kind: "<short tag>", note: "<one sentence>"}.
Empty array [] if it reads well.

Letter:
${summary}`,
  }];

  let out;
  try { out = await nonStreamAnthropic({ system, messages, model: AI_MODELS.deep, maxTokens: 600 }); }
  catch (e) { return json({ error: String(e.message || e) }, 502); }

  // Parse JSON from output (model sometimes wraps in code fences)
  let issues = [];
  try {
    const cleaned = out.text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) issues = parsed.slice(0, 5);
  } catch (e) {
    // If parsing fails, return raw text so the UI can still show something
    return json({ ok: true, issues: [], raw: out.text.slice(0, 800) });
  }
  return json({ ok: true, issues });
}

// ─────────────────────────────────────────────────────────────────
function pickSnippet(fields) {
  for (const k of ['body', 'reflection', 'topic', 'title', 'intro', 'prize']) {
    if (typeof fields[k] === 'string' && fields[k].trim()) return fields[k].trim();
  }
  return '';
}
