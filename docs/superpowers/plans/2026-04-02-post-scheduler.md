# Post Scheduler + Carousel Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add carousel uploads (1-10 images), AI-recommended scheduling, and Instagram auto-publishing to the hub's Create Post flow.

**Architecture:** Images uploaded to Redis via existing `api/upload-image.js` (TTL extended for scheduled posts). Scheduled posts stored in Redis as JSON array. Cron job runs every 15 minutes to publish due posts via Instagram Content Publishing API. Hub UI gains carousel thumbnails, scheduling panel with recommended times, and planner integration.

**Tech Stack:** Vanilla JS (hub/index.html), Vercel Edge Functions, Upstash Redis REST API, Instagram Content Publishing API, Resend API

**Spec:** `docs/superpowers/specs/2026-04-02-post-scheduler-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `hub/index.html` | Modify | Carousel upload UI, scheduling panel, planner integration, scheduled posts list |
| `api/upload-image.js` | Modify | Extend TTL for scheduled post images (1hr → 7 days) |
| `api/create-post.js` | Modify | Accept multiple images for carousel caption generation |
| `api/schedule-post.js` | Create | CRUD for scheduled posts (schedule, list, reschedule, cancel, retry) |
| `api/publish-scheduled.js` | Create | Cron job — find due posts, publish to Instagram, handle retries, send notifications |
| `vercel.json` | Modify | Add cron entry for publish-scheduled |

---

### Task 1: Extend Image Upload TTL

**Files:**
- Modify: `api/upload-image.js`

The existing endpoint stores images in Redis with a 1-hour TTL. Scheduled posts might be days away. Accept an optional `ttl` parameter — default stays 1 hour, but scheduled posts can request 7 days.

- [ ] **Step 1: Add TTL parameter support**

In `api/upload-image.js`, replace the POST handler's Redis store section:

```js
    // Find this line (around line 68):
    const id = crypto.randomUUID();
    const key = PREFIX + 'tmp:img:' + id;

    // Store in Redis with 1 hour TTL
    await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['SET', key, JSON.stringify({ data: base64Data, mediaType }), 'EX', 3600],
      ]),
    });
```

Replace with:

```js
    const id = crypto.randomUUID();
    const key = PREFIX + 'tmp:img:' + id;

    // TTL: default 1 hour, up to 7 days for scheduled posts
    const requestedTTL = parseInt(body.ttl, 10);
    const maxTTL = 604800; // 7 days
    const ttl = (requestedTTL > 0 && requestedTTL <= maxTTL) ? requestedTTL : 3600;

    await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['SET', key, JSON.stringify({ data: base64Data, mediaType }), 'EX', ttl],
      ]),
    });
```

- [ ] **Step 2: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/upload-image.js
git commit -m "feat: add configurable TTL to image upload (up to 7 days for scheduled posts)"
```

---

### Task 2: Carousel Upload UI

**Files:**
- Modify: `hub/index.html`

Replace the single-image upload with a multi-image carousel system. Stores an array of compressed base64 data URLs. Shows draggable thumbnails.

- [ ] **Step 1: Add carousel CSS**

Add before the closing `</style>` tag in the last style block in `hub/index.html`:

```css
/* ── Carousel Upload ── */
.carousel-thumbs {
  display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; align-items: center;
}
.carousel-thumb {
  width: 60px; height: 60px; border-radius: 8px; overflow: hidden;
  border: 2px solid var(--border); position: relative; cursor: grab;
  flex-shrink: 0;
}
.carousel-thumb.dragging { opacity: 0.4; }
.carousel-thumb.drag-over { border-color: var(--accent); }
.carousel-thumb img { width: 100%; height: 100%; object-fit: cover; }
.carousel-thumb .thumb-remove {
  position: absolute; top: 2px; right: 2px; width: 18px; height: 18px;
  background: rgba(0,0,0,0.7); color: #fff; border: none; border-radius: 50%;
  font-size: 10px; cursor: pointer; display: flex; align-items: center;
  justify-content: center; opacity: 0; transition: opacity 0.15s;
}
.carousel-thumb:hover .thumb-remove { opacity: 1; }
.carousel-add {
  width: 60px; height: 60px; border-radius: 8px;
  border: 2px dashed var(--border); display: flex;
  align-items: center; justify-content: center;
  font-size: 20px; color: var(--text-muted); cursor: pointer;
  transition: border-color 0.2s;
}
.carousel-add:hover { border-color: var(--accent-border); color: var(--text); }
.carousel-counter {
  font-size: 11px; color: var(--text-muted); margin-top: 6px;
}
```

- [ ] **Step 2: Add carousel HTML**

Find the Create Post card's image area. After the existing `createPostClear` button (line ~3193), add:

```html
        <div class="carousel-thumbs" id="carouselThumbs" style="display:none;"></div>
        <div class="carousel-counter" id="carouselCounter" style="display:none;"></div>
        <input type="file" id="carouselAddFile" accept="image/*" style="display:none;">
```

- [ ] **Step 3: Replace image storage with array**

Find `var createPostImage = null;` in the script section and replace with:

```js
var createPostImages = []; // Array of base64 data URLs
var createPostPlatform = 'instagram';
```

- [ ] **Step 4: Update handlePostImage for carousel**

Replace the `showPostImage` function:

```js
function showPostImage(dataUrl) {
  createPostImages.push(dataUrl);
  renderCarousel();
  var genBtn = document.getElementById('createPostBtn');
  if (genBtn) genBtn.disabled = false;
}

function renderCarousel() {
  var preview = document.getElementById('createPostPreview');
  var dropInner = document.getElementById('createPostDropInner');
  var clearBtn = document.getElementById('createPostClear');
  var thumbsEl = document.getElementById('carouselThumbs');
  var counterEl = document.getElementById('carouselCounter');

  if (!createPostImages.length) {
    if (preview) preview.style.display = 'none';
    if (dropInner) dropInner.style.display = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (thumbsEl) thumbsEl.style.display = 'none';
    if (counterEl) counterEl.style.display = 'none';
    return;
  }

  // Show first image as main preview
  if (preview) { preview.src = createPostImages[0]; preview.style.display = 'block'; }
  if (dropInner) dropInner.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'flex';

  // Thumbnails (show when 2+ images)
  if (createPostImages.length > 1 && thumbsEl) {
    thumbsEl.style.display = 'flex';
    thumbsEl.innerHTML = createPostImages.map(function(img, i) {
      return '<div class="carousel-thumb" draggable="true" data-idx="' + i + '">' +
        '<img src="' + img + '" alt="Photo ' + (i + 1) + '">' +
        '<button class="thumb-remove" onclick="removeCarouselImage(' + i + ')">&times;</button>' +
      '</div>';
    }).join('') + (createPostImages.length < 10
      ? '<div class="carousel-add" onclick="addCarouselImage()">+</div>'
      : '');

    // Drag-and-drop reorder
    thumbsEl.querySelectorAll('.carousel-thumb').forEach(function(el) {
      el.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', el.dataset.idx);
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', function() { el.classList.remove('dragging'); });
      el.addEventListener('dragover', function(e) { e.preventDefault(); el.classList.add('drag-over'); });
      el.addEventListener('dragleave', function() { el.classList.remove('drag-over'); });
      el.addEventListener('drop', function(e) {
        e.preventDefault();
        el.classList.remove('drag-over');
        var fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        var toIdx = parseInt(el.dataset.idx, 10);
        if (fromIdx !== toIdx) {
          var moved = createPostImages.splice(fromIdx, 1)[0];
          createPostImages.splice(toIdx, 0, moved);
          renderCarousel();
        }
      });
    });
  } else if (thumbsEl) {
    thumbsEl.style.display = 'none';
  }

  // Show add button even for single image
  if (createPostImages.length === 1 && thumbsEl) {
    thumbsEl.style.display = 'flex';
    thumbsEl.innerHTML = '<div class="carousel-add" onclick="addCarouselImage()">+ Add more</div>';
  }

  // Counter
  if (counterEl && createPostImages.length > 1) {
    counterEl.style.display = '';
    counterEl.textContent = createPostImages.length + '/10 photos';
  } else if (counterEl) {
    counterEl.style.display = 'none';
  }
}

function removeCarouselImage(idx) {
  createPostImages.splice(idx, 1);
  renderCarousel();
  if (!createPostImages.length) {
    document.getElementById('createPostBtn').disabled = true;
    document.getElementById('createPostOutput').style.display = 'none';
  }
}

function addCarouselImage() {
  if (createPostImages.length >= 10) return;
  document.getElementById('carouselAddFile').click();
}
```

- [ ] **Step 5: Wire up the carousel file input**

In the Create Post initialization section (where `createPostFile` event listeners are set up), add:

```js
  var carouselAddInput = document.getElementById('carouselAddFile');
  if (carouselAddInput) {
    carouselAddInput.addEventListener('change', function() {
      if (this.files && this.files[0]) handlePostImage(this.files[0]);
      this.value = '';
    });
  }
```

- [ ] **Step 6: Update clearPostImage for carousel**

Replace the existing `clearPostImage` function:

```js
function clearPostImage() {
  createPostImages = [];
  renderCarousel();
  document.getElementById('createPostBtn').disabled = true;
  document.getElementById('createPostFile').value = '';
  document.getElementById('createPostOutput').style.display = 'none';
}
```

- [ ] **Step 7: Update generatePost to use image array**

In `generatePost()`, update the safety net to check `createPostImages[0]` instead of `createPostImage`:

Replace `if (!createPostImage) return;` with `if (!createPostImages.length) return;`

Update the safety net check: `if (createPostImages[0].length > 800000)` — re-compress the first image (the one sent for caption gen).

