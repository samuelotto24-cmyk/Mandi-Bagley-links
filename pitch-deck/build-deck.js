const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const pptx = new pptxgen();

// ── Design System ──
const C = {
  bg: '0A0E1A',
  card: '1A2235',
  blue: '4F8EF7',
  purple: '7C6AF7',
  green: '22C55E',
  gold: 'F59E0B',
  red: 'EF4444',
  white: 'FFFFFF',
  muted: '8B95A8',
};

pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pptx.author = 'Sam Otto';
pptx.title = 'Canyon Challenge — Creator Platform Pitch';

function img(name) {
  const p = path.join(DIR, name);
  return fs.existsSync(p) ? p : null;
}

function addLabel(slide, num, title) {
  slide.addText(`${num} — ${title}`, {
    x: 0.4, y: 0.3, w: 4, h: 0.3,
    fontSize: 9, color: C.blue, fontFace: 'Calibri',
    charSpacing: 4, bold: true,
  });
  // Accent divider line
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 0.6, w: 1.2, h: 0.04,
    fill: { color: C.blue },
  });
}

function addCard(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.1,
    fill: { color: opts.fill || C.card },
    line: opts.border ? { color: opts.border, width: 1.5 } : undefined,
  });
}

// ═══════════════════════════════════════
// SLIDE 1 — TITLE
// ═══════════════════════════════════════
(function() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };

  // Left accent bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.06, h: 7.5,
    fill: { color: C.blue },
  });

  // Top label
  slide.addText('CANYON CHALLENGE  ·  GRAND CANYON UNIVERSITY', {
    x: 0.5, y: 0.4, w: 5, h: 0.3,
    fontSize: 9, color: C.muted, fontFace: 'Calibri', charSpacing: 3,
  });

  // Headline
  slide.addText([
    { text: 'Creators have audiences.\n', options: { fontSize: 38, color: C.white, bold: true } },
    { text: "They don't have a system.", options: { fontSize: 38, color: C.blue, bold: true } },
  ], { x: 0.5, y: 1.2, w: 5.5, h: 2.5, fontFace: 'Calibri', lineSpacingMultiple: 1.1 });

  // Subtext
  slide.addText('One platform: branded website + live analytics + AI strategist.\nBuilt for creators who are serious about growth.', {
    x: 0.5, y: 3.6, w: 5, h: 1,
    fontSize: 13, color: C.muted, fontFace: 'Calibri', lineSpacingMultiple: 1.4,
  });

  // Screenshot
  const heroImg = img('processed-mandi-hero.png');
  if (heroImg) {
    slide.addImage({ path: heroImg, x: 7.0, y: 0.6, w: 5.8, h: 6.0, transparency: 15 });
  }

  // Bottom bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 6.8, w: 13.33, h: 0.7,
    fill: { color: '0D1220' },
  });
  slide.addText('Sam Otto  ·  bysamotto.com  ·  2026', {
    x: 0, y: 6.9, w: 13.33, h: 0.5,
    fontSize: 11, color: C.muted, fontFace: 'Calibri', align: 'center',
  });
})();

// ═══════════════════════════════════════
// SLIDE 2 — PROBLEM
// ═══════════════════════════════════════
(function() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };

  const compositeImg = img('slide2-composite.png');
  if (compositeImg) {
    slide.addImage({ path: compositeImg, x: 0, y: 0, w: 13.33, h: 7.5, sizing: { type: 'cover', w: 13.33, h: 7.5 } });
  }

  // Label
  slide.addText('01 — PROBLEM', {
    x: 0.4, y: 0.3, w: 4, h: 0.3,
    fontSize: 9, color: C.blue, fontFace: 'Calibri', charSpacing: 4, bold: true,
  });

  // Dark overlay at bottom
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.2, w: 13.33, h: 2.3,
    fill: { color: C.bg, transparency: 15 },
  });

  // Headline
  slide.addText("Creators have views. They can't convert them.", {
    x: 0.5, y: 5.4, w: 12, h: 0.8,
    fontSize: 30, color: C.white, bold: true, fontFace: 'Calibri',
  });

  // Subtext
  slide.addText('The average creator with 100K+ followers is juggling 3+ disconnected apps — and still has no idea what\'s actually working.', {
    x: 0.5, y: 6.2, w: 10, h: 0.6,
    fontSize: 13, color: C.muted, fontFace: 'Calibri',
  });
})();

