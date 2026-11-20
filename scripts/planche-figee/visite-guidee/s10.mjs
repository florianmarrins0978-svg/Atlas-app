import { session, TRAVAIL } from "./fige.mjs";
const { page, va, fige, fin } = await session();
const pas = (t = 700) => page.waitForTimeout(t);
const ligne = (txt) => page.locator('[data-atlas="ligne-a-regarder"]', { hasText: txt }).first();
const essai = async (f) => { try { await f(); } catch (e) { console.log("passé :", e.message.split("\n")[0]); } };
try {
  await va("/termines/comptable");
  if (await ligne("Quincaillerie").count()) {
    await fige("41-comptable");
    await page.click('[data-atlas="check-up"]'); await pas(4000);
    await fige("42-checkup");
    await essai(async () => { await ligne("Quincaillerie").getByRole("button", { name: "Ticket perdu" }).click(); await pas(1000); await page.click('[data-atlas="valider-ticket-perdu"]'); await pas(2500); });
    await essai(async () => { await ligne("Mutuelle").locator('[data-atlas="autre-chose"]').click(); await pas(1000); await page.locator('[data-atlas="choix-motif"]', { hasText: "Un fournisseur" }).first().click(); await pas(2500); });
    await essai(async () => { await ligne("Remise").locator('[data-atlas="autre-chose"]').click(); await pas(1000); await page.locator('[data-atlas="choix-motif"]').first().click(); await pas(2500); });
    await va("/termines/comptable");
  }
  await fige("43-comptable-justifie");
  await va("/termines/comptable/2026-11");
  await fige("44-releve-du-mois");
  await va("/termines/comptable");
  await page.click('[data-atlas="arreter-mon-dossier"]'); await pas(1500);
  await page.locator('[data-atlas="arreter-et-ranger"]').scrollIntoViewIfNeeded();
  await fige("46-arreter");
  await page.click('[data-atlas="arreter-et-ranger"]'); await pas(6000);
  await fige("47-dossier-range");
  console.log("APRES", page.url(), (await page.evaluate(() => document.body.innerText)).slice(0, 600));
  await va("/termines/comptable/dossiers");
  await fige("48-mes-dossiers");
  console.log((await page.evaluate(() => [...document.querySelectorAll("a,button")].map((e) => (e.dataset.atlas || "") + " " + (e.getAttribute("href") || "") + " " + e.innerText.replace(/\s+/g, " ").slice(0, 50)).join("\n"))));
  await va("/reglages/banque");
  await fige("45-ma-banque");
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
await fin();
