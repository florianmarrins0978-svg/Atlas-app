// « Travaux à faire », joué à l'écran — le bandeau qui se déplie, et le retour
// qui part chaque soir.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE PEUT VOIR.**
//
// La règle du rappel est éprouvée sans base (`test-retour-intervention.ts`), et
// les retours en base (`test-retour-intervention-db.ts`). Les deux resteraient
// vertes si les lignes du devis s'étalaient de nouveau sur le planning, si le
// bandeau ne s'ouvrait pas, si « Envoyer le retour du jour » se refusait sans
// photo, ou si le second envoi n'apparaissait pas comme un second retour.
//
// **Ses décisions du 19 et du 20 septembre 2026 sont ici, et nulle part
// ailleurs** (`appli/fiche-intervention-sixieme.html`, codée sur son « tu peux
// coder exactement cette planche ») :
//
// · *« un devis de trois pages, ça va faire trop long sur le planning si c'est
//   visible tout le temps »* — les lignes vivent dans le bandeau, fermé ;
// · *« il faut qu'on puisse l'envoyer même si on ne met pas de photo ou si
//   tout n'est pas coché »* — le retour part avec ce qu'il a ;
// · *« un chantier de 8 jours, il faut pouvoir faire plusieurs retours
//   d'intervention jour après jour »* — le second envoi est un second retour ;
// · *« marque quelque chose pour qu'on comprenne que c'est à retrouver dans la
//   catégorie Terminés, dans Retour d'intervention »* — et sans point ;
// · *« le contour de la fiche en doré, celui de l'appli »* — le même or que
//   « une journée », mesuré, pas supposé.

