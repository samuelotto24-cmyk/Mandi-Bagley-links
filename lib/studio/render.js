// Letter renderer — turns a saved letter (meta + sections) into the final
// HTML email body. Template-level: every client uses these renderers; per-
// client styling is read from CLIENT_BRAND.
//
// Public API:
//   renderLetter(letter, brand, dataContext)
//     letter      → { name, subject, preheader, sections: [...] }
//     brand       → CLIENT_BRAND
//     dataContext → { drops?: [Drop[]], recap?: [Post[]] } pre-fetched by caller
//
//   renderSection(section, brand, dataContext)
//
//   buildPlainText(letter)  → text/plain version (no HTML), one for accessibility / spam scoring

import { CLIENT_BRAND as DEFAULT_BRAND } from '../client-config.js';
import { SECTION_TYPES } from './section-types.js';

// ── Escape helpers ────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// Allow inline <em> and <strong> (per the voice guide); strip everything else.
function richInline(s) {
  if (s == null) return '';
  // First escape, then re-allow <em>/<strong>
  let out = esc(s);
  out = out
    .replace(/&lt;em&gt;/g,  '<em>')
    .replace(/&lt;\/em&gt;/g,'</em>')
    .replace(/&lt;strong&gt;/g,  '<strong>')
    .replace(/&lt;\/strong&gt;/g,'</strong>');
  return out;
}
// Markdown-ish link replacer for [text](https://url)
function linkify(htmlEscaped, brand) {
  return htmlEscaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, text, url) => `<a href="${url}" style="color:${brand.accent};text-decoration:underline;">${text}</a>`
  );
}
function paragraphs(text, brand) {
  const lines = String(text || '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return lines.map(p =>
    `<p style="font-size:16px;line-height:1.75;color:${brand.textSoft};margin:0 0 14px;">${linkify(richInline(p).replace(/\n/g, '<br>'), brand)}</p>`
  ).join('\n');
}

// ── Section title (consistent typography across all section types) ────
function sectionTitle(label, kicker, brand) {
  return `
    <tr><td style="padding:36px 48px 4px;">
      <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${brand.muted};margin-bottom:6px;">${esc(kicker || label)}</div>
    </td></tr>
  `;
}

