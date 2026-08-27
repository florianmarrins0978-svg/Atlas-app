import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { MODELE_FOURNI } from "../src/lib/prestations-entretien";

// L'écran où la fiche se compose — Paysage → Fiche de chantier → Composer ma fiche.
//
// **Sa demande du 16 août 2026** : *« dans les réglages […] un endroit où
// l'utilisateur pourra créer cette fiche […] retirer ou ajouter des cases s'il
// le souhaite »*.
//
// Ce que cette suite tient, et qu'aucune capture ne montrerait :
//
//   1. **la rubrique existe et se trouve** — un écran qu'il ne trouve pas
//      n'existe pas ;
//   2. le modèle ne se pose PAS tout seul : il est proposé, puis posé d'un
//      geste ;
//   3. **le retrait se défait** (sa règle du 10 août) — c'est le point le plus
//      coûteux de cet écran : une croix sans retour sur une liste composée à la
//      main ;
//   4. une prestation ajoutée se range dans SA famille, pas au bas de l'écran ;
//   5. un doublon est refusé **avec une phrase**, jamais avec un code ;
//   6. **les CATÉGORIES se créent nommées et se retirent d'un geste** — sa
//      remarque du 24 août 2026, *« ajouter des catégories, en enlever, en
//      créer »*. Avant, « créer » rangeait dans « Divers » à charge pour lui de
//      renommer, et « enlever » n'existait pas.