Update the fetch body to send the first image (for caption generation, sending just the first is fine — we'll handle all images during upload):

```js
    body: JSON.stringify({
      image: createPostImages[0],
      images: createPostImages,
      platform: createPostPlatform,
      notes: document.getElementById('createPostNotes').value || '',
      automationKeyword: document.getElementById('createPostAutomation').value || '',
    }),
```

- [ ] **Step 8: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add hub/index.html
git commit -m "feat(hub): carousel upload UI with drag-to-reorder thumbnails"
```

---

### Task 3: Update Caption Generation for Carousel

**Files:**
- Modify: `api/create-post.js`

When multiple images are sent, include all of them in the Claude API call so the caption covers the full carousel.

- [ ] **Step 1: Accept images array**

In `api/create-post.js`, update the body destructuring:

```js
    const { image, images = [], platform = 'instagram', notes = '', automationKeyword = '' } = body;
```

- [ ] **Step 2: Build multi-image content blocks**

Replace the messages array in the Claude API call:

```js
    // Build image content blocks — all carousel images for context
    const imageContent = [];
    const allImages = images.length > 0 ? images : (image ? [image] : []);

    for (const img of allImages.slice(0, 10)) {
      let mt = 'image/jpeg';
      let b64 = img;
      if (img.startsWith('data:')) {
        const m = img.match(/^data:(image\/\w+);base64,(.+)$/);
        if (m) { mt = m[1]; b64 = m[2]; }
      }
      // Skip images that are too large
      if (b64.length > 1500000) continue;
      imageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: mt, data: b64 },
      });
    }

    // Fallback: at least use the primary image
    if (!imageContent.length && image) {
      imageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64Data },
      });
    }

    const isCarousel = allImages.length > 1;
    const carouselNote = isCarousel
      ? `\n\nThis is a CAROUSEL POST with ${allImages.length} images. Write ONE caption that works for the entire carousel. Reference the variety/progression of images naturally.`
      : '';
```

- [ ] **Step 3: Update the messages and prompt**

Replace the existing messages array in the Claude API call:

```js
        messages: [{
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `Write a ${platform} post for ${isCarousel ? 'this carousel of ' + allImages.length + ' images' : 'this image'}.${carouselNote}`,
            },
          ],
        }],
```

- [ ] **Step 4: Remove the old single-image size check**

Delete or update the block that returns "Image too large. Max 4MB." since we now handle multiple images and skip oversized ones gracefully.

- [ ] **Step 5: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/create-post.js
git commit -m "feat: carousel-aware caption generation — AI sees all images"
```

---

### Task 4: Schedule Post API

**Files:**
- Create: `api/schedule-post.js`

CRUD endpoint for scheduled posts. Stores post objects in Redis as a JSON array.

- [ ] **Step 1: Create `api/schedule-post.js`**

```js
export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';

const POSTS_KEY = `${PREFIX}scheduled_posts`;

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

function auth(req) {
  const h = req.headers.get('authorization');
  const token = h && h.startsWith('Bearer ') ? h.slice(7) : null;
  return token === PASSWORD;
}

async function loadPosts() {
  const raw = await redisGet(POSTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function savePosts(posts) {
  await redisSet(POSTS_KEY, JSON.stringify(posts));
}

export default async function handler(req) {
  // Cron auth (for publish-scheduled calling back) or Bearer auth
  const cronAuth = req.headers.get('authorization');
  const isCron = cronAuth === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron && !auth(req)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);

  // GET — list posts, optionally filtered by status
  if (req.method === 'GET') {
    const posts = await loadPosts();
    const status = url.searchParams.get('status');
    const filtered = status ? posts.filter(p => p.status === status) : posts;
    return json({ posts: filtered });
  }

  // POST — schedule a new post
  if (req.method === 'POST') {
    const body = await req.json();
    const { images, caption, hashtags, platform, scheduledAt, automationKeyword, postNow } = body;

    if (!images || !images.length || !caption) {
      return json({ error: 'images and caption are required' }, 400);
    }

    const post = {
      id: crypto.randomUUID(),
      images,
      caption,
      hashtags: hashtags || [],
      platform: platform || 'instagram',
      scheduledAt: postNow ? new Date().toISOString() : scheduledAt,
      automationKeyword: automationKeyword || '',
      status: 'scheduled',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      publishedAt: null,
      igMediaId: null,
      error: null,
    };

    const posts = await loadPosts();
    posts.push(post);
    await savePosts(posts);

    return json({ ok: true, post }, 201);
  }

  // PUT — update a post (reschedule, cancel, retry)
  if (req.method === 'PUT') {
    const body = await req.json();
    const { id } = body;
    if (!id) return json({ error: 'id is required' }, 400);

    const posts = await loadPosts();
    const idx = posts.findIndex(p => p.id === id);
    if (idx === -1) return json({ error: 'Post not found' }, 404);

    if (body.scheduledAt) posts[idx].scheduledAt = body.scheduledAt;
    if (body.status === 'cancelled') posts[idx].status = 'cancelled';
    if (body.retry) {
      posts[idx].status = 'scheduled';
      posts[idx].retryCount = 0;
      posts[idx].error = null;
    }
    // Allow cron to update status
    if (body.status === 'posted' || body.status === 'failed' || body.status === 'retrying') {
      posts[idx].status = body.status;
      if (body.publishedAt) posts[idx].publishedAt = body.publishedAt;
      if (body.igMediaId) posts[idx].igMediaId = body.igMediaId;
      if (body.error) posts[idx].error = body.error;
      if (body.retryCount !== undefined) posts[idx].retryCount = body.retryCount;
    }

    await savePosts(posts);
    return json({ ok: true, post: posts[idx] });
  }

  // DELETE — remove a post
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id query param required' }, 400);

    const posts = await loadPosts();
    const filtered = posts.filter(p => p.id !== id);
    if (filtered.length === posts.length) return json({ error: 'Post not found' }, 404);

    await savePosts(filtered);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/schedule-post.js
git commit -m "feat: add schedule-post CRUD API endpoint"
```