// ── Per-section renderers ─────────────────────────────────────────────
const RENDERERS = {
  devotional(fields, brand) {
    const verseRef  = esc(fields.scripture || '');
    const verseText = esc(fields.verseText || '');
    const reflection = paragraphs(fields.reflection, brand);
    return `
      ${sectionTitle('Devotional', 'Devotional', brand)}
      ${verseText ? `
      <tr><td style="padding:6px 48px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(220,38,38,0.045);border:1px solid ${brand.borderSoft};border-left:3px solid ${brand.accent};">
          <tr><td style="padding:22px 28px;">
            <div style="font-family:${brand.displayFont};font-style:italic;font-size:19px;color:${brand.text};line-height:1.45;letter-spacing:-0.005em;">${verseText}</div>
            ${verseRef ? `<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${brand.accent};margin-top:10px;">${verseRef}</div>` : ''}
          </td></tr>
        </table>
      </td></tr>` : ''}
      <tr><td style="padding:18px 48px 8px;">${reflection}</td></tr>
    `;
  },

  realtalk(fields, brand) {
    const topic = esc(fields.topic || '');
    const body  = paragraphs(fields.body, brand);
    return `
      ${sectionTitle('Real Talk', 'Real Talk', brand)}
      ${topic ? `<tr><td style="padding:0 48px 12px;">
        <h2 style="font-family:${brand.displayFont};font-weight:500;font-size:30px;color:${brand.text};margin:0 0 4px;line-height:1.15;letter-spacing:-0.01em;">${topic}</h2>
      </td></tr>` : ''}
      <tr><td style="padding:6px 48px 8px;">${body}</td></tr>
    `;
  },

  recipe(fields, brand) {
    const title  = esc(fields.title || '');
    const intro  = esc(fields.intro || '');
    const photo  = esc(fields.photo || '');
    const ingredients = String(fields.ingredients || '').split('\n').map(s => s.trim()).filter(Boolean);
    const steps  = String(fields.steps || '').split('\n').map(s => s.trim()).filter(Boolean);

    const ingHtml = ingredients.length
      ? `<ul style="list-style:none;padding:0;margin:0;">${ingredients.map(i =>
          `<li style="padding:6px 0;border-bottom:1px solid ${brand.borderSoft};font-size:14px;color:${brand.textSoft};">${esc(i)}</li>`
        ).join('')}</ul>`
      : '';
    const stepsHtml = steps.length
      ? `<ol style="padding-left:20px;margin:0;">${steps.map(s =>
          `<li style="padding:8px 0;font-size:14px;color:${brand.textSoft};line-height:1.6;">${esc(s)}</li>`
        ).join('')}</ol>`
      : '';

    return `
      ${sectionTitle('Recipe', 'A fun recipe', brand)}
      ${title ? `<tr><td style="padding:0 48px 8px;">
        <h2 style="font-family:${brand.displayFont};font-weight:500;font-size:28px;color:${brand.text};margin:0;letter-spacing:-0.005em;">${title}</h2>
      </td></tr>` : ''}
      ${intro ? `<tr><td style="padding:0 48px 12px;">
        <p style="font-size:15px;color:${brand.muted};margin:0;font-style:italic;">${intro}</p>
      </td></tr>` : ''}
      ${photo ? `<tr><td style="padding:6px 48px 18px;">
        <img src="${photo}" alt="${title}" width="504" style="display:block;width:100%;max-width:504px;height:auto;border:1px solid ${brand.border};">
      </td></tr>` : ''}
      ${ingHtml ? `<tr><td style="padding:6px 48px 4px;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${brand.muted};margin-bottom:8px;">Ingredients</div>
        ${ingHtml}
      </td></tr>` : ''}
      ${stepsHtml ? `<tr><td style="padding:18px 48px 8px;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${brand.muted};margin-bottom:8px;">Steps</div>
        ${stepsHtml}
      </td></tr>` : ''}
    `;
  },

  drops(fields, brand, dataCtx = {}) {
    const intro = esc(fields.intro || 'A few things dropping this week:');
    const all   = Array.isArray(dataCtx.drops) ? dataCtx.drops : [];
    const selected = Array.isArray(fields.selectedDropIds) && fields.selectedDropIds.length
      ? all.filter(d => fields.selectedDropIds.includes(d.id))
      : all;
    if (!selected.length) {
      return `
        ${sectionTitle('Drops', 'Drops', brand)}
        <tr><td style="padding:6px 48px 8px;">
          <p style="font-size:14px;color:${brand.muted};margin:0;font-style:italic;">No active drops this week.</p>
        </td></tr>
      `;
    }
    const rows = selected.map(d => `
      <tr><td style="padding:14px 0;border-bottom:1px solid ${brand.borderSoft};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${d.image ? `<td width="80" valign="top" style="padding-right:14px;">
              <a href="${esc(d.link || '#')}" style="text-decoration:none;"><img src="${esc(d.image)}" alt="${esc(d.brand)}" width="80" style="display:block;width:80px;height:80px;object-fit:cover;border:1px solid ${brand.border};"></a>
            </td>` : ''}
            <td valign="top">
              <div style="font-family:${brand.displayFont};font-size:20px;color:${brand.text};line-height:1.1;margin-bottom:4px;font-weight:500;">${esc(d.brand)}</div>
              ${d.description ? `<div style="font-size:13px;color:${brand.textSoft};line-height:1.5;margin-bottom:8px;">${esc(d.description)}</div>` : ''}
              <a href="${esc(d.link || '#')}" style="display:inline-block;text-decoration:none;background:${brand.accent}1A;color:${brand.accent};padding:5px 10px;font-size:11px;letter-spacing:0.12em;font-weight:600;font-family:'DM Mono','SF Mono',Menlo,monospace;border-radius:2px;">${esc(d.code)}</a>
            </td>
          </tr>
        </table>
      </td></tr>
    `).join('');

    return `
      ${sectionTitle('Drops', 'Drops · use my code', brand)}
      <tr><td style="padding:0 48px 6px;">
        <p style="font-size:14px;color:${brand.textSoft};margin:0 0 8px;">${intro}</p>
      </td></tr>
      <tr><td style="padding:0 48px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${rows}
        </table>
      </td></tr>
    `;
  },

  favorites(fields, brand) {
    const intro = esc(fields.intro || 'Things I keep reaching for:');
    const items = Array.isArray(fields.items) ? fields.items : [];
    if (!items.length) {
      return `
        ${sectionTitle('Favorites', 'Favorites', brand)}
        <tr><td style="padding:6px 48px 8px;">
          <p style="font-size:14px;color:${brand.muted};margin:0;font-style:italic;">No favorites added yet.</p>
        </td></tr>
      `;
    }
    const rows = items.map(it => `
      <tr><td style="padding:12px 0;border-bottom:1px solid ${brand.borderSoft};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${it.photo ? `<td width="64" valign="top" style="padding-right:14px;">
              <img src="${esc(it.photo)}" alt="${esc(it.label || '')}" width="64" style="display:block;width:64px;height:64px;object-fit:cover;border:1px solid ${brand.border};">
            </td>` : ''}
            <td valign="top">
              ${it.link
                ? `<a href="${esc(it.link)}" style="font-family:${brand.displayFont};font-size:18px;color:${brand.text};text-decoration:none;line-height:1.2;font-weight:500;">${esc(it.label || 'Untitled')} <span style="color:${brand.accent};font-size:13px;">↗</span></a>`
                : `<div style="font-family:${brand.displayFont};font-size:18px;color:${brand.text};line-height:1.2;font-weight:500;">${esc(it.label || 'Untitled')}</div>`}
              ${it.note ? `<div style="font-size:13px;color:${brand.textSoft};line-height:1.5;margin-top:4px;">${richInline(it.note)}</div>` : ''}
            </td>
          </tr>
        </table>
      </td></tr>
    `).join('');
    return `
      ${sectionTitle('Favorites', 'Favorites', brand)}
      <tr><td style="padding:0 48px 4px;">
        <p style="font-size:14px;color:${brand.textSoft};margin:0 0 8px;font-style:italic;">${intro}</p>
      </td></tr>
      <tr><td style="padding:0 48px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
      </td></tr>
    `;
  },

  qa(fields, brand) {
    const intro = esc(fields.intro || 'You asked. I answered.');
    const pairs = Array.isArray(fields.pairs) ? fields.pairs : [];
    if (!pairs.length) {
      return `
        ${sectionTitle('Q&A', 'Q&A', brand)}
        <tr><td style="padding:6px 48px 8px;">
          <p style="font-size:14px;color:${brand.muted};margin:0;font-style:italic;">No questions answered this week.</p>
        </td></tr>
      `;
    }
    const rows = pairs.map(p => `
      <tr><td style="padding:14px 0;border-bottom:1px solid ${brand.borderSoft};">
        <div style="font-size:13px;color:${brand.muted};margin-bottom:4px;">
          ${p.askerLabel ? esc(p.askerLabel) + ' asked:' : 'Someone asked:'}
        </div>
        <div style="font-family:${brand.displayFont};font-style:italic;font-size:18px;color:${brand.text};line-height:1.4;margin-bottom:10px;">${esc(p.question || '')}</div>
        <div style="font-size:15px;color:${brand.textSoft};line-height:1.7;">${richInline(p.answer || '').replace(/\n/g,'<br>')}</div>
      </td></tr>
    `).join('');
    return `
      ${sectionTitle('Q&A', 'Q&A', brand)}
      <tr><td style="padding:0 48px 4px;">
        <p style="font-size:14px;color:${brand.textSoft};margin:0 0 8px;font-style:italic;">${intro}</p>
      </td></tr>
      <tr><td style="padding:0 48px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
      </td></tr>
    `;
  },

  recap(fields, brand, dataCtx = {}) {
    const intro = esc(fields.intro || 'In case you missed it:');
    const posts = Array.isArray(dataCtx.recap) ? dataCtx.recap : [];
    if (!posts.length) {
      return `
        ${sectionTitle('Content Recap', 'In case you missed it', brand)}
        <tr><td style="padding:0 48px 4px;">
          <p style="font-size:14px;color:${brand.textSoft};margin:0 0 8px;font-style:italic;">${intro}</p>
        </td></tr>
        <tr><td style="padding:0 48px 8px;">
          <p style="font-size:13px;color:${brand.muted};margin:0;font-style:italic;">No recap items this week.</p>
        </td></tr>
      `;
    }
    const rows = posts.map(p => `
      <tr><td style="padding:14px 0;border-bottom:1px solid ${brand.borderSoft};">
        <a href="${esc(p.link || '#')}" style="text-decoration:none;display:block;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            ${p.thumb ? `<td width="80" valign="top" style="padding-right:14px;">
              <img src="${esc(p.thumb)}" alt="" width="80" style="display:block;width:80px;height:80px;object-fit:cover;border:1px solid ${brand.border};">
            </td>` : ''}
            <td valign="top">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${brand.muted};margin-bottom:4px;">${esc(p.platform || '')}</div>
              <div style="font-size:14px;color:${brand.text};line-height:1.45;">${esc(p.caption || '')}</div>
            </td>
          </tr></table>
        </a>
      </td></tr>
    `).join('');
    return `
      ${sectionTitle('Content Recap', 'In case you missed it', brand)}
      <tr><td style="padding:0 48px 4px;">
        <p style="font-size:14px;color:${brand.textSoft};margin:0 0 8px;font-style:italic;">${intro}</p>
      </td></tr>
      <tr><td style="padding:0 48px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
      </td></tr>
    `;
  },

  giveaway(fields, brand) {
    const prize    = esc(fields.prize || '');
    const rules    = paragraphs(fields.rules, brand);
    const deadline = esc(fields.deadline || '');
    const cta      = esc(fields.cta || 'Reply to enter');
    return `
      ${sectionTitle('Giveaway', 'Giveaway', brand)}
      <tr><td style="padding:6px 48px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(220,38,38,0.06);border:1px solid ${brand.accent}40;">
          <tr><td style="padding:24px 28px;">
            <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${brand.accent};margin-bottom:8px;font-weight:600;">A surprise giveaway</div>
            ${prize ? `<div style="font-family:${brand.displayFont};font-size:24px;color:${brand.text};line-height:1.2;margin-bottom:12px;font-weight:500;">${prize}</div>` : ''}
            ${rules}
            ${deadline ? `<div style="font-size:13px;color:${brand.textSoft};margin-top:10px;">Entries close <strong>${deadline}</strong>.</div>` : ''}
            <div style="margin-top:18px;font-size:14px;color:${brand.text};font-weight:600;">${cta}</div>
          </td></tr>
        </table>
      </td></tr>
    `;
  },

  freeletter(fields, brand) {
    const body = paragraphs(fields.body, brand);
    // If this section was created via "Insert Video", render a clickable
    // thumbnail above the body so the email shows a play-card.
    const videoBlock = (fields._videoUrl && fields._videoThumb)
      ? `<tr><td style="padding:24px 48px 0;text-align:center;">
           <a href="${esc(fields._videoUrl)}" style="text-decoration:none;display:inline-block;position:relative;">
             <img src="${esc(fields._videoThumb)}" alt="Watch video" width="504" style="display:block;width:100%;max-width:504px;height:auto;border:1px solid ${brand.border};">
             <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
               <span style="background:rgba(0,0,0,0.55);color:#fff;font-size:24px;padding:14px 22px;border-radius:99px;">▶ Watch</span>
             </div>
           </a>
         </td></tr>`
      : '';
    return videoBlock + `<tr><td style="padding:24px 48px 8px;">${body}</td></tr>`;
  },
};

