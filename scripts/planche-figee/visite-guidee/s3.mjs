import { session, TRAVAIL } from "./fige.mjs";
import { readFileSync } from "node:fs";
const id = readFileSync(`${TRAVAIL}/chantier.txt`, "utf8").trim();
const { page, va, fige, fin } = await session();
const pas = async (t = 600) => page.waitForTimeout(t);
const remplir = async (label, v) => { const c = page.getByLabel(label, { exact: true }); await c.click(); await c.fill(v); await c.blur(); await pas(400); };
try {
  await va(`/chantiers/${id}/devis-complet`);
  await remplir("Titre du devis", "Entretien du jardin");
  await remplir("Description 1", "Taille de la haie de thuyas le long du chemin");
  await remplir("Quantité 1", "25");
  await remplir("Unité 1", "ml");
  await remplir("Prix unitaire 1", "12");
  await remplir("Description 2", "Ramassage et évacuation des déchets verts");
  await remplir("Unité 2", "forfait");
  await remplir("Prix unitaire 2", "90");
  await remplir("Description 3", "Élagage du tilleul devant la maison");
  await remplir("Prix unitaire 3", "380");
  await pas(3000);
  await va(`/chantiers/${id}/devis-complet`);
  await pas(2000);
  await fige("10-devis");
  // Le micro en haut à droite : corriger le devis à la voix. On fige l'écoute,
  // puis on recharge : rien n'est envoyé.
  await page.click('button[aria-label="Dicter dans le devis"]'); await pas(2500);
  await fige("10b-devis-micro");
  await va(`/chantiers/${id}/devis-complet`); await pas(1500);
  const auxTotaux = async () => { await page.locator("text=Total TTC").first().scrollIntoViewIfNeeded(); await page.mouse.wheel(0, 200); await pas(800); };
  await auxTotaux();
  await fige("11-devis-totaux");
  // Chaque bouton du devis, pour de vrai : sa feuille, puis ce qu'il pose sur le
  // devis, puis on le retire pour que le devis du parcours reste le même.
  const ESSAIS = [
    { nom: "remise", ouvre: '[data-atlas="poser-prix-accorde"]', applique: 'button:has-text("Appliquer la remise")', vue: '[data-atlas="retirer-prix-accorde"]', retire: '[data-atlas="retirer-prix-accorde"]' },
    { nom: "main-doeuvre", ouvre: '[data-atlas="poser-main-doeuvre"]', applique: 'button:has-text("Ajouter la main d’œuvre")', vue: '[data-atlas="montant-main-doeuvre"]', retire: 'button[aria-label="Retirer « Main d’œuvre »"]' },
    { nom: "acompte", ouvre: '[data-atlas="ajouter-acompte"]', applique: 'button:has-text("Ajouter l’acompte")', vue: '[data-atlas="echeancier-devis"]', retire: '[data-atlas="retirer-acompte"]' },
    { nom: "tva", ouvre: 'button:has-text("+ Ajouter une TVA")', applique: 'button:has-text("Ajouter la TVA à 10 %")', vue: 'button[aria-label="Retirer la TVA à 10 %"]', retire: 'button[aria-label="Retirer la TVA à 10 %"]' },
  ];
  for (const e of ESSAIS) {
    await auxTotaux();
    await page.locator(e.ouvre).first().click(); await pas(1500);
    await fige(`11-${e.nom}-feuille`);
    await page.locator(e.applique).first().click(); await pas(2500);
    await page.locator(e.vue).first().scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 120)); await pas(800);
    await fige(`11-${e.nom}-pose`);
    await page.locator(e.retire).first().click(); await pas(2500);
  }
  await auxTotaux();
  await page.locator('button:has-text("+ Ajouter une ligne")').first().click(); await pas(2000);
  await page.locator('[data-atlas="croix-ligne"]').last().scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 160)); await pas(800);
  await fige("11-ligne-pose");
  await page.locator('[data-atlas="croix-ligne"]').last().click(); await pas(2500);
  await va(`/chantiers/${id}/devis-complet`); await pas(1500);
  await auxTotaux();
  console.log("après les essais :", await page.locator("text=Total TTC").first().locator("xpath=..").innerText());
  await page.screenshot({ path: `${TRAVAIL}/s3-plein.png`, fullPage: true });
  await page.locator('[data-atlas="apercu-pdf"]').click();
  await page.waitForURL(/documents\/pdf/, { timeout: 60000 });
  await page.waitForSelector("canvas", { timeout: 60000 }); await pas(5000);
  await fige("12-apercu-pdf");
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
await fin();