---

### Task 5: Publish Cron Job

**Files:**
- Create: `api/publish-scheduled.js`
- Modify: `vercel.json` — add cron entry

This cron job runs every 15 minutes, finds due posts, publishes them to Instagram, updates status, and sends notifications.

- [ ] **Step 1: Add cron to `vercel.json`**

Add to the `crons` array:

```json
{
  "path": "/api/publish-scheduled",
  "schedule": "*/15 * * * *"
}
```

- [ ] **Step 2: Create `api/publish-scheduled.js`**

```js
export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';
const RESEND_KEY  = process.env.RESEND_API_KEY;
const CLIENT_NAME = process.env.CLIENT_NAME || 'Mandi Bagley';
const FROM_EMAIL  = process.env.CONTACT_FROM_EMAIL || 'hub@mandibagley.com';
const CLIENT_EMAIL = process.env.CLIENT_EMAIL;

const POSTS_KEY = `${PREFIX}scheduled_posts`;
const NOTIFS_KEY = `${PREFIX}notifications`;

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
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, value]),
  });
}

async function publishToInstagram(post, accessToken, igUserId) {
  const images = post.images;
  const caption = post.caption + (post.hashtags.length ? '\n\n' + post.hashtags.map(h => '#' + h.replace(/^#/, '')).join(' ') : '');

  if (images.length === 1) {
    // Single image post
    const containerRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: images[0],
        caption,
        access_token: accessToken,
      }),
    });
    const container = await containerRes.json();
    if (container.error) throw new Error(container.error.message || 'Container creation failed');

    const publishRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: accessToken,
      }),
    });
    const published = await publishRes.json();
    if (published.error) throw new Error(published.error.message || 'Publish failed');
    return published.id;
  }

  // Carousel post
  const childIds = [];
  for (const imageUrl of images) {
    const itemRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    });
    const item = await itemRes.json();
    if (item.error) throw new Error(item.error.message || 'Carousel item creation failed');
    childIds.push(item.id);
  }

  const carouselRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds,
      caption,
      access_token: accessToken,
    }),
  });
  const carousel = await carouselRes.json();
  if (carousel.error) throw new Error(carousel.error.message || 'Carousel creation failed');

  const publishRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: carousel.id,
      access_token: accessToken,
    }),
  });
  const published = await publishRes.json();
  if (published.error) throw new Error(published.error.message || 'Carousel publish failed');
  return published.id;
}

async function sendNotification(type, post, error) {
  const now = new Date().toISOString();
  const notif = {
    type,
    postId: post.id,
    caption: post.caption.substring(0, 80),
    platform: post.platform,
    error: error || null,
    timestamp: now,
  };

  // Push to Redis notification list
  await redisPipeline([
    ['LPUSH', NOTIFS_KEY, JSON.stringify(notif)],
    ['LTRIM', NOTIFS_KEY, 0, 49],
  ]);

  // Send email
  if (RESEND_KEY && CLIENT_EMAIL) {
    const subject = type === 'posted'
      ? 'Your post just went live! \u{1F389}'
      : 'Your scheduled post couldn\u2019t be published';
    const body = type === 'posted'
      ? `<p>Your ${post.platform} post was published successfully!</p><p style="color:#666;font-style:italic">"${post.caption.substring(0, 200)}"</p>`
      : `<p>Your scheduled ${post.platform} post failed to publish after 3 attempts.</p><p style="color:#c00">Error: ${error}</p><p><a href="https://mandibagley.com/hub">Open hub to retry</a></p>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${CLIENT_NAME} Hub <${FROM_EMAIL}>`,
        to: [CLIENT_EMAIL],
        subject,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">${body}</div>`,
      }),
    }).catch(() => {});
  }
}

