import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { ADRESSE } from "./_adresse";

// LES DOSSIERS DU PLAN D'ARROSAGE — sa demande du 21 novembre 2026, planche
// `appli/arrosage-dossiers.html`, `ARCHITECTURE.md` §599.
//
// **LE GESTE DU PATRON, PAS LA FONCTION** (`CLAUDE.md` §5 quater) : la suite
// dessine un plan au doigt comme lui, l'enregistre par la feuille, puis le
// retrouve par « Mes dossiers ». Les suites base éprouvent le dépôt ; celle-ci
// éprouve la porte d'entrée, qui est celle qui peut être fermée.
//
//   1. un plan dessiné s'enregistre dans un dossier neuf, nommé par lui ;
//   2. le même plan deux fois ne fait pas de version de plus ;
//   3. le dossier l'affiche, et le plan revu est CELUI de ce jour-là, en
//      lecture seule : autant de réseaux, aucun geste qui le change ;
//   4. « Voir la saisie » dit ce qu'il a saisi, et que la photo n'est pas
//      gardée (un plan dessiné n'en a pas) ;
//   5. le PDF archivé se télécharge ;
//   6. « Reprendre dans l'outil » rouvre l'outil sur ce plan ;
//   7. supprimer le fait disparaître, et son PDF avec ;
//   8. rien ne déborde à 390 px.

