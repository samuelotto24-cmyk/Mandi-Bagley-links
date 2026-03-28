export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}

export default async function handler(req) {
  const url = new URL(req.url);
  if (url.searchParams.get('password') !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const accessToken = await redisGet('stats:tiktok:access_token');

  if (!accessToken) {
    return new Response(JSON.stringify({ connected: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch user info
    const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json();

    // Fetch recent videos
    const videosRes = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,view_count,like_count,comment_count,share_count,create_time', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: 20 }),
    });
    const videosData = await videosRes.json();

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

    return new Response(JSON.stringify({
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
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Token might be expired — return disconnected state
    return new Response(JSON.stringify({ connected: false, error: 'token_expired' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
