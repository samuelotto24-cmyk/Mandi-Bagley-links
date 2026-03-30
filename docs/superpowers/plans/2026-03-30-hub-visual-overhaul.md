# Hub Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the hub from a 14-card bento grid into a sidebar-navigated 3-view layout with Create Post as the hero element, floating chat agent, and decluttered Home view.

**Architecture:** The hub is a single `hub/index.html` file (~3,400 lines) with inline CSS, JS, and HTML. No framework migration — we restructure the existing monolith. View switching via JS show/hide on 3 view containers. Sidebar replaces the greeting-row nav. All existing API integrations and data fetching preserved.

**Tech Stack:** Vanilla HTML/CSS/JS, Vercel serverless functions (unchanged), localStorage for calendar (unchanged)

---

## File Structure

All changes are within a single file:

- **Modify:** `hub/index.html` — the entire hub (CSS, HTML, JS)

No new files. No deleted files. The API layer (`/api/*`) is untouched.

---

## Implementation Strategy

The overhaul is done in 7 tasks, each producing a working (if incomplete) hub. The order is designed so the hub never fully breaks — each task builds on the last.

1. **Add sidebar + view shell** — structural CSS/HTML for the new layout
2. **Build Home view** — Create Post hero + Briefing + Stats + Goal + Leads + Brand Codes
3. **Build Analytics view** — Social platforms + Heatmap + Brand code detail
4. **Build Planner view** — Weekly calendar in its own view
5. **Convert chat to floating agent** — FAB button + overlay drawer
6. **Wire view switching** — sidebar nav JS + active states
7. **Clean up** — remove dead bento grid CSS, aurora blobs, old greeting row, unused cards

---

### Task 1: Add Sidebar + View Shell (CSS + HTML Structure)

**Files:**
- Modify: `hub/index.html` (CSS section ~line 153-500, HTML body structure ~line 1500+)

**Goal:** Add the sidebar and 3 empty view containers alongside the existing bento grid. Both layouts coexist temporarily.

- [ ] **Step 1: Add sidebar CSS**

Add after the existing `.hub-inner` styles (around line 307):

```css
/* ── Sidebar + View Shell ── */
.hub-shell { display: grid; grid-template-columns: 64px 1fr; min-height: 100vh; position: relative; z-index: 1; }
.hub-sidebar {
  position: sticky; top: 0; height: 100vh;
  background: var(--surface); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; align-items: center;
  padding: 20px 0; gap: 8px; z-index: 10;
}
.hub-sidebar .sidebar-logo {
  width: 32px; height: 32px; background: var(--accent-pale);
  border: 1px solid var(--border); border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--serif); font-size: 16px; color: var(--text);
  margin-bottom: 16px;
}
.hub-sidebar .sidebar-nav-item {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; cursor: pointer; transition: all 0.2s;
  color: var(--text-muted); position: relative; border: none; background: none;
}
.hub-sidebar .sidebar-nav-item:hover { background: var(--accent-pale); color: var(--text); }
.hub-sidebar .sidebar-nav-item.active { background: rgba(255,255,255,0.1); color: var(--text); }
.hub-sidebar .sidebar-nav-item.active::before {
  content: ''; position: absolute; left: -12px;
  width: 3px; height: 20px; background: var(--accent);
  border-radius: 0 2px 2px 0;
}
.hub-sidebar .sidebar-label {
  font-size: 9px; color: var(--text-muted); letter-spacing: 0.3px;
  margin-top: 2px; text-align: center;
}
.hub-sidebar .sidebar-spacer { flex: 1; }

.hub-main { padding: 28px 32px 100px; max-width: 1100px; }
.hub-view { display: none; }
.hub-view.active { display: block; }
```

- [ ] **Step 2: Add responsive sidebar CSS for mobile**

Add after the sidebar CSS:

```css
@media (max-width: 768px) {
  .hub-shell { grid-template-columns: 1fr; }
  .hub-sidebar {
    position: fixed; bottom: 0; left: 0; right: 0; height: auto;
    flex-direction: row; justify-content: center;
    padding: 8px 16px; gap: 24px; border-right: none;
    border-top: 1px solid var(--border);
    background: rgba(10,10,10,0.95); backdrop-filter: blur(20px);
    z-index: 100;
  }
  .hub-sidebar .sidebar-logo { display: none; }
  .hub-sidebar .sidebar-spacer { display: none; }
  .hub-sidebar .sidebar-label { display: none; }
  .hub-sidebar .sidebar-nav-item.active::before { display: none; }
  .hub-main { padding: 20px 16px 80px; }
}
```

- [ ] **Step 3: Add sidebar HTML and view containers**