import assert from "node:assert/strict";
import { jourDuPatron } from "./_jour-e2e";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";
import { jpegDeTaille } from "./_images-temoins";

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LIGNE = "[data-atlas='ligne-planifiee']";
const FEUILLE = "[data-atlas='feuille']";
const OUVRIR = "[data-atlas='ouvrir-travaux']";
const COMPTE = "[data-atlas='compte-des-travaux']";
const TACHE = "[data-atlas='tache-du-retour']";
const ENVOYER = "[data-atlas='envoyer-le-retour']";
const ENVOYE = "[data-atlas='retour-envoye']";
const PHOTO_DU_RETOUR = "[data-atlas='photo-du-retour']";

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
  console.log("=== Travaux à faire — le bandeau, et le retour du jour ===\n");

  // Un chantier de la journée, sans retour : c'est l'état du matin. **Avec
  // un devis qui a des lignes** : selon les suites jouées avant, le chantier
  // le plus récent en porte un vide, et il n'y aurait rien à cocher.
  const { rows } = await pool.query<{ id: string; nom: string }>(
    `SELECT c.id, c.nom FROM chantiers c
       JOIN devis d ON d.chantier_id = c.id AND d.statut = 'envoye'
      WHERE c.deleted_at IS NULL AND c.termine_at IS NULL
        AND EXISTS (SELECT 1 FROM lignes_devis l WHERE l.devis_id = d.id)
      ORDER BY c.created_at DESC LIMIT 1`
  );
  assert.ok(rows.length === 1, "aucun chantier avec un devis envoyé dans le jeu de démonstration");
  const chantierId = rows[0].id;
  const chantierNom = rows[0].nom;
  // **LE JOUR DU PATRON, PAS CELUI DE POSTGRESQL** (`_jour-e2e.ts`) : entre
  // minuit et deux heures chez lui, `CURRENT_DATE` est encore la veille.
  await pool.query(`UPDATE chantiers SET date_planifiee = $2 WHERE id = $1`, [
    chantierId,
    jourDuPatron(),
  ]);
  await pool.query(`DELETE FROM retours_intervention WHERE chantier_id = $1`, [chantierId]);
  // **Ce qu'il a photographié en créant la fiche** : vu AVANT le travail.
  await pool.query(`DELETE FROM photos WHERE storage_key LIKE $1`, [`chantiers/${chantierId}/photos/e2e-fiche%`]);
  await pool.query(
    `INSERT INTO photos (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum)
     SELECT c.entreprise_id, c.id, $2, 'image/jpeg', 10, $3 FROM chantiers c WHERE c.id = $1`,
    [chantierId, `chantiers/${chantierId}/photos/e2e-fiche.jpg`, "f".repeat(64)]
  );
  // Le devis envoyé le plus récent — celui que la feuille imprime
  // (`devisÀImprimer`, `repositories/devis.ts`).
  const { rows: lignesDuDevis } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM lignes_devis l
      WHERE l.devis_id = (SELECT id FROM devis WHERE chantier_id = $1 AND statut = 'envoye'
                          ORDER BY numero_version DESC LIMIT 1)`,
    [chantierId]
  );
  const nombreDeLignes = Number(lignesDuDevis[0]?.n ?? 0);
  assert.ok(nombreDeLignes > 0, "le devis du chantier n'a aucune ligne : rien à mesurer");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  async function ouvrirLaFiche() {
    // **SA ligne, pas la première du jour.** D'autres suites posent leurs
    // chantiers sur le même jour ; cliquer la première ligne ouvrait parfois la
    // fiche d'un voisin, et le retour partait sur lui — rouge sans défaut.
    // Sans `?chantier=` : ce paramètre ouvre un tiroir par-dessus la journée,
    // qui intercepte le clic. Le chantier est posé sur AUJOURD'HUI, et c'est
    // là que le planning s'ouvre.
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    const ligne = page.locator(`${LIGNE}:has-text("${chantierNom}")`).first();
    await ligne.waitFor({ state: "visible", timeout: 20_000 });
    await ligne.click();
    await page.locator(FEUILLE).first().waitFor({ state: "visible", timeout: 20_000 });
    await page.locator(OUVRIR).waitFor({ state: "visible", timeout: 20_000 });
  }

  await ouvrirLaFiche();

  await cas("FERMÉ, le bandeau dit COMBIEN et ne montre pas les lignes du devis", async () => {
    const compte = (await page.locator(COMPTE).innerText()).trim();
    assert.match(compte, new RegExp(`^${nombreDeLignes} ligne`), `le compte dit « ${compte} »`);
    assert.equal(await page.locator(TACHE).count(), 0, "les lignes du devis s'étalent sur le planning");
    const texte = await page.locator(FEUILLE).innerText();
    assert.match(texte, /Travaux à faire/);
    assert.doesNotMatch(texte, /Fin de chantier/, "l'ancien nom du bandeau est encore là");
    assert.equal(await page.locator(ENVOYE).count(), 0, "un chantier sans retour s'annonce déjà envoyé");
  });

  await cas("LE CONTOUR DE LA FICHE EST DU MÊME OR QUE « UNE JOURNÉE » — mesuré", async () => {
    // Sa question du 19 au soir : *« j'ai l'impression que c'est pas le même
    // doré que pour "une journée" »*. C'était le même ; un trait fin paraissait
    // plus pâle, d'où les 2 px. On compare les couleurs CALCULÉES, pas les
    // jetons du code.
    const contour = await page.locator(FEUILLE).first().evaluate((e) => {
      const s = getComputedStyle(e);
      return { couleur: s.borderTopColor, largeur: s.borderTopWidth };
    });
    const duree = await page.locator("[data-atlas='duree-planifiee']").first().evaluate((e) => getComputedStyle(e).color);
    assert.equal(contour.largeur, "2px", `le contour fait ${contour.largeur}`);
    assert.equal(contour.couleur, duree, `contour ${contour.couleur}, « une journée » ${duree}`);
  });

  await cas("« Ouvrir le devis sans les prix » est en NOIR, pas ton sur ton avec le contour", async () => {
    const lien = page.locator("[data-atlas='pdf-sans-prix']");
    await lien.waitFor({ state: "visible", timeout: 15_000 });
    assert.equal((await lien.innerText()).trim(), "Ouvrir le devis sans les prix");
    const couleur = await lien.evaluate((e) => getComputedStyle(e).color);
    const contour = await page.locator(FEUILLE).first().evaluate((e) => getComputedStyle(e).borderTopColor);
    assert.notEqual(couleur, contour, `le lien a la couleur du contour (${couleur})`);
  });

  await cas("SES PHOTOS NE SONT PLUS SUR LA FICHE — elles sont dans la fiche de sécurité", async () => {
    // **Sa demande du 22 septembre 2026** : *« pas besoin d'avoir les photos à
    // cet endroit, elles sont déjà présentes dans la fiche de sécurité »*. Ce
    // contrôle réclamait l'inverse depuis le 9 septembre ; on l'adapte, on ne
    // remet pas ce qu'il a fait retirer (`CLAUDE.md` §5 bis).
    //
    // **Et l'on vérifie que ce qui les remplace est bien là** : constater une
    // absence ne prouverait rien si la rangée avait simplement déménagé nulle
    // part. La fiche de sécurité, elle, lit les MÊMES photos du chantier.
    await page.locator(FEUILLE).first().waitFor({ state: "visible", timeout: 15_000 });
    assert.equal(
      await page.locator("[data-atlas='photo-du-chantier']").count(),
      0,
      "la rangée des photos est revenue au-dessus de la fiche de sécurité"
    );
    assert.ok(
      await page.locator("[data-atlas='fiche-de-securite']").first().isVisible(),
      "la porte de la fiche de sécurité n'est pas sur la feuille : les photos ne sont plus nulle part"
    );
  });

  await cas("OUVERT, les lignes du devis sont les cases — autant que le devis en porte", async () => {
    await page.locator(OUVRIR).click();
    await page.locator(TACHE).first().waitFor({ state: "visible", timeout: 20_000 });
    assert.equal(await page.locator(TACHE).count(), nombreDeLignes);
    assert.ok(await page.locator("[data-atlas='ajouter-photo-retour']").isVisible(), "pas de « + » pour une photo");
    assert.ok(await page.locator(ENVOYER).isEnabled(), "« Envoyer le retour du jour » est refusé alors que rien n'est exigé");
  });

  await cas("LE RETOUR PART SANS PHOTO ET SANS RIEN COCHER, et dit OÙ le retrouver", async () => {
    await page.locator(ENVOYER).click();
    await page.locator(ENVOYE).waitFor({ state: "visible", timeout: 25_000 });
    const dit = (await page.locator(ENVOYE).innerText()).replace(/\n/g, " ");
    assert.match(dit, /Retour du jour envoyé/);
    assert.match(dit, /Terminés, Retour d'intervention/, "le bloc ne dit pas où le retrouver");
    assert.doesNotMatch(dit, /·/, "le point qu'il refuse est revenu");
    const { rows: r } = await pool.query(`SELECT count(*)::int AS n FROM retours_intervention WHERE chantier_id = $1`, [chantierId]);
    assert.equal(Number(r[0].n), 1, "le retour n'est pas en base");
  });

  await cas("LE LENDEMAIN : le bandeau se rouvre, une case cochée, un SECOND retour part", async () => {
    await page.locator(OUVRIR).click();
    await page.locator(TACHE).first().waitFor({ state: "visible", timeout: 20_000 });
    await page.locator(TACHE).first().click();
    // **Le compte se relit une fois la case PEINTE cochée**, jamais dans le
    // même souffle que le clic : on mesure l'écran, pas l'intention.
    await page.waitForFunction(
      (s) => document.querySelector(s)?.getAttribute("aria-pressed") === "true",
      TACHE,
      { timeout: 10_000 }
    );
    const compte = (await page.locator(COMPTE).innerText()).trim();
    // Un devis d'une seule ligne cochée, c'est « tout est fait » — le jeu de
    // démonstration en porte selon les suites jouées avant celle-ci.
    const attendu = nombreDeLignes === 1 ? /^tout est fait$/ : /^1 sur \d+ fait$/;
    assert.match(compte, attendu, `le compte dit « ${compte} » et non ${attendu}`);
    await page.locator(ENVOYER).click();
    await page.waitForFunction(
      (s) => /2 retours envoyés/.test(document.querySelector(s)?.textContent ?? ""),
      ENVOYE,
      { timeout: 25_000 }
    );
    const { rows: r } = await pool.query(
      `SELECT count(*)::int AS n FROM retours_intervention WHERE chantier_id = $1`,
      [chantierId]
    );
    assert.equal(Number(r[0].n), 2, "le second envoi a écrasé le premier au lieu d'en créer un second");
  });

  await cas("APRÈS RECHARGEMENT : les deux retours se lisent, et la case cochée hier l'est encore", async () => {
    await ouvrirLaFiche();
    await page.locator(ENVOYE).waitFor({ state: "visible", timeout: 20_000 });
    assert.match((await page.locator(ENVOYE).innerText()).replace(/\n/g, " "), /2 retours envoyés/);
    await page.locator(OUVRIR).click();
    await page.locator(TACHE).first().waitFor({ state: "visible", timeout: 20_000 });
    assert.equal(
      await page.locator(TACHE).first().getAttribute("aria-pressed"),
      "true",
      "la case cochée hier est revenue vide : il devrait tout recocher le soir 3"
    );
  });

  // ─── PLUSIEURS PHOTOS D'UN COUP — sa demande du 20 septembre 2026 ──────────
  //
  // *« J'ouvre la photothèque et j'en sélectionne plusieurs »*, avec un
  // plafond. Le sélecteur est celui du téléphone ; ce qui se mesure ici, c'est
  // ce qui en sort : autant de vignettes que de photos choisies, toutes
  // cochées, et le compte sous le plafond du retour.
  await cas("TROIS PHOTOS CHOISIES D'UN COUP arrivent toutes, cochées, et le compte dit « 3/10 »", async () => {
    const avant = await page.locator(PHOTO_DU_RETOUR).count();
    await page.locator("[data-atlas='travaux-a-faire'] input[type=file]").setInputFiles(
      [1, 2, 3].map((n) => ({ name: `photo-${n}.jpg`, mimeType: "image/jpeg", buffer: Buffer.from(jpegDeTaille(2048)) }))
    );
    await page.waitForFunction(
      ([s, n]) => document.querySelectorAll(s).length === n,
      [PHOTO_DU_RETOUR, avant + 3] as [string, number],
      { timeout: 30_000 }
    );
    const cochees = await page.locator(`${PHOTO_DU_RETOUR}[aria-pressed='true']`).count();
    assert.equal(cochees, 3, `${cochees} photo(s) cochée(s) sur les trois ajoutées`);
    assert.equal((await page.locator("[data-atlas='compte-photos-retour']").innerText()).trim(), "3/10");
  });

  // ─── LE RETOUR ENVOYÉ SE MODIFIE — sa demande du 25 septembre 2026 ────────
  //
  // *« Juste en recliquant sur le bouton 1 retour envoyé, ça rouvre la même
  // rubrique, je modifie, je renvoie, et ça modifie le retour envoyé, ça n'en
  // envoie pas un deuxième ! »*
  await cas("UN APPUI SUR « 2 retours envoyés » ROUVRE LE DERNIER, et le renvoyer le RÉÉCRIT", async () => {
    await page.locator(ENVOYE).click();
    await page.locator(ENVOYER).waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForFunction((s) => document.querySelector(s)?.textContent === "Renvoyer le retour", ENVOYER, {
      timeout: 10_000,
    });
    await page.locator("[data-atlas='a-signaler']").fill("portail à reprendre");
    await page.locator(ENVOYER).click();
    await page.waitForFunction(
      (s) => document.querySelector(s)?.getAttribute("aria-expanded") === "false",
      ENVOYE,
      { timeout: 25_000 }
    );
    const { rows: r } = await pool.query(
      `SELECT a_signaler FROM retours_intervention WHERE chantier_id = $1 ORDER BY pose_le DESC`,
      [chantierId]
    );
    assert.equal(r.length, 2, `${r.length} retours en base : la modification en a envoyé un de plus`);
    assert.equal(r[0].a_signaler, "portail à reprendre", "le dernier retour n'a pas été réécrit");
    assert.match((await page.locator(ENVOYE).innerText()).replace(/\n/g, " "), /2 retours envoyés/);

    // Rouvert, il montre ce qui est parti, pas un écran vierge.
    await page.locator(ENVOYE).click();
    await page.waitForFunction(
      (s) => (document.querySelector(s) as HTMLTextAreaElement | null)?.value === "portail à reprendre",
      "[data-atlas='a-signaler']",
      { timeout: 10_000 }
    );
  });

  await pool.end();
  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Travaux à faire — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