// ═══════════════════════════════════════
// SLIDE 3 — COMPETITION
// ═══════════════════════════════════════
(function() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  addLabel(slide, '02', 'COMPETITION');

  // Linktree screenshot
  const ltImg = img('processed-linktree-screenshot.png');
  if (ltImg) {
    slide.addText('Linktree', { x: 0.5, y: 0.9, w: 3, h: 0.3, fontSize: 11, color: C.muted, fontFace: 'Calibri' });
    slide.addImage({ path: ltImg, x: 0.4, y: 1.3, w: 4.0, h: 2.6 });
  }

  // VS
  slide.addText('VS', {
    x: 4.8, y: 2.2, w: 1.5, h: 0.8,
    fontSize: 42, color: C.blue, bold: true, fontFace: 'Calibri', align: 'center',
  });

  // Your platform
  const compImg = img('processed-bysamotto-comparison.png');
  if (compImg) {
    slide.addText('Your Platform', { x: 7.0, y: 0.9, w: 3, h: 0.3, fontSize: 11, color: C.blue, fontFace: 'Calibri' });
    slide.addImage({ path: compImg, x: 6.8, y: 1.3, w: 4.5, h: 2.6 });
  }

  // Comparison table
  const tableRows = [
    [{ text: 'Tool', options: { bold: true, color: C.white, fill: { color: '141A2E' } } },
     { text: 'Links', options: { bold: true, color: C.white, fill: { color: '141A2E' } } },
     { text: 'Analytics', options: { bold: true, color: C.white, fill: { color: '141A2E' } } },
     { text: 'AI Strategy', options: { bold: true, color: C.white, fill: { color: '141A2E' } } },
     { text: 'Custom Design', options: { bold: true, color: C.white, fill: { color: '141A2E' } } }],
    ['Linktree', '✓', 'Basic', '✗', '✗'],
    ['Beacons', '✓', 'Basic', '✗', 'Limited'],
    ['Stan Store', '✓', 'Sales only', '✗', '✗'],
    ['This Platform', { text: '✓', options: { color: C.green } }, { text: 'Full', options: { color: C.green } }, { text: '✓ AI', options: { color: C.green } }, { text: '✓ Custom', options: { color: C.green } }],
  ];

  slide.addTable(tableRows, {
    x: 0.4, y: 4.3, w: 12.5,
    fontSize: 11, fontFace: 'Calibri', color: C.muted,
    border: { type: 'solid', pt: 0.5, color: '2A3550' },
    rowH: 0.4,
    autoPage: false,
  });

  // Bottom insight
  addCard(slide, 0.4, 6.2, 12.5, 0.7, { border: C.blue });
  slide.addText('The gap: No competitor connects website + analytics + AI strategy into one system.', {
    x: 0.6, y: 6.3, w: 12, h: 0.5,
    fontSize: 13, color: C.blue, fontFace: 'Calibri', bold: true, align: 'center',
  });
})();

// ═══════════════════════════════════════
// SLIDE 4 — SOLUTION
// ═══════════════════════════════════════
(function() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  addLabel(slide, '03', 'SOLUTION');

  // Headline
  slide.addText('One platform. Three layers.', {
    x: 0.4, y: 0.85, w: 5, h: 0.6,
    fontSize: 32, color: C.white, bold: true, fontFace: 'Calibri',
  });

  // Three pillar cards
  const pillars = [
    { icon: '🌐', title: 'Your Website', color: C.blue, desc: 'Custom domain, tap-to-copy codes, program cards' },
    { icon: '📊', title: 'Your Analytics', color: C.purple, desc: 'YouTube, Instagram, TikTok. One dashboard.' },
    { icon: '🤖', title: 'Your AI Strategist', color: C.green, desc: 'Reads your real data. Tells you what to post next.' },
  ];

  pillars.forEach(function(p, i) {
    const y = 1.7 + i * 1.15;
    addCard(slide, 0.4, y, 5.5, 0.95);
    // Top accent bar
    slide.addShape(pptx.ShapeType.rect, { x: 0.4, y: y, w: 5.5, h: 0.05, fill: { color: p.color } });
    slide.addText(`${p.icon}  ${p.title}`, {
      x: 0.7, y: y + 0.15, w: 5, h: 0.35,
      fontSize: 16, color: C.white, bold: true, fontFace: 'Calibri',
    });
    slide.addText(p.desc, {
      x: 0.7, y: y + 0.5, w: 5, h: 0.35,
      fontSize: 12, color: C.muted, fontFace: 'Calibri',
    });
  });

  // Screenshots right side
  const codesImg = img('processed-mandi-codes.png');
  if (codesImg) {
    slide.addImage({ path: codesImg, x: 6.5, y: 0.9, w: 6.3, h: 2.8 });
  }
  const aiImg = img('processed-hub-ai.png');
  if (aiImg) {
    slide.addImage({ path: aiImg, x: 6.5, y: 3.9, w: 6.3, h: 2.4 });
  }

  // Bottom strip
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 6.6, w: 13.33, h: 0.6, fill: { color: '0D1220' } });
  slide.addText('✓ Live in 72 hours   ✓ Done for you   ✓ Built from scratch   ✓ No templates', {
    x: 0, y: 6.7, w: 13.33, h: 0.4,
    fontSize: 12, color: C.blue, fontFace: 'Calibri', align: 'center',
  });
})();

