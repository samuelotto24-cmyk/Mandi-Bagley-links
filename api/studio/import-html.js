export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import { sanitizeEmailHtml } from '../../lib/sanitize-email-html.js';
import { createLetter, updateLetter, getLetter } from '../../lib/studio/letters-store.js';

// POST { html, brief?, letterId? }
//   - sanitizes the pasted HTML (strips scripts, neutralizes bad URLs,
//     wraps fragments, detects email-incompat CSS)
//   - if letterId: updates that letter in place
//   - else: creates a new "custom" letter
//   - returns { ok, letter, warnings, bytes } so the UI can show what
//     was flagged
//
// Used by the Design-with-Claude "Import HTML" path AND any time the
// user wants to re-import after editing in claude.ai.

export default async function handler(req) {
  if (!authed(req)) return unauthorized();
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'bad_json' }, 400); }

  const html = String(body.html || '');
  const brief = String(body.brief || '').trim().slice(0, 200);
  const letterId = body.letterId ? String(body.letterId).trim() : null;

  const result = sanitizeEmailHtml(html);
  if (!result.ok) {
    return json({
      error: result.error,
      detail: result.detail || `Couldn't import: ${result.error}`,
    }, 400);
  }

  // Auto-name: "Imported design — May 1" (a clean draft identifier).
  // The brief text doesn't go into the name OR the subject — those are
  // both inbox metadata the user sets explicitly before sending.
  const dateLabel = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const defaultName    = `Imported design — ${dateLabel}`;
  const defaultSubject = '';

  try {
    let letter;
    if (letterId) {
      const existing = await getLetter(letterId, { withSections: false });
      if (!existing) return json({ error: 'letter_not_found' }, 404);
      letter = await updateLetter(letterId, {
        type: 'custom',
        customHtml: result.html,
        // Don't clobber name/subject if already set
        ...(existing.name    ? {} : { name:    defaultName }),
        ...(existing.subject ? {} : { subject: defaultSubject }),
      });
    } else {
      letter = await createLetter({
        name:       defaultName,
        subject:    defaultSubject,
        preheader:  '',
        type:       'custom',
        customHtml: result.html,
      });
    }

    return json({
      ok: true,
      letter,
      warnings: result.warnings || [],
      bytes: result.bytes,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}
