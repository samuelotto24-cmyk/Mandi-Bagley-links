export const config = { runtime: 'edge' };

const REDIS_URL    = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX       = process.env.REDIS_PREFIX || 'stats:';
const CLIENT_NAME  = process.env.CLIENT_NAME  || 'Mandi Bagley';
const FROM_EMAIL   = process.env.CONTACT_FROM_EMAIL || 'hub@mandibagley.com';
const CLIENT_EMAIL = process.env.CLIENT_EMAIL;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;
const PASSWORD     = process.env.DASHBOARD_PASSWORD;

const POSTS_KEY         = PREFIX + 'scheduled_posts';
const ACCESS_TOKEN_KEY  = PREFIX + 'ig:access_token';
const USER_ID_KEY       = PREFIX + 'ig:user_id';
const NOTIFICATIONS_KEY = PREFIX + 'notifications';

const IG_API = 'https://graph.instagram.com/v21.0';
const MAX_RETRIES = 3;

// ─── Redis helpers ────────────────────────────────────────────────────────────

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
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', key, value]),
  });
  return res.json();
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

// ─── Response helper ──────────────────────────────────────────────────────────

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Instagram publishing ─────────────────────────────────────────────────────

async function igPost(path, params) {
  const url = new URL(`${IG_API}${path}`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

async function publishSingleImage(igUserId, accessToken, post) {
  const { id: creation_id } = await igPost(`/${igUserId}/media`, {
    image_url: post.images[0],
    caption: post.caption || '',
    access_token: accessToken,
  });

  const { id: media_id } = await igPost(`/${igUserId}/media_publish`, {
    creation_id,
    access_token: accessToken,
  });

  return media_id;
}

async function publishCarousel(igUserId, accessToken, post) {
  // Create each carousel item
  const itemIds = [];
  for (const image_url of post.images) {
    const { id: item_id } = await igPost(`/${igUserId}/media`, {
      image_url,
      is_carousel_item: true,
      access_token: accessToken,
    });
    itemIds.push(item_id);
  }

  // Create carousel container
  const { id: carousel_creation_id } = await igPost(`/${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: itemIds,
    caption: post.caption || '',
    access_token: accessToken,
  });

  // Publish
  const { id: media_id } = await igPost(`/${igUserId}/media_publish`, {
    creation_id: carousel_creation_id,
    access_token: accessToken,
  });

  return media_id;
}

async function publishPost(igUserId, accessToken, post) {
  const images = Array.isArray(post.images) ? post.images : [];
  if (images.length === 0) throw new Error('Post has no images');

  if (images.length === 1) {
    return publishSingleImage(igUserId, accessToken, post);
  }
  return publishCarousel(igUserId, accessToken, post);
}

// ─── Notifications ────────────────────────────────────────────────────────────

function buildSuccessEmailHtml(post, mediaId) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px;">
      <h2 style="margin:0 0 12px;font-size:20px;color:#0A0A0A;">Post Published</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.5;">
        Your scheduled post has been published to Instagram successfully.
      </p>
      ${post.caption ? `<div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:0;font-size:13px;color:#333;white-space:pre-wrap;">${post.caption.substring(0, 200)}${post.caption.length > 200 ? '…' : ''}</p>
      </div>` : ''}
      <p style="margin:0;font-size:12px;color:#999;">Media ID: ${mediaId}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#999;">Published at: ${new Date().toUTCString()}</p>
    </div>
  </div>
</body>
</html>`;
}

function buildFailureEmailHtml(post, errorMsg) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px;">
      <h2 style="margin:0 0 12px;font-size:20px;color:#c0392b;">Scheduled Post Failed</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.5;">
        A scheduled post failed to publish after ${MAX_RETRIES} attempts.
      </p>
      ${post.caption ? `<div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:0;font-size:13px;color:#333;white-space:pre-wrap;">${post.caption.substring(0, 200)}${post.caption.length > 200 ? '…' : ''}</p>
      </div>` : ''}
      <p style="margin:0;font-size:13px;color:#c0392b;">Error: ${errorMsg}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#999;">Scheduled for: ${post.scheduledAt}</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(subject, html) {
  if (!RESEND_KEY || !CLIENT_EMAIL) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${CLIENT_NAME} <${FROM_EMAIL}>`,
      to: [CLIENT_EMAIL],
      subject,
      html,
    }),
  });
}

async function pushNotification(notification) {
  await redisPipeline([
    ['LPUSH', NOTIFICATIONS_KEY, JSON.stringify(notification)],
    ['LTRIM', NOTIFICATIONS_KEY, '0', '499'],
  ]);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  // Auth: accept Vercel cron secret OR dashboard password
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const validTokens = [CRON_SECRET, PASSWORD].filter(Boolean);

  if (!token || !validTokens.includes(token)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Load Instagram credentials
  const [rawPosts, accessToken, igUserId] = await Promise.all([
    redisGet(POSTS_KEY),
    redisGet(ACCESS_TOKEN_KEY),
    redisGet(USER_ID_KEY),
  ]);

  const posts = rawPosts ? JSON.parse(rawPosts) : [];
  const now = Date.now();

  // Find due posts
  const duePosts = posts.filter(
    p => p.status === 'scheduled' && new Date(p.scheduledAt).getTime() <= now
  );

  if (duePosts.length === 0) {
    return json({ published: 0, message: 'No posts due' });
  }

  if (!accessToken || !igUserId) {
    return json({ error: 'Instagram credentials not configured', published: 0 }, 500);
  }

  let publishedCount = 0;

  for (const post of duePosts) {
    const idx = posts.findIndex(p => p.id === post.id);
    if (idx === -1) continue;

    try {
      const mediaId = await publishPost(igUserId, accessToken, post);

      posts[idx] = {
        ...post,
        status: 'posted',
        publishedAt: new Date().toISOString(),
        igMediaId: mediaId,
      };

      publishedCount++;

      // Notify success
      const notification = {
        type: 'post_published',
        postId: post.id,
        igMediaId: mediaId,
        caption: (post.caption || '').substring(0, 100),
        createdAt: new Date().toISOString(),
      };
      await pushNotification(notification);
      await sendEmail(
        `Post published — ${CLIENT_NAME}`,
        buildSuccessEmailHtml(post, mediaId)
      );
    } catch (err) {
      const retryCount = (post.retryCount || 0) + 1;

      if (retryCount >= MAX_RETRIES) {
        posts[idx] = {
          ...post,
          status: 'failed',
          retryCount,
          failedAt: new Date().toISOString(),
          lastError: err.message,
        };

        // Notify failure
        const notification = {
          type: 'post_failed',
          postId: post.id,
          error: err.message,
          retryCount,
          createdAt: new Date().toISOString(),
        };
        await pushNotification(notification);
        await sendEmail(
          `Scheduled post failed — ${CLIENT_NAME}`,
          buildFailureEmailHtml(post, err.message)
        );
      } else {
        // Keep as scheduled — will retry next run
        posts[idx] = {
          ...post,
          status: 'scheduled',
          retryCount,
          lastError: err.message,
        };
      }
    }
  }

  // Save updated posts
  await redisSet(POSTS_KEY, JSON.stringify(posts));

  return json({
    published: publishedCount,
    checked: duePosts.length,
  });
}
