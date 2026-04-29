export const config = { runtime: 'edge' };

import { authed, unauthorized, json } from '../../lib/studio/auth.js';
import { SECTION_TYPES } from '../../lib/studio/section-types.js';
import { CLIENT_BRAND } from '../../lib/client-config.js';

// GET → returns the bits of CLIENT_BRAND + studioConfig + section registry
// that the Studio UI needs to render itself. Single source of truth so the
// UI doesn't have to duplicate the section-types registry.

export default async function handler(req) {
  if (!authed(req)) return unauthorized();
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const sc = CLIENT_BRAND.studioConfig || {};
  const enabledIds = sc.sectionTypes || Object.keys(SECTION_TYPES);
  const sectionTypes = {};
  for (const id of enabledIds) {
    if (SECTION_TYPES[id]) {
      // Strip the AI prompt from the client payload — the prompt is
      // server-side only (used by the Phase 3 AI assistant).
      const { aiPrompt, ...rest } = SECTION_TYPES[id];
      sectionTypes[id] = rest;
    }
  }

  return json({
    ok: true,
    brand: {
      name:         CLIENT_BRAND.name,
      role:         CLIENT_BRAND.role,
      domain:       CLIENT_BRAND.domain,
      siteUrl:      CLIENT_BRAND.siteUrl,
      bg:           CLIENT_BRAND.bg,
      surface:      CLIENT_BRAND.surface,
      surfaceAlt:   CLIENT_BRAND.surfaceAlt,
      border:       CLIENT_BRAND.border,
      borderSoft:   CLIENT_BRAND.borderSoft,
      text:         CLIENT_BRAND.text,
      textSoft:     CLIENT_BRAND.textSoft,
      muted:        CLIENT_BRAND.muted,
      accent:       CLIENT_BRAND.accent,
      displayFont:  CLIENT_BRAND.displayFont,
      bodyFont:     CLIENT_BRAND.bodyFont,
    },
    studioConfig: sc,
    sectionTypes,
    sectionTypeOrder: enabledIds,
  });
}
