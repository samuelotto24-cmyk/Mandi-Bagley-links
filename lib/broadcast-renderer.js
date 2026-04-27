// Renders a broadcast email from a structured draft.
// Brand-aware — pass `brand` to apply Design Studio overrides.

import { blocks } from './email-blocks.js';
import { CLIENT_BRAND } from './client-config.js';

function splitParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
}

export function renderBroadcast(draft, brand) {
  const B = brand || CLIENT_BRAND;
  const {
    emailDocument, header, paragraphs, pullQuote, ctaPrimary, ctaOutline, divider, ornament,
  } = blocks(B);

  const headline    = String(draft.headline   || '').trim() || `From ${B.name}`;
  const kicker      = String(draft.kicker     || '').trim() || null;
  const subhead     = String(draft.subhead    || '').trim() || null;
  const bodyParas   = splitParagraphs(draft.body);
  const quote       = String(draft.pull_quote || '').trim() || null;
  const ctaLabel    = String(draft.cta_label  || '').trim();
  const ctaUrl      = String(draft.cta_url    || '').trim();
  const ctaSecLabel = String(draft.cta_secondary_label || '').trim();
  const ctaSecUrl   = String(draft.cta_secondary_url   || '').trim();

  const rows = [];
  rows.push(header({ kicker, headline, subhead }));
  if (subhead || kicker) rows.push(ornament());
  if (bodyParas.length) rows.push(paragraphs(bodyParas));
  if (quote) rows.push(pullQuote(quote));
  if (ctaLabel && ctaUrl) {
    rows.push(divider({ topPad: 24 }));
    rows.push(ctaPrimary(ctaUrl, ctaLabel));
  }
  if (ctaSecLabel && ctaSecUrl) {
    rows.push(ctaOutline(ctaSecUrl, ctaSecLabel));
  }

  return emailDocument({
    title: draft.subject || headline,
    contentRows: rows.join('\n'),
    includeSignoff: true,
    includeUnsubscribe: true,
  });
}
