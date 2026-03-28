# YouTube Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add YouTube OAuth, daily data sync, a Social Analytics section in the Hub, and YouTube context in the AI advisor — all in the template repo.

**Architecture:** Four new API endpoints (connect, callback, data, sync) handle OAuth and data fetching. YouTube data is stored in Redis alongside existing website analytics. The Hub gets a new Social Analytics section that reads from `/api/youtube/data`. The briefing and chat APIs include YouTube data in the LLM context when available. A Vercel cron job syncs data daily.

**Tech Stack:** Vercel Edge Functions, YouTube Data API v3, YouTube Analytics API v2, Upstash Redis, Google OAuth 2.0

---

## File Map

All files are in `~/creator-platform-template/template/`

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `api/youtube/connect.js` | Redirect to Google OAuth |
| Create | `api/youtube/callback.js` | Exchange code for tokens, store in Redis |
| Create | `api/youtube/data.js` | Serve stored YouTube data to Hub |
| Create | `api/youtube/sync.js` | Cron job — fetch YouTube stats, store in Redis |
| Create | `vercel.json` | Cron schedule for daily sync |
| Modify | `hub/index.html` | Social Analytics section (HTML + CSS + JS) |
| Modify | `api/briefing.js` | Include YouTube data in AI context |
| Modify | `api/chat.js` | Include YouTube data in AI context |

---

## Task 1: YouTube OAuth — Connect Endpoint

**Files:**
- Create: `~/creator-platform-template/template/api/youtube/connect.js`

- [ ] **Step 1: Create the connect endpoint**

```js
export const config = { runtime: 'edge' };

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'Password2024';

export default async function handler(req) {
  const url = new URL(req.url);
  const pw = url.searchParams.get('password');

  if (pw !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!YOUTUBE_CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'YouTube not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build the callback URL from the request origin
  const origin = url.origin;
  const redirectUri = origin + '/api/youtube/callback';

  // State param carries the password for callback verification
  const state = encodeURIComponent(JSON.stringify({ password: pw, origin: origin }));

  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ].join(' ');

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: YOUTUBE_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    state: state,
  }).toString();

  return Response.redirect(authUrl, 302);
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/creator-platform-template
git add template/api/youtube/connect.js
git commit -m "feat: add YouTube OAuth connect endpoint"
```

---

## Task 2: YouTube OAuth — Callback Endpoint

**Files:**
- Create: `~/creator-platform-template/template/api/youtube/callback.js`

- [ ] **Step 1: Create the callback endpoint**

```js
export const config = { runtime: 'edge' };

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = process.env.REDIS_PREFIX || 'stats:';

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

export default async function handler(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response('<html><body><h2>YouTube connection cancelled.</h2><p><a href="/hub">Back to Hub</a></p></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code || !stateRaw) {
    return new Response('Missing code or state', { status: 400 });
  }

  let state;
  try {
    state = JSON.parse(decodeURIComponent(stateRaw));
  } catch (e) {
    return new Response('Invalid state', { status: 400 });
  }

  const origin = state.origin || url.origin;
  const redirectUri = origin + '/api/youtube/callback';

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: YOUTUBE_CLIENT_ID,
      client_secret: YOUTUBE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Token exchange failed:', errText);
    return new Response('<html><body><h2>Connection failed.</h2><p>Could not connect YouTube. <a href="/hub">Try again</a></p></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const tokens = await tokenRes.json();

  // Get the channel ID
  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const channelData = await channelRes.json();
  const channelId = channelData.items?.[0]?.id || '';
  const channelTitle = channelData.items?.[0]?.snippet?.title || '';

  // Store tokens + channel info in Redis
  const tokenData = JSON.stringify({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in * 1000),
    channelId: channelId,
    channelTitle: channelTitle,
    connectedAt: new Date().toISOString(),
  });

  await redis([
    ['SET', PREFIX + 'youtube:tokens', tokenData],
  ]);

  // Redirect back to Hub
  return Response.redirect(origin + '/hub', 302);
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/creator-platform-template
git add template/api/youtube/callback.js
git commit -m "feat: add YouTube OAuth callback — token exchange and storage"
```