export function renderSection(section, brand = DEFAULT_BRAND, dataContext = {}) {
  if (!section || !section.type) return '';
  const fn = RENDERERS[section.type];
  if (!fn) return '';
  try {
    return fn(section.fields || {}, brand, dataContext);
  } catch (e) {
    return `<tr><td style="padding:24px 48px;color:#c44;font-size:13px;">[render error in ${esc(section.type)}: ${esc(String(e.message||e))}]</td></tr>`;
  }
}

// ── Letter shell ──────────────────────────────────────────────────────
// If letter.type === 'custom' (from Design with Claude → Import HTML),
// the user pasted a complete HTML email artifact that bypasses the section
// system. Return it as-is so what she designed is exactly what ships.
// Otherwise iterate sections through the normal renderer.
export function renderLetter(letter, brand = DEFAULT_BRAND, dataContext = {}) {
  if (letter?.type === 'custom' && typeof letter.customHtml === 'string' && letter.customHtml.trim()) {
    return letter.customHtml;
  }

  const sections = Array.isArray(letter?.sections) ? letter.sections : [];
  const subject   = esc(letter?.subject   || letter?.name || 'A note from ' + brand.name);
  const preheader = esc(letter?.preheader || '');
  const sigName   = esc(brand.name || '');
  const role      = esc(brand.role || '');

  const unsubscribe = `${brand.unsubscribeUrl || (brand.siteUrl + '/unsubscribe')}`;
  const divider = `<tr><td style="padding:18px 48px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td height="1" style="background:${brand.border};font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>`;

  // Join sections with a divider between them (none before the first)
  const sectionsHtml = sections.map((s, i) => {
    const html = renderSection(s, brand, dataContext);
    return i === 0 ? html : (divider + html);
  }).join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title>
<!--[if mso]><style>* { font-family: Georgia, serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${brand.bg};font-family:${brand.bodyFont};-webkit-text-size-adjust:100%;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ''}
<div style="background:radial-gradient(ellipse 800px 500px at 50% 0%, rgba(220,38,38,0.06) 0%, transparent 60%), ${brand.bg};padding:40px 16px;">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:linear-gradient(180deg, ${brand.surface} 0%, ${brand.surfaceAlt} 100%);border:1px solid ${brand.border};box-shadow:0 30px 80px rgba(0,0,0,0.10);">

  <!-- ── Letter header ── -->
  <tr><td style="padding:42px 48px 14px;text-align:center;">
    <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${brand.muted};margin-bottom:10px;">${role}</div>
    <div style="font-family:${brand.displayFont};font-style:italic;font-size:34px;color:${brand.text};line-height:1.1;letter-spacing:-0.005em;">${esc(letter?.name || 'Letter')}</div>
  </td></tr>
  <tr><td style="padding:6px 48px 0;text-align:center;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td width="40" height="1" style="background:${brand.accent};opacity:0.6;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  ${sectionsHtml}

  <!-- ── Sign-off ── -->
  ${divider}
  <tr><td style="padding:30px 48px 12px;text-align:center;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td width="100" height="1" style="background:linear-gradient(90deg, transparent, ${brand.border});font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:0 12px;font-family:${brand.displayFont};font-style:italic;font-size:13px;color:${brand.accent};opacity:0.85;">until next time</td>
      <td width="100" height="1" style="background:linear-gradient(90deg, ${brand.border}, transparent);font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:18px 48px 52px;text-align:center;">
    <div style="font-family:${brand.displayFont};font-style:italic;font-size:26px;color:${brand.text};line-height:1.15;margin-bottom:6px;letter-spacing:-0.005em;">${sigName}</div>
    <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${brand.muted};">${role}</div>
  </td></tr>

  <!-- ── Footer ── -->
  <tr><td style="padding:0 48px 28px;text-align:center;">
    <a href="${brand.siteUrl}" style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${brand.accent};text-decoration:none;">${esc(brand.domain || '')}</a>
    <div style="font-size:11px;color:${brand.muted};margin-top:14px;">
      <a href="${esc(unsubscribe)}" style="color:${brand.muted};text-decoration:underline;">unsubscribe</a>
    </div>
  </td></tr>

</table>
</div>
</body></html>`;
}

// ── Plain-text fallback (used by Resend for accessibility / spam scoring) ──
export function buildPlainText(letter, brand = DEFAULT_BRAND) {
  const lines = [];
  lines.push(`${brand.name} — ${letter?.name || 'Letter'}`);
  lines.push('---');
  for (const s of letter?.sections || []) {
    const t = SECTION_TYPES[s.type];
    if (!t) continue;
    lines.push(t.label.toUpperCase());
    const f = s.fields || {};
    if (f.scripture) lines.push(f.scripture);
    if (f.verseText) lines.push(`"${f.verseText}"`);
    if (f.topic)     lines.push(f.topic);
    if (f.title)     lines.push(f.title);
    if (f.prize)     lines.push(`Prize: ${f.prize}`);
    if (f.intro)     lines.push(f.intro);
    if (f.body)      lines.push(f.body);
    if (f.reflection) lines.push(f.reflection);
    if (f.rules)     lines.push(f.rules);
    if (Array.isArray(f.items)) for (const it of f.items) lines.push(`  · ${it.label || ''} ${it.note ? '— ' + it.note : ''}`);
    if (Array.isArray(f.pairs)) for (const p of f.pairs) {
      lines.push(`Q: ${p.question || ''}`);
      lines.push(`A: ${p.answer || ''}`);
    }
    lines.push('');
  }
  lines.push(`— ${brand.name}`);
  lines.push(brand.siteUrl || '');
  return lines.join('\n');
}
