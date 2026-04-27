// Reusable HTML building blocks for emails — brand-aware.
//
// Usage:
//   const { emailDocument, header, paragraph, ... } = blocks(brand);
//   emailDocument({ title, contentRows: header({...}) + paragraph(...) });
//
// `brand` defaults to CLIENT_BRAND but can be overridden at render time
// (e.g. when the Design Studio applies a preset).

import { CLIENT_BRAND } from './client-config.js';

export function blocks(brand) {
  const B = brand || CLIENT_BRAND;

  const BODY_BG = `radial-gradient(ellipse 800px 500px at 50% 0%, ${withAlpha(B.accent, 0.10)} 0%, transparent 60%), ${B.bg}`;
  const CARD_BG = `linear-gradient(180deg, ${B.surface} 0%, ${B.surfaceAlt} 100%)`;

  function emailDocument({ title, contentRows, includeSignoff = true, includeUnsubscribe = false }) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<!--[if mso]><style>* { font-family: Georgia, serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${B.bg};font-family:${B.bodyFont};-webkit-text-size-adjust:100%;">
<div style="background:${BODY_BG};padding:40px 16px;">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:${CARD_BG};border:1px solid ${B.border};box-shadow:0 30px 80px rgba(0,0,0,0.45);">
${contentRows}
${includeSignoff ? signoff() : ''}
${includeUnsubscribe ? unsubscribeFooter() : ''}
</table>
</div>
</body></html>`;
  }

  function header({ kicker, headline, subhead = null }) {
    return `<tr><td style="padding:60px 48px 18px;text-align:center;">
    ${kicker ? `
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;"><tr>
      <td width="4" height="4" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:0 12px;font-size:11px;letter-spacing:0.36em;text-transform:uppercase;color:${B.accent};font-weight:500;white-space:nowrap;">${kicker}</td>
      <td width="4" height="4" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>` : ''}
    <div style="font-family:${B.displayFont};font-size:48px;color:${B.text};line-height:1.02;letter-spacing:-0.018em;">${headline}</div>
    ${subhead ? `<div style="font-family:${B.displayFont};font-style:italic;font-size:19px;color:${B.accent};margin-top:16px;line-height:1.35;">${subhead}</div>` : ''}
  </td></tr>`;
  }

  function ornament() {
    return `<tr><td style="padding:24px 48px 0;text-align:center;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td width="5" height="5" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
      <td width="48" height="1" style="background:${B.accent};font-size:0;line-height:0;">&nbsp;</td>
      <td width="5" height="5" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>`;
  }

  function paragraph(text, { topPad = 32, bottomPad = 8 } = {}) {
    return `<tr><td style="padding:${topPad}px 48px ${bottomPad}px;">
    <p style="font-size:16px;line-height:1.78;color:${B.textSoft};margin:0;">${text}</p>
  </td></tr>`;
  }

  function paragraphs(texts) {
    if (!texts || !texts.length) return '';
    const inner = texts.map(t => `<p style="font-size:16px;line-height:1.78;color:${B.textSoft};margin:0 0 20px;">${t}</p>`).join('\n    ');
    return `<tr><td style="padding:32px 48px 8px;">
    ${inner}
  </td></tr>`;
  }

  function pullQuote(text) {
    return `<tr><td style="padding:32px 48px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${withAlpha(B.accent, 0.045)};border:1px solid ${B.borderSoft};border-left:3px solid ${B.accent};">
      <tr><td style="padding:28px 36px 28px 56px;position:relative;">
        <span style="font-family:'Georgia',serif;font-size:88px;color:${B.accent};opacity:0.28;position:absolute;left:18px;top:-6px;line-height:1;font-weight:400;">&ldquo;</span>
        <div style="font-family:${B.displayFont};font-style:italic;font-size:21px;color:${B.text};line-height:1.45;letter-spacing:-0.005em;">${text}</div>
      </td></tr>
    </table>
  </td></tr>`;
  }

  function divider({ topPad = 40, bottomPad = 0 } = {}) {
    return `<tr><td style="padding:${topPad}px 48px ${bottomPad}px;text-align:center;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td width="120" height="1" style="background:linear-gradient(90deg, transparent, ${B.border});font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:0 14px;color:${B.accent};font-size:10px;line-height:1;font-family:${B.displayFont};font-style:italic;">&middot;</td>
      <td width="120" height="1" style="background:linear-gradient(90deg, ${B.border}, transparent);font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>`;
  }

  function ctaPrimary(href, label) {
    return `<tr><td style="padding:32px 48px 12px;text-align:center;">
    <a href="${href}" style="display:inline-block;background:${B.ctaBg};color:${B.ctaFg};padding:19px 50px;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;font-family:${B.bodyFont};box-shadow:0 12px 30px rgba(0,0,0,0.32),0 1px 0 rgba(255,255,255,0.06) inset;border-radius:1px;">${label}</a>
  </td></tr>`;
  }

  function ctaOutline(href, label) {
    return `<tr><td style="padding:24px 48px 8px;text-align:center;">
    <a href="${href}" style="display:inline-block;border:1px solid ${B.accent};color:${B.accent};padding:15px 40px;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;background:${withAlpha(B.accent, 0.04)};">${label}</a>
  </td></tr>`;
  }

  function signoff() {
    return `<tr><td style="padding:56px 48px 12px;text-align:center;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td width="100" height="1" style="background:linear-gradient(90deg, transparent, ${B.border});font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:0 12px;font-family:${B.displayFont};font-style:italic;font-size:13px;color:${B.accent};opacity:0.75;">until next time</td>
      <td width="100" height="1" style="background:linear-gradient(90deg, ${B.border}, transparent);font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:30px 48px 52px;text-align:center;">
    <div style="font-family:${B.displayFont};font-style:italic;font-size:26px;color:${B.text};line-height:1.15;margin-bottom:8px;letter-spacing:-0.005em;">${B.name}</div>
    <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${B.muted};margin-bottom:22px;">${B.role}</div>
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 22px;"><tr>
      <td width="5" height="5" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
      <td width="60" height="1" style="background:${B.accent};opacity:0.45;font-size:0;line-height:0;">&nbsp;</td>
      <td width="5" height="5" style="background:${B.accent};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
    <a href="${B.siteUrl}" style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${B.accent};text-decoration:none;">${B.domain}</a>
  </td></tr>`;
  }

  function unsubscribeFooter() {
    return `<tr><td style="padding:0 48px 32px;text-align:center;">
    <div style="font-size:11px;color:${B.muted};line-height:1.6;">You're receiving this because you subscribed at ${B.domain}.<br/>
    <a href="${B.unsubscribeUrl}" style="color:${B.muted};text-decoration:underline;">Unsubscribe</a></div>
  </td></tr>`;
  }

  return {
    emailDocument, header, ornament, paragraph, paragraphs,
    pullQuote, divider, ctaPrimary, ctaOutline, signoff, unsubscribeFooter,
  };
}

// Convert a #RRGGBB hex to an rgba() string at the given alpha.
// Falls back to the original color if input isn't a 6-digit hex.
function withAlpha(hex, alpha) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex || '');
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
