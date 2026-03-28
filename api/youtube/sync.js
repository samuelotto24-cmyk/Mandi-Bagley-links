export const config = { runtime: 'edge' };

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = process.env.REDIS_PREFIX || 'stats:';
const CRON_SECRET = process.env.CRON_SECRET;

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: YOUTUBE_CLIENT_ID,
      client_secret: YOUTUBE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Token refresh failed: ' + (await res.text()));
  return res.json();
}

async function ytFetch(url, accessToken) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('YouTube API error: ' + res.status + ' ' + (await res.text()));
  return res.json();
}

export default async function handler(req) {
  if (CRON_SECRET && req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const tokenResult = await redis([['GET', PREFIX + 'youtube:tokens']]);
    const tokenRaw = tokenResult[0]?.result;
    if (!tokenRaw) {
      return new Response(JSON.stringify({ skipped: true, reason: 'YouTube not connected' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stored = JSON.parse(tokenRaw);
    let accessToken = stored.accessToken;
    const channelId = stored.channelId;

    if (Date.now() > stored.expiresAt - 300000) {
      const refreshed = await refreshAccessToken(stored.refreshToken);
      accessToken = refreshed.access_token;
      stored.accessToken = accessToken;
      stored.expiresAt = Date.now() + (refreshed.expires_in * 1000);
      await redis([['SET', PREFIX + 'youtube:tokens', JSON.stringify(stored)]]);
    }

    // 1. Channel stats
    const channelData = await ytFetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}`,
      accessToken
    );
    const stats = channelData.items?.[0]?.statistics || {};
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    const channel = {
      subscriberCount: parseInt(stats.subscriberCount || '0', 10),
      viewCount: parseInt(stats.viewCount || '0', 10),
      videoCount: parseInt(stats.videoCount || '0', 10),
      fetchedAt: new Date().toISOString(),
    };

    // 2. Recent videos (last 5)
    var videos = [];
    if (uploadsPlaylistId) {
      const playlistData = await ytFetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=5`,
        accessToken
      );
      const videoIds = (playlistData.items || []).map(function(item) {
        return item.contentDetails.videoId;
      }).join(',');

      if (videoIds) {
        const videosData = await ytFetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}`,
          accessToken
        );
        videos = (videosData.items || []).map(function(v) {
          return {
            title: v.snippet.title,
            videoId: v.id,
            publishedAt: v.snippet.publishedAt,
            views: parseInt(v.statistics.viewCount || '0', 10),
            likes: parseInt(v.statistics.likeCount || '0', 10),
            comments: parseInt(v.statistics.commentCount || '0', 10),
          };
        });
      }
    }

    // 3. Analytics (30 days)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    var views30d = 0, watchTime30d = 0;
    try {
      const overviewData = await ytFetch(
        'https://youtubeanalytics.googleapis.com/v2/reports?' + new URLSearchParams({
          ids: 'channel==MINE',
          startDate: startDate,
          endDate: endDate,
          metrics: 'views,estimatedMinutesWatched',
        }),
        accessToken
      );
      if (overviewData.rows && overviewData.rows[0]) {
        views30d = overviewData.rows[0][0] || 0;
        watchTime30d = Math.round(overviewData.rows[0][1] || 0);
      }
    } catch (e) { console.error('Analytics overview error:', e.message); }

    var demographics = { ageGroups: {}, genderSplit: {} };
    try {
      const demoData = await ytFetch(
        'https://youtubeanalytics.googleapis.com/v2/reports?' + new URLSearchParams({
          ids: 'channel==MINE',
          startDate: startDate,
          endDate: endDate,
          dimensions: 'ageGroup,gender',
          metrics: 'viewerPercentage',
          sort: '-viewerPercentage',
        }),
        accessToken
      );
      var genderTotals = {};
      var ageTotals = {};
      (demoData.rows || []).forEach(function(row) {
        var age = row[0], gender = row[1], pct = row[2];
        ageTotals[age] = (ageTotals[age] || 0) + pct;
        genderTotals[gender] = (genderTotals[gender] || 0) + pct;
      });
      demographics = { ageGroups: ageTotals, genderSplit: genderTotals };
    } catch (e) { console.error('Analytics demographics error:', e.message); }

    var trafficSources = {};
    try {
      const trafficData = await ytFetch(
        'https://youtubeanalytics.googleapis.com/v2/reports?' + new URLSearchParams({
          ids: 'channel==MINE',
          startDate: startDate,
          endDate: endDate,
          dimensions: 'insightTrafficSourceType',
          metrics: 'views',
          sort: '-views',
          maxResults: '10',
        }),
        accessToken
      );
      (trafficData.rows || []).forEach(function(row) {
        trafficSources[row[0]] = row[1];
      });
    } catch (e) { console.error('Analytics traffic error:', e.message); }

    var countries = {};
    try {
      const countryData = await ytFetch(
        'https://youtubeanalytics.googleapis.com/v2/reports?' + new URLSearchParams({
          ids: 'channel==MINE',
          startDate: startDate,
          endDate: endDate,
          dimensions: 'country',
          metrics: 'views',
          sort: '-views',
          maxResults: '10',
        }),
        accessToken
      );
      (countryData.rows || []).forEach(function(row) {
        countries[row[0]] = row[1];
      });
    } catch (e) { console.error('Analytics countries error:', e.message); }

    const analytics = {
      views30d: views30d,
      watchTime30d: watchTime30d,
      demographics: demographics,
      trafficSources: trafficSources,
      countries: countries,
      fetchedAt: new Date().toISOString(),
    };

    const today = new Date().toISOString().split('T')[0];
    await redis([
      ['SET', PREFIX + 'youtube:channel', JSON.stringify(channel)],
      ['SET', PREFIX + 'youtube:videos', JSON.stringify(videos)],
      ['SET', PREFIX + 'youtube:analytics', JSON.stringify(analytics)],
      ['SET', PREFIX + 'youtube:subscribers:' + today, String(channel.subscriberCount)],
      ['SET', PREFIX + 'youtube:views:' + today, String(channel.viewCount)],
    ]);

    return new Response(JSON.stringify({
      ok: true,
      channel: channel,
      videosCount: videos.length,
      analytics: { views30d: views30d, watchTime30d: watchTime30d },
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('YouTube sync error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
