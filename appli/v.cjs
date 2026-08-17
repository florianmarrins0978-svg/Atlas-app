const { chromium } = require('playwright');
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await nav.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
  await p.goto('http://127.0.0.1:8069/arrosage.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.removeItem('atlas-arrosage'));
  await p.reload({ waitUntil: 'networkidle' });
  await p.selectOption('#marque', 'hunter');
  await p.waitForTimeout(200);
  console.log('note marque Hunter :', (await p.locator('#marqueNote').innerText()).replace(/\n/g,' '));
  console.log('bandeau :', (await p.locator('#bandeau').innerText()).replace(/\n/g,' '));
  console.log('zone 0  :', (await p.locator('.zone-res').first().innerText()).replace(/\n/g,' '));
  await p.selectOption('#marque', 'rainbird');
  await p.waitForTimeout(200);
  console.log('note Rain Bird :', (await p.locator('#marqueNote').innerText()).replace(/\n/g,' '));
  await p.screenshot({ path:'/tmp/claude-0/-home-user-Atlas-app/625ed6e8-234d-549b-a18f-cc9e3938615c/scratchpad/vues/v8-final.png' });
  await nav.close();
})();
