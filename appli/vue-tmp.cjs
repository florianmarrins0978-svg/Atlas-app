const { chromium } = require('playwright');
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8089/arrosage-tarifs.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.removeItem('atlas-arrosage-prix'));
  await p.reload({ waitUntil: 'networkidle' });
  // On tape un prix, comme lui : la case doit se retenir et le compte suivre.
  await p.locator('.p input').first().fill('3.10');
  await p.waitForTimeout(150);
  console.log('compte :', (await p.locator('#compte').innerText()).replace(/\n/g,' '));
  await p.screenshot({ path: '/tmp/claude-0/-home-user-Atlas-app/625ed6e8-234d-549b-a18f-cc9e3938615c/scratchpad/vues/v5-tarifs.png' });
  // Et le plan doit en tenir compte.
  await p.goto('http://127.0.0.1:8089/arrosage.html', { waitUntil: 'networkidle' });
  await p.locator('#total').scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  console.log('total  :', (await p.locator('#total').innerText()).replace(/\n/g,' '));
  await p.screenshot({ path: '/tmp/claude-0/-home-user-Atlas-app/625ed6e8-234d-549b-a18f-cc9e3938615c/scratchpad/vues/v5-total.png' });
  await nav.close();
})();
