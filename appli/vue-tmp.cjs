const { chromium } = require('playwright');
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8092/arrosage.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.removeItem('atlas-arrosage'));
  await p.reload({ waitUntil: 'networkidle' });
  await p.locator('#marque').scrollIntoViewIfNeeded(); await p.waitForTimeout(250);
  await p.screenshot({ path: '/tmp/claude-0/-home-user-Atlas-app/625ed6e8-234d-549b-a18f-cc9e3938615c/scratchpad/vues/v3-marque.png' });
  await nav.close();
})();
