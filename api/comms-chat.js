export const config = { runtime: 'edge' };

import { COMMS_DEFAULTS } from '../lib/comms-defaults.js';

const PASSWORD      = process.env.DASHBOARD_PASSWORD || '__DASHBOARD_PASSWORD__';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_KEY;

function authed(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  return token === PASSWORD;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VOICE_GUIDE = `
__CLIENT_NAME__ is an IFBB Bikini Pro and 1:1 coach. Her voice rules:
- Real, not polished. Sounds like she'd text a friend.
- Short sentences. Punchy beats polished.
- Em-dashes over commas for rhythm.
- Lowercase first words sometimes — feels personal, not corporate.
- No "Hey there!" or fake warmth.
- No emojis unless she's already using one.
- Sign off with first name only, never "Cass M." or "__CLIENT_NAME__."
- Honest, direct. Doesn't overpromise.
- HTML inline tags allowed: <em>, <strong>, <br>. Use <em> for emphasis (renders italic in the email).
- Plain text only — no markdown. No **bold**, no *italic*, no headings.
`.trim();

const BROADCAST_FIELD_LABELS = {
  subject: 'Subject line',
  kicker: 'Kicker (small uppercase tag above the headline)',
  headline: 'Headline',
  subhead: 'Subheadline (italic line under the headline)',
  body: 'Body (paragraphs separated by blank lines)',
  pull_quote: 'Pull quote (one bold line)',
  cta_label: 'CTA button label',
  cta_url: 'CTA button URL',
  cta_secondary_label: 'Secondary CTA label',
  cta_secondary_url: 'Secondary CTA URL',
};

function buildSystemPrompt({ kind, fieldKey, currentDraft }) {
  let emailContext, fieldContext;
  if (kind === 'broadcast') {
    emailContext = `She's composing a one-off broadcast email to her newsletter subscribers — could be a launch announcement, a personal note, a campaign blast, or a free piece of value.`;
    const lbl = BROADCAST_FIELD_LABELS[fieldKey];
    fieldContext = lbl ? `Specifically the field "${lbl}".` : '';
  } else {
    const def = COMMS_DEFAULTS[kind];
    const fieldDef = def?.fields?.[fieldKey];
    emailContext = def
      ? `She's editing the "${def.label}" — ${def.summary}`
      : `She's editing one of her automated emails.`;
    fieldContext = fieldDef
      ? `Specifically the field "${fieldDef.label}"${fieldDef.help ? ` (${fieldDef.help})` : ''}.`
      : '';
  }

  return `You are a personal copywriting assistant for __CLIENT_NAME__. She talks to you while editing the messages that go out automatically to her audience.

${VOICE_GUIDE}

${emailContext}
${fieldContext}

Current draft of this field:
"""
${currentDraft || '(empty)'}
"""

How to help her:
- When she asks for a rewrite, return ONLY the rewritten copy — no preamble, no "here's a version", no quote marks around it. Just the new draft, ready to paste.
- When she asks a question (not a rewrite), answer in 1–2 sentences.
- When she asks for options, return at most 3 options separated by blank lines, each ready to use as-is.
- Keep the same approximate length unless she asks to shorten or expand.
- Stay in her voice. If her draft uses lowercase, match it. If she uses em-dashes, match them.
- Don't add caveats, disclaimers, or "let me know if you'd like..." endings.

If she asks something unrelated to the email (e.g. about her data or business), gently redirect: "I'm the writing assistant — try the Strategist tab for that."`.trim();
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!authed(req)) return json({ error: 'Unauthorized' }, 401);
  if (!ANTHROPIC_KEY) return json({ error: 'AI not configured' }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const message      = (body.message      || '').toString().trim();
  const kind         = (body.kind         || '').toString();
  const fieldKey     = (body.field        || '').toString();
  const currentDraft = (body.currentDraft || '').toString();
  const history      = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (!message) return json({ error: 'empty_message' }, 400);

  const systemPrompt = buildSystemPrompt({ kind, fieldKey, currentDraft });

  const messages = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));
  messages.push({ role: 'user', content: message });

  const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!llmRes.ok) {
    const errText = await llmRes.text().catch(() => '');
    console.error('Comms-chat API error:', errText);
    return json({ error: 'AI unavailable' }, 502);
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
          } catch { /* skip malformed line */ }
        }
      }
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (e) {
      console.error('Stream error:', e);
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
