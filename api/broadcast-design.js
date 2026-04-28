export const config = { runtime: 'edge' };

import { CLIENT_BRAND } from '../lib/client-config.js';
import { getBrand }     from '../lib/brand-store.js';

const PASSWORD      = process.env.DASHBOARD_PASSWORD || 'Cassandra2024';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_KEY;

function authed(req) {
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  return t === PASSWORD;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PRESETS = {
  letter:        'A personal letter — warm, narrative, single thread of thought. Light on CTAs.',
  tip:           'A focused tip or framework — one specific idea broken into 2-3 paragraphs of practical detail.',
  spotlight:     'A spotlight on something specific (recipe, workout, product, brand code) with a clear primary action.',
  launch:        'A launch announcement — exciting, clear about what is launching, when, and what to do next.',
  general:       'A general newsletter mix — a real moment from life, something practical, and what is coming next.',
};

function buildSystemPrompt(brand) {
  const B = brand || CLIENT_BRAND;
  const voiceGuide = B.voiceGuide || `Voice: real, direct, human, no fake warmth.`;

  return `You are a personal copywriter for ${B.name} (${B.role || ''}).
You draft one-off newsletter emails that sound exactly like them.

${voiceGuide}

You will receive a short brief. Output a complete structured draft as a JSON object — no preamble, no commentary, no markdown fences. Just the JSON object.

Schema (use these keys exactly):
{
  "subject":             string  — inbox subject line, often lowercase, very specific (e.g. "a few things I'm using this month")
  "kicker":              string  — tiny uppercase tag above the headline, 1-3 words (e.g. "Real Talk", "October Notes"). Optional — set to "" if it doesn't fit.
  "headline":            string  — display-font headline, 2-7 words. Specific, not vague.
  "subhead":             string  — italic line under the headline, 5-12 words. Optional — set to "" if not needed.
  "body":                string  — the main body. Multiple paragraphs separated by blank lines. <em> and <strong> allowed inline. No markdown.
  "pull_quote":          string  — one tweetable line in their voice. Optional — set to "" if it would feel forced.
  "cta_label":           string  — primary button label. Optional — set to "" if no CTA fits.
  "cta_url":             string  — leave as "" — they'll fill it in.
  "cta_secondary_label": string  — optional outline-style secondary CTA. Default "".
  "cta_secondary_url":   string  — default "".
}

Rules:
- Stay in their voice. If the voice guide says lowercase first words, use lowercase first words.
- 3-5 paragraphs in the body, no more. Each paragraph 1-3 sentences.
- Be specific over generic. If they mention "recipes I'm eating," name the kind of recipe; don't say "delicious foods."
- Don't output anything except the JSON object. No "Here's your draft:". No backticks. Just {.`;
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!authed(req))         return json({ error: 'Unauthorized' }, 401);
  if (!ANTHROPIC_KEY)       return json({ error: 'AI not configured' }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const prompt  = String(body.prompt  || '').trim();
  const presetId = String(body.preset || 'general').trim();
  if (!prompt) return json({ error: 'empty_prompt' }, 400);

  const presetHint = PRESETS[presetId] || PRESETS.general;
  const userMessage = `Brief from ${CLIENT_BRAND.name}:
"""
${prompt}
"""

Format hint: ${presetHint}

Draft the newsletter now. JSON only.`;

  const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: buildSystemPrompt(await getBrand().catch(() => null)),
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!llmRes.ok) {
    const errText = await llmRes.text().catch(() => '');
    console.error('Design API error:', errText);
    return json({ error: 'design_failed', detail: errText.slice(0, 240) }, 502);
  }

  const data = await llmRes.json();
  const text = data?.content?.[0]?.text?.trim() || '';

  // Extract JSON — be lenient if the model adds preamble or backticks
  let parsed = null;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (e) { /* fall through */ }

  if (!parsed || !parsed.subject || !parsed.headline || !parsed.body) {
    return json({ error: 'parse_failed', raw: text.slice(0, 600) }, 502);
  }

  // Fill in safe defaults for any missing keys
  const draft = {
    subject:             parsed.subject             || '',
    kicker:              parsed.kicker              || '',
    headline:            parsed.headline            || '',
    subhead:             parsed.subhead             || '',
    body:                parsed.body                || '',
    pull_quote:          parsed.pull_quote          || '',
    cta_label:           parsed.cta_label           || '',
    cta_url:             parsed.cta_url             || '',
    cta_secondary_label: parsed.cta_secondary_label || '',
    cta_secondary_url:   parsed.cta_secondary_url   || '',
  };

  return json({ ok: true, draft });
}