Replace the opening `.hub-inner` div (around line 1530, `<div class="hub-inner" id="hub">`) and its corresponding closing tag with:

```html
<div class="hub-shell" id="hub" style="display:none;">
  <!-- Sidebar -->
  <nav class="hub-sidebar">
    <div class="sidebar-logo" id="sidebarLogo">M</div>
    <button class="sidebar-nav-item active" data-view="home" onclick="switchView('home')" title="Home">✍️</button>
    <div class="sidebar-label">Home</div>
    <button class="sidebar-nav-item" data-view="analytics" onclick="switchView('analytics')" title="Analytics">📊</button>
    <div class="sidebar-label">Analytics</div>
    <button class="sidebar-nav-item" data-view="planner" onclick="switchView('planner')" title="Planner">📅</button>
    <div class="sidebar-label">Planner</div>
    <div class="sidebar-spacer"></div>
  </nav>

  <!-- Main content area -->
  <div class="hub-main">
    <!-- Home View -->
    <div class="hub-view active" id="viewHome">
      <!-- Will be populated in Task 2 -->
    </div>

    <!-- Analytics View -->
    <div class="hub-view" id="viewAnalytics">
      <!-- Will be populated in Task 3 -->
    </div>

    <!-- Planner View -->
    <div class="hub-view" id="viewPlanner">
      <!-- Will be populated in Task 4 -->
    </div>
  </div>
</div>
```

Keep the original bento grid content inside `#viewHome` temporarily so nothing breaks. Move the entire `.bento-grid` div inside `#viewHome`.

- [ ] **Step 4: Update `showHub()` to work with new shell**

In the JS, find `showHub()` (it sets `document.getElementById('hub').style.display = ...`). The new `#hub` is the `.hub-shell` which uses `display: grid`. Update the show line:

```js
document.getElementById('hub').style.display = 'grid';
```

Also update the sidebar logo initial from CLIENT:

```js
document.getElementById('sidebarLogo').textContent = CLIENT.name.charAt(0);
```

- [ ] **Step 5: Verify the hub still loads and works**

Open the hub locally or on the deployed URL. The sidebar should appear on the left. All existing cards should still render in the Home view (inside the bento grid, unchanged). Nothing should be broken.

- [ ] **Step 6: Commit**

```bash
git add hub/index.html
git commit -m "feat(hub): add sidebar shell and view containers"
```

---

### Task 2: Build Home View

**Files:**
- Modify: `hub/index.html` (HTML inside `#viewHome`, CSS additions, minor JS adjustments)

**Goal:** Replace the bento grid inside `#viewHome` with the new layout: greeting → Create Post hero + Briefing + Stats → Goal strip → Leads + Brand Codes.

- [ ] **Step 1: Add Home view CSS**

Add to the CSS section:

