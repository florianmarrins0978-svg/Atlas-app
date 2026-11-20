import { session } from "./fige.mjs";
const { page, va, fin } = await session();
try {
  await va("/reglages/equipe");
  for (let i = 0; i < 3; i++) { await page.click('button[aria-label="Un salarié de plus"]'); await page.waitForTimeout(1500); }
  await va("/reglages/equipe");
  for (const [i, n] of [[1, "Paul"], [2, "Kévin"], [3, "Hugo"]]) { await page.fill(`input[aria-label="Nom du salarié ${i}"]`, n); await page.keyboard.press("Tab"); await page.waitForTimeout(1500); }
} catch (e) { console.log("ÉCHEC s0", e.message.split("\n")[0]); }
await fin();