// ═══════════════════════════════════════
// SLIDE 5 — ICP
// ═══════════════════════════════════════
(function() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  addLabel(slide, '04', 'IDEAL CUSTOMER PROFILE');

  slide.addText('The creator who needs this now.', {
    x: 0.4, y: 0.85, w: 6, h: 0.6,
    fontSize: 28, color: C.white, bold: true, fontFace: 'Calibri',
  });

  // ICP card
  addCard(slide, 0.4, 1.6, 6.0, 4.8);
  slide.addText('PRIMARY ICP', {
    x: 0.7, y: 1.75, w: 3, h: 0.3,
    fontSize: 9, color: C.blue, fontFace: 'Calibri', charSpacing: 4, bold: true,
  });
  slide.addText('Mid-tier to established creator\n10K – 500K followers', {
    x: 0.7, y: 2.1, w: 5.5, h: 0.7,
    fontSize: 18, color: C.white, bold: true, fontFace: 'Calibri', lineSpacingMultiple: 1.3,
  });

  const traits = [
    '💰  Makes real money from brand deals & affiliates',
    '📱  Active on Instagram, TikTok, or YouTube',
    '🤷  No idea what content is actually converting',
    '🛠️  Using 3+ disconnected tools (Linktree, GA, ChatGPT)',
    '⏰  Willing to invest in their brand as a business',
  ];
  traits.forEach(function(t, i) {
    slide.addText(t, {
      x: 0.7, y: 3.0 + i * 0.42, w: 5.5, h: 0.35,
      fontSize: 12, color: C.muted, fontFace: 'Calibri',
    });
  });

  // Mandi stats
  slide.addText('LIVE CLIENT: MANDI BAGLEY', {
    x: 0.7, y: 5.2, w: 5, h: 0.3,
    fontSize: 9, color: C.green, fontFace: 'Calibri', charSpacing: 3, bold: true,
  });
  slide.addText('1M+ followers  ·  64M+ TikTok likes  ·  4 active brand deals', {
    x: 0.7, y: 5.5, w: 5.5, h: 0.3,
    fontSize: 12, color: C.white, fontFace: 'Calibri',
  });
  slide.addText('mandibagley.com →', {
    x: 0.7, y: 5.85, w: 3, h: 0.3,
    fontSize: 11, color: C.blue, italic: true, fontFace: 'Calibri',
  });

  // Screenshot
  const heroImg = img('processed-mandi-hero.png');
  if (heroImg) {
    slide.addImage({ path: heroImg, x: 7.0, y: 1.2, w: 5.8, h: 5.2 });
  }
})();

