export const config = { runtime: 'edge' };

import { CLIENT_BRAND } from '../../lib/client-config.js';
import { SECTION_TYPES } from '../../lib/studio/section-types.js';
import { studioKey, redisCmd } from '../../lib/studio/redis.js';
import { createLetter } from '../../lib/studio/letters-store.js';

// Vercel cron-driven endpoint. Runs weekly; only creates a draft if the
// configured cadence (studioConfig.lockInCadenceWeeks, default 2) has passed
// since the last assembly.
//
// What it does:
//   - Checks studio:lockin:last_draft_at against now
//   - If due: creates a draft letter with the sections from
//     studioConfig.lockInPreset, in order, each with a sensible empty payload
//   - Saves studio:lockin:last_draft_at = now
//   - Sends Mandi a heads-up email so she opens and fills the draft
//
// It NEVER auto-sends. The draft is always human-reviewed.

const CRON_SECRET = process.env.CRON_SECRET;
const PASSWORD    = process.env.DASHBOARD_PASSWORD;
const RESEND_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL  = process.env.CONTACT_FROM_EMAIL || `hub@${CLIENT_BRAND.domain}`;
const TO_EMAIL    = process.env.CLIENT_EMAIL || process.env.CONTACT_TO_EMAIL;

const LAST_KEY     = studioKey('lockin:last_draft_at');
const DISABLED_KEY = studioKey('lockin:disabled');

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function sectionDefault(typeId) {
  const t = SECTION_TYPES[typeId];
  if (!t) return null;
  // Reasonable empty payload per type
  switch (typeId) {
    case 'drops':       return { intro: 'A few things dropping this week:', selectedDropIds: [] };
    case 'recap':       return { intro: 'In case you missed it:', postIds: [] };
    case 'favorites':   return { intro: 'Things I keep reaching for:', items: [] };
    case 'qa':          return { intro: 'You asked. I answered.', pairs: [] };
    case 'giveaway':    return { prize: '', rules: '', deadline: '', cta: 'Reply with the word "yes"' };
    case 'recipe':      return { title: '', intro: '', ingredients: '', steps: '', photo: '' };
    case 'devotional':  return { scripture: '', verseText: '', reflection: '' };
    case 'realtalk':    return { topic: '', body: '' };
    case 'freeletter':  return { body: '' };
    default:            return {};
  }
}

async function notifyCreator({ letter }) {
  if (!RESEND_KEY || !TO_EMAIL) return { ok: false, skipped: true };
  const editUrl = `${CLIENT_BRAND.siteUrl}/hub/studio?id=${encodeURIComponent(letter.id)}`;
  const subject = `Your ${CLIENT_BRAND.studioConfig?.lockInLetterName || 'Lock-In Letter'} draft is ready`;
  const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:${CLIENT_BRAND.bg};font-family:${CLIENT_BRAND.bodyFont};">
<div style="padding:36px 16px;">
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background:${CLIENT_BRAND.surface};border:1px solid ${CLIENT_BRAND.border};">
    <tr><td style="padding:32px 32px 16px;">
      <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${CLIENT_BRAND.muted};margin-bottom:8px;">Letter Studio</div>
      <div style="font-family:${CLIENT_BRAND.displayFont};font-style:italic;font-size:30px;color:${CLIENT_BRAND.text};line-height:1.15;">Your draft is ready to review.</div>
    </td></tr>
    <tr><td style="padding:0 32px 16px;">
      <p style="font-size:15px;color:${CLIENT_BRAND.textSoft};line-height:1.65;margin:0 0 16px;">
        Hey ${CLIENT_BRAND.name.split(' ')[0]} — I assembled the next ${esc(letter.name)} skeleton with the sections you've set in your Lock-In preset. It's a draft. Open it, fill in what feels right, edit, send when you're ready.
      </p>
      <p style="font-size:14px;color:${CLIENT_BRAND.muted};line-height:1.6;margin:0;">
        I never auto-send these. You're the one who hits Send.
      </p>
    </td></tr>
    <tr><td style="padding:8px 32px 32px;">
      <a href="${editUrl}" style="display:inline-block;background:${CLIENT_BRAND.text};color:${CLIENT_BRAND.bg};padding:14px 28px;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;">Open Studio →</a>
    </td></tr>
  </table>
</div>
</body></html>`.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: `${CLIENT_BRAND.name} <${FROM_EMAIL}>`,
        to: [TO_EMAIL],
        subject,
        html,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export default async function handler(req) {
  // Auth: cron secret OR dashboard password (so manual trigger works)
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const validTokens = [CRON_SECRET, PASSWORD].filter(Boolean);
  if (!token || !validTokens.includes(token)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  const action = url.searchParams.get('action');

  // ── Toggle endpoint: pause / resume the auto-draft cron ──
  // POST /api/studio/lockin-suggest?action=set-disabled  body: { disabled: true|false }
  if (action === 'set-disabled') {
    let body = {};
    try { body = await req.json(); } catch { /* allow empty */ }
    if (body.disabled === true) {
      await redisCmd('SET', DISABLED_KEY, '1');
      return json({ ok: true, kind: 'lockin', disabled: true });
    } else {
      await redisCmd('DEL', DISABLED_KEY);
      return json({ ok: true, kind: 'lockin', disabled: false });
    }
  }
  if (action === 'get-status') {
    const isDisabled = (await redisCmd('GET', DISABLED_KEY)) === '1';
    const lastAt = Number(await redisCmd('GET', LAST_KEY) || 0);
    return json({ ok: true, kind: 'lockin', disabled: isDisabled, lastDraftAt: lastAt });
  }

  // Pause check — if Mandi disabled the Lock-In auto-draft from Messages,
  // skip silently. Manual "force" still respects the toggle.
  const disabled = (await redisCmd('GET', DISABLED_KEY)) === '1';
  if (disabled) {
    return json({ ok: true, skipped: true, reason: 'paused' });
  }

  const cadenceWeeks = CLIENT_BRAND.studioConfig?.lockInCadenceWeeks || 2;
  const cadenceMs = cadenceWeeks * 7 * 24 * 60 * 60 * 1000;

  const lastAt = Number(await redisCmd('GET', LAST_KEY) || 0);
  const now = Date.now();
  if (!force && lastAt && (now - lastAt) < cadenceMs) {
    return json({ ok: true, skipped: true, reason: 'too_soon', nextDueAt: lastAt + cadenceMs });
  }

  // Build the section payload from the preset
  const preset = CLIENT_BRAND.studioConfig?.lockInPreset || [];
  const sections = preset
    .filter(id => SECTION_TYPES[id])
    .map(id => ({
      id: newId('s'),
      type: id,
      fields: sectionDefault(id) || {},
    }));

  const dateLabel = new Date(now).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const letterName = `${CLIENT_BRAND.studioConfig?.lockInLetterName || 'Lock-In Letter'} — ${dateLabel}`;

  const letter = await createLetter({
    name: letterName,
    subject: '',
    preheader: '',
    sections,
  });

  await redisCmd('SET', LAST_KEY, String(now));
  const notify = await notifyCreator({ letter });

  return json({
    ok: true,
    created: true,
    letter: { id: letter.id, name: letter.name },
    sections: sections.length,
    notified: notify.ok,
    nextDueAt: now + cadenceMs,
  });
}
