# Post Scheduler + Carousel Support — Design Spec

**Date:** 2026-04-02
**Project:** mandi-bagley (mandibagley.com)
**Goal:** Auto-schedule and publish Instagram posts (single + carousel) from the hub, with AI-recommended posting times based on audience analytics.

---

## Overview

The Create Post flow gains carousel support (1-10 images), a scheduling system with AI-suggested optimal times, and direct Instagram publishing. Scheduled posts appear in the Weekly Planner and a new Scheduled Posts list. A cron job runs every 15 minutes to publish due posts. Notifications go to the hub and via email.

Platform support: Instagram wired up first. TikTok and YouTube show "coming soon" in the UI but the backend is platform-agnostic for future expansion.

---

## Data Flow

```
Upload 1-10 images → Compress client-side → Upload to Vercel Blob → Get public URLs
         ↓
Generate caption (AI sees all carousel images)
         ↓
User picks: "Post Now" or "Schedule"
    ↓                        ↓
Publish immediately    Show top 3 time slots → User picks one (or custom)
via Instagram API            ↓
         ↓            Store in Redis: scheduled post object
    Update status            ↓
    + notify         Cron (every 15 min) → Find due posts → Publish
                                            ↓ (fail)
                                      Retry up to 3x → Alert on final failure
```

---

## Components

### 1. Carousel Upload UI

Modifies the existing Create Post card in `hub/index.html`.

**Behavior:**
- First image: drop or click to upload (same as today)
- After first image: "+" button appears to add more
- Thumbnails in a horizontal row (60x60px, rounded corners)
- Drag-and-drop to reorder thumbnails
- "X" on each thumbnail to remove
- Max 10 images — "+" disappears at 10
- Counter: "3/10 photos"

**Caption generation:**
- All images sent to Claude API as multiple image content blocks
- Caption covers the full carousel
- Automation keyword CTA appended if automation is attached

**Detection:**
- 1 image = single post
- 2-10 images = carousel
- No toggle needed

### 2. Scheduling UI

Replaces current action buttons after caption generation.

**Two primary actions:**
- **"Post Now"** — publishes immediately via Instagram API
- **"Schedule"** — opens scheduling panel

**Scheduling panel:**
- Top 3 recommended time slots ranked by predicted engagement
- Derived from `stats:hourly` Redis data (audience activity heatmap)
- Each slot shows: day, time, relative score ("peak engagement", "high", "good")
- **"Custom time"** option with native datetime picker
- **"Schedule Post"** button confirms
- Note: "Instagram only for now. TikTok and YouTube scheduling coming soon."

**After scheduling:**
- Create Post card resets
- Toast: "Scheduled for Tue 7:00 PM"
- Post appears in Weekly Planner

### 3. Planner Integration

Modifies the existing Weekly Planner view in `hub/index.html`.

**Scheduled post cards on calendar days:**
- Thumbnail of first image
- Scheduled time
- Caption preview (truncated)
- Platform icon
- Automation badge if attached
- Status dot: blue (scheduled), green (posted), red (failed)

**Click to expand:**
- Full caption + all images
- Actions: Reschedule, Cancel, Retry (if failed)

### 4. Scheduled Posts List

New card in the Engagement Engine section of home view.

**Two tabs:**
- **Upcoming** — scheduled posts as compact list: thumbnail, platform, time, status
- **Posted** — recently published posts with green checkmark

**Failed posts:** red badge with "Retry" button

### 5. API — `api/upload-post-image.js`

Uploads compressed images to Vercel Blob.

**Auth:** Bearer token
**Method:** POST
**Body:** `{ image: "data:image/jpeg;base64,..." }`
**Returns:** `{ url: "https://....public.blob.vercel-storage.com/posts/..." }`
**Key format:** `posts/{timestamp}_{index}.jpg`

### 6. API — `api/schedule-post.js`

CRUD for scheduled posts.

**Auth:** Bearer token

**POST — schedule a new post:**
```json
{
  "images": ["https://blob-url-1", "https://blob-url-2"],
  "caption": "full caption text",
  "hashtags": ["tag1", "tag2"],
  "platform": "instagram",
  "scheduledAt": "2026-04-05T19:00:00Z",
  "automationKeyword": "MEAL",
  "postNow": false
}
```
- Generates UUID as post ID
- If `postNow: true`, publishes immediately instead of scheduling
- Stores in Redis under `stats:scheduled_posts`
- Returns `{ ok: true, post: {...} }`

**GET — list all posts:**
- Returns all scheduled/posted/failed posts
- Query param `?status=scheduled` to filter

**PUT — update a post:**
- Body: `{ id: "uuid", scheduledAt: "new-time" }` to reschedule
- Body: `{ id: "uuid", status: "cancelled" }` to cancel
- Body: `{ id: "uuid", retry: true }` to retry a failed post