// ═══════════════════════════════════════
// SLIDE 6 — TRACTION
// ═══════════════════════════════════════
(function() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  addLabel(slide, '05', 'TRACTION');

  slide.addText("This isn't a concept. It's live.", {
    x: 0.4, y: 0.85, w: 5, h: 0.6,
    fontSize: 32, color: C.white, bold: true, fontFace: 'Calibri',
  });

  // Stat cards
  const stats = [
    { val: '12.8K', label: 'Pageviews', color: C.blue },
    { val: '3.4K', label: 'Unique Visitors', color: C.purple },
    { val: '8.4%', label: 'Engagement Rate', color: C.green },
    { val: '$4,280', label: 'Link Revenue', color: C.gold },
  ];

  stats.forEach(function(s, i) {
    const y = 1.65 + i * 1.05;
    addCard(slide, 0.4, y, 4.2, 0.85);
    slide.addShape(pptx.ShapeType.rect, { x: 0.4, y: y, w: 0.06, h: 0.85, fill: { color: s.color } });
    slide.addText(s.val, {
      x: 0.7, y: y + 0.1, w: 3, h: 0.4,
      fontSize: 24, color: C.white, bold: true, fontFace: 'Calibri',
    });
    slide.addText(s.label, {
      x: 0.7, y: y + 0.5, w: 3, h: 0.25,
      fontSize: 11, color: C.muted, fontFace: 'Calibri',
    });
  });

  // Growth row
  addCard(slide, 0.4, 5.95, 4.2, 0.7);
  slide.addText('48.2K followers ↑1,240  ·  284K views ↑23%  ·  ↑34% link revenue', {
    x: 0.6, y: 6.05, w: 3.8, h: 0.5,
    fontSize: 10, color: C.green, fontFace: 'Calibri',
  });

  // Hub screenshot
  const hubImg = img('processed-hub-dashboard.png');
  if (hubImg) {
    slide.addImage({ path: hubImg, x: 5.2, y: 1.2, w: 7.7, h: 5.5 });
  }

  // Footer
  slide.addText('Data pulled live from mandibagley.com/hub · All figures are real, not projected', {
    x: 0, y: 7.0, w: 13.33, h: 0.3,
    fontSize: 9, color: C.muted, italic: true, fontFace: 'Calibri', align: 'center',
  });
})();

// ═══════════════════════════════════════
// SLIDE 7 — TAM / SAM
// ═══════════════════════════════════════
(function() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  addLabel(slide, '06', 'MARKET SIZE');

  slide.addText('A $250B market.\nWe need 0.001% of it.', {
    x: 0.4, y: 0.85, w: 8, h: 1.0,
    fontSize: 28, color: C.white, bold: true, fontFace: 'Calibri', lineSpacingMultiple: 1.1,
  });

  // TAM card
  addCard(slide, 0.4, 2.2, 4.0, 2.2, { border: C.blue });
  slide.addText('TAM', { x: 0.6, y: 2.35, w: 2, h: 0.3, fontSize: 9, color: C.blue, fontFace: 'Calibri', charSpacing: 4, bold: true });
  slide.addText('$254B', { x: 0.6, y: 2.7, w: 3, h: 0.6, fontSize: 36, color: C.white, bold: true, fontFace: 'Calibri' });
  slide.addText('Global Creator Economy 2025\nGrowing 23% CAGR\nProjected $1.35T by 2033', {
    x: 0.6, y: 3.3, w: 3.5, h: 0.9, fontSize: 11, color: C.muted, fontFace: 'Calibri', lineSpacingMultiple: 1.4,
  });

  // SAM card
  addCard(slide, 4.8, 2.2, 4.0, 2.2, { border: C.purple });
  slide.addText('SAM', { x: 5.0, y: 2.35, w: 2, h: 0.3, fontSize: 9, color: C.purple, fontFace: 'Calibri', charSpacing: 4, bold: true });
  slide.addText('~$2.7B', { x: 5.0, y: 2.7, w: 3, h: 0.6, fontSize: 36, color: C.white, bold: true, fontFace: 'Calibri' });
  slide.addText('US mid-tier creators 10K–500K\n1.8M creators\n1% capture = $27M ARR', {
    x: 5.0, y: 3.3, w: 3.5, h: 0.9, fontSize: 11, color: C.muted, fontFace: 'Calibri', lineSpacingMultiple: 1.4,
  });

  // Year 1 target
  addCard(slide, 9.2, 2.2, 3.7, 2.2, { border: C.gold });
  slide.addText('YEAR 1 TARGET', { x: 9.4, y: 2.35, w: 3, h: 0.3, fontSize: 9, color: C.gold, fontFace: 'Calibri', charSpacing: 4, bold: true });
  slide.addText('$66–76K', { x: 9.4, y: 2.7, w: 3, h: 0.6, fontSize: 36, color: C.white, bold: true, fontFace: 'Calibri' });
  slide.addText('20 Full Platform clients\n$30K–$40K setup revenue\n$36K ARR retainers', {
    x: 9.4, y: 3.3, w: 3.2, h: 0.9, fontSize: 11, color: C.muted, fontFace: 'Calibri', lineSpacingMultiple: 1.4,
  });

  // Bar chart — Creator Economy Growth
  slide.addChart(pptx.charts.BAR, [
    { name: 'Creator Economy ($B)', labels: ['2024', '2025', '2026', '2027', '2028'], values: [205, 252, 310, 381, 469] },
  ], {
    x: 0.4, y: 4.8, w: 12.5, h: 2.3,
    showTitle: false,
    showValue: true,
    valueFontSize: 9,
    valueFontColor: C.white,
    catAxisLabelColor: C.muted,
    catAxisLabelFontSize: 10,
    valAxisHidden: true,
    catGridLine: { style: 'none' },
    valGridLine: { style: 'none' },
    chartColors: [C.blue],
    plotBgrdColor: C.bg,
    catAxisLineShow: false,
  });
})();