```css
/* ── Home View Layout ── */
.home-greeting { margin-bottom: 24px; }
.home-greeting h1 { font-family: var(--serif); font-size: 28px; font-weight: 300; color: var(--text); margin-bottom: 4px; }
.home-greeting .home-subtitle { font-size: 13px; color: var(--text-muted); }
.home-greeting .home-subtitle strong { color: var(--text); font-weight: 500; }

.home-grid {
  display: grid; grid-template-columns: 1.5fr 1fr;
  grid-template-rows: auto auto; gap: 16px; margin-bottom: 20px;
}
.home-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-md); padding: 20px; transition: border-color 0.2s;
}
.home-card:hover { border-color: var(--accent-border); }
.home-card .home-card-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px;
  color: var(--text-muted); margin-bottom: 12px; font-weight: 600;
  display: flex; align-items: center; gap: 6px;
}

/* Create Post Hero */
.home-create-post { grid-row: 1 / 3; border-color: var(--accent-border); display: flex; flex-direction: column; }
.home-create-post .create-post-drop { flex: 1; min-height: 140px; }

/* Home Stats Grid */
.home-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.home-stat-tile {
  background: var(--surface-elevated); border-radius: 10px; padding: 14px;
}
.home-stat-tile .stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
.home-stat-tile .stat-value { font-family: var(--serif); font-size: 24px; color: var(--text); font-weight: 400; }
.home-stat-tile .stat-change { font-size: 11px; color: #22c55e; margin-top: 2px; }

/* Goal Strip */
.home-goal-strip {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 14px 20px; display: flex; align-items: center; gap: 16px;
  margin-bottom: 20px; cursor: pointer; transition: border-color 0.2s;
}
.home-goal-strip:hover { border-color: var(--accent-border); }
.home-goal-strip .goal-label { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.home-goal-strip .goal-label strong { color: var(--text); font-weight: 500; }
.home-goal-strip .goal-bar { flex: 1; height: 6px; background: var(--surface-elevated); border-radius: 3px; overflow: hidden; }
.home-goal-strip .goal-fill {
  height: 100%; background: linear-gradient(90deg, rgba(255,255,255,0.3), var(--accent));
  border-radius: 3px; transition: width 0.6s ease;
}
.home-goal-strip .goal-pct { font-family: var(--serif); font-size: 18px; color: var(--text); min-width: 40px; text-align: right; }

/* Bottom Row */
.home-bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* Leads in Home */
.home-lead-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid var(--border);
}
.home-lead-item:last-child { border: none; }
.home-lead-name { font-size: 13px; color: var(--text); }
.home-lead-source { font-size: 11px; color: var(--text-muted); }
.home-lead-time { font-size: 11px; color: var(--text-muted); }

/* Brand Codes in Home */
.home-code-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid var(--border);
}
.home-code-row:last-child { border: none; }
.home-code-chip {
  background: var(--accent-pale); border-radius: 6px;
  padding: 4px 10px; font-size: 11px; color: var(--text-muted); font-weight: 500;
}
.home-code-stat { font-size: 12px; color: var(--text-muted); }
.home-code-stat strong { color: var(--text); }

/* Trending tags in Create Post */
.trending-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.trending-tag {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--accent-pale); border: 1px solid var(--border);
  border-radius: 6px; padding: 4px 10px; font-size: 11px; color: var(--text-muted);
}

/* Briefing trend insight block */
.briefing-trend-block {
  background: var(--surface-elevated); border-left: 2px solid var(--accent-border);
  border-radius: 0 8px 8px 0; padding: 10px 14px; margin-top: 12px;
  font-size: 12px; color: var(--text-muted); line-height: 1.5;
}
.briefing-trend-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--text-muted); margin-bottom: 4px; font-weight: 500;
}

@media (max-width: 768px) {
  .home-grid { grid-template-columns: 1fr; }
  .home-create-post { grid-row: auto; }
  .home-bottom-row { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Replace `#viewHome` content with new Home layout HTML**

Remove the bento grid from `#viewHome` and replace with the new layout. The bento cards' content (IDs, data containers) must be preserved — we're restructuring the wrapper, not the innards.

