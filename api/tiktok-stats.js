export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';

const CACHE_KEY = 'stats:tiktok:cache';
const CACHE_TTL = 1800; // 30 minutes

async function redisPipeline(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

export default async function handler(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch token + cached data in one pipeline
  const [tokenResult, cacheResult] = await redisPipeline([
    ['GET', 'stats:tiktok:access_token'],
    ['GET', CACHE_KEY],
  ]);

  const accessToken = tokenResult?.result;
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
    // Fetch user info + videos in parallel
    const [userRes, videosRes] = await Promise.all([
      fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,view_count,like_count,comment_count,share_count,create_time', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ max_count: 20 }),
      }),
    ]);

    const [userData, videosData] = await Promise.all([userRes.json(), videosRes.json()]);

    const user   = userData?.data?.user || {};
    const videos = videosData?.data?.videos || [];

    // Calculate aggregates
    let totalViews = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
    let topVideo = null;

    for (const v of videos) {
      totalViews    += v.view_count || 0;
      totalLikes    += v.like_count || 0;
      totalComments += v.comment_count || 0;
      totalShares   += v.share_count || 0;
      if (!topVideo || (v.view_count || 0) > (topVideo.view_count || 0)) {
        topVideo = v;
      }
    }

    const payload = JSON.stringify({
      connected: true,
      user: {
        name:       user.display_name || '',
        avatar:     user.avatar_url || '',
        followers:  user.follower_count || 0,
        following:  user.following_count || 0,
        totalLikes: user.likes_count || 0,
        videoCount: user.video_count || 0,
      },
      recentVideos: videos.slice(0, 10).map(v => ({
        id:        v.id,
        title:     v.title || '',
        cover:     v.cover_image_url || '',
        views:     v.view_count || 0,
        likes:     v.like_count || 0,
        comments:  v.comment_count || 0,
        shares:    v.share_count || 0,
        created:   v.create_time || 0,
      })),
      totals: {
        views:    totalViews,
        likes:    totalLikes,
        comments: totalComments,
        shares:   totalShares,
      },
      topVideo: topVideo ? {
        id:     topVideo.id,
        title:  topVideo.title || '',
        cover:  topVideo.cover_image_url || '',
        views:  topVideo.view_count || 0,
        likes:  topVideo.like_count || 0,
      } : null,
    });

    // Cache in Redis (fire-and-forget)
    redisPipeline([['SET', CACHE_KEY, payload, 'EX', CACHE_TTL]]);

    return new Response(payload, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' },
    });
  } catch {
    // Token might be expired — return disconnected state
    return new Response(JSON.stringify({ connected: false, error: 'token_expired' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