---

## Task 3: YouTube Sync Endpoint (Cron Job)

**Files:**
- Create: `~/creator-platform-template/template/api/youtube/sync.js`

- [ ] **Step 1: Create the sync endpoint**

```js
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
  // Verify cron secret
  if (CRON_SECRET && req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Read stored tokens
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

    // Refresh token if expired (or within 5 min of expiry)
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
    let videos = [];
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

    // 3a. Overview metrics
    let views30d = 0, watchTime30d = 0;
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

    // 3b. Demographics
    let demographics = { ageGroups: {}, genderSplit: {} };
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

    // 3c. Traffic sources
    let trafficSources = {};
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

    // 3d. Countries
    let countries = {};
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

    // 4. Store everything in Redis
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
```

- [ ] **Step 2: Commit**

```bash
cd ~/creator-platform-template
git add template/api/youtube/sync.js
git commit -m "feat: add YouTube sync cron job — fetches channel, videos, analytics"
```

---

## Task 4: YouTube Data Endpoint

**Files:**
- Create: `~/creator-platform-template/template/api/youtube/data.js`

- [ ] **Step 1: Create the data endpoint**

```js
export const config = { runtime: 'edge' };

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX = process.env.REDIS_PREFIX || 'stats:';

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

export default async function handler(req) {
  const url = new URL(req.url);
  if (url.searchParams.get('password') !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if YouTube is connected
  const results = await redis([
    ['GET', PREFIX + 'youtube:tokens'],
    ['GET', PREFIX + 'youtube:channel'],
    ['GET', PREFIX + 'youtube:videos'],
    ['GET', PREFIX + 'youtube:analytics'],
  ]);

  const tokens = results[0]?.result ? JSON.parse(results[0].result) : null;
  if (!tokens) {
    return new Response(JSON.stringify({ connected: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const channel = results[1]?.result ? JSON.parse(results[1].result) : null;
  const videos = results[2]?.result ? JSON.parse(results[2].result) : [];
  const analytics = results[3]?.result ? JSON.parse(results[3].result) : null;

  // Get subscriber history for trend (last 7 days)
  const historyCommands = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    historyCommands.push(['GET', PREFIX + 'youtube:subscribers:' + d.toISOString().split('T')[0]]);
  }
  const historyResults = await redis(historyCommands);
  const subscriberHistory = historyResults.map(function(r, idx) {
    var d = new Date();
    d.setDate(d.getDate() - idx);
    return {
      date: d.toISOString().split('T')[0],
      count: r?.result ? parseInt(r.result, 10) : null,
    };
  }).filter(function(h) { return h.count !== null; });

  return new Response(JSON.stringify({
    connected: true,
    channelTitle: tokens.channelTitle,
    connectedAt: tokens.connectedAt,
    channel: channel,
    videos: videos,
    analytics: analytics,
    subscriberHistory: subscriberHistory,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/creator-platform-template
git add template/api/youtube/data.js
git commit -m "feat: add YouTube data endpoint — serves stored stats to Hub"
```

---

## Task 5: Vercel Cron Configuration

**Files:**
- Create: `~/creator-platform-template/template/vercel.json`

