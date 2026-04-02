export const config = { runtime: 'edge' };

const REDIS_URL    = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX       = process.env.REDIS_PREFIX || 'stats:';
const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN;
const APP_SECRET   = process.env.INSTAGRAM_APP_SECRET;

/* ── Redis helpers ─────────────────────────────────────────────── */

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}

async function redisPipeline(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  return res.json();
}

/* ── Automation helpers ────────────────────────────────────────── */

async function getAutomations() {
  const raw = await redisGet(`${PREFIX}automations`);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function matchKeyword(text, automations) {
  if (!text) return null;
  const upper = text.toUpperCase();
  return automations.find(a => a.active && upper.includes(a.keyword)) || null;
}

function logLead(step, keyword, user) {
  const commands = [
    ['HINCRBY', `${PREFIX}funnel:${keyword}`, step, '1'],
    ['LPUSH', `${PREFIX}leads`, JSON.stringify({
      step,
      keyword,
      user: user || 'unknown',
      ts: new Date().toISOString(),
    })],
    ['LTRIM', `${PREFIX}leads`, '0', '999'],
  ];
  // Fire-and-forget — do not await
  redisPipeline(commands).catch(() => {});
}

/* ── Signature verification (Web Crypto API) ───────────────────── */

async function verifySignature(body, signatureHeader) {
  if (!APP_SECRET) return true;
  if (!signatureHeader) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const expected = `sha256=${hex}`;
  return expected === signatureHeader;
}

/* ── Main handler ──────────────────────────────────────────────── */

export default async function handler(req) {
  const url = new URL(req.url);

  /* ── GET: webhook verification handshake ─────────────────────── */
  if (req.method === 'GET') {
    const mode      = url.searchParams.get('hub.mode');
    const token     = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  /* ── POST: incoming webhook events ───────────────────────────── */
  if (req.method === 'POST') {
    const bodyText = await req.text();

    // Validate signature
    const signatureHeader = req.headers.get('x-hub-signature-256');
    if (APP_SECRET) {
      const valid = await verifySignature(bodyText, signatureHeader);
      if (!valid) {
        return new Response('Invalid signature', { status: 403 });
      }
    }

    let payload;
    try { payload = JSON.parse(bodyText); } catch {
      return new Response('Bad JSON', { status: 400 });
    }

    const automations = await getAutomations();
    if (!automations.length) {
      return new Response('OK', { status: 200 });
    }

    const pageToken = await redisGet(`${PREFIX}ig:page_token`);
    const igUserId  = await redisGet(`${PREFIX}ig:user_id`);
    const origin    = url.origin;

    const entries = payload.entry || [];

    for (const entry of entries) {

      /* ── Comment events ──────────────────────────────────────── */
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'comments') continue;
        const value = change.value || {};
        const commentText = value.text || '';
        const commentId   = value.id;
        const commentUser = value.from ? value.from.username || value.from.id : 'unknown';

        const matched = matchKeyword(commentText, automations);
        if (!matched || !commentId || !pageToken) continue;

        logLead('comments', matched.keyword, commentUser);

        // Reply to comment
        fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: matched.commentReply,
            access_token: pageToken,
          }),
        }).catch(() => {});
      }

      /* ── Messaging (DM) events ───────────────────────────────── */
      const messages = entry.messaging || [];
      for (const msg of messages) {
        if (!msg.message || !msg.message.text) continue;
        const dmText   = msg.message.text;
        const senderId = msg.sender ? msg.sender.id : null;
        const senderLabel = senderId || 'unknown';

        if (!senderId || !pageToken || !igUserId) continue;

        const matched = matchKeyword(dmText, automations);

        if (matched) {
          logLead('dms', matched.keyword, senderLabel);

          // Send DM response with capture link
          const replyText = `${matched.dmResponse}\n\n${origin}/g/${matched.captureSlug}`;
          fetch(`https://graph.facebook.com/v21.0/${igUserId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: senderId },
              message: { text: replyText },
              access_token: pageToken,
            }),
          }).catch(() => {});
        } else {
          // No keyword match — check if this is a first-time DM for welcome message
          const welcomeConfig = await redisGet(`${PREFIX}welcome_dm`);
          if (welcomeConfig) {
            try {
              const welcome = JSON.parse(welcomeConfig);
              if (welcome.enabled) {
                // Check if we've already welcomed this user
                const welcomedKey = `${PREFIX}welcomed:${senderId}`;
                const alreadyWelcomed = await redisGet(welcomedKey);
                if (!alreadyWelcomed) {
                  // Mark as welcomed (expires in 90 days)
                  redisPipeline([
                    ['SET', welcomedKey, '1', 'EX', '7776000'],
                  ]).catch(() => {});

                  // Build welcome message with freebie menu
                  let welcomeText = welcome.message || "Hey! Thanks for reaching out \u{1F90D}";
                  if (welcome.showFreebies && automations.length) {
                    const activeAutos = automations.filter(a => a.active);
                    if (activeAutos.length) {
                      welcomeText += '\n\nI have some free stuff for you! Just type any of these:';
                      for (const a of activeAutos) {
                        welcomeText += `\n\u{1F449} ${a.keyword} \u{2014} ${a.captureHeadline}`;
                      }
                    }
                  }

                  fetch(`https://graph.facebook.com/v21.0/${igUserId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      recipient: { id: senderId },
                      message: { text: welcomeText },
                      access_token: pageToken,
                    }),
                  }).catch(() => {});

                  logLead('welcome_dm', 'WELCOME', senderLabel);
                }
              }
            } catch {}
          }
        }
      }
    }

    return new Response('OK', { status: 200 });
  }

  return new Response('Method not allowed', { status: 405 });
}
