// Renders a broadcast email from a structured draft.
// Brand-aware AND draft-aware — per-broadcast design + signoff overrides apply.

import { blocks } from './email-blocks.js';
import { CLIENT_BRAND } from './client-config.js';

function splitParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
}

// Merge per-broadcast design overrides on top of the brand. Each null/empty
// override falls back to the brand-level default.
function mergeBrand(base, design) {
  const out = { ...base };
  if (!design) return out;
  if (design.accentColor)  { out.accent = design.accentColor; out.ctaBg = design.accentColor; }
  if (design.bgColor)      { out.bg = design.bgColor; }
  if (design.displayFont)  out.displayFont = design.displayFont;
  if (design.bodyFont)     out.bodyFont = design.bodyFont;
  return out;
}

// Build a custom signoff row (overrides the default factory signoff).
function customSignoff(B, signoff) {
  const closing = String(signoff?.closing || '').trim() || 'until next time';
  const name    = String(signoff?.name    || '').trim() || B.name;
  const role    = String(signoff?.role    || '').trim() || B.role || '';
  const showRole = role.length > 0;
  return `<tr><td style="padding:56px 48px 12px;text-align:center;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td width="100" height="1" style="background:linear-gradient(90deg, transparent, ${B.border});font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:0 12px;font-family:${B.displayFont};font-style:italic;font-size:13px;color:${B.accent};opacity:0.75;">${escapeHtml(closing)}</td>
      <td width="100" height="1" style="background:linear-gradient(90deg, ${B.border}, transparent);font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:30px 48px 52px;text-align:center;">
    <div style="font-family:${B.displayFont};font-style:italic;font-size:26px;color:${B.text};line-height:1.15;margin-bottom:8px;letter-spacing:-0.005em;">${escapeHtml(name)}</div>
    ${showRole ? `<div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${B.muted};margin-bottom:22px;">${escapeHtml(role)}</div>` : ''}
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 22px;"><tr>
      <td width="5" height="5" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
      <td width="60" height="1" style="background:${B.accent};opacity:0.45;font-size:0;line-height:0;">&nbsp;</td>
      <td width="5" height="5" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
    <a href="${B.siteUrl}" style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${B.accent};text-decoration:none;">${B.domain}</a>
  </td></tr>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Auto-inject an unsubscribe footer just before </body> in custom-imported HTML.
function injectUnsubscribe(html, B) {
  const footer = `
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;margin:0 auto;">
  <tr><td style="padding:24px 48px 32px;text-align:center;font-family:${B.bodyFont || 'system-ui'};">
    <div style="font-size:11px;color:${B.muted || '#888'};line-height:1.6;">You're receiving this because you subscribed at ${B.domain}.<br/>
    <a href="${B.unsubscribeUrl}" style="color:${B.muted || '#888'};text-decoration:underline;">Unsubscribe</a></div>
  </td></tr>
</table>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, footer + '</body>');
  }
  return html + footer;
}

export function renderBroadcast(draft, brand) {
  const baseBrand = brand || CLIENT_BRAND;
  const B = mergeBrand(baseBrand, draft.design);

  // Custom HTML path — when Cass has imported a Claude-designed artifact.
  // Use her HTML verbatim, just inject the unsubscribe footer.
  if (draft.customHtml && draft.customHtml.length > 50) {
    return injectUnsubscribe(draft.customHtml, B);
  }

  const headlineSize = (draft.design && draft.design.headlineSize) || 48;

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

  const showPullQuote    = !draft.design || draft.design.showPullQuote    !== false;
  const showSecondaryCta = !draft.design || draft.design.showSecondaryCta !== false;

  const rows = [];
  // Header — patch in the custom headline size if set
  let headerRow = header({ kicker, headline, subhead });
  if (headlineSize !== 48) {
    headerRow = headerRow.replace(
      /font-size:48px/,
      `font-size:${headlineSize}px`
    );
  }
  rows.push(headerRow);
  if (subhead || kicker) rows.push(ornament());
  if (bodyParas.length) rows.push(paragraphs(bodyParas));
  if (showPullQuote && quote) rows.push(pullQuote(quote));
  if (ctaLabel && ctaUrl) {
    rows.push(divider({ topPad: 24 }));
    rows.push(ctaPrimary(ctaUrl, ctaLabel));
  }
  if (showSecondaryCta && ctaSecLabel && ctaSecUrl) {
    rows.push(ctaOutline(ctaSecUrl, ctaSecLabel));
  }

  // Use custom signoff if any signoff field is set, else default factory signoff
  const hasCustomSignoff = draft.signoff && (draft.signoff.closing || draft.signoff.name || draft.signoff.role);
  const signoffRow = hasCustomSignoff ? customSignoff(B, draft.signoff) : null;

  return emailDocument({
    title: draft.subject || headline,
    contentRows: rows.join('\n') + (signoffRow || ''),
    includeSignoff: !signoffRow,
    includeUnsubscribe: true,
  });
}