const CAPTURES = process.env.CAPTURES_E2E ?? "/tmp/captures-atlas";
const BASE = "http://localhost:3000";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  console.log("=== La fiche d'entretien, dans les Réglages ===");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // Le décor : une fiche vide, quel que soit l'état laissé par une autre suite.
  await pool.query(`delete from prestations_entretien`);

  // **ELLE A QUITTÉ LES RÉGLAGES le 26 août 2026**, à sa demande : *« est-ce
  // qu'on peut la déplacer dans la fiche de chantier, dans la catégorie
  // Paysage ? Et comme ça on ne la voit plus dans la catégorie Réglages. »*
  //
  // Le contrôle vise **l'adresse d'arrivée**, pas le libellé cliqué
  // (`CLAUDE.md` §5 bis) : le mot changera peut-être encore, le chemin non.
  await cas("la rubrique se trouve depuis la fiche de chantier", async () => {
    await page.goto(`${BASE}/paysage/fiche`, { waitUntil: "networkidle" });
    const lien = page.locator('a[href="/paysage/fiche/composer"]');
    assert.ok(
      (await lien.count()) > 0,
      "aucun chemin depuis la fiche de chantier vers l'endroit où elle se compose"
    );
    await lien.first().click();
    await page.waitForURL(/\/paysage\/fiche\/composer/, { timeout: 20_000 });
  });

  await cas("elle n'est PLUS dans les réglages", async () => {
    await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
    const corps = await page.locator("body").innerText();
    assert.ok(
      !/fiche d.entretien/i.test(corps),
      "« Fiche d'entretien » est revenue dans les réglages : elle vit dans Paysage depuis le 26 août 2026"
    );
    await page.goto(`${BASE}/paysage/fiche/composer`, { waitUntil: "networkidle" });
  });

  await cas("une fiche vide PROPOSE le modèle, elle ne le pose pas", async () => {
    // Attendre l'écran lui-même : lire le corps à l'instant où l'adresse
    // change rendrait le contenu de la page PRÉCÉDENTE, et le contrôle
    // accuserait un écran qu'il n'a pas encore vu.
    await page.getByRole("button", { name: /Partir du modèle Atlas/ }).waitFor({ timeout: 20_000 });
    const corps = await page.locator("body").innerText();
    assert.match(corps, /vide/i, "l'écran ne dit pas que la fiche est vide");
    // Le contenu du modèle est montré AVANT d'appuyer : il choisit en sachant.
    assert.match(corps, /Tonte et ébarbage/, "le contenu du modèle n'est pas montré");
    const { rows } = await pool.query(`select count(*)::int as n from prestations_entretien`);
    assert.equal(rows[0].n, 0, "des prestations ont été écrites par le simple fait d'ouvrir l'écran");
  });

  await cas("« Partir du modèle Atlas » pose les prestations, une fois", async () => {
    await page.getByRole("button", { name: /Partir du modèle Atlas/ }).click();
    await page.waitForSelector("[data-prestation]", { timeout: 30_000 });
    const combien = await page.locator("[data-prestation]").count();
    assert.equal(
      combien,
      MODELE_FOURNI.length,
      `${combien} prestations à l'écran, ${MODELE_FOURNI.length} attendues`
    );
    // Les familles sont là, dans l'ordre du métier — pas dans l'alphabet.
    const familles = await page.locator("[data-famille]").evaluateAll((n) =>
      n.map((e) => (e as HTMLInputElement).value)
    );
    assert.deepEqual(familles, ["Pelouse", "Tailles", "Massifs", "Propreté"]);
  });

  // **SA PLACE EST SOUS LE TITRE, EN PREMIER** — sa décision du 26 août 2026 :
  // *« la B, mais il faut que la rubrique se trouve sous le titre en premier, et
  // son titre doré doit être "composer ma fiche" »*.
  //
  // Le contrôle MESURE les positions plutôt que de lire l'ordre du code : c'est
  // ce que son œil voit, et une mise en page peut réordonner ce que le HTML
  // empile. Il refuse de conclure sur une boîte de zéro pixel (`CLAUDE.md` §5,
  // le contrôle qui mesure zéro ne mesure rien).
  await cas("la rubrique est SOUS LE TITRE, avant le jour du passage", async () => {
    await page.goto(`${BASE}/paysage/fiche`, { waitUntil: "networkidle" });
    const rubrique = page.locator('a[href="/paysage/fiche/composer"]').first();
    await rubrique.waitFor({ timeout: 20_000 });

    const boite = await rubrique.boundingBox();
    const jour = await page.getByText("Jour du passage").first().boundingBox();
    assert.ok(boite && boite.height > 0, "la rubrique ne se mesure pas : rien n'est prouvé");
    assert.ok(jour && jour.height > 0, "« Jour du passage » ne se mesure pas : rien n'est prouvé");
    assert.ok(
      boite!.y < jour!.y,
      `la rubrique est passée SOUS le jour du passage (${Math.round(boite!.y)} px contre ${Math.round(jour!.y)} px) — il l'a demandée en premier`
    );

    // Le titre doré, ses mots à lui.
    const titre = page.getByText("Composer ma fiche", { exact: true }).first();
    assert.ok((await titre.count()) > 0, "le titre « Composer ma fiche » a disparu");

    // La cible se touche au pouce, sur un chantier, parfois avec des gants.
    assert.ok(boite!.height >= 44, `la rubrique fait ${Math.round(boite!.height)} px de haut, sous les 44 px du pouce`);

    // **Et on REGARDE.** Quatre défauts réels de ce dépôt sont sortis d'une
    // image et d'aucun test (`CLAUDE.md` §5) : la capture fait partie du
    // travail, pas de la finition.
    mkdirSync(CAPTURES, { recursive: true });
    await page.screenshot({ path: `${CAPTURES}/fiche-chantier-rubrique-en-tete.png` });

    // On revient d'où l'on vient : les cas suivants composent la fiche, et
    // laisser la suite sur un autre écran les ferait tous rougir à la file —
    // sept faux coupables pour un seul oubli de navigation.
    await page.goto(`${BASE}/paysage/fiche/composer`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-prestation]", { timeout: 30_000 });
  });

  await cas("LE RETRAIT SE DÉFAIT — et rien n'est écrit tant qu'on peut annuler", async () => {
    // **Le point le plus coûteux de cet écran.** Une croix nue sur une liste
    // composée à la main est le geste qu'il regretterait le plus.
    const avant = await page.locator("[data-prestation]").count();
    await page.getByRole("button", { name: "Retirer Scarification" }).click();
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator("[data-prestation]").count(),
      avant - 1,
      "la ligne n'a pas disparu de l'écran"
    );
    // Rien en base tant que le tiroir est ouvert : sinon « Annuler » mentirait.
    const pendant = await pool.query(
      `select count(*)::int as n from prestations_entretien where libelle = 'Scarification'`
    );
    assert.equal(pendant.rows[0].n, 1, "la ligne a été supprimée AVANT la fin du délai d'annulation");

    await page.getByRole("button", { name: /Annuler/ }).click();
    await page.waitForTimeout(500);
    assert.equal(
      await page.locator("[data-prestation]").count(),
      avant,
      "« Annuler » n'a pas ramené la ligne"
    );
  });

  await cas("un retrait non annulé finit par s'écrire", async () => {
    await page.getByRole("button", { name: "Retirer Démoussage voirie" }).click();
    // Le tiroir se referme au bout de six secondes (`useRetraits`).
    await page.waitForTimeout(9_000);
    const { rows } = await pool.query(
      `select count(*)::int as n from prestations_entretien where libelle = 'Démoussage voirie'`
    );
    assert.equal(rows[0].n, 0, "la prestation retirée est toujours en base après le délai");
  });

  await cas("une prestation ajoutée se range dans SA famille", async () => {
    await page.reload({ waitUntil: "networkidle" });
    // Le bouton d'ajout de la première famille (Pelouse).
    await page.getByRole("button", { name: "+ Ajouter une prestation" }).first().click();
    await page.getByLabel(/Nouvelle prestation dans Pelouse/).fill("Aération du gazon");
    await page.getByRole("button", { name: /Ajouter à Pelouse/ }).click();
    await page.waitForTimeout(3_000);

    const { rows } = await pool.query(
      `select famille from prestations_entretien where libelle = 'Aération du gazon'`
    );
    assert.equal(rows.length, 1, "la prestation n'a pas été enregistrée");
    assert.equal(rows[0].famille, "Pelouse", "elle a atterri dans la mauvaise famille");
  });

  await cas("un doublon est refusé AVEC UNE PHRASE, jamais avec un code", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "+ Ajouter une prestation" }).first().click();
    await page.getByLabel(/Nouvelle prestation dans Pelouse/).fill("tonte et EBARBAGE");
    await page.getByRole("button", { name: /Ajouter à Pelouse/ }).click();
    await page.waitForTimeout(1_500);

    // `[data-refus]` et non `[role="alert"]` : la barre de développement de
    // Next porte elle aussi ce rôle, et le contrôle accusait alors l'écran.
    const alerte = page.locator("[data-refus]");
    assert.equal(await alerte.count(), 1, "aucun message n'explique le refus");
    const phrase = await alerte.innerText();
    assert.match(phrase, /déjà dans votre fiche/i, `phrase inattendue : « ${phrase} »`);
    // Ce que le patron ne doit JAMAIS lire.
    assert.doesNotMatch(phrase, /doublon|refus|error/i, `« ${phrase} » parle comme un programme`);
  });

  await cas("une famille se CRÉE avec son nom, jamais dans « Divers »", async () => {
    // **Sa remarque du 24 août 2026.** Le bouton promettait une famille et
    // rangeait la ligne dans « Divers », à charge pour lui de renommer le titre
    // juste au-dessus — un second geste que rien n'annonçait.
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "+ Ajouter une famille" }).click();
    await page.getByLabel("Nom de la nouvelle famille").fill("Potager");
    await page.getByLabel(/Première prestation de la nouvelle famille/).fill("Binage des rangs");
    await page.getByRole("button", { name: /Créer la famille/ }).click();
    await page.waitForTimeout(3_000);

    const { rows } = await pool.query(
      `select famille from prestations_entretien where libelle = 'Binage des rangs'`
    );
    assert.equal(rows.length, 1, "la prestation n'a pas été enregistrée");
    assert.equal(
      rows[0].famille,
      "Potager",
      `la famille saisie a été ignorée — la ligne est tombée dans « ${rows[0].famille} »`
    );
  });

  await cas("une famille sans nom se refuse AVEC UNE PHRASE, et ne perd pas la saisie", async () => {
    // Le refus vient du dépôt, pas d'une règle recopiée dans l'écran : c'est
    // `PHRASE_REFUS.famille_vide` qui parle.
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "+ Ajouter une famille" }).click();
    await page.getByLabel(/Première prestation de la nouvelle famille/).fill("Une ligne sans famille");
    await page.getByRole("button", { name: /Créer la famille/ }).click();
    await page.waitForTimeout(1_500);

    const alerte = page.locator("[data-refus]");
    assert.equal(await alerte.count(), 1, "l'écran s'est refermé sans dire pourquoi");
    assert.match(await alerte.innerText(), /famille/i);
    // Et rien n'a été écrit sous un nom inventé.
    const { rows } = await pool.query(
      `select count(*)::int as n from prestations_entretien where libelle = 'Une ligne sans famille'`
    );
    assert.equal(rows[0].n, 0, "une ligne a été rangée dans une famille que personne n'a nommée");
  });

  await cas("UNE FAMILLE SE RETIRE D'UN GESTE — et le retrait se défait", async () => {
    // « En enlever » n'existait pas avant le 24 août 2026 : il fallait retirer
    // les lignes une par une, au pouce, avec des gants.
    await page.reload({ waitUntil: "networkidle" });
    const { rows: avant } = await pool.query(
      `select count(*)::int as n from prestations_entretien where famille = 'Massifs'`
    );
    assert.ok(avant[0].n > 1, "ce cas ne prouverait rien : la famille « Massifs » est déjà vide");

    await page.locator('[data-retirer-famille="Massifs"]').click();
    await page.waitForTimeout(500);
    assert.equal(
      await page.locator('[data-famille="Massifs"]').count(),
      0,
      "la famille est restée à l'écran"
    );

    // Rien en base tant que « Annuler » est là — sa règle du 10 août, la même
    // que pour une ligne seule.
    const pendant = await pool.query(
      `select count(*)::int as n from prestations_entretien where famille = 'Massifs'`
    );
    assert.equal(
      pendant.rows[0].n,
      avant[0].n,
      "la famille a été effacée AVANT la fin du délai d'annulation"
    );

    await page.getByRole("button", { name: /Annuler/ }).click();
    await page.waitForTimeout(500);
    assert.equal(
      await page.locator('[data-famille="Massifs"]').count(),
      1,
      "« Annuler » n'a pas ramené la famille"
    );

    // Et non annulé, il s'écrit : la famille part avec toutes ses prestations.
    await page.locator('[data-retirer-famille="Massifs"]').click();
    await page.waitForTimeout(9_000);
    const apres = await pool.query(
      `select count(*)::int as n from prestations_entretien where famille = 'Massifs'`
    );
    assert.equal(apres.rows[0].n, 0, "la famille retirée est toujours en base après le délai");
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Fiche d'entretien (écran) — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
