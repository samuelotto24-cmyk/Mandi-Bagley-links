export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const CRON_SECRET = process.env.CRON_SECRET;
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';

const POSTS_KEY = PREFIX + 'scheduled_posts';

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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default async function handler(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Allow both dashboard password and cron secret
  const isAuthed =
    token === PASSWORD || (CRON_SECRET && token === CRON_SECRET);

  if (!isAuthed) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);

  // GET — list all posts, optional ?status= filter
  if (req.method === 'GET') {
    const raw = await redisGet(POSTS_KEY);
    let posts = raw ? JSON.parse(raw) : [];

    const statusFilter = url.searchParams.get('status');
    if (statusFilter) {
      posts = posts.filter((p) => p.status === statusFilter);
    }

    return json({ posts });
  }

  // POST — create a new scheduled post
  if (req.method === 'POST') {
    const body = await req.json();

    const {
      images,
      caption,
      hashtags,
      platform,
      scheduledAt,
      automationKeyword,
      postNow,
    } = body;

    if (!caption || !String(caption).trim()) {
      return json({ error: 'Missing required field: caption' }, 400);
    }
    if (!platform || !String(platform).trim()) {
      return json({ error: 'Missing required field: platform' }, 400);
    }
    if (!postNow && (!scheduledAt || !String(scheduledAt).trim())) {
      return json({ error: 'Missing required field: scheduledAt (or set postNow: true)' }, 400);
    }

    const raw = await redisGet(POSTS_KEY);
    const posts = raw ? JSON.parse(raw) : [];

    const now = new Date().toISOString();

    const post = {
      id: generateUUID(),
      images: Array.isArray(images) ? images : [],
      caption: String(caption).trim(),
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      platform: String(platform).trim(),
      scheduledAt: postNow ? now : String(scheduledAt).trim(),
      automationKeyword: automationKeyword ? String(automationKeyword).trim() : '',
      status: 'scheduled',
      retryCount: 0,
      createdAt: now,
      publishedAt: null,
      igMediaId: null,
      error: null,
    };

    posts.push(post);
    await redisSet(POSTS_KEY, JSON.stringify(posts));

    return json({ post }, 201);
  }

  // PUT — update a post by id
  if (req.method === 'PUT') {
    const body = await req.json();

    if (!body.id) {
      return json({ error: 'Missing required field: id' }, 400);
    }

    const raw = await redisGet(POSTS_KEY);
    const posts = raw ? JSON.parse(raw) : [];

    const idx = posts.findIndex((p) => p.id === body.id);
    if (idx === -1) {
      return json({ error: `Post with id "${body.id}" not found` }, 404);
    }

    const post = posts[idx];

    // Retry — reset status and retryCount
    if (body.retry === true) {
      post.status = 'scheduled';
      post.retryCount = 0;
      post.error = null;
    }

    // Cancel
    if (body.status === 'cancelled') {
      post.status = 'cancelled';
    }

    // Reschedule
    if (body.scheduledAt !== undefined) {
      post.scheduledAt = String(body.scheduledAt).trim();
      // Rescheduling also re-activates a cancelled/failed post
      if (post.status !== 'scheduled') {
        post.status = 'scheduled';
      }
    }

    // Cron-writable fields: posted / failed transitions
    if (body.status === 'posted') {
      post.status = 'posted';
      post.publishedAt = body.publishedAt || new Date().toISOString();
      if (body.igMediaId !== undefined) post.igMediaId = body.igMediaId;
      post.error = null;
    }

    if (body.status === 'failed') {
      post.status = 'failed';
      if (body.error !== undefined) post.error = body.error;
      if (body.retryCount !== undefined) post.retryCount = Number(body.retryCount);
    }

    // Generic retryCount update (cron incrementing without status change)
    if (body.retryCount !== undefined && body.status !== 'failed' && body.retry !== true) {
      post.retryCount = Number(body.retryCount);
    }

    posts[idx] = post;
    await redisSet(POSTS_KEY, JSON.stringify(posts));

    return json({ post });
  }

  // DELETE — remove by ?id= query param
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) {
      return json({ error: 'Missing id query parameter' }, 400);
    }

    const raw = await redisGet(POSTS_KEY);
    const posts = raw ? JSON.parse(raw) : [];

    const idx = posts.findIndex((p) => p.id === id);
    if (idx === -1) {
      return json({ error: `Post with id "${id}" not found` }, 404);
    }

    const removed = posts.splice(idx, 1)[0];
    await redisSet(POSTS_KEY, JSON.stringify(posts));

    return json({ removed });
  }

  return json({ error: 'Method not allowed' }, 405);
}
