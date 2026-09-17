import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerSonCompte } from "../src/server/repositories/creation-compte";
import { documentsAAccepter, enregistrerAcceptations } from "../src/server/repositories/documents-legaux";
import { ADRESSE } from "./_adresse";

// ═══════════════════════════════════════════════════════════════════════════
// L'ACCUEIL SANS AUCUN CHANTIER : LA PORTE DU DEVIS DESCEND AUX DEUX TIERS
// ═══════════════════════════════════════════════════════════════════════════
//
// **Sa demande du 10 septembre 2026**, sur la planche qu'il a retenue
// (`appli/facturer-sans-devis.html`) : *« liste vide : les deux gestes
// descendent · liste pleine : ils remontent, et "créer un devis" retrouve
// exactement la place qu'il a aujourd'hui »*. Puis, le 16 septembre, capture à
// l'appui, la mesure : *« lorsqu'il n'y a pas de chantier, le créer le devis
// doit se trouver au 2/3 haut du téléphone »*.
//
// **Pourquoi une suite plutôt qu'une relecture.** Une place ne se lit pas dans
// le code : elle se MESURE à l'écran. Le bloc n'a pas bougé de place dans le
// marquage — ce sont deux ressorts qui le poussent —, donc un `grep` ne dirait
// rien, et c'est exactement la faute du 14 septembre (`CLAUDE.md` §10).
//
// **Un compte NEUF, jamais le compte de démonstration vidé.** Vider les
// chantiers de la démonstration ferait rougir les suites suivantes, qui
// travaillent sur ce que les précédentes laissent (`run-e2e-tests.ts`). Ce
// compte-ci naît sans chantier — c'est l'état de son écran à lui — et il est
// effacé à la fin.
//
// **Sait échouer** : joué sur l'écran d'avant ce lot, il rend la porte à 0,25
// de la hauteur et rougit en le disant.
// ═══════════════════════════════════════════════════════════════════════════

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;
const MOT_DE_PASSE = "trois-mots-tres-courts";

/** Les deux tiers, et ce qu'on tolère autour. La place se règle par des
 *  ressorts, pas au pixel : la marge absorbe une police un peu plus haute ou
 *  un bandeau d'essai, elle n'absorbe pas un retour au quart de l'écran. */
const CIBLE = 2 / 3;
const MARGE = 0.05;

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

/** Le centre de l'anneau, en fraction de la hauteur du téléphone. */
async function placeDeLaPorte(page: import("playwright").Page): Promise<number> {
  const anneau = page.locator('[data-atlas="nouveau-chantier"] .atlas-rond');
  await anneau.waitFor({ state: "visible", timeout: 30_000 });
  const boite = await anneau.boundingBox();
  const vue = page.viewportSize();
  // Une boîte de zéro pixel n'est pas une mesure : la rendre verte est le
  // défaut du 15 août 2026 (`CLAUDE.md` §5).
  assert.ok(boite && boite.height > 1, "l'anneau ne se mesure pas : rien n'a été éprouvé");
  assert.ok(vue && vue.height > 1, "la fenêtre n'a pas de hauteur : rien n'a été éprouvé");
  return (boite.y + boite.height / 2) / vue.height;
}

