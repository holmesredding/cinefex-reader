// Run against a local static server. Requires Playwright (NODE_PATH may point to
// an existing install). CHROME_BIN optionally selects an installed Chromium.
// Example: node scripts/verify-reader-layout.js http://127.0.0.1:8766
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8766';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // The tests exercise layout and locally indexed text, independently of IA.
    await page.route('https://archive.org/**', route => route.abort());
    for (const session of [false, true]) {
      const path = 'issues/32/index.html?reading=text#page=4';
      await page.goto(base + '/' + (session ? 'session.html#' + encodeURIComponent(path) : path));
      const reader = session ? page.frameLocator('#reader') : page;
      await reader.locator('.article-prose > p').first().waitFor();
      const body = reader.locator('body');
      async function checkBounds() {
        const result = await body.evaluate(() => {
          const rect = selector => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, height: r.height };
          };
          return { width: innerWidth, height: innerHeight, body: rect('body'), panel: rect('#articleReading'), nav: rect('nav'), footer: rect('footer'), scrollWidth: document.body.scrollWidth };
        });
        assert.ok(result.scrollWidth <= result.width + 1, 'No horizontal page overflow');
        assert.ok(result.body.bottom <= result.height + 1, 'Reader stays within viewport');
        assert.ok(result.panel.top >= 0 && result.panel.bottom <= result.height + 1, 'Article stays within viewport');
        if (result.footer.height) assert.ok(result.footer.bottom <= result.height + 1, 'Navigation is visible');
        if (result.nav.height) assert.ok(result.nav.right <= result.width + 1, 'Toolbar fits');
      }
      for (const size of [{width:1024,height:768}, {width:768,height:1024}, {width:390,height:844}, {width:1366,height:1024}]) {
        await page.setViewportSize(size);
        await page.waitForTimeout(100);
        await checkBounds();
        await reader.locator('#hideControlsToolbar').click();
        await reader.locator('#showControlsButton').waitFor();
        await checkBounds();
        assert.equal(await reader.locator('#articleReading').evaluate(el => Math.round(el.getBoundingClientRect().top)), 0, 'Hidden toolbar leaves no headroom');
        await reader.locator('#showControlsButton').click();
        await reader.locator('#hideControlsToolbar').waitFor();
      }
      await reader.locator('#articleReading').evaluate(el => { el.scrollTop = 700; });
      await page.waitForTimeout(100);
      const position = await body.evaluate(() => ({ page: CinefexReader.current, top: document.querySelector('#articleReading').scrollTop }));
      await reader.locator('#hideControlsToolbar').click();
      await page.waitForFunction(() => history.state?.cinefexHiddenControls === true);
      await page.goBack();
      await reader.locator('#hideControlsToolbar').waitFor();
      await page.waitForTimeout(100);
      const restored = await body.evaluate(() => ({ page: CinefexReader.current, top: document.querySelector('#articleReading').scrollTop }));
      assert.equal(restored.page, position.page, 'Back restores controls without changing article page');
      assert.ok(Math.abs(restored.top-position.top)<3, 'Hide/show preserves article position');
      await reader.locator('[data-reading-view="page"]').click();
      await reader.locator('#fullscreenButton').click();
      await reader.locator('#showControlsButton').waitFor();
      const fits = await reader.locator('#paper').evaluate(paper => {
        const p=paper.getBoundingClientRect(), v=document.querySelector('#viewport').getBoundingClientRect();
        return p.top>=v.top-1 && p.left>=v.left-1 && p.bottom<=v.bottom+1 && p.right<=v.right+1;
      });
      assert.ok(fits, 'Full-screen magazine page is completely visible');
      assert.equal(await page.evaluate(() => document.fullscreenElement === document.documentElement), true, 'Outer document owns full screen');
      await reader.locator('#showControlsButton').click();
      await reader.locator('#fullscreenButton').click();
      await reader.locator('#hideControlsToolbar').waitFor();
      assert.equal(await page.evaluate(() => Boolean(document.fullscreenElement)), false);
      console.log(`${session?'Session iframe':'Direct reader'}: four sizes, article position, history, and full screen passed`);
    }
    assert.deepEqual(errors, []);
    console.log('No browser script errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
