import { session, TRAVAIL } from "./fige.mjs";
const { page, va, fige, fin } = await session();
const pas = (t = 700) => page.waitForTimeout(t);
const RUBRIQUES = ["identite","banque","mon-annee","equipe","vehicules","organigramme","tarifs","documents","fournisseurs","ia","agenda","abonnement","donnees","compte","notifications","connexion","connexion/double-verification","apparence","idee"];
try {
  await va("/termines/comptable/dossiers");
  await page.click('[data-atlas="ouvrir-dossier"]');
  await page.waitForURL(/documents\/pdf/, { timeout: 60000 });
  await page.waitForSelector("canvas", { timeout: 60000 }); await pas(5000);
  await fige("49-dossier-pdf");
  // Ses fournisseurs et leurs prix d'achat, posés par l'écran lui-même : ce sont
  // eux que le devis reprend, avec sa marge.
  await va("/reglages/fournisseurs");
  await page.fill('[data-atlas="marge-generale"]', "20"); await page.keyboard.press("Tab"); await pas(1200);
  const FOURNISSEURS = [
    ["Pépinière des Saules", "02 61 91 00 21", [["Photinia Red Robin, pot de 10 L", "pièce", "12.50"], ["Thuya plicata 100/125 cm", "pièce", "18.90"], ["Paillage écorce de pin, sac de 50 L", "sac", "7.80"], ["Terreau universel, sac de 40 L", "sac", "8.90"]]],
    ["Quincaillerie du Port", "02 61 91 00 22", [["Piquet bois traité 1,50 m", "pièce", "3.20"], ["Grillage soudé vert 1,20 m, rouleau de 25 m", "pièce", "64.00"]]],
  ];
  for (const [nom, tel, prix] of FOURNISSEURS) {
    await page.fill('[data-atlas="nom-nouvelle-societe"]', nom);
    await page.click('[data-atlas="ajouter-societe"]'); await pas(2000);
    await page.locator('[data-atlas="societe"]', { hasText: nom }).first().click(); await pas(1500);
    await page.fill('[data-atlas="telephone-societe"]', tel); await page.keyboard.press("Tab"); await pas(800);
    for (const [article, unite, montant] of prix) {
      await page.fill('[data-atlas="article-nom"]', article);
      await page.locator('select[aria-label="Unité"]').selectOption({ label: unite }).catch(() => {});
      await page.fill('[data-atlas="article-prix"]', montant);
      await page.click('[data-atlas="ajouter-prix"]'); await pas(1500);
    }
    await va("/reglages/fournisseurs");
  }
  await va("/reglages");
  await fige("50-reglages");
  for (const r of RUBRIQUES) { await va(`/reglages/${r}`); await pas(800); await fige(`r-${r.replace("/", "-")}`); }
  await va("/reglages/idee");
  await page.getByRole("button", { name: /J'écris mon idée/ }).click(); await pas(1200);
  await page.locator("textarea").first().fill("Voir la météo de la semaine sur le planning.");
  await pas(600);
  await fige("r-idee-ecrite");
  await va("/reglages/fournisseurs");
  await page.locator('[data-atlas="societe"]', { hasText: "Pépinière des Saules" }).first().click(); await pas(2000);
  await page.locator('[data-atlas="partie-prix"]').scrollIntoViewIfNeeded(); await pas(600);
  await fige("r-fournisseurs-fiche");
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
await fin();