export default async function handler(req) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const validCron = token === process.env.CRON_SECRET;
  const validPw = token === (process.env.DASHBOARD_PASSWORD || 'Password2024');

  if (!validCron && !validPw) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date();
  const raw = await redisGet(POSTS_KEY);
  const posts = raw ? JSON.parse(raw) : [];

  // Find due posts
  const duePosts = posts.filter(p =>
    p.status === 'scheduled' && new Date(p.scheduledAt) <= now
  );

  if (!duePosts.length) {
    return new Response(JSON.stringify({ ok: true, published: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Load Instagram credentials
  const accessToken = await redisGet(`${PREFIX}ig:access_token`);
  const igUserId = await redisGet(`${PREFIX}ig:user_id`);

  let publishedCount = 0;

  for (const post of duePosts) {
    const idx = posts.findIndex(p => p.id === post.id);
    if (idx === -1) continue;

    if (post.platform === 'instagram' && accessToken && igUserId) {
      try {
        const mediaId = await publishToInstagram(post, accessToken, igUserId);
        posts[idx].status = 'posted';
        posts[idx].publishedAt = now.toISOString();
        posts[idx].igMediaId = mediaId;
        publishedCount++;
        await sendNotification('posted', posts[idx]);
      } catch (err) {
        const errMsg = err.message || 'Unknown error';
        posts[idx].retryCount = (posts[idx].retryCount || 0) + 1;
        if (posts[idx].retryCount >= 3) {
          posts[idx].status = 'failed';
          posts[idx].error = errMsg;
          await sendNotification('failed', posts[idx], errMsg);
        } else {
          posts[idx].error = errMsg;
          // Status stays 'scheduled' — will retry on next cron run
        }
      }
    } else {
      // Platform not supported or not connected
      posts[idx].retryCount = (posts[idx].retryCount || 0) + 1;
      if (posts[idx].retryCount >= 3) {
        posts[idx].status = 'failed';
        posts[idx].error = 'Instagram not connected';
        await sendNotification('failed', posts[idx], 'Instagram not connected');
      }
    }
  }

  await redisSet(POSTS_KEY, JSON.stringify(posts));

  return new Response(JSON.stringify({ ok: true, published: publishedCount, checked: duePosts.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add api/publish-scheduled.js vercel.json
git commit -m "feat: add publish-scheduled cron job (every 15 min)"
```

---

### Task 6: Scheduling UI

**Files:**
- Modify: `hub/index.html`

After caption generation, show "Post Now" and "Schedule" buttons. Schedule opens a panel with top 3 recommended time slots.

- [ ] **Step 1: Add scheduling panel CSS**

Add to the hub's style block:

```css
/* ── Scheduling Panel ── */
.schedule-panel {
  margin-top: 16px; padding: 16px;
  background: var(--surface-elevated); border: 1px solid var(--border);
  border-radius: 12px; display: none;
}
.schedule-panel.active { display: block; }
.schedule-slots { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.schedule-slot {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px;
  cursor: pointer; transition: border-color 0.2s;
}
.schedule-slot:hover { border-color: var(--accent-border); }
.schedule-slot.selected { border-color: var(--accent); background: var(--accent-pale); }
.schedule-slot-time { font-size: 14px; font-weight: 500; }
.schedule-slot-score { font-size: 12px; color: var(--text-muted); }
.schedule-custom { margin-top: 8px; }
.schedule-custom input[type="datetime-local"] {
  width: 100%; padding: 10px 12px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text); font-family: var(--sans); font-size: 13px;
}
.schedule-actions { display: flex; gap: 8px; margin-top: 12px; }
.schedule-actions button {
  flex: 1; padding: 10px; border-radius: 8px; font-family: var(--sans);
  font-size: 13px; font-weight: 600; cursor: pointer; border: none;
}
.schedule-confirm { background: var(--accent); color: var(--bg); }
.schedule-cancel-btn { background: transparent; border: 1px solid var(--border) !important; color: var(--text-muted); }
.schedule-coming-soon {
  font-size: 11px; color: var(--text-muted); text-align: center;
  margin-top: 8px; font-style: italic;
}
```

- [ ] **Step 2: Add scheduling UI to Create Post output area**

Replace the existing `createPostActions` div contents with:

```html
          <div class="create-post-actions" id="createPostActions" style="display:none;">
            <button class="cp-action-btn cp-action-ig" onclick="postNow()">&#128247; Post Now to Instagram</button>
            <button class="cp-action-btn" onclick="openSchedulePanel()">&#128197; Schedule</button>
            <button class="cp-action-btn" onclick="postToInstagram()">&#128203; Copy Caption &amp; Open Instagram</button>
          </div>
          <div class="schedule-panel" id="schedulePanel">
            <div style="font-size:13px;font-weight:600;margin-bottom:10px;">Best times to post</div>
            <div class="schedule-slots" id="scheduleSlots"></div>
            <div class="schedule-custom">
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Or pick a custom time:</div>
              <input type="datetime-local" id="scheduleCustomTime">
            </div>
            <div class="schedule-actions">
              <button class="schedule-cancel-btn" onclick="closeSchedulePanel()">Cancel</button>
              <button class="schedule-confirm" id="scheduleConfirmBtn" onclick="confirmSchedule()" disabled>Schedule Post</button>
            </div>
            <div class="schedule-coming-soon">Instagram only for now. TikTok and YouTube scheduling coming soon.</div>
          </div>
```

- [ ] **Step 3: Add scheduling JavaScript**

Add to the automations engine script block:

```js
/* ══════════════════════════════════════════════════
   SCHEDULING ENGINE
   ══════════════════════════════════════════════════ */
var selectedScheduleTime = null;
var generatedCaption = '';
var generatedHashtags = [];

function getTopTimeSlots() {
  // Use existing hourly data if available
  var hourlyData = window._hourlyData || {};
  var byHour = {};
  for (var key in hourlyData) {
    var hr = key.includes(':') ? parseInt(key.split(':').pop(), 10) : parseInt(key, 10);
    if (!isNaN(hr)) byHour[hr] = (byHour[hr] || 0) + hourlyData[key];
  }

  // Find top 3 hours
  var hours = [];
  for (var h = 0; h < 24; h++) {
    var windowSum = (byHour[h] || 0) + (byHour[(h + 1) % 24] || 0);
    hours.push({ hour: h, score: windowSum });
  }
  hours.sort(function(a, b) { return b.score - a.score; });

  // Get top 3 non-adjacent hours
  var selected = [];
  var used = {};
  for (var i = 0; i < hours.length && selected.length < 3; i++) {
    if (!used[hours[i].hour] && !used[hours[i].hour - 1] && !used[hours[i].hour + 1]) {
      selected.push(hours[i]);
      used[hours[i].hour] = true;
    }
  }

  // Fallback if no data
  if (!selected.length) {
    selected = [
      { hour: 19, score: 100 },
      { hour: 12, score: 80 },
      { hour: 7, score: 60 },
    ];
  }

  // Map to upcoming dates
  var now = new Date();
  var slots = [];
  var labels = ['Peak engagement', 'High engagement', 'Good engagement'];
  for (var s = 0; s < selected.length; s++) {
    var target = new Date(now);
    target.setHours(selected[s].hour, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    // Skip to next available day if too close
    while (target - now < 1800000) { // at least 30 min out
      target.setDate(target.getDate() + 1);
    }
    var dayName = target.toLocaleDateString('en-US', { weekday: 'short' });
    var timeStr = target.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    slots.push({
      label: dayName + ' ' + timeStr,
      sublabel: labels[s] || '',
      iso: target.toISOString(),
    });
  }
  return slots;
}

function openSchedulePanel() {
  var panel = document.getElementById('schedulePanel');
  var slotsEl = document.getElementById('scheduleSlots');
  selectedScheduleTime = null;
  document.getElementById('scheduleConfirmBtn').disabled = true;
  document.getElementById('scheduleCustomTime').value = '';

  var slots = getTopTimeSlots();
  slotsEl.innerHTML = slots.map(function(slot, i) {
    return '<div class="schedule-slot" data-iso="' + slot.iso + '" onclick="selectTimeSlot(this)">' +
      '<span class="schedule-slot-time">' + slot.label + '</span>' +
      '<span class="schedule-slot-score">' + slot.sublabel + '</span>' +
    '</div>';
  }).join('');

  panel.classList.add('active');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeSchedulePanel() {
  document.getElementById('schedulePanel').classList.remove('active');
  selectedScheduleTime = null;
}

function selectTimeSlot(el) {
  document.querySelectorAll('.schedule-slot').forEach(function(s) { s.classList.remove('selected'); });
  el.classList.add('selected');
  selectedScheduleTime = el.dataset.iso;
  document.getElementById('scheduleConfirmBtn').disabled = false;
  document.getElementById('scheduleCustomTime').value = '';
}

// Custom time input
document.getElementById('scheduleCustomTime').addEventListener('change', function() {
  if (this.value) {
    document.querySelectorAll('.schedule-slot').forEach(function(s) { s.classList.remove('selected'); });
    selectedScheduleTime = new Date(this.value).toISOString();
    document.getElementById('scheduleConfirmBtn').disabled = false;
  }
});

function confirmSchedule() {
  if (!selectedScheduleTime || !createPostImages.length) return;
  var btn = document.getElementById('scheduleConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Scheduling...';

  // First upload all images to get public URLs
  uploadAllImages(createPostImages).then(function(imageUrls) {
    // Then create the scheduled post
    return fetch('/api/schedule-post', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + password, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: imageUrls,
        caption: generatedCaption,
        hashtags: generatedHashtags,
        platform: createPostPlatform,
        scheduledAt: selectedScheduleTime,
        automationKeyword: document.getElementById('createPostAutomation').value || '',
      }),
    });
  }).then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.ok) {
      closeSchedulePanel();
      clearPostImage();
      showToast('Scheduled for ' + new Date(selectedScheduleTime).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }));
      loadScheduledPosts();
    } else {
      alert(data.error || 'Failed to schedule');
    }
    btn.textContent = 'Schedule Post';
    btn.disabled = false;
  }).catch(function(err) {
    alert('Failed to schedule: ' + err.message);
    btn.textContent = 'Schedule Post';
    btn.disabled = false;
  });
}

function postNow() {
  if (!createPostImages.length) return;
  var btn = document.querySelector('.cp-action-ig');
  if (btn) { btn.disabled = true; btn.textContent = 'Publishing...'; }

  uploadAllImages(createPostImages).then(function(imageUrls) {
    return fetch('/api/schedule-post', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + password, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: imageUrls,
        caption: generatedCaption,
        hashtags: generatedHashtags,
        platform: createPostPlatform,
        automationKeyword: document.getElementById('createPostAutomation').value || '',
        postNow: true,
      }),
    });
  }).then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.ok) {
      clearPostImage();
      showToast('Post published!');
    } else {
      alert(data.error || 'Failed to publish');
    }
    if (btn) { btn.disabled = false; btn.textContent = '\u{1F4F7} Post Now to Instagram'; }
  }).catch(function(err) {
    alert('Failed: ' + err.message);
    if (btn) { btn.disabled = false; btn.textContent = '\u{1F4F7} Post Now to Instagram'; }
  });
}