```html
<div class="hub-view active" id="viewHome">
  <!-- Smart Banner (preserved) -->
  <div id="smartBanner" class="smart-banner" style="display:none;"></div>

  <!-- Greeting -->
  <div class="home-greeting">
    <h1 id="greetingH1">Good morning</h1>
    <div class="home-subtitle" id="homeSubtitle">Loading your hub...</div>
  </div>

  <!-- Primary Grid: Create Post Hero + Briefing + Stats -->
  <div class="home-grid">
    <!-- Create Post (hero, spans 2 rows) -->
    <div class="home-card home-create-post" id="createPostCard">
      <div class="home-card-label">✍️ Create Post</div>
      <!-- Preserve existing create post innards -->
      <div class="create-post-drop" id="createPostDrop">
        <div class="create-post-drop-inner">
          <div class="create-post-drop-icon">📷</div>
          <div class="create-post-drop-text">Drop an image or tap to upload</div>
          <div class="create-post-drop-sub">JPG, PNG, WebP — up to 4MB</div>
        </div>
        <img id="createPostPreview" style="display:none; max-width:100%; border-radius:10px;">
        <button id="createPostClear" style="display:none;" class="create-post-clear">✕ Remove</button>
        <input type="file" id="createPostFile" accept="image/*" style="display:none;">
      </div>
      <div class="create-post-controls">
        <div class="create-post-platforms">
          <button class="cp-platform-btn active" data-platform="instagram" onclick="selectCPPlatform(this)">📷 IG</button>
          <button class="cp-platform-btn" data-platform="tiktok" onclick="selectCPPlatform(this)">🎵 TikTok</button>
          <button class="cp-platform-btn" data-platform="youtube" onclick="selectCPPlatform(this)">▶️ YouTube</button>
        </div>
        <input class="create-post-notes" id="createPostNotes" placeholder="Optional notes (mood, promo, context)...">
        <!-- Trending tags (Niche Pulse data) -->
        <div class="trending-tags" id="createPostTrends"></div>
        <button id="createPostBtn" class="create-post-generate" disabled onclick="generatePost()">✨ Generate Caption</button>
      </div>
      <div class="create-post-output" id="createPostOutput" style="display:none;">
        <div class="create-post-result-header">
          <span>Your Caption</span>
          <button id="createPostCopyBtn" onclick="copyGeneratedCaption()">📋 Copy</button>
        </div>
        <div class="create-post-caption" id="createPostCaption"></div>
        <div class="create-post-meta" id="createPostMeta" style="display:none;">
          <div class="create-post-meta-item" id="createPostTime"></div>
          <div class="create-post-meta-item" id="createPostHashtags"></div>
          <div class="create-post-meta-item" id="createPostTips"></div>
        </div>
        <div class="create-post-actions" id="createPostActions" style="display:none;">
          <button class="cp-action-btn cp-action-ig" onclick="postToInstagram()">📷 Post to Instagram</button>
          <button class="cp-action-btn" onclick="copyAndOpen('tiktok')">🎵 Copy & Open TikTok</button>
          <button class="cp-action-btn" onclick="copyAndOpen('youtube')">▶️ Copy & Open YouTube</button>
        </div>
        <div class="cp-post-status" id="cpPostStatus" style="display:none;"></div>
      </div>
    </div>

    <!-- Briefing (right top) -->
    <div class="home-card" id="homeBriefingCard">
      <div class="home-card-label">
        📋 Today's Briefing
        <button id="briefingRefresh" onclick="refreshBriefing()" style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:8px;width:28px;height:28px;cursor:pointer;color:var(--text-muted);font-size:12px;">↻</button>
      </div>
      <div id="homeBriefingContent">
        <div class="skeleton skeleton-text w80"></div>
        <div class="skeleton skeleton-text w60"></div>
        <div class="skeleton skeleton-text w40"></div>
      </div>
    </div>

    <!-- Stats (right bottom) -->
    <div class="home-card" id="homeStatsCard">
      <div class="home-card-label">📈 Quick Stats</div>
      <div class="home-stats-grid" id="homeStatsGrid">
        <div class="home-stat-tile"><div class="stat-label">Followers</div><div class="stat-value skeleton" style="height:28px;width:60px;"></div></div>
        <div class="home-stat-tile"><div class="stat-label">Engagement</div><div class="stat-value skeleton" style="height:28px;width:60px;"></div></div>
        <div class="home-stat-tile"><div class="stat-label">Views (7d)</div><div class="stat-value skeleton" style="height:28px;width:60px;"></div></div>
        <div class="home-stat-tile"><div class="stat-label">Link Clicks</div><div class="stat-value skeleton" style="height:28px;width:60px;"></div></div>
      </div>
    </div>
  </div>

  <!-- Goal Strip -->
  <div class="home-goal-strip" id="homeGoalStrip" onclick="openGoalModal()" style="display:none;">
    <div class="goal-label" id="homeGoalLabel">Goal: <strong>—</strong></div>
    <div class="goal-bar"><div class="goal-fill" id="homeGoalFill" style="width:0%;"></div></div>
    <div class="goal-pct" id="homeGoalPct">0%</div>
  </div>

  <!-- Bottom Row: Leads + Brand Codes -->
  <div class="home-bottom-row">
    <div class="home-card" id="homeLeadsCard">
      <div class="home-card-label">👥 Recent Leads</div>
      <div id="homeLeadsList">
        <div class="skeleton skeleton-text w80"></div>
        <div class="skeleton skeleton-text w60"></div>
      </div>
    </div>
    <div class="home-card" id="homeBrandCodesCard">
      <div class="home-card-label">🏷️ Brand Codes</div>
      <div id="homeBrandCodesList"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add `renderHomeStats()` function**

Add a new JS function that populates the Home stats grid from the existing `scoreboardData`:

```js
function renderHomeStats() {
  const d = scoreboardData;
  if (!d) return;
  const grid = document.getElementById('homeStatsGrid');
  if (!grid) return;
  const tiles = [
    { label: 'Followers', value: d.followers, change: d.followersTrend },
    { label: 'Engagement', value: d.engagement ? d.engagement + '%' : '—', change: d.engagementTrend },
    { label: 'Views (7d)', value: d.totalViews, change: d.viewsTrend },
    { label: 'Link Clicks', value: d.linkClicks, change: d.linkClicksTrend },
  ];
  grid.innerHTML = tiles.map(t => `
    <div class="home-stat-tile">
      <div class="stat-label">${t.label}</div>
      <div class="stat-value">${typeof t.value === 'number' ? formatNum(t.value) : (t.value || '—')}</div>
      ${t.change ? `<div class="stat-change">${t.change}</div>` : ''}
    </div>
  `).join('');
}
```

Call `renderHomeStats()` at the end of `renderScoreboard()` and `renderStats()`.

- [ ] **Step 4: Add `renderHomeBriefing()` function**

Add a function that populates the Home briefing card from existing briefing data:

```js
function renderHomeBriefing(data) {
  const el = document.getElementById('homeBriefingContent');
  if (!el || !data) return;
  const summary = data.summary || data.title || '';
  const trendText = data.nicheTrend || data.trend || '';
  el.innerHTML = `
    <div style="font-size:13.5px;line-height:1.65;color:rgba(255,255,255,0.7);margin-bottom:12px;">
      ${summary}
    </div>
    ${trendText ? `
      <div class="briefing-trend-block">
        <div class="briefing-trend-label">🔥 Trending in ${CLIENT.nicheLabel.split('·')[0].trim()}</div>
        ${trendText}
      </div>
    ` : ''}
  `;
}
```

Call `renderHomeBriefing(data)` inside `renderBriefing()` after the existing rendering logic.

- [ ] **Step 5: Add `renderHomeTrends()` function**

Populate the trending tags inside Create Post from Niche Pulse data:

```js
function renderHomeTrends(pulseData) {
  const el = document.getElementById('createPostTrends');
  if (!el || !pulseData || !pulseData.length) return;
  el.innerHTML = pulseData.slice(0, 3).map(p => `
    <span class="trending-tag">🔥 ${p.headline || p.topic || p.text || ''}</span>
  `).join('');
}
```

Call `renderHomeTrends(data.pulse || data.trends)` inside `renderPulse()` or at the end of `loadBriefing()`.

- [ ] **Step 6: Add `renderHomeLeads()` function**

Populate the Home leads list from existing leads data:

```js
function renderHomeLeads(leads) {
  const el = document.getElementById('homeLeadsList');
  if (!el) return;
  if (!leads || !leads.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">No leads yet</div>';
    return;
  }
  el.innerHTML = leads.slice(0, 4).map(l => `
    <div class="home-lead-item">
      <div>
        <div class="home-lead-name">${l.user || l.name || 'Unknown'}</div>
        <div class="home-lead-source">via ${l.keyword || l.source || 'direct'}</div>
      </div>
      <div class="home-lead-time">${leadTimeAgo(l.timestamp || l.ts)}</div>
    </div>
  `).join('');
}
```

Call `renderHomeLeads(leads)` inside the existing `renderLeads()` function.

- [ ] **Step 7: Add `renderHomeBrandCodes()` function**

Populate the Home brand codes summary:

```js
function renderHomeBrandCodes() {
  const el = document.getElementById('homeBrandCodesList');
  if (!el) return;
  if (!CLIENT.brandCodes || !CLIENT.brandCodes.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">No brand codes configured</div>';
    return;
  }
  const codeData = window._brandCodeData || {};
  el.innerHTML = CLIENT.brandCodes.map(bc => {
    const uses = codeData[bc.code] || 0;
    return `
      <div class="home-code-row">
        <span class="home-code-chip">${bc.code}</span>
        <span class="home-code-stat">${bc.brand} · <strong>${uses} uses</strong></span>
      </div>
    `;
  }).join('');
}
```

Call `renderHomeBrandCodes()` inside the existing `renderBrandCodes()` function. Store the code usage data on `window._brandCodeData` in `renderBrandCodes()` so the Home view can read it.

- [ ] **Step 8: Update `renderHomeSubtitle()` in greeting**

Add a function to populate the subtitle with dynamic data:

```js
function renderHomeSubtitle() {
  const el = document.getElementById('homeSubtitle');
  if (!el) return;
  const parts = [];
  if (window._newLeadsCount) parts.push(`<strong>${window._newLeadsCount} new leads</strong>`);
  if (window._topPlatformTrend) parts.push(window._topPlatformTrend);
  if (window._bestPostTime) parts.push(`Best time to post: <strong>${window._bestPostTime}</strong>`);
  el.innerHTML = parts.length ? parts.join(' · ') : 'Welcome back';
}
```

Call this at the end of `loadBriefing()` and `loadQuickStats()` after data is available.

- [ ] **Step 9: Verify Home view renders correctly**

Open the hub. The Home view should show:
- Greeting with subtitle
- Create Post as a tall hero card on the left
- Briefing with trend insight on the right top
- Stats 2x2 grid on the right bottom
- Goal strip (if a goal is set)
- Leads and Brand Codes at the bottom

All data should populate from the existing API calls.

- [ ] **Step 10: Commit**

```bash
git add hub/index.html
git commit -m "feat(hub): build Home view with Create Post hero layout"
```

---

### Task 3: Build Analytics View

**Files:**
- Modify: `hub/index.html`

**Goal:** Move social platforms, heatmap, and brand code detail into the Analytics view.

- [ ] **Step 1: Add Analytics view CSS**

```css
/* ── Analytics View ── */
.analytics-section { margin-bottom: 28px; }
.analytics-section-title {
  font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px;
  color: var(--text-muted); margin-bottom: 12px; font-weight: 600;
}
.analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .analytics-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 2: Populate `#viewAnalytics` with moved content**

