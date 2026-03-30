export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';

const AUTOMATIONS_KEY = PREFIX + 'automations';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  const res = await fetch(`${REDIS_URL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, value]),
  });
  return res.json();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sanitizeSlug(slug) {
  return slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

export default async function handler(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token !== PASSWORD) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);

  // GET — return all automations
  if (req.method === 'GET') {
    const raw = await redisGet(AUTOMATIONS_KEY);
    const automations = raw ? JSON.parse(raw) : [];
    return json({ automations });
  }

  // POST — create new automation
  if (req.method === 'POST') {
    const body = await req.json();
    const required = ['keyword', 'commentReply', 'dmResponse', 'captureSlug', 'captureHeadline', 'freebieType', 'freebieValue'];
    for (const field of required) {
      if (!body[field] || !String(body[field]).trim()) {
        return json({ error: `Missing required field: ${field}` }, 400);
      }
    }

    const keyword = String(body.keyword).trim().toUpperCase();
    const captureSlug = sanitizeSlug(String(body.captureSlug).trim());

    if (!captureSlug) {
      return json({ error: 'captureSlug must contain at least one alphanumeric character' }, 400);
    }

    const raw = await redisGet(AUTOMATIONS_KEY);
    const automations = raw ? JSON.parse(raw) : [];

    if (automations.some(a => a.keyword === keyword)) {
      return json({ error: `Automation with keyword "${keyword}" already exists` }, 409);
    }

    const automation = {
      keyword,
      commentReply: String(body.commentReply).trim(),
      dmResponse: String(body.dmResponse).trim(),
      captureSlug,
      captureHeadline: String(body.captureHeadline).trim(),
      captureDescription: body.captureDescription ? String(body.captureDescription).trim() : '',
      freebieType: String(body.freebieType).trim(),
      freebieValue: String(body.freebieValue).trim(),
      upsellUrl: body.upsellUrl ? String(body.upsellUrl).trim() : '',
      upsellText: body.upsellText ? String(body.upsellText).trim() : '',
      active: true,
      createdAt: new Date().toISOString(),
    };

    automations.push(automation);
    await redisSet(AUTOMATIONS_KEY, JSON.stringify(automations));

    return json({ automation }, 201);
  }

  // PUT — update automation by keyword
  if (req.method === 'PUT') {
    const body = await req.json();
    if (!body.keyword) {
      return json({ error: 'Missing keyword to identify automation' }, 400);
    }

    const keyword = String(body.keyword).trim().toUpperCase();

    const raw = await redisGet(AUTOMATIONS_KEY);
    const automations = raw ? JSON.parse(raw) : [];

    const idx = automations.findIndex(a => a.keyword === keyword);
    if (idx === -1) {
      return json({ error: `Automation with keyword "${keyword}" not found` }, 404);
    }

    const updatable = ['commentReply', 'dmResponse', 'captureSlug', 'captureHeadline', 'captureDescription', 'freebieType', 'freebieValue', 'upsellUrl', 'upsellText', 'active'];
    for (const field of updatable) {
      if (body[field] !== undefined) {
        if (field === 'captureSlug') {
          automations[idx][field] = sanitizeSlug(String(body[field]).trim());
        } else if (field === 'active') {
          automations[idx][field] = Boolean(body[field]);
        } else {
          automations[idx][field] = String(body[field]).trim();
        }
      }
    }

    await redisSet(AUTOMATIONS_KEY, JSON.stringify(automations));

    return json({ automation: automations[idx] });
  }

  // DELETE — remove automation by keyword query param
  if (req.method === 'DELETE') {
    const keyword = url.searchParams.get('keyword');
    if (!keyword) {
      return json({ error: 'Missing keyword query parameter' }, 400);
    }

    const normalizedKeyword = keyword.trim().toUpperCase();

    const raw = await redisGet(AUTOMATIONS_KEY);
    const automations = raw ? JSON.parse(raw) : [];

    const idx = automations.findIndex(a => a.keyword === normalizedKeyword);
    if (idx === -1) {
      return json({ error: `Automation with keyword "${normalizedKeyword}" not found` }, 404);
    }

    const removed = automations.splice(idx, 1)[0];
    await redisSet(AUTOMATIONS_KEY, JSON.stringify(automations));

    return json({ removed });
  }

  return json({ error: 'Method not allowed' }, 405);
}