function uploadAllImages(images) {
  var ttl = selectedScheduleTime ? 604800 : 3600; // 7 days for scheduled, 1hr for now
  return Promise.all(images.map(function(img) {
    return fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + password, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: img, ttl: ttl }),
    }).then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.url) throw new Error('Image upload failed');
      return data.url;
    });
  }));
}

function showToast(msg) {
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--accent);color:var(--bg);padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:999;font-family:var(--sans);box-shadow:0 4px 20px rgba(0,0,0,0.3);';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}
```

- [ ] **Step 4: Store generated caption/hashtags for scheduling**

In the `generatePost` function, after the JSON is parsed and caption/hashtags are extracted (~where `showPostActions(parsed)` is called), add:

```js
            generatedCaption = parsed.caption || fullText;
            generatedHashtags = parsed.hashtags || [];
```

- [ ] **Step 5: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add hub/index.html
git commit -m "feat(hub): scheduling UI with AI-recommended time slots"
```

---

### Task 7: Scheduled Posts List + Planner Integration

**Files:**
- Modify: `hub/index.html`

Add a "Scheduled Posts" card to the Engagement Engine section and show scheduled posts in the Weekly Planner.

- [ ] **Step 1: Add Scheduled Posts card HTML**

In the Engagement Engine section (after the DM Settings card), add:

```html
      <div class="home-card" style="grid-column: 1 / -1;">
        <div class="home-card-label" style="display:flex;justify-content:space-between;align-items:center;">
          📅 Scheduled Posts
          <div style="display:flex;gap:6px;">
            <button onclick="showScheduledTab('upcoming')" id="schedTabUpcoming" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:var(--accent-pale);color:var(--text);cursor:pointer;font-family:var(--sans);">Upcoming</button>
            <button onclick="showScheduledTab('posted')" id="schedTabPosted" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:var(--sans);">Posted</button>
          </div>
        </div>
        <div id="scheduledPostsList"></div>
      </div>
```

- [ ] **Step 2: Add scheduled posts JavaScript**

```js
/* ══════════════════════════════════════════════════
   SCHEDULED POSTS
   ══════════════════════════════════════════════════ */
var scheduledPostsData = [];
var scheduledPostsTab = 'upcoming';

function loadScheduledPosts() {
  fetch('/api/schedule-post', { headers: { 'Authorization': 'Bearer ' + password } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      scheduledPostsData = data.posts || [];
      renderScheduledPosts();
      renderPlannerPosts();
    })
    .catch(function() {});
}

function showScheduledTab(tab) {
  scheduledPostsTab = tab;
  document.getElementById('schedTabUpcoming').style.background = tab === 'upcoming' ? 'var(--accent-pale)' : 'transparent';
  document.getElementById('schedTabUpcoming').style.color = tab === 'upcoming' ? 'var(--text)' : 'var(--text-muted)';
  document.getElementById('schedTabPosted').style.background = tab === 'posted' ? 'var(--accent-pale)' : 'transparent';
  document.getElementById('schedTabPosted').style.color = tab === 'posted' ? 'var(--text)' : 'var(--text-muted)';
  renderScheduledPosts();
}

function renderScheduledPosts() {
  var el = document.getElementById('scheduledPostsList');
  if (!el) return;

  var filtered = scheduledPostsData.filter(function(p) {
    if (scheduledPostsTab === 'upcoming') return p.status === 'scheduled';
    return p.status === 'posted';
  }).sort(function(a, b) {
    return new Date(scheduledPostsTab === 'upcoming' ? a.scheduledAt : b.publishedAt || b.scheduledAt) -
           new Date(scheduledPostsTab === 'upcoming' ? b.scheduledAt : a.publishedAt || a.scheduledAt);
  });

  // Also show failed in upcoming tab
  if (scheduledPostsTab === 'upcoming') {
    var failed = scheduledPostsData.filter(function(p) { return p.status === 'failed'; });
    filtered = filtered.concat(failed);
  }

  if (!filtered.length) {
    el.innerHTML = '<div class="automation-empty">' +
      (scheduledPostsTab === 'upcoming' ? 'No upcoming posts' : 'No posted content yet') + '</div>';
    return;
  }

  el.innerHTML = filtered.map(function(p) {
    var statusDot = p.status === 'scheduled' ? '\u{1F535}' :
                    p.status === 'posted' ? '\u{1F7E2}' :
                    p.status === 'failed' ? '\u{1F534}' : '\u26AA';
    var time = p.status === 'posted'
      ? new Date(p.publishedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : new Date(p.scheduledAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    var thumb = p.images && p.images[0] ? '<img src="' + p.images[0] + '" style="width:40px;height:40px;border-radius:6px;object-fit:cover;border:1px solid var(--border);flex-shrink:0;">' : '';
    var badge = p.images && p.images.length > 1 ? '<span style="font-size:10px;color:var(--text-muted);">' + p.images.length + ' photos</span>' : '';
    var actions = '';
    if (p.status === 'scheduled') {
      actions = '<button onclick="cancelScheduledPost(\'' + p.id + '\')" style="font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;">Cancel</button>';
    }
    if (p.status === 'failed') {
      actions = '<button onclick="retryScheduledPost(\'' + p.id + '\')" style="font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid #f87171;background:rgba(248,113,113,0.1);color:#f87171;cursor:pointer;">Retry</button>';
    }

    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">' +
      thumb +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.caption.substring(0, 60) + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);display:flex;gap:8px;align-items:center;">' + statusDot + ' ' + time + ' ' + badge + '</div>' +
        (p.error ? '<div style="font-size:10px;color:#f87171;margin-top:2px;">' + p.error + '</div>' : '') +
      '</div>' +
      actions +
    '</div>';
  }).join('');
}

function cancelScheduledPost(id) {
  fetch('/api/schedule-post', {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + password, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id, status: 'cancelled' }),
  }).then(function() { loadScheduledPosts(); });
}

function retryScheduledPost(id) {
  fetch('/api/schedule-post', {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + password, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id, retry: true }),
  }).then(function() { loadScheduledPosts(); });
}

function renderPlannerPosts() {
  // Show scheduled posts on calendar days in the planner
  var calDays = document.querySelectorAll('.cal-day');
  if (!calDays.length) return;

  // Clear existing scheduled post badges
  calDays.forEach(function(day) {
    var existing = day.querySelectorAll('.cal-scheduled-post');
    existing.forEach(function(el) { el.remove(); });
  });

  var scheduled = scheduledPostsData.filter(function(p) {
    return p.status === 'scheduled' || p.status === 'posted';
  });

  scheduled.forEach(function(post) {
    var postDate = new Date(post.scheduledAt);
    var dateStr = postDate.toISOString().split('T')[0];

    calDays.forEach(function(day) {
      var dayDate = day.dataset.date;
      if (dayDate === dateStr) {
        var statusColor = post.status === 'posted' ? '#22c55e' : post.status === 'failed' ? '#f87171' : '#3b82f6';
        var time = postDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        var badge = document.createElement('div');
        badge.className = 'cal-scheduled-post';
        badge.style.cssText = 'font-size:10px;padding:3px 6px;background:' + statusColor + '20;border:1px solid ' + statusColor + '40;border-radius:5px;margin-top:4px;color:' + statusColor + ';cursor:pointer;';
        badge.textContent = '\u{1F4F7} ' + time;
        badge.title = post.caption.substring(0, 60);
        day.appendChild(badge);
      }
    });
  });
}
```

