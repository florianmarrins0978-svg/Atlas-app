import { session, TRAVAIL } from "./fige.mjs";
const { page, va, fige, fin } = await session();
const pas = async (t = 600) => page.waitForTimeout(t);
try {
  await va("/");
  await fige("01-accueil");
  await va("/clients");
  await fige("02-clients");
  await va("/chantiers/nouveau");
  await fige("03-nouveau-mr");
  await page.click('[data-atlas="civilite-entreprise"]'); await pas();
  await fige("04-nouveau-entreprise");
  await page.click('[data-atlas="civilite-public"]'); await pas();
  await fige("05-nouveau-public");
  await page.click('[data-atlas="civilite-mr"]'); await pas();
  await page.getByLabel("Nom du client").fill("Lefèvre");
  await page.getByLabel("Téléphone").first().fill("06 39 98 12 34");
  await page.getByLabel("E-mail").first().fill("lefevre@example.com");
  await page.getByLabel("Adresse du chantier").fill("7 chemin du Verger, 44300 Nantes");
  await pas(1500);
  await page.keyboard.press("Escape");
  await page.locator("h1, body").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
  await pas();
  await fige("06-nouveau-rempli");
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png` }); }
await fin();
