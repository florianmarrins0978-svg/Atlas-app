const { chromium } = require('playwright');
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8097/arrosage.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.removeItem('atlas-arrosage'));
  await p.reload({ waitUntil: 'networkidle' });
  const O = '/tmp/claude-0/-home-user-Atlas-app/625ed6e8-234d-549b-a18f-cc9e3938615c/scratchpad/vues/';
  await p.screenshot({ path: O + 'v2-haut.png' });
  await p.locator('#nourrice').scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await p.screenshot({ path: O + 'v2-nourrice.png' });
  await nav.close();
})();