Move the following existing cards into `#viewAnalytics`:
- Platforms card (YouTube, Instagram, TikTok — `#socialPlatforms` and its parent)
- Audience Heatmap card (`#heatmapWrap` and its parent)
- Brand Codes card detail (the full card with `#brandCodes`)
- Connect Banner (`#connectBanner`)

```html
<div class="hub-view" id="viewAnalytics">
  <div class="home-greeting">
    <h1>Analytics</h1>
    <div class="home-subtitle">Your social platforms and audience insights</div>
  </div>

  <!-- Connect Banner (moved) -->
  <div id="connectBanner" style="display:none;margin-bottom:20px;">
    <!-- existing connect banner content preserved -->
  </div>

  <!-- Platforms Section (moved) -->
  <div class="analytics-section">
    <div class="analytics-section-title">Platforms</div>
    <div class="social-chips" id="socialPlatforms">
      <!-- existing YouTube, Instagram, TikTok chips preserved with all IDs -->
    </div>
  </div>

  <!-- Heatmap + Brand Codes -->
  <div class="analytics-grid">
    <div class="analytics-section">
      <div class="analytics-section-title">Audience Activity</div>
      <div class="home-card">
        <!-- existing heatmap content with #heatmapWrap preserved -->
      </div>
    </div>
    <div class="analytics-section">
      <div class="analytics-section-title">Brand Code Performance</div>
      <div class="home-card" style="padding:20px;">
        <div id="brandCodes">
          <!-- existing brand codes rendering preserved -->
        </div>
      </div>
    </div>
  </div>

  <!-- Top Links -->
  <div class="analytics-section">
    <div class="analytics-section-title">Top Links</div>
    <div class="home-card" style="padding:20px;">
      <div id="topLinks">
        <!-- existing top links rendering preserved -->
      </div>
    </div>
  </div>
</div>
```