- [ ] **Step 1: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/youtube/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/creator-platform-template
git add template/vercel.json
git commit -m "feat: add vercel.json with daily YouTube sync cron"
```

---

## Task 6: Hub Social Analytics Section — CSS + HTML + JS

**Files:**
- Modify: `~/creator-platform-template/template/hub/index.html`

This is the biggest task — adding the Social Analytics section to the Hub with connect buttons and YouTube data display.

- [ ] **Step 1: Add Social Analytics CSS**

Read `template/hub/index.html`. Find the closing `</style>` tag. Add the following CSS before it:

```css
/* ── Social Analytics ── */
.social-section-header {
  text-align: center;
  padding: 8px 0 20px;
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.5;
}
.social-platforms {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}
.social-platform-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  transition: border-color 0.22s ease;
}
.social-platform-card:hover { border-color: var(--accent-border); }
.social-platform-card.connected {
  text-align: left;
  padding: 20px;
}
.social-platform-icon {
  font-size: 28px;
  margin-bottom: 12px;
}
.social-platform-name {
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 4px;
}
.social-platform-status {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 16px;
}
.social-connect-btn {
  display: inline-block;
  padding: 10px 24px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: 8px;
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: box-shadow 0.22s ease;
  text-decoration: none;
}
.social-connect-btn:hover {
  box-shadow: 0 0 24px var(--accent-pale);
}
.social-connect-btn.disabled {
  background: var(--surface-elevated);
  color: var(--text-muted);
  cursor: default;
  border: 1px solid var(--border);
}
.social-connect-btn.disabled:hover { box-shadow: none; }
.yt-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}
.yt-stat {
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
}
.yt-stat-value {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
}
.yt-stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-top: 2px;
}
.yt-stat-trend {
  font-size: 11px;
  margin-top: 2px;
}
.yt-stat-trend.up { color: #4ade80; }
.yt-stat-trend.down { color: #f87171; }
.yt-videos-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.yt-video-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13px;
}
.yt-video-title {
  color: var(--text);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 12px;
}
.yt-video-stats {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-muted);
}
.yt-demo-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}
.yt-demo-card {
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}
.yt-demo-card-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.yt-demo-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}
.yt-demo-bar-label {
  width: 60px;
  flex-shrink: 0;
  color: var(--text-muted);
}
.yt-demo-bar-track {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.05);
  border-radius: 2px;
  overflow: hidden;
}
.yt-demo-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
}
.yt-demo-bar-pct {
  width: 36px;
  text-align: right;
  color: var(--text-muted);
  flex-shrink: 0;
}
.yt-section-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 10px;
}
@media (max-width: 640px) {
  .social-platforms { grid-template-columns: 1fr; }
  .yt-stats-grid { grid-template-columns: 1fr; }
  .yt-demo-row { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Add Social Analytics HTML**

Find the divider after the Stats + Goal section. It should be right before `<!-- Game Plan / Briefing Section -->` or similar. Find the first `<div class="divider"></div>` that appears after the goal section.

Insert the Social Analytics section after that divider:

```html
  <!-- Social Analytics -->
  <div class="fade-up">
    <div class="section-label">Social Analytics</div>
    <div class="social-section-header" id="socialHeader">Connect your platforms to unlock AI-powered strategy across all your channels</div>
    <div class="social-platforms" id="socialPlatforms">
      <div class="social-platform-card" id="ytCard">
        <div class="social-platform-icon">&#9654;&#65039;</div>
        <div class="social-platform-name">YouTube</div>
        <div class="social-platform-status" id="ytStatus">Not connected</div>
        <a class="social-connect-btn" id="ytConnectBtn" href="#">Connect YouTube</a>
        <div id="ytData" style="display:none;"></div>
      </div>
      <div class="social-platform-card">
        <div class="social-platform-icon">&#128247;</div>
        <div class="social-platform-name">Instagram</div>
        <div class="social-platform-status">Coming soon</div>
        <button class="social-connect-btn disabled">Coming Soon</button>
      </div>
      <div class="social-platform-card">
        <div class="social-platform-icon">&#127925;</div>
        <div class="social-platform-name">TikTok</div>
        <div class="social-platform-status">Coming soon</div>
        <button class="social-connect-btn disabled">Coming Soon</button>
      </div>
    </div>
  </div>

  <div class="divider"></div>
```

- [ ] **Step 3: Add Social Analytics JavaScript**

Find the section where other load functions are defined (near `loadBriefing`, `loadGoal`, etc.). Add this function:

```js
/* ── Social Analytics ── */
async function loadSocialAnalytics() {
  try {
    var res = await fetch('/api/youtube/data?password=' + encodeURIComponent(password));
    if (!res.ok) return;
    var data = await res.json();

    // Set connect button href
    document.getElementById('ytConnectBtn').href = '/api/youtube/connect?password=' + encodeURIComponent(password);

    if (!data.connected) return;

    // YouTube is connected — render data
    var card = document.getElementById('ytCard');
    card.classList.add('connected');

    var ch = data.channel || {};
    var analytics = data.analytics || {};
    var videos = data.videos || [];
    var history = data.subscriberHistory || [];

    // Calculate subscriber trend
    var subTrend = '';
    if (history.length >= 2) {
      var newest = history[0].count;
      var oldest = history[history.length - 1].count;
      var diff = newest - oldest;
      if (diff > 0) subTrend = '<span class="yt-stat-trend up">+' + diff.toLocaleString() + ' this week</span>';
      else if (diff < 0) subTrend = '<span class="yt-stat-trend down">' + diff.toLocaleString() + ' this week</span>';
    }

    // Format watch time
    var watchHours = analytics.watchTime30d ? Math.round(analytics.watchTime30d / 60) : 0;

    var html = '';

    // Stats row
    html += '<div class="yt-stats-grid">';
    html += '<div class="yt-stat"><div class="yt-stat-value">' + (ch.subscriberCount || 0).toLocaleString() + '</div><div class="yt-stat-label">Subscribers</div>' + subTrend + '</div>';
    html += '<div class="yt-stat"><div class="yt-stat-value">' + (analytics.views30d || 0).toLocaleString() + '</div><div class="yt-stat-label">Views (30d)</div></div>';
    html += '<div class="yt-stat"><div class="yt-stat-value">' + watchHours.toLocaleString() + 'h</div><div class="yt-stat-label">Watch Time (30d)</div></div>';
    html += '</div>';

    // Recent videos
    if (videos.length) {
      html += '<div class="yt-section-label">Recent Videos</div>';
      html += '<div class="yt-videos-list">';
      videos.forEach(function(v) {
        html += '<div class="yt-video-item">';
        html += '<span class="yt-video-title">' + v.title + '</span>';
        html += '<span class="yt-video-stats">';
        html += '<span>' + (v.views || 0).toLocaleString() + ' views</span>';
        html += '<span>' + (v.likes || 0).toLocaleString() + ' likes</span>';
        html += '<span>' + (v.comments || 0).toLocaleString() + ' comments</span>';
        html += '</span></div>';
      });
      html += '</div>';
    }

    // Demographics + Traffic Sources
    var demo = analytics.demographics || {};
    var traffic = analytics.trafficSources || {};
    var countries = analytics.countries || {};

    html += '<div class="yt-demo-row">';

    // Gender + Age
    if (demo.genderSplit && Object.keys(demo.genderSplit).length) {
      html += '<div class="yt-demo-card"><div class="yt-demo-card-title">Audience</div>';
      Object.entries(demo.genderSplit).sort(function(a,b){return b[1]-a[1];}).forEach(function(e) {
        var label = e[0] === 'female' ? 'Female' : e[0] === 'male' ? 'Male' : 'Other';
        var pct = Math.round(e[1]);
        html += '<div class="yt-demo-bar"><span class="yt-demo-bar-label">' + label + '</span>';
        html += '<div class="yt-demo-bar-track"><div class="yt-demo-bar-fill" style="width:' + pct + '%"></div></div>';
        html += '<span class="yt-demo-bar-pct">' + pct + '%</span></div>';
      });
      if (demo.ageGroups && Object.keys(demo.ageGroups).length) {
        html += '<div style="margin-top:10px;">';
        Object.entries(demo.ageGroups).sort(function(a,b){return b[1]-a[1];}).slice(0, 4).forEach(function(e) {
          var label = e[0].replace('age', '');
          var pct = Math.round(e[1]);
          html += '<div class="yt-demo-bar"><span class="yt-demo-bar-label">' + label + '</span>';
          html += '<div class="yt-demo-bar-track"><div class="yt-demo-bar-fill" style="width:' + pct + '%"></div></div>';
          html += '<span class="yt-demo-bar-pct">' + pct + '%</span></div>';
        });
        html += '</div>';
      }
      html += '</div>';
    }

    // Traffic sources
    if (Object.keys(traffic).length) {
      html += '<div class="yt-demo-card"><div class="yt-demo-card-title">Traffic Sources</div>';
      var totalTraffic = Object.values(traffic).reduce(function(a,b){return a+b;}, 0);
      Object.entries(traffic).sort(function(a,b){return b[1]-a[1];}).slice(0, 5).forEach(function(e) {
        var label = e[0].replace(/_/g, ' ').replace(/\b\w/g, function(c){return c.toUpperCase();});
        var pct = totalTraffic > 0 ? Math.round(e[1] / totalTraffic * 100) : 0;
        html += '<div class="yt-demo-bar"><span class="yt-demo-bar-label" style="width:80px">' + label + '</span>';
        html += '<div class="yt-demo-bar-track"><div class="yt-demo-bar-fill" style="width:' + pct + '%"></div></div>';
        html += '<span class="yt-demo-bar-pct">' + pct + '%</span></div>';
      });
      html += '</div>';
    }

    html += '</div>';

    // Top countries
    if (Object.keys(countries).length) {
      html += '<div class="yt-demo-card" style="margin-bottom:0;"><div class="yt-demo-card-title">Top Countries</div>';
      var totalCountry = Object.values(countries).reduce(function(a,b){return a+b;}, 0);
      Object.entries(countries).sort(function(a,b){return b[1]-a[1];}).slice(0, 5).forEach(function(e) {
        var pct = totalCountry > 0 ? Math.round(e[1] / totalCountry * 100) : 0;
        html += '<div class="yt-demo-bar"><span class="yt-demo-bar-label">' + e[0] + '</span>';
        html += '<div class="yt-demo-bar-track"><div class="yt-demo-bar-fill" style="width:' + pct + '%"></div></div>';
        html += '<span class="yt-demo-bar-pct">' + pct + '%</span></div>';
      });
      html += '</div>';
    }

    // Hide connect button, show data
    document.getElementById('ytConnectBtn').style.display = 'none';
    document.getElementById('ytStatus').textContent = 'Connected · ' + (data.channelTitle || 'YouTube');
    document.getElementById('ytData').style.display = 'block';
    document.getElementById('ytData').innerHTML = html;

    // Update header
    document.getElementById('socialHeader').textContent = 'Connect more platforms to unlock full cross-channel strategy';

  } catch (e) {
    console.error('Social analytics load failed:', e);
  }
}
```

Then find the initialization block in `showHub()` where `loadBriefing()`, `loadGoal()`, `loadReferral()` are called. Add:

```js
  loadSocialAnalytics();
```

- [ ] **Step 4: Commit**

```bash
cd ~/creator-platform-template
git add template/hub/index.html
git commit -m "feat: add Social Analytics section to Hub — YouTube connect + data display"
```

---

## Task 7: AI Advisor Integration

**Files:**
- Modify: `~/creator-platform-template/template/api/briefing.js`
- Modify: `~/creator-platform-template/template/api/chat.js`

- [ ] **Step 1: Add YouTube context to briefing.js**

Read `template/api/briefing.js`. Find the section where Redis commands are built (the big `await redis([...])` call). Add these commands to the pipeline:

```js
      ['GET', PREFIX + 'youtube:channel'],
      ['GET', PREFIX + 'youtube:videos'],
      ['GET', PREFIX + 'youtube:analytics'],
```

Then after the data parsing section, add:

```js
    // YouTube data (if connected)
    const ytChannelRaw = results[N]?.result; // replace N with the correct index
    const ytVideosRaw = results[N+1]?.result;
    const ytAnalyticsRaw = results[N+2]?.result;
    let youtubeContext = '';
    if (ytChannelRaw) {
      const ytChannel = JSON.parse(ytChannelRaw);
      const ytVideos = ytVideosRaw ? JSON.parse(ytVideosRaw) : [];
      const ytAnalytics = ytAnalyticsRaw ? JSON.parse(ytAnalyticsRaw) : {};
      youtubeContext = '\n\n## YouTube Analytics\n';
      youtubeContext += '- Subscribers: ' + (ytChannel.subscriberCount || 0).toLocaleString() + '\n';
      youtubeContext += '- Total channel views: ' + (ytChannel.viewCount || 0).toLocaleString() + '\n';
      if (ytAnalytics.views30d) youtubeContext += '- Views (30d): ' + ytAnalytics.views30d.toLocaleString() + '\n';
      if (ytAnalytics.watchTime30d) youtubeContext += '- Watch time (30d): ' + Math.round(ytAnalytics.watchTime30d / 60) + ' hours\n';
      if (ytAnalytics.demographics?.genderSplit) {
        var genders = Object.entries(ytAnalytics.demographics.genderSplit).map(function(e) { return e[0] + ': ' + Math.round(e[1]) + '%'; }).join(', ');
        youtubeContext += '- Gender: ' + genders + '\n';
      }
      if (ytAnalytics.trafficSources) {
        var sources = Object.entries(ytAnalytics.trafficSources).sort(function(a,b){return b[1]-a[1];}).slice(0,3).map(function(e){return e[0]+': '+e[1];}).join(', ');
        youtubeContext += '- Top traffic sources: ' + sources + '\n';
      }
      if (ytAnalytics.countries) {
        var topC = Object.entries(ytAnalytics.countries).sort(function(a,b){return b[1]-a[1];}).slice(0,3).map(function(e){return e[0]+': '+e[1];}).join(', ');
        youtubeContext += '- Top countries: ' + topC + '\n';
      }
      if (ytVideos.length) {
        youtubeContext += '\n### Recent Videos\n';
        ytVideos.forEach(function(v) {
          youtubeContext += '- "' + v.title + '" — ' + (v.views||0).toLocaleString() + ' views, ' + (v.likes||0).toLocaleString() + ' likes, ' + (v.comments||0).toLocaleString() + ' comments (' + (v.publishedAt||'').split('T')[0] + ')\n';
        });
      }
    }
```

Then include `youtubeContext` in the LLM prompt. Find where the `userMessage` is built and append `youtubeContext` to it (e.g., after the `## Calendar dates this week` section, add `${youtubeContext}`).

**IMPORTANT:** The exact line numbers and Redis pipeline indexes will depend on the current state of the file. The implementer must read the file, count the existing Redis commands, and add the YouTube commands at the end of the pipeline. Then use the correct index to extract the results.

- [ ] **Step 2: Add YouTube context to chat.js**

Same approach for `template/api/chat.js`. Add the three YouTube Redis commands to the pipeline, parse the results, and include the YouTube context in the `dataContext` string that gets passed to the LLM.

Find where `dataContext` is built (the template literal that starts with `## ${CLIENT_NAME}'s Analytics Data`). At the end of it, before the closing backtick, add:

```js
${youtubeContext}
```

Build `youtubeContext` the same way as in briefing.js — read the three YouTube keys from the Redis results and format as a text section.

- [ ] **Step 3: Commit**

```bash
cd ~/creator-platform-template
git add template/api/briefing.js template/api/chat.js
git commit -m "feat: include YouTube data in AI advisor context"
```

---

## Task 8: Enable YouTube Analytics API in Google Cloud

**Note:** This is a manual step Sam needs to do, not code.

- [ ] **Step 1: Enable YouTube Analytics API**

Go to https://console.cloud.google.com, select the "Creator Platform" project, go to APIs & Services → Library, search for "YouTube Analytics API", and click Enable.

(The YouTube Data API v3 was already enabled. The Analytics API is a separate API that needs its own enablement.)

- [ ] **Step 2: Add test user for OAuth**

Since the app is in "Testing" mode (not published), go to APIs & Services → OAuth consent screen → Test users → Add users. Add your own Google email so you can test the flow.

---

## Task 9: Push Template Updates

- [ ] **Step 1: Push to GitHub**

```bash
cd ~/creator-platform-template
git push origin main
```

- [ ] **Step 2: Verify all commits are on GitHub**

```bash
git log --oneline
```

Should show all YouTube integration commits.
