export const config = { runtime: 'edge' };

import { getDraft, saveDraft } from '../lib/broadcast-store.js';
import { sanitizeEmailHtml }  from '../lib/sanitize-email-html.js';

const PASSWORD = process.env.DASHBOARD_PASSWORD || 'Cassandra2024';

function authed(req) {
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  return t === PASSWORD;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!authed(req))         return json({ error: 'Unauthorized' }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const id     = String(body.id     || '').trim();
  const html   = String(body.html   || '');
  const source = String(body.source || 'claude').slice(0, 40);
  const action = String(body.action || 'sanitize-and-save');  // 'sanitize-only' | 'sanitize-and-save'

  // Always sanitize first
  const result = sanitizeEmailHtml(html);
  if (!result.ok) {
    return json({ error: result.error, detail: result.detail || '' }, 400);
  }

  if (action === 'sanitize-only') {
    return json({ ok: true, html: result.html, warnings: result.warnings, bytes: result.bytes });
  }

  // Save to a draft
  if (!id) return json({ error: 'missing_id' }, 400);
  const draft = await getDraft(id);
  if (!draft) return json({ error: 'draft_not_found' }, 404);

  draft.customHtml = result.html;
  draft.customHtmlMeta = {
    source,
    importedAt: Date.now(),
    warnings:   result.warnings,
    bytes:      result.bytes,
  };

  // If subject is empty, try to extract — prefer <title>, fall back to first <h1>
  if (!draft.subject) {
    const titleM = result.html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleM) {
      draft.subject = titleM[1].trim().slice(0, 300);
    } else {
      // Strip tags from first heading and use that as subject
      const h1M = result.html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
      if (h1M) {
        const text = h1M[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (text) draft.subject = text.slice(0, 300);
      }
    }
  }

  const saved = await saveDraft(draft);
  return json({
    ok: true,
    draft: saved,
    warnings: result.warnings,
    bytes: result.bytes,
  });
}