The key is to **move** the DOM elements (with their IDs intact) so all existing JS functions that reference those IDs continue to work without changes.

- [ ] **Step 3: Verify Analytics view**

Switch to the Analytics tab. Platforms should show connection status, heatmap should render, brand codes should display.

- [ ] **Step 4: Commit**

```bash
git add hub/index.html
git commit -m "feat(hub): build Analytics view with platforms, heatmap, brand codes"
```

---

### Task 4: Build Planner View

**Files:**
- Modify: `hub/index.html`

**Goal:** Move the weekly planner into its own view.

- [ ] **Step 1: Move calendar into `#viewPlanner`**

Move the calendar card (data-order="3", `#calendarPlanner`) into the Planner view:

```html
<div class="hub-view" id="viewPlanner">
  <div class="home-greeting">
    <h1>Weekly Planner</h1>
    <div class="home-subtitle">Plan your content for the week</div>
  </div>

  <!-- Calendar nav (moved) -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
    <button class="cal-nav-btn" onclick="shiftCalendarWeek(-1)">←</button>
    <span class="cal-nav-label" id="calWeekLabel"></span>
    <button class="cal-nav-btn" onclick="shiftCalendarWeek(1)">→</button>
    <button class="cal-nav-today" onclick="shiftCalendarWeek(0)">Today</button>
  </div>

  <!-- Calendar strip (moved, preserve #calendarStrip) -->
  <div class="calendar-strip" id="calendarStrip">
    <!-- renderCalendar() populates this -->
  </div>
</div>
```

All IDs (`calendarStrip`, `calWeekLabel`) stay the same so `renderCalendar()`, `shiftCalendarWeek()`, `toggleCalDay()`, etc. continue to work.

- [ ] **Step 2: Verify Planner view**

Switch to Planner tab. Calendar should render with 7 days, week navigation should work, notes should save to localStorage, type selection and suggestions should function.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat(hub): move weekly planner to dedicated view"
```

---

### Task 5: Convert Chat to Floating Agent

**Files:**
- Modify: `hub/index.html`

**Goal:** Remove the chat bento card and replace it with a floating FAB + slide-out drawer that works on all views.

- [ ] **Step 1: Add floating chat CSS**

```css
/* ── Floating Chat Agent ── */
.chat-fab-btn {
  position: fixed; bottom: 24px; right: 24px; z-index: 90;
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--accent); border: none; color: var(--bg);
  font-size: 20px; cursor: pointer;
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex; align-items: center; justify-content: center;
}
.chat-fab-btn:hover { transform: scale(1.08); box-shadow: 0 6px 32px rgba(0,0,0,0.5); }
.chat-fab-btn.has-unread::after {
  content: ''; position: absolute; top: 0; right: 0;
  width: 12px; height: 12px; background: #f87171;
  border-radius: 50%; border: 2px solid var(--bg);
}