### 7. API — `api/publish-scheduled.js` (Cron)

Runs every 15 minutes via Vercel cron.

**Process:**
1. Load all posts from `stats:scheduled_posts`
2. Find posts where `scheduledAt <= now` and `status === "scheduled"`
3. For each due post:
   - **Single image:** Create media container via Instagram API → publish
   - **Carousel:** Create container per image → create carousel container → publish
4. On success:
   - Set `status: "posted"`, add `publishedAt` timestamp
   - Send success email via Resend
   - Push notification to `stats:notifications`
5. On failure:
   - Increment `retryCount`
   - If `retryCount < 3`: set `status: "scheduled"` (will retry next cron run)
   - If `retryCount >= 3`: set `status: "failed"`, send failure email, push notification

**Instagram API flow (single post):**
```
POST /{ig-user-id}/media
  image_url, caption, access_token
→ returns creation_id

POST /{ig-user-id}/media_publish
  creation_id, access_token
→ returns media_id
```

**Instagram API flow (carousel):**
```
For each image:
  POST /{ig-user-id}/media
    image_url, is_carousel_item=true, access_token
  → returns item_creation_id

POST /{ig-user-id}/media
  media_type=CAROUSEL, children=[item_ids], caption, access_token
→ returns carousel_creation_id

POST /{ig-user-id}/media_publish
  creation_id=carousel_creation_id, access_token
→ returns media_id
```

### 8. Notifications

**Hub notifications:**
- Push to `stats:notifications` list in Redis
- Hub polls or loads on page view
- Shows in a notification area: "Your post was published!" or "Post failed to publish — tap to retry"

**Email notifications via Resend:**
- On success: "Your post just went live! 🎉" with caption preview + link to Instagram post
- On final failure: "Your scheduled post couldn't be published" with error details + link to hub to retry

---

## Redis Schema

| Key | Type | Contents |
|-----|------|----------|
| `stats:scheduled_posts` | String (JSON) | Array of post objects |
| `stats:notifications` | List | JSON notification objects |

**Post object:**
```json
{
  "id": "uuid",
  "images": ["https://blob-url-1", "https://blob-url-2"],
  "caption": "full caption",
  "hashtags": ["tag1"],
  "platform": "instagram",
  "scheduledAt": "2026-04-05T19:00:00Z",
  "automationKeyword": "MEAL",
  "status": "scheduled",
  "retryCount": 0,
  "createdAt": "2026-04-02T...",
  "publishedAt": null,
  "igMediaId": null,
  "error": null
}
```

**Status lifecycle:**
`scheduled` → `posted` (success)
`scheduled` → `scheduled` (retry, retryCount < 3)
`scheduled` → `failed` (retryCount >= 3)
`cancelled` (user cancelled)

---

## Vercel Configuration Changes

**vercel.json additions:**
```json
{ "path": "/api/publish-scheduled", "schedule": "*/15 * * * *" }
```

**Environment variables needed:**
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob access (provision via Vercel dashboard)

**CSP update:** Add Vercel Blob domain to `img-src`

---

## Time Slot Recommendation Algorithm

Uses existing `stats:hourly` Redis hash (audience page view data by hour).

1. Aggregate views per hour across all days
2. Find top 3 non-overlapping 1-hour windows
3. Map to upcoming dates (next 7 days)
4. Rank by engagement score
5. Present as: "Tue 7:00 PM — peak engagement"

If no audience data, fall back to general best times for the client's niche (fitness: 6-8 AM, 12-1 PM, 6-9 PM).

---

## Build Order

1. **Vercel Blob setup** — provision blob store, add env var
2. **`api/upload-post-image.js`** — image upload to blob
3. **Carousel upload UI** — multi-image upload with thumbnails, reorder, remove
4. **Update `api/create-post.js`** — accept multiple images for caption generation
5. **`api/schedule-post.js`** — CRUD for scheduled posts
6. **Scheduling UI** — time slot picker, Post Now / Schedule buttons
7. **`api/publish-scheduled.js`** — cron job to publish due posts
8. **Planner integration** — show scheduled posts on calendar days
9. **Scheduled Posts list** — new card in engagement section
10. **Notifications** — hub notification feed + email alerts via Resend

Steps 1-6 can be built and tested without Instagram publishing API access.
Steps 7+ need `instagram_content_publish` permission (blocked by Meta approval).
All UI and scheduling infrastructure works regardless.

---

## Out of Scope (for now)

- TikTok publishing (API doesn't support it well yet)
- YouTube publishing (complex, different content format)
- Video/Reel uploads (photos only for v1)
- Multi-account support (one Instagram account per hub)
- A/B testing different captions
- Bulk scheduling
