export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import { renderLetter } from '../../lib/studio/render.js';
import { listDrops } from '../../lib/studio/drops-store.js';
import { CLIENT_BRAND } from '../../lib/client-config.js';
import { getBrand } from '../../lib/brand-store.js';

// POST { letter: { name, subject, preheader, sections } }
//   → { ok, html, subject, preheader }
//
// Auto-fetches data sources that the letter needs (drops, recap). The Studio
// UI calls this on every meaningful change to refresh the live preview pane.

export default async function handler(req) {
  if (!authed(req)) return unauthorized();
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'bad_json' }, 400); }

  const letter = body?.letter;
  if (!letter || !Array.isArray(letter.sections)) {
    return json({ error: 'invalid_letter' }, 400);
  }

  // Determine which data sources to pre-fetch based on section types present.
  const dataContext = {};
  const types = new Set(letter.sections.map(s => s?.type).filter(Boolean));

  // Use brand WITH overrides applied so the preview reflects live edits to
  // palette / fonts / voice guide from the Brand drawer.
  const brand = await getBrand().catch(() => CLIENT_BRAND);

  if (types.has('drops')) {
    try {
      const allDrops = await listDrops();
      const cap = brand.studioConfig?.maxDropsPerLetter || CLIENT_BRAND.studioConfig?.maxDropsPerLetter || 4;
      dataContext.drops = allDrops.slice(0, cap);
    } catch (_) { dataContext.drops = []; }
  }
  if (types.has('recap')) dataContext.recap = [];

  const html = renderLetter(letter, brand, dataContext);
  return json({
    ok: true,
    html,
    subject:   letter.subject   || letter.name || `A note from ${brand.name}`,
    preheader: letter.preheader || '',
    dataContext,
  });
}
