export const config = { runtime: 'edge' };

import { getOverrides, saveOverrides, resetOverrides, applyOverrides } from '../lib/brand-store.js';
import { THEME_PRESETS, DISPLAY_FONTS, BODY_FONTS } from '../lib/brand-presets.js';
import { CLIENT_BRAND } from '../lib/client-config.js';

const PASSWORD = process.env.DASHBOARD_PASSWORD || 'Cassandra2024';

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

export default async function handler(req) {
  if (!authed(req)) return json({ error: 'Unauthorized' }, 401);

  if (req.method === 'GET') {
    const over = await getOverrides();
    const brand = applyOverrides(over);
    return json({
      ok: true,
      overrides: over,
      brand,
      voiceGuide: brand.voiceGuide || CLIENT_BRAND.voiceGuide || '',
      voiceGuideDefault: CLIENT_BRAND.voiceGuide || '',
      defaults: {
        presetId:      null,        // null means "use client-config default"
        displayFontId: null,
        bodyFontId:    null,
      },
      options: {
        presets: Object.values(THEME_PRESETS).map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          swatches: p.swatches,
          palette: p.palette,
        })),
        displayFonts: Object.values(DISPLAY_FONTS).map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          family: f.family,
          googleFamily: f.googleFamily,
        })),
        bodyFonts: Object.values(BODY_FONTS).map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          family: f.family,
          googleFamily: f.googleFamily,
        })),
      },
      // Original client-config defaults so the UI can reset to them
      clientDefaults: {
        palette: {
          bg:         CLIENT_BRAND.bg,
          surface:    CLIENT_BRAND.surface,
          surfaceAlt: CLIENT_BRAND.surfaceAlt,
          border:     CLIENT_BRAND.border,
          borderSoft: CLIENT_BRAND.borderSoft,
          text:       CLIENT_BRAND.text,
          textSoft:   CLIENT_BRAND.textSoft,
          muted:      CLIENT_BRAND.muted,
          accent:     CLIENT_BRAND.accent,
          ctaBg:      CLIENT_BRAND.ctaBg,
          ctaFg:      CLIENT_BRAND.ctaFg,
        },
        displayFont: CLIENT_BRAND.displayFont,
        bodyFont:    CLIENT_BRAND.bodyFont,
      },
    });
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
    try {
      const saved = await saveOverrides(body);
      const brand = applyOverrides(saved);
      return json({ ok: true, overrides: saved, brand });
    } catch (e) {
      return json({ error: String(e.message || e) }, 400);
    }
  }

  if (req.method === 'DELETE') {
    try {
      await resetOverrides();
      return json({ ok: true, overrides: null, brand: applyOverrides(null) });
    } catch (e) {
      return json({ error: String(e.message || e) }, 400);
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