const BASE = ADRESSE;

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  // Un nom à lui seul : une suite rejouée ne retombe jamais sur le dossier d'avant.
  const nom = `Plan d’arrosage de Madame Essai ${Date.now().toString(36)}`;
  let reseaux = 0;
  let adresseDuDossier = "";
  let adresseDuPlan = "";
  let adresseDuPdf = "";

  const sansDebordement = async (ecran: string) => {
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(deborde <= 1, `${ecran} déborde de ${deborde} px à 390 px`);
  };

  await cas("un plan dessiné s'enregistre dans un dossier neuf, nommé par lui", async () => {
    await page.goto(`${BASE}/paysage/arrosage`, { waitUntil: "networkidle" });
    await page.click('[data-atlas="ouvrir-dessin"]');
    await page.fill("#terrain-L", "10");
    await page.fill("#terrain-l", "10");
    await page.getByRole("button", { name: "Pelouse", exact: true }).click();
    await page.fill("#feuille-L", "8");
    await page.fill("#feuille-l", "6");
    await page.click('[data-atlas="feuille-valider"]');
    const toile = page.locator('[data-atlas="toile"]');
    const toileArretee = async () => {
      let b = await toile.boundingBox();
      for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(50);
        const apres = await toile.boundingBox();
        if (b && apres && Math.abs(apres.y - b.y) < 0.5) return apres;
        b = apres;
      }
      return b;
    };
    const poser = async (bouton: string, fx: number, fy: number) => {
      await page.getByRole("button", { name: bouton, exact: true }).click();
      const b = await toileArretee();
      assert.ok(b && b.width > 0, "la toile du dessin ne mesure rien");
      await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
    };
    await poser("Nourrice", 0.9, 0.9);
    await poser("Compteur", 0.1, 0.92);
    await page.click('[data-atlas="faire-le-plan"]');
    await page.waitForSelector('[data-atlas="plan-arrosage"]', { timeout: 60_000 });
    reseaux = await page.locator('[data-atlas="carte-reseau"]').count();
    assert.ok(reseaux >= 1, "le plan dessiné ne porte aucun réseau : la suite ne mesure rien");

    await page.click('[data-atlas="enregistrer-dossier"]');
    const feuille = page.locator('[data-atlas="feuille-enregistrer"]');
    await feuille.waitFor({ timeout: 20_000 });
    // Un plan dessiné n'a pas de photo : la feuille ne promet pas le croquis.
    assert.doesNotMatch(await feuille.innerText(), /Le croquis,/, "la feuille promet un croquis qu'un plan dessiné n'a pas");
    await feuille.getByRole("radio", { name: /Nouveau dossier/ }).click();
    await page.fill("#nom-du-nouveau-dossier", nom);
    await page.click('[data-atlas="enregistrer"]');
    const fait = page.locator('[data-atlas="plan-enregistre"]');
    await fait.waitFor({ timeout: 30_000 });
    assert.match(await fait.innerText(), new RegExp(`Enregistré dans ${nom}, aujourd’hui à \\d+ h \\d\\d\\.`));
    adresseDuDossier = (await fait.locator("a").getAttribute("href")) ?? "";
    assert.match(adresseDuDossier, /^\/paysage\/dossiers-arrosage\/[0-9a-f-]{36}$/);
  });

  await cas("le même plan deux fois ne fait pas de version de plus", async () => {
    await page.click('[data-atlas="enregistrer-dossier"]');
    const feuille = page.locator('[data-atlas="feuille-enregistrer"]');
    await feuille.getByRole("radio", { name: new RegExp(nom) }).click();
    await page.click('[data-atlas="enregistrer"]');
    const deja = page.locator('[data-atlas="plan-deja-enregistre"]');
    await deja.waitFor({ timeout: 30_000 });
    assert.match(await deja.innerText(), new RegExp(`déjà enregistré tel quel dans ${nom}`));
  });

  await cas("« Mes dossiers » le montre, et le dossier porte une seule version", async () => {
    await page.goto(`${BASE}/paysage/arrosage`, { waitUntil: "networkidle" });
    await page.click('[data-atlas="mes-dossiers"]');
    await page.waitForURL(`${BASE}/paysage/dossiers-arrosage`, { timeout: 20_000 });
    const ligne = page.locator(`a[href="${adresseDuDossier}"]`);
    assert.equal(await ligne.count(), 1, "le dossier enregistré n'est pas dans « Mes dossiers »");
    assert.match(await ligne.innerText(), /1 plan, aujourd’hui/);
    await sansDebordement("« Mes dossiers »");
    await ligne.click();
    await page.waitForURL(`${BASE}${adresseDuDossier}`, { timeout: 20_000 });
    assert.equal(await page.locator('[data-atlas^="version-"]').count(), 1, "le même plan deux fois a fait deux versions");
    adresseDuPlan = (await page.locator('[data-atlas="version-1"]').getAttribute("href")) ?? "";
    await sansDebordement("le dossier ouvert");
  });

  await cas("le plan revu est celui de ce jour-là, en lecture seule", async () => {
    await page.goto(`${BASE}${adresseDuPlan}`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-atlas="plan-arrosage"]', { timeout: 30_000 });
    assert.match(await page.locator('[data-atlas="plan-enregistre-le"]').innerText(), new RegExp(`Enregistré aujourd’hui à \\d+ h \\d\\d\\s+${nom}\\. Tel que rendu ce jour-là\\.`));
    assert.equal(await page.locator('[data-atlas="carte-reseau"]').count(), reseaux, "le plan revu n'a pas les réseaux du plan enregistré");
    for (const geste of ["ajouter-piece", "ajouter-une-zone", "modifier-zone", "modifier-liste", "enregistrer-dossier"]) {
      assert.equal(await page.locator(`[data-atlas="${geste}"]`).count(), 0, `un plan enregistré offre encore « ${geste} »`);
    }
    assert.equal(await page.locator('[data-atlas="reprendre-dans-l-outil"]').count(), 1, "« Reprendre dans l’outil » manque");
    await sansDebordement("le plan revu");
  });

  await cas("« Voir la saisie » dit ce qu'il a saisi, et que la photo n'est pas gardée", async () => {
    await page.click('[data-atlas="voir-la-saisie"]');
    const feuille = page.locator('[data-atlas="feuille-saisie"]');
    await feuille.waitFor({ timeout: 10_000 });
    const texte = await feuille.innerText();
    assert.match(texte, /La photo du croquis n’est pas gardée\./);
    assert.match(texte, /Le piquage\s+Juste après le compteur d’eau/);
    assert.match(texte, /Les zones\s+Pelouse, 8 m sur 6 m/);
    await feuille.getByRole("button", { name: "Fermer" }).click();
  });

  await cas("le PDF archivé se télécharge", async () => {
    adresseDuPdf = (await page.locator('[data-atlas="telecharger-pdf"]').getAttribute("href")) ?? "";
    assert.match(adresseDuPdf, /\/pdf\?telecharger=1$/);
    const r = await page.request.get(`${BASE}${adresseDuPdf}`);
    assert.equal(r.status(), 200, `le PDF répond ${r.status()}`);
    assert.equal(r.headers()["content-type"], "application/pdf");
    assert.match(r.headers()["content-disposition"] ?? "", /^attachment;.*plan-d-arrosage-\d{4}-\d\d-\d\d-version-1\.pdf/);
    const corps = await r.body();
    assert.equal(corps.subarray(0, 5).toString("latin1"), "%PDF-", "le fichier servi n'est pas un PDF");
  });

  await cas("« Reprendre dans l’outil » rouvre l'outil sur ce plan", async () => {
    await page.click('[data-atlas="reprendre-dans-l-outil"]');
    await page.waitForURL(/\/paysage\/arrosage\?reprendre=/, { timeout: 20_000 });
    await page.waitForSelector('[data-atlas="plan-arrosage"]', { timeout: 30_000 });
    assert.equal(await page.locator('[data-atlas="carte-reseau"]').count(), reseaux, "le plan repris n'a pas les réseaux du plan enregistré");
    // Repris, il redevient un plan vivant : il s'enregistre de nouveau.
    assert.equal(await page.locator('[data-atlas="enregistrer-dossier"]').count(), 1);
  });

  await cas("supprimer le fait disparaître, et son PDF avec", async () => {
    await page.goto(`${BASE}${adresseDuDossier}`, { waitUntil: "networkidle" });
    await page.click('[data-atlas="supprimer-dossier"]');
    const feuille = page.locator('[data-atlas="feuille-supprimer"]');
    await feuille.waitFor({ timeout: 10_000 });
    assert.match(await feuille.innerText(), /reste gardé 5 ans/);
    await page.click('[data-atlas="confirmer-la-suppression"]');
    await page.waitForURL(`${BASE}/paysage/dossiers-arrosage`, { timeout: 20_000 });
    assert.equal(await page.locator(`a[href="${adresseDuDossier}"]`).count(), 0, "le dossier supprimé est encore dans la liste");
    assert.equal((await page.request.get(`${BASE}${adresseDuPdf}`)).status(), 404, "le PDF d'un dossier supprimé se télécharge encore");
    // L'écran, pas le code HTTP : le gabarit racine (`loading.tsx`) diffuse la
    // page avant que `notFound()` tranche, et le code reste 200 comme partout.
    await page.goto(`${BASE}${adresseDuPlan}`, { waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="plan-revu"]').count(), 0, "le plan d'un dossier supprimé s'ouvre encore");
  });

  await contexte.close();
  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Les dossiers du plan d'arrosage — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