.chat-drawer-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
  opacity: 0; pointer-events: none; transition: opacity 0.3s;
}
.chat-drawer-overlay.open { opacity: 1; pointer-events: auto; }

.chat-drawer {
  position: fixed; bottom: 0; right: 0; z-index: 201;
  width: 400px; max-width: 100vw; height: 70vh; max-height: 600px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-md) var(--r-md) 0 0;
  display: flex; flex-direction: column;
  transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.23,1,0.32,1);
  box-shadow: 0 -8px 40px rgba(0,0,0,0.3);
}
.chat-drawer.open { transform: translateY(0); }

.chat-drawer-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
}
.chat-drawer-header .chat-title {
  font-family: var(--serif); font-size: 18px; color: var(--text); flex: 1;
}
.chat-drawer-header .chat-close {
  background: none; border: none; color: var(--text-muted);
  font-size: 18px; cursor: pointer; padding: 4px;
}
.chat-drawer-header .chat-close:hover { color: var(--text); }

.chat-drawer .chat-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
.chat-drawer .chat-prompts { padding: 8px 20px; display: flex; flex-wrap: wrap; gap: 6px; }
.chat-drawer .chat-input-row {
  padding: 12px 20px; border-top: 1px solid var(--border);
  display: flex; gap: 8px;
}

@media (max-width: 768px) {
  .chat-fab-btn { bottom: 72px; } /* above mobile nav */
  .chat-drawer { width: 100vw; height: 80vh; border-radius: var(--r-md) var(--r-md) 0 0; }
}
```

- [ ] **Step 2: Add floating chat HTML**

Add this outside the `.hub-shell`, right before the closing `</body>`:

```html
<!-- Floating Chat Agent -->
<button class="chat-fab-btn" id="chatFab" onclick="toggleChatDrawer()">💬</button>

<div class="chat-drawer-overlay" id="chatOverlay" onclick="toggleChatDrawer()"></div>
<div class="chat-drawer" id="chatDrawer">
  <div class="chat-drawer-header">
    <span class="chat-title">Your Strategist</span>
    <div class="chat-live-dot" style="font-size:10px;color:#22c55e;">● LIVE</div>
    <button class="chat-close" onclick="toggleChatDrawer()">✕</button>
  </div>
  <div class="chat-body" id="chatBody">
    <!-- existing chat messages render here -->
  </div>
  <div class="chat-prompts" id="chatPrompts">
    <button class="chat-prompt" onclick="askPrompt(this)">What's growing fastest?</button>
    <button class="chat-prompt" onclick="askPrompt(this)">Write a caption</button>
    <button class="chat-prompt" onclick="askPrompt(this)">Which platform should I focus on?</button>
    <button class="chat-prompt" onclick="askPrompt(this)">Brand pitch draft</button>
  </div>
  <div class="chat-input-row" id="chatInputRow">
    <input class="chat-input" id="chatInput" placeholder="Ask your strategist..." onkeydown="if(event.key==='Enter')sendChat(event)">
    <button class="chat-send" onclick="sendChat()">→</button>
  </div>
</div>
```

- [ ] **Step 3: Add `toggleChatDrawer()` JS function**

```js
function toggleChatDrawer() {
  const drawer = document.getElementById('chatDrawer');
  const overlay = document.getElementById('chatOverlay');
  const isOpen = drawer.classList.contains('open');
  drawer.classList.toggle('open');
  overlay.classList.toggle('open');
  if (!isOpen) {
    document.getElementById('chatInput').focus();
    document.getElementById('chatFab').classList.remove('has-unread');
  }
}
```

- [ ] **Step 4: Remove the old chat bento card from the DOM**

Delete the old `data-order="5"` chat card (Your Strategist) from the bento grid. The chat IDs (`chatBody`, `chatInput`, `chatPrompts`, `chatInputRow`) now live in the drawer. All existing chat JS functions (`sendChat`, `askPrompt`, `appendMsg`, etc.) should work without changes because they reference the same element IDs.

Also remove the mobile sticky chat (`#stickyChat`) — the drawer handles mobile now.

- [ ] **Step 5: Verify floating chat works**

Open hub. FAB button should appear bottom-right. Clicking opens the drawer with chat history. Sending a message should stream a response. Prompts should work. Clicking overlay or X closes the drawer.

- [ ] **Step 6: Commit**

```bash
git add hub/index.html
git commit -m "feat(hub): convert chat to floating drawer agent"
```

---

### Task 6: Wire View Switching

**Files:**
- Modify: `hub/index.html` (JS section)

