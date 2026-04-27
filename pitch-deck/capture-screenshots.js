const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  const results = [];

  // 1. hub-dashboard.png
  try {
    console.log('1. Navigating to hub...');
    await page.goto('https://mandibagley.com/hub', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Login
    await page.fill('input[type="password"]', 'Mandi2026');
    await page.click('button');
    await page.waitForTimeout(4000);

    await page.screenshot({ path: 'hub-dashboard.png', fullPage: false });
    results.push('hub-dashboard.png: SUCCESS');
    console.log('hub-dashboard.png captured');
  } catch (e) {
    results.push(`hub-dashboard.png: FAILED - ${e.message}`);
    console.error('hub-dashboard.png failed:', e.message);
  }

  // 2. hub-ai.png (same page, scroll to AI section)
  try {
    console.log('2. Scrolling to AI Advisor...');
    // Try to find and scroll to the AI advisor section
    const aiSection = await page.$('text=AI Advisor') || await page.$('text=advisor') || await page.$('text=Chat') || await page.$('text=chat');
    if (aiSection) {
      await aiSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    } else {
      // Just scroll down significantly
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'hub-ai.png', fullPage: false });
    results.push('hub-ai.png: SUCCESS');
    console.log('hub-ai.png captured');
  } catch (e) {
    results.push(`hub-ai.png: FAILED - ${e.message}`);
    console.error('hub-ai.png failed:', e.message);
  }

  // 3. youtube-analytics.png
  try {
    console.log('3. Navigating to YouTube...');
    await page.goto('https://www.youtube.com/@mandibagley', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'youtube-analytics.png', fullPage: false });
    results.push('youtube-analytics.png: SUCCESS');
    console.log('youtube-analytics.png captured');
  } catch (e) {
    // Fallback: try YouTube Studio landing
    try {
      await page.goto('https://studio.youtube.com', { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'youtube-analytics.png', fullPage: false });
      results.push('youtube-analytics.png: SUCCESS (studio fallback)');
    } catch (e2) {
      results.push(`youtube-analytics.png: FAILED - ${e.message}`);
      console.error('youtube-analytics.png failed:', e.message);
    }
  }

  // 4. instagram-insights.png
  try {
    console.log('4. Navigating to Instagram...');
    await page.goto('https://www.instagram.com/mandibagley/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'instagram-insights.png', fullPage: false });
    results.push('instagram-insights.png: SUCCESS');
    console.log('instagram-insights.png captured');
  } catch (e) {
    results.push(`instagram-insights.png: FAILED - ${e.message}`);
    console.error('instagram-insights.png failed:', e.message);
  }

  // 5. tiktok-analytics.png
  try {
    console.log('5. Navigating to TikTok...');
    await page.goto('https://www.tiktok.com/@mandibagley', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'tiktok-analytics.png', fullPage: false });
    results.push('tiktok-analytics.png: SUCCESS');
    console.log('tiktok-analytics.png captured');
  } catch (e) {
    results.push(`tiktok-analytics.png: FAILED - ${e.message}`);
    console.error('tiktok-analytics.png failed:', e.message);
  }

  await browser.close();

  console.log('\n=== RESULTS ===');
  results.forEach(r => console.log(r));
})();