// ═══════════════════════════════════════
// SLIDE 8 — MARKETING
// ═══════════════════════════════════════
(function() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  addLabel(slide, '07', 'MARKETING');

  slide.addText('How we get clients.', {
    x: 0.4, y: 0.85, w: 5, h: 0.6,
    fontSize: 32, color: C.white, bold: true, fontFace: 'Calibri',
  });

  // 2x2 channel cards
  const channels = [
    { num: '01', title: 'Referral Program', desc: '1 free month per referral\n$100 off for referred creator', color: C.green },
    { num: '02', title: 'Portfolio Site', desc: 'bysamotto.com — live demos\nof every feature built', color: C.blue },
    { num: '03', title: 'Direct Outreach', desc: 'Personalized pitches to\n10K–500K creators', color: C.purple },
    { num: '04', title: 'Social Proof Flywheel', desc: 'Every client becomes a case study.\nResults feed the next pitch.', color: C.gold },
  ];

  channels.forEach(function(ch, i) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.4 + col * 3.2;
    const y = 1.65 + row * 1.85;
    addCard(slide, x, y, 2.95, 1.6);
    slide.addShape(pptx.ShapeType.rect, { x: x, y: y, w: 2.95, h: 0.05, fill: { color: ch.color } });
    slide.addText(ch.num, { x: x + 0.2, y: y + 0.2, w: 1, h: 0.25, fontSize: 9, color: ch.color, fontFace: 'Calibri', charSpacing: 3, bold: true });
    slide.addText(ch.title, { x: x + 0.2, y: y + 0.45, w: 2.5, h: 0.3, fontSize: 15, color: C.white, bold: true, fontFace: 'Calibri' });
    slide.addText(ch.desc, { x: x + 0.2, y: y + 0.8, w: 2.5, h: 0.6, fontSize: 11, color: C.muted, fontFace: 'Calibri', lineSpacingMultiple: 1.3 });
  });

  // Portfolio screenshot
  const portfolioImg = img('processed-bysamotto-hero.png');
  if (portfolioImg) {
    slide.addImage({ path: portfolioImg, x: 7.2, y: 1.0, w: 5.8, h: 5.5 });
  }
})();

// ═══════════════════════════════════════
// SLIDE 9 — COST STRUCTURE
// ═══════════════════════════════════════
(function() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  addLabel(slide, '08', 'COST STRUCTURE & PRICING');

  slide.addText('Strong margins. Low overhead.\nHigh recurring revenue.', {
    x: 0.4, y: 0.85, w: 8, h: 1.0,
    fontSize: 28, color: C.white, bold: true, fontFace: 'Calibri', lineSpacingMultiple: 1.1,
  });

  // Full Platform card
  addCard(slide, 0.4, 2.2, 5.8, 4.2, { border: C.blue });
  slide.addText('⭐  FULL PLATFORM', { x: 0.7, y: 2.4, w: 5, h: 0.3, fontSize: 9, color: C.blue, fontFace: 'Calibri', charSpacing: 4, bold: true });
  slide.addText('$1,500–$2,000 setup + $150/mo', { x: 0.7, y: 2.8, w: 5, h: 0.5, fontSize: 20, color: C.white, bold: true, fontFace: 'Calibri' });
  slide.addShape(pptx.ShapeType.rect, { x: 0.7, y: 3.4, w: 5.2, h: 0.01, fill: { color: '2A3550' } });

  const fullFeatures = [
    '✓  Custom branded website with domain',
    '✓  Private analytics dashboard',
    '✓  The Hub + AI Strategist',
    '✓  YouTube / Instagram / TikTok data',
    '✓  Weekly AI briefings + strategy chat',
    '✓  Same-day updates & priority support',
  ];
  fullFeatures.forEach(function(f, i) {
    slide.addText(f, { x: 0.7, y: 3.6 + i * 0.4, w: 5, h: 0.35, fontSize: 12, color: C.muted, fontFace: 'Calibri' });
  });

  // Brand Site card
  addCard(slide, 6.8, 2.2, 5.8, 4.2, { border: C.purple });
  slide.addText('BRAND SITE', { x: 7.1, y: 2.4, w: 5, h: 0.3, fontSize: 9, color: C.purple, fontFace: 'Calibri', charSpacing: 4, bold: true });
  slide.addText('$400–$500 setup + $49/mo', { x: 7.1, y: 2.8, w: 5, h: 0.5, fontSize: 20, color: C.white, bold: true, fontFace: 'Calibri' });
  slide.addShape(pptx.ShapeType.rect, { x: 7.1, y: 3.4, w: 5.2, h: 0.01, fill: { color: '2A3550' } });

  const brandFeatures = [
    '✓  Custom branded website with domain',
    '✓  Tap-to-copy affiliate codes',
    '✓  Social links & smart buttons',
    '✓  Maintenance & same-day updates',
    '✓  Upgrade to Full Platform anytime',
  ];
  brandFeatures.forEach(function(f, i) {
    slide.addText(f, { x: 7.1, y: 3.6 + i * 0.4, w: 5, h: 0.35, fontSize: 12, color: C.muted, fontFace: 'Calibri' });
  });

  // Footer
  slide.addText('COGS: ~$30–50/client/mo  ·  Gross margin: ~75–85% on retainer  ·  Labor-dominant, scales with AI agents', {
    x: 0, y: 6.8, w: 13.33, h: 0.4,
    fontSize: 9, color: C.muted, italic: true, fontFace: 'Calibri', align: 'center',
  });
})();

