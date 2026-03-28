# YouTube Integration — Social Analytics for the Hub

> Connect a creator's YouTube channel to pull real analytics daily, display in the Hub, and feed into the AI advisor.

---

## Goal

Add a "Social Analytics" section to the Hub where creators connect their YouTube channel (and later Instagram/TikTok). Once connected, YouTube stats are pulled automatically every day via cron job, stored in Redis, displayed in the Hub, and included in the AI advisor's context for cross-platform strategy advice.

---

## Scope

**In scope:**
- YouTube OAuth flow (connect once, data flows forever)
- Daily cron job to fetch YouTube analytics
- Social Analytics section in the Hub (connect buttons + data display)
- YouTube data in AI advisor context (briefing + chat)
- Built in the template repo for all future clients
- Historical tracking for trend display

**Out of scope (future phases):**
- Instagram integration (waiting on Meta app review)
- TikTok integration (waiting on developer registration)
- YouTube channel management (posting, editing — read-only)

---

## Social Analytics Section — Hub UI

### Placement

After the Stats + Goal row, before the Game Plan section — high up so creators can't miss it.

### Unconnected State (first visit)

Header: "Connect your platforms to unlock AI-powered strategy across all your channels"

Three platform cards side by side:
- **YouTube** — YouTube icon, "Connect YouTube" button (accent-colored, glowing, prominent)
- **Instagram** — Instagram icon, "Coming Soon" button (dimmed, not clickable)
- **TikTok** — TikTok icon, "Coming Soon" button (dimmed, not clickable)

The connect buttons must be impossible to miss — accent color, glow effect, clear call to action.

### Connected State (after YouTube OAuth)

YouTube card expands to show full data:

**Top row (key metrics):**
- Subscriber count + trend ("gained 200 this week" or "+3.2%")
- Total views (last 30 days)
- Total watch time (last 30 days)

**Recent videos (last 5):**
- Video title (truncated)
- View count
- Likes
- Comments
- Published date

**Audience demographics:**
- Top 3 countries (with percentages)
- Age range breakdown (bar or pills)
- Gender split (percentage)

**Traffic sources:**
- Search, Suggested, External, Direct, Browse — shown as small bar list or pills with percentages

Instagram and TikTok cards remain as "Coming Soon" buttons alongside the YouTube data.

---

## OAuth Flow

### Connect (one-time, creator-initiated)

1. Creator clicks "Connect YouTube" in the Hub
2. Hub redirects to `GET /api/youtube/connect?password=XXX`
3. API builds Google OAuth URL with scopes and redirects creator to Google
4. Creator signs into Google, grants permission
5. Google redirects to `GET /api/youtube/callback?code=XXX&state=XXX`
6. API exchanges code for access token + refresh token
7. API stores tokens in Redis (key: `stats:youtube:tokens`, encrypted with dashboard password)
8. API redirects creator back to Hub
9. Hub shows YouTube data

### Token management

