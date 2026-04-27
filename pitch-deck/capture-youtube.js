const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Try YouTube search for Mandi Bagley to get something visual
  try {
    console.log('Trying YouTube search...');
    await page.goto('https://www.youtube.com/results?search_query=mandi+bagley', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);

    // Check what we got
    const title = await page.title();
    console.log('Page title:', title);

    await page.screenshot({ path: 'youtube-analytics.png', fullPage: false });
    console.log('Saved youtube-analytics.png');

    // Also check page content for debugging
    const text = await page.textContent('body');
    console.log('Page has text length:', text.length);
    console.log('Contains "mandi":', text.toLowerCase().includes('mandi'));
    console.log('Contains "consent":', text.toLowerCase().includes('consent'));
    console.log('Contains "cookies":', text.toLowerCase().includes('cookie'));
    console.log('First 500 chars:', text.substring(0, 500));
  } catch (e) {
    console.error('Failed:', e.message);
  }

  await browser.close();
})();
