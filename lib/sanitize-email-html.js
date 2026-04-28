// Minimal whitelist-based HTML sanitizer for creator-pasted email designs.
// Edge-runtime safe (no DOM, no Node APIs).
//
// We're not defending against attackers — Cass is the only person who can paste
// HTML, and the audience is her own subscribers. We're stripping things that
// either break email clients or leak hub-side script execution if previewed.

const STRIP_TAGS = [
  'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'noscript', 'meta', 'link', 'base',
];

const URL_ATTRS = ['href', 'src', 'action', 'background'];

// Strip a whole tag including its content (script-like)
function stripFullTag(html, tag) {
  const re = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
  let out = html.replace(re, '');
  // Also self-closing or no-content variants
  const reSelf = new RegExp(`<${tag}\\b[^>]*/?>`, 'gi');
  out = out.replace(reSelf, '');
  return out;
}

// Strip on* event handlers (onload="..." etc.)
function stripEventHandlers(html) {
  // Match on<word>="..." or on<word>='...' or on<word>=value
  return html.replace(/\son[a-z]+\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s>]+)/gi, '');
}

// Neutralize javascript: and data: in URL attributes (data: URIs in src can be huge or risky)
function neutralizeBadUrls(html) {
  return html.replace(
    /\b(href|src|action|background)\s*=\s*("|')\s*(javascript|vbscript|data):/gi,
    '$1=$2#blocked-$3:'
  );
}

// Wrap fragmentary HTML so it has html/body structure (some Claude artifacts just dump body content)
function wrapIfFragment(html) {
  const trimmed = html.trim();
  if (/^<!doctype/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return trimmed;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;">${trimmed}</body></html>`;
}

// Light, fast detection of email-incompatible CSS so we can warn the user
function detectIncompatibilities(html) {
  const warnings = [];
  if (/display\s*:\s*flex/i.test(html))                    warnings.push('uses display:flex (Outlook drops this)');
  if (/display\s*:\s*grid/i.test(html))                    warnings.push('uses CSS grid (most email clients drop this)');
  if (/position\s*:\s*absolute|position\s*:\s*fixed/i.test(html)) warnings.push('uses absolute/fixed positioning (unreliable in email)');
  if (/<style\b[^>]*>[\s\S]*?@media/i.test(html) === false && /<style\b/i.test(html)) {
    // has style blocks — many clients (especially Gmail) inline-strip <style>; warn
    warnings.push('uses <style> blocks (Gmail inlines these — inline styles are safer)');
  }
  if (!/<table\b/i.test(html))                             warnings.push('no <table> layout (Outlook needs tables for reliable layout)');
  return warnings;
}

export function sanitizeEmailHtml(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { ok: false, error: 'empty_input' };
  }
  let html = rawInput;

  // 1. Strip dangerous tags + their content (script, iframe, etc.)
  for (const tag of STRIP_TAGS) {
    html = stripFullTag(html, tag);
  }

  // 2. Strip on* event handlers
  html = stripEventHandlers(html);

  // 3. Neutralize javascript: / vbscript: / data: in URL attributes
  html = neutralizeBadUrls(html);

  // 4. Strip leading "Here's your newsletter:" preamble Claude sometimes adds
  //    Look for chat-style preamble before the actual HTML
  const firstTagIdx = html.search(/<(?:!doctype|html|body|table|div|p|h[1-6])\b/i);
  if (firstTagIdx > 0 && firstTagIdx < 1000) {
    html = html.slice(firstTagIdx);
  }
  // Also strip code-fence wrappers like ```html ... ```
  html = html.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // 5. Wrap fragments
  html = wrapIfFragment(html);

  // 6. Sanity check
  if (html.length < 50) {
    return { ok: false, error: 'too_short', detail: 'Pasted content is too short to be a real email.' };
  }
  if (html.length > 500_000) {
    return { ok: false, error: 'too_large', detail: 'HTML is over 500KB — probably has embedded images. Host them and reference URLs instead.' };
  }

  // 7. Email-client compatibility warnings (non-blocking)
  const warnings = detectIncompatibilities(html);

  return {
    ok: true,
    html,
    warnings,
    bytes: html.length,
  };
}
