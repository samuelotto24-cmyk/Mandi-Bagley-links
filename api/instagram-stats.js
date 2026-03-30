export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';

const CACHE_KEY = 'stats:instagram:cache';
const CACHE_TTL = 1800; // 30 minutes

async function redisPipeline(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

async function redisSetEx(key, ttl, value) {
  await fetch(`${REDIS_URL}/setex/${encodeURIComponent(key)}/${ttl}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
}

export default async function handler(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch token + cached data
  const [tokenResult, userIdResult, cacheResult] = await redisPipeline([
    ['GET', 'stats:instagram:access_token'],
    ['GET', 'stats:instagram:user_id'],
    ['GET', CACHE_KEY],
  ]);

  const accessToken = tokenResult?.result;
  const userId = userIdResult?.result;

  if (!accessToken) {
    return new Response(JSON.stringify({ connected: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Return cached data if available
  if (cacheResult?.result) {
    return new Response(cacheResult.result, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' },
    });
  }

  try {
    // Fetch profile info + recent media in parallel
    const [profileRes, mediaRes] = await Promise.all([
      fetch(`https://graph.instagram.com/v21.0/me?fields=id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count&access_token=${accessToken}`),
      fetch(`https://graph.instagram.com/v21.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=12&access_token=${accessToken}`),
    ]);

    const profile = await profileRes.json();
    const media = await mediaRes.json();

    if (profile.error) {
      console.error('Instagram API error:', JSON.stringify(profile.error));
      // Token might be expired — clear it
      if (profile.error.code === 190) {
        await fetch(`${REDIS_URL}/del/stats:instagram:access_token`, {
          headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
        });
        return new Response(JSON.stringify({ connected: false, error: 'Token expired' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ connected: false, error: profile.error.message }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find top performing post by likes
    const posts = (media.data || []).map(function(p) {
      return {
        id: p.id,
        caption: (p.caption || '').substring(0, 100),
        type: p.media_type,
        url: p.media_url || p.thumbnail_url || '',
        timestamp: p.timestamp,
        likes: p.like_count || 0,
        comments: p.comments_count || 0,
      };
    });

    const topPost = posts.length ? posts.reduce(function(a, b) { return a.likes > b.likes ? a : b; }) : null;

    // Calculate engagement from recent posts
    const totalEngagement = posts.reduce(function(sum, p) { return sum + p.likes + p.comments; }, 0);
    const avgEngagement = posts.length ? Math.round(totalEngagement / posts.length) : 0;
    const engagementRate = profile.followers_count ? ((avgEngagement / profile.followers_count) * 100).toFixed(1) : '0';

    const result = {
      connected: true,
      username: profile.username,
      name: profile.name || profile.username,
      profilePic: profile.profile_picture_url || '',
      accountType: profile.account_type,
      followers: profile.followers_count || 0,
      following: profile.follows_count || 0,
      posts: profile.media_count || 0,
      engagementRate: engagementRate,
      avgLikes: posts.length ? Math.round(posts.reduce(function(s, p) { return s + p.likes; }, 0) / posts.length) : 0,
      avgComments: posts.length ? Math.round(posts.reduce(function(s, p) { return s + p.comments; }, 0) / posts.length) : 0,
      topPost: topPost,
      recentPosts: posts.slice(0, 6),
    };

    const resultStr = JSON.stringify(result);

    // Cache for 30 minutes
    await redisSetEx(CACHE_KEY, CACHE_TTL, resultStr);

    return new Response(resultStr, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' },
    });
  } catch (e) {
    console.error('Instagram stats error:', e.message);
    return new Response(JSON.stringify({ connected: false, error: e.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