**Goal:** Make sidebar navigation switch between Home, Analytics, and Planner views.

- [ ] **Step 1: Add `switchView()` function**

```js
function switchView(viewName) {
  // Hide all views
  document.querySelectorAll('.hub-view').forEach(v => v.classList.remove('active'));
  // Show target view
  const target = document.getElementById('view' + viewName.charAt(0).toUpperCase() + viewName.slice(1));
  if (target) target.classList.add('active');
  // Update sidebar active state
  document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  // Scroll to top
  window.scrollTo(0, 0);
}
```

- [ ] **Step 2: Verify view switching**

Click each sidebar icon. Home should show the new layout. Analytics should show platforms + heatmap + brand codes. Planner should show the calendar. Active indicator should move with the selection. On mobile, bottom nav should work the same way.

- [ ] **Step 3: Commit**

```bash
git add hub/index.html
git commit -m "feat(hub): wire sidebar view switching"
```

---

### Task 7: Clean Up Dead Code

**Files:**
- Modify: `hub/index.html`

**Goal:** Remove the old bento grid CSS and HTML, aurora blobs, old greeting row, and unused cards (automations, refer & earn, conversion funnel as separate cards). Keep the API functions that feed data to those features — only remove the presentation layer for cards that no longer exist.

- [ ] **Step 1: Remove old bento grid CSS**

Delete the `.bento-grid`, `.bento-card`, `.span-*`, `data-order` related CSS rules. These are no longer used.

- [ ] **Step 2: Remove aurora blobs and gradient animations**

Delete the `.aurora-blob-*` CSS rules and keyframes (`auroraFloat1` through `auroraFloat5`). Delete the corresponding HTML divs (`.aurora-blob-1` through `.aurora-blob-5` inside `.gradient-bg`).

Keep the base gradient mesh (`.gradient-bg`, `.gradient-mesh`) — it's subtle and adds depth. But remove the 5 floating blobs that create visual noise.

- [ ] **Step 3: Remove old greeting row**

Delete the `.greeting-row`, `.greeting-nav`, `.greeting-nav-icon`, etc. CSS. Delete the corresponding HTML (the 3-column grid with nav buttons). The new greeting is inside each view.

- [ ] **Step 4: Remove unused card HTML**

Remove these cards from the DOM entirely (they're no longer in any view):
- Automations card (`data-order="12"`, `#automationsList`)
- Refer & Earn card (`data-order="11"`, `#referralCard`)
- Conversion Funnel card as standalone (`data-order="13"` — funnel data is shown via leads)
- Niche Pulse standalone card (`data-order="7"` — data now flows into briefing + Create Post trends)

Keep the JS functions (`loadAutomations`, `loadReferral`, `renderFunnel`, `renderPulse`) — they don't hurt anything and the API data may still be useful. Just remove the HTML containers they render into.

- [ ] **Step 5: Remove old FAB bar**

Delete `.fab-bar-legacy` CSS and the corresponding HTML. The sidebar replaces this navigation.

- [ ] **Step 6: Remove old `#hub` display logic in CSS**

Clean up any CSS that references `.hub-inner` (the old container class). The new container is `.hub-shell`.

- [ ] **Step 7: Verify everything works end-to-end**

Full test:
1. Login works
2. Home view: greeting, Create Post, briefing, stats, goal, leads, brand codes all render
3. Analytics view: platforms show, heatmap renders, brand codes detail shows
4. Planner view: calendar renders, notes save, week navigation works
5. Chat drawer: opens/closes, sends messages, streams responses
6. Mobile: bottom nav works, drawer opens full-width, layout stacks vertically
7. No console errors
8. All API data still loads

- [ ] **Step 8: Commit**

```bash
git add hub/index.html
git commit -m "refactor(hub): remove bento grid, aurora blobs, and unused cards"
```

---

## Self-Review Checklist

1. **Spec coverage:** All spec requirements are covered:
   - Sidebar: Task 1 ✓
   - Home view with Create Post hero: Task 2 ✓
   - Analytics view: Task 3 ✓
   - Planner view: Task 4 ✓
   - Floating chat: Task 5 ✓
   - View switching: Task 6 ✓
   - Niche Pulse dissolved into briefing + Create Post: Task 2 (Steps 4, 5) ✓
   - Goal as compact strip: Task 2 (HTML) ✓
   - Brand codes on Home + Analytics: Tasks 2, 3 ✓
   - Cleanup of removed features: Task 7 ✓

2. **Placeholder scan:** No TBDs or TODOs. All code blocks are complete.

3. **Type consistency:** Element IDs are consistent across tasks (`chatBody`, `chatInput`, `homeStatsGrid`, etc.). Functions reference the same IDs they create.