// ═══════════════════════════════════════
// SLIDE 10 — CLOSING / THE ASK
// ═══════════════════════════════════════
(function() {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };

  // Left accent bar
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.06, h: 7.5, fill: { color: C.blue } });

  // Background image right side
  const portfolioImg = img('processed-bysamotto-hero.png');
  if (portfolioImg) {
    slide.addImage({ path: portfolioImg, x: 6.5, y: 0, w: 6.83, h: 7.5, transparency: 25 });
  }

  // Label
  slide.addText('THE ASK', {
    x: 0.5, y: 0.4, w: 3, h: 0.3,
    fontSize: 9, color: C.blue, fontFace: 'Calibri', charSpacing: 4, bold: true,
  });
  slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.7, w: 1.0, h: 0.04, fill: { color: C.blue } });

  // Headline
  slide.addText('One client proves the model.\nThe system scales from there.', {
    x: 0.5, y: 1.2, w: 6, h: 1.2,
    fontSize: 32, color: C.white, bold: true, fontFace: 'Calibri', lineSpacingMultiple: 1.15,
  });

  // Subtext
  slide.addText('Live client. Live platform. Real data.\nAI agents that deploy a new client in hours, not weeks.', {
    x: 0.5, y: 2.6, w: 5.5, h: 0.8,
    fontSize: 13, color: C.muted, fontFace: 'Calibri', lineSpacingMultiple: 1.4,
  });

  // 3 ask cards
  const asks = [
    { icon: '🤝', title: 'Mentorship', desc: 'Introductions to 50K–500K creators actively looking to grow' },
    { icon: '🔗', title: 'Network', desc: 'Connections to brand partners, investors, or accelerator programs' },
    { icon: '💡', title: 'Feedback', desc: 'Guidance on pricing, positioning, and hitting $100K ARR in year one' },
  ];

  asks.forEach(function(a, i) {
    const y = 3.7 + i * 1.1;
    addCard(slide, 0.5, y, 5.5, 0.9);
    slide.addText(`${a.icon}  ${a.title}`, {
      x: 0.8, y: y + 0.1, w: 4.5, h: 0.35,
      fontSize: 15, color: C.white, bold: true, fontFace: 'Calibri',
    });
    slide.addText(a.desc, {
      x: 0.8, y: y + 0.45, w: 4.8, h: 0.35,
      fontSize: 11, color: C.muted, fontFace: 'Calibri',
    });
  });

  // Bottom bar
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 6.8, w: 13.33, h: 0.7, fill: { color: '0D1220' } });
  slide.addText('Sam Otto  ·  bysamotto.com  ·  sam@bysamotto.com', {
    x: 0, y: 6.9, w: 13.33, h: 0.5,
    fontSize: 12, color: C.blue, fontFace: 'Calibri', align: 'center',
  });
})();

// ── Save ──
const outputPath = path.join(DIR, 'canyon-challenge-pitch-v2.pptx');
pptx.writeFile({ fileName: outputPath }).then(function() {
  console.log('Done! Saved to: ' + outputPath);
}).catch(function(err) {
  console.error('Error:', err);
});