async function main() {
  console.log("=== L'accueil sans chantier : la porte descend ===\n");

  const email = `accueil-vide-${Date.now()}@essai.local`;
  const compte = await creerSonCompte({
    civilite: "mr",
    prenom: "Lucien",
    nom: "Vidal",
    email,
    motDePasse: MOT_DE_PASSE,
    entreprise: "Jardins Vidal",
    forme: "EI",
    tva: "franchise",
  });
  assert.ok(compte.ok, `le compte d'essai n'a pas pu être créé : ${compte.ok ? "" : compte.refus}`);

  // Un compte neuf est renvoyé aux conditions générales tant qu'il ne les a
  // pas acceptées : sans cela cette suite mesurerait l'écran des documents.
  const aAccepter = await documentsAAccepter(compte.utilisateurId);
  if (aAccepter.length > 0) {
    await enregistrerAcceptations(
      compte.utilisateurId,
      aAccepter.map((d) => d.id),
      { adresseIp: "127.0.0.1", agentUtilisateur: "suite d'essai" }
    );
  }

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  try {
    await cas("un compte sans chantier arrive bien sur l'accueil vide", async () => {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', MOT_DE_PASSE);
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const compteur = page.locator('[data-atlas="compteur"]');
      await compteur.waitFor({ state: "visible", timeout: 30_000 });
      assert.equal(await compteur.getAttribute("data-compte"), "0", "ce compte porte des chantiers");
      assert.equal(await page.locator(".atlas-ligne").count(), 0, "des lignes de chantier s'affichent");
    });

    await cas("la porte du devis se pose aux deux tiers de la hauteur", async () => {
      const place = await placeDeLaPorte(page);
      // La mesure se DIT, verte ou rouge : un contrôle qui ne rend que « ✓ »
      // ne permet pas de voir la place dériver d'un lot à l'autre.
      console.log(`    porte mesurée à ${(place * 100).toFixed(1)} % de la hauteur`);
      assert.ok(
        Math.abs(place - CIBLE) <= MARGE,
        `la porte est à ${(place * 100).toFixed(1)} % de la hauteur, ` +
          `il la veut à ${(CIBLE * 100).toFixed(0)} % (± ${(MARGE * 100).toFixed(0)}) — ` +
          `sa demande du 16 septembre 2026`
      );
    });

    await cas("« En cours 0 » reste SOUS la porte, comme sur sa planche", async () => {
      const porte = await page.locator('[data-atlas="nouveau-chantier"]').boundingBox();
      const compteur = await page.locator('[data-atlas="compteur"]').boundingBox();
      assert.ok(porte && compteur, "l'un des deux ne se mesure pas : rien n'a été éprouvé");
      assert.ok(
        compteur.y > porte.y + porte.height - 1,
        `« En cours » est passé au-dessus de la porte (porte ${Math.round(porte.y)} px, ` +
          `compteur ${Math.round(compteur.y)} px)`
      );
    });

    // **L'autre moitié de sa phrase, et elle compte autant.** *« Liste pleine :
    // ils remontent, et "créer un devis" retrouve exactement la place qu'il a
    // aujourd'hui. »* Une descente qui vaudrait aussi avec des chantiers
    // coûterait deux lignes de son fil sur l'écran qu'il ouvre vingt fois par
    // jour.
    await cas("avec des chantiers, la porte retrouve sa place, en haut", async () => {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.fill('input[name="email"]', "demo@atlas.local");
      await page.fill('input[name="password"]', process.env.ATLAS_MDP_DEMO?.trim() || "demo1234");
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const compteur = page.locator('[data-atlas="compteur"]');
      await compteur.waitFor({ state: "visible", timeout: 30_000 });
      const lignes = await page.locator(".atlas-ligne").count();
      assert.ok(lignes > 0, "le jeu de démonstration n'a aucun chantier : rien n'a été éprouvé");
      const place = await placeDeLaPorte(page);
      console.log(`    porte mesurée à ${(place * 100).toFixed(1)} % de la hauteur`);
      assert.ok(
        place < 0.45,
        `avec ${lignes} chantiers, la porte est descendue à ${(place * 100).toFixed(1)} % ` +
          `de la hauteur : elle doit rester en haut`
      );
    });
  } finally {
    await navigateur.close();
    // Le compte d'essai s'en va avec son entreprise : le laisser ferait grossir
    // la base d'une entreprise fantôme à chaque batterie.
    await pool.query(`DELETE FROM entreprises WHERE id = $1`, [compte.ok ? compte.entrepriseId : null]);
    await pool.query(`DELETE FROM users WHERE email = $1`, [email]);
    await pool.end();
  }

  console.log("");
  console.log(`L'accueil sans chantier — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
