const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  const results = [];

  // 3. youtube-analytics.png — try Mandi's actual channel URL or a search
  try {
    console.log('3. Trying YouTube search for Mandi Bagley...');
    // Try different possible YouTube URLs
    const urls = [
      'https://www.youtube.com/@MandiBagley',
      'https://www.youtube.com/@mandi.bagley',
      'https://www.youtube.com/@mandibrown',
      'https://www.youtube.com/results?search_query=mandi+bagley'
    ];

    let captured = false;
    for (const url of urls) {
      try {
        console.log(`  Trying ${url}...`);
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(2000);

        // Check if it's a valid channel page (not 404)
        const pageContent = await page.textContent('body');
        if (pageContent.includes("isn't available") || pageContent.includes('404')) {
          console.log('  Page not found, trying next...');
          continue;
        }

        await page.screenshot({ path: 'youtube-analytics.png', fullPage: false });
        results.push(`youtube-analytics.png: SUCCESS (${url})`);
        console.log(`  Captured from ${url}`);
        captured = true;
        break;
      } catch (e) {
        console.log(`  Failed: ${e.message}`);
      }
    }

    if (!captured) {
      // Fallback: screenshot YouTube homepage
      await page.goto('https://www.youtube.com', { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'youtube-analytics.png', fullPage: false });
      results.push('youtube-analytics.png: SUCCESS (YouTube homepage fallback)');
    }
  } catch (e) {
    results.push(`youtube-analytics.png: FAILED - ${e.message}`);
    console.error('youtube-analytics.png failed:', e.message);
  }

  // 4. instagram-insights.png — dismiss the login modal
  try {
    console.log('4. Navigating to Instagram and dismissing modal...');
    await page.goto('https://www.instagram.com/mandibagley/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Try to dismiss the login modal by clicking the X button
    try {
      // Look for close button or X in the modal
      const closeBtn = await page.$('svg[aria-label="Close"]');
      if (closeBtn) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      } else {
        // Try clicking the X button by various selectors
        const xBtn = await page.$('button:has(svg[aria-label="Close"])')
          || await page.$('[role="dialog"] button')
          || await page.$('div[role="dialog"] button:first-child');
        if (xBtn) {
          await xBtn.click();
          await page.waitForTimeout(1000);
        } else {
          // Press Escape to dismiss
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
      }
    } catch (e) {
      console.log('  Could not find/click close button, trying Escape...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // Scroll up to make sure we see the profile header
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'instagram-insights.png', fullPage: false });
    results.push('instagram-insights.png: SUCCESS');
    console.log('instagram-insights.png captured');
  } catch (e) {
    results.push(`instagram-insights.png: FAILED - ${e.message}`);
    console.error('instagram-insights.png failed:', e.message);
  }

  // 5. tiktok-analytics.png — retry with longer wait
  try {
    console.log('5. Navigating to TikTok with longer wait...');
    await page.goto('https://www.tiktok.com/@mandibagley', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Try to close any popups/cookie banners
    try {
      const cookieBtn = await page.$('button:has-text("Accept")') || await page.$('button:has-text("accept")');
      if (cookieBtn) await cookieBtn.click();
    } catch(e) {}

    await page.waitForTimeout(2000);
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
