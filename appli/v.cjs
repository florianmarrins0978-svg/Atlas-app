const { chromium } = require('playwright');
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await nav.newContext({ viewport:{width:420,height:900}, deviceScaleFactor:3 })).newPage();
  await p.goto('http://127.0.0.1:8076/arrosage.html', { waitUntil:'networkidle' });
  await p.evaluate(() => localStorage.removeItem('atlas-arrosage'));
  await p.reload({ waitUntil:'networkidle' });
  await p.locator('#plans .plan').first().screenshot({ path:'/tmp/claude-0/-home-user-Atlas-app/625ed6e8-234d-549b-a18f-cc9e3938615c/scratchpad/vues/v7-quinconce.png' });
  console.log('bandeau :', (await p.locator('#bandeau').innerText()).replace(/\n/g,' '));
  await nav.close();
})();