- [ ] **Step 3: Load scheduled posts on hub show**

In the `showHub` override at the bottom of the file, add `loadScheduledPosts()`:

```js
showHub = function() {
  _origShowHub();
  loadAutomations();
  loadLeads();
  loadScheduledPosts();
  setTimeout(function() { loadInstagramData(); }, 500);
};
```

- [ ] **Step 4: Commit**

```bash
cd /Users/samotto/mandi-bagley
git add hub/index.html
git commit -m "feat(hub): scheduled posts list + planner integration with status badges"
```

---

### Task 8: Final Wiring + Vercel JSON

**Files:**
- Modify: `vercel.json`
- Modify: `hub/index.html` (store hourly data for time recommendations)

- [ ] **Step 1: Update vercel.json crons**

Add the publish-scheduled cron to the existing crons array in `vercel.json`:

```json
{
  "path": "/api/publish-scheduled",
  "schedule": "*/15 * * * *"
}
```

- [ ] **Step 2: Store hourly data globally for time slot recommendations**

In the `renderHomeStats` function or wherever `stats:hourly` data is fetched, expose it globally:

```js
window._hourlyData = hourlyData;
```

This is likely already done in the stats loading code. Verify by searching for `_hourlyData` or `hourly` in the existing code. If not, add it where the hourly hash is parsed.

- [ ] **Step 3: Commit and push**

```bash
cd /Users/samotto/mandi-bagley
git add vercel.json hub/index.html
git commit -m "feat: add publish-scheduled cron + wire hourly data for time recommendations"
git push origin main
```

---

## Summary

| Task | What it builds | Can test without Meta? |
|------|---------------|----------------------|
| 1 | Extended image upload TTL | Yes |
| 2 | Carousel upload UI | Yes |
| 3 | Multi-image caption generation | Yes |
| 4 | Schedule post CRUD API | Yes |
| 5 | Publish cron job | No (needs `instagram_content_publish`) |
| 6 | Scheduling UI + time recommendations | Yes |
| 7 | Scheduled posts list + planner | Yes |
| 8 | Final wiring | Yes |

Tasks 1-4 and 6-8 are fully testable now. Task 5 (actual Instagram publishing) activates after Meta approves `instagram_content_publish`.