- Refresh tokens are long-lived (don't expire unless revoked)
- The cron job uses the refresh token to get fresh access tokens automatically
- Creator never needs to reconnect unless they revoke access in their Google account

### Required OAuth scopes

- `https://www.googleapis.com/auth/youtube.readonly` — channel info, videos
- `https://www.googleapis.com/auth/yt-analytics.readonly` — analytics data (demographics, traffic sources, watch time)

---

## Daily Cron Job

### Endpoint

`POST /api/youtube/sync` — protected by Vercel's `CRON_SECRET` header.

### Schedule

Runs once daily at 6:00 AM UTC (configured in vercel.json).

### What it fetches

1. **Channel stats** (YouTube Data API v3 — `channels.list`):
   - Subscriber count
   - Total view count
   - Total video count

2. **Recent videos** (YouTube Data API v3 — `search.list` + `videos.list`):
   - Last 5 uploads: title, video ID, publish date, view count, like count, comment count

3. **Analytics** (YouTube Analytics API — `reports.query`):
   - 30-day views, estimated minutes watched
   - Demographics: age group + gender breakdown
   - Traffic sources: search, suggested, external, browse, other
   - Country breakdown: top 10 countries by views

### Redis Storage

All data stored under the client's Redis prefix:

```
stats:youtube:tokens          — JSON: { accessToken, refreshToken, expiresAt }
stats:youtube:channel         — JSON: { subscriberCount, viewCount, videoCount, fetchedAt }
stats:youtube:videos          — JSON: [ { title, videoId, publishedAt, views, likes, comments }, ... ]
stats:youtube:analytics       — JSON: { views30d, watchTime30d, demographics, trafficSources, countries, fetchedAt }
stats:youtube:subscribers:YYYY-MM-DD — daily subscriber count (for trend tracking)
stats:youtube:views:YYYY-MM-DD       — daily total view count (for trend tracking)
```

---

## AI Advisor Integration

### Briefing API (`api/briefing.js`)

When building the LLM context, check if YouTube data exists in Redis. If it does, add a "YouTube Analytics" section to the prompt:

```
## YouTube Analytics
- Subscribers: 12,400 (+200 this week)
- Views (30d): 45,000
- Watch time (30d): 2,100 hours
- Top traffic source: YouTube Search (42%)
- Top country: United States (68%)
- Audience: 65% female, 72% age 18-34

## Recent Videos
- "Morning Workout Routine" — 8,200 views, 340 likes, 28 comments (Mar 25)
- "Meal Prep Sunday" — 5,100 views, 210 likes, 15 comments (Mar 22)
...
```

If YouTube is not connected (no tokens in Redis), omit the section entirely. Never mention YouTube if there's no data.

### Chat API (`api/chat.js`)

Same approach — include YouTube data in the chat advisor's system prompt context if available. The advisor can then answer questions like "How's my YouTube doing?" or "Which platform should I focus on?" with real data.

---

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/youtube/connect` | GET | password query param | Redirects to Google OAuth |
| `/api/youtube/callback` | GET | state param (contains password) | Handles Google redirect, stores tokens |
| `/api/youtube/data` | GET | password query param | Returns stored YouTube data for Hub display |
| `/api/youtube/sync` | POST | CRON_SECRET header | Daily cron — fetches from YouTube API, stores in Redis |

---

## Environment Variables

**Same for all clients (your Google developer app):**
- `YOUTUBE_CLIENT_ID` — from Google Cloud Console
- `YOUTUBE_CLIENT_SECRET` — from Google Cloud Console

**Per-client (already exist):**
- `UPSTASH_REDIS_REST_URL` — each client's Redis
- `UPSTASH_REDIS_REST_TOKEN` — each client's Redis auth
- `DASHBOARD_PASSWORD` — used for OAuth state verification

---

## Vercel Configuration

Add to the template's `vercel.json`:

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

---

## Template Files

**New files (in `~/creator-platform-template/template/`):**
- `api/youtube/connect.js` — OAuth redirect builder
- `api/youtube/callback.js` — token exchange + Redis storage
- `api/youtube/data.js` — serves stored data to Hub
- `api/youtube/sync.js` — cron job fetcher

**Modified files:**
- `hub/index.html` — new Social Analytics section (HTML, CSS, JS)
- `api/briefing.js` — include YouTube data in AI context if available
- `api/chat.js` — include YouTube data in AI context if available
- `vercel.json` — cron schedule (create if doesn't exist)

---

## Google OAuth Redirect URIs

The Google Cloud Console OAuth client needs redirect URIs for each client domain. When deploying a new client, add their callback URL:

- `https://mandibagley.com/api/youtube/callback`
- `https://newclient.com/api/youtube/callback`
- `http://localhost:3000/api/youtube/callback` (for local dev)

This is a manual step in Google Cloud Console per client deployment.
