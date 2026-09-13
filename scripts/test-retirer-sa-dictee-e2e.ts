import assert from "node:assert/strict";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";

/**
 * JETER SA DICTÉE DEPUIS L'ÉCRAN OÙ IL LA FAIT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa décision du 13 septembre 2026 :** *« C'est sur cet écran que je le
 * voulais ! Car en cas de problème on peut supprimer la dictée comme ça. »*
 *
 * **Ce qui manquait n'était pas le geste, c'était l'objet.** Le glissement
 * existait depuis le 7 septembre — sur l'écran Note vocale, où il ne va pas
 * quand sa dictée vient de rater. Pire : le rendu qui le portait dans l'anneau
 * n'était monté par AUCUN écran. Du code écrit, éprouvé, et inatteignable :
 * la faute du 28 août (`CLAUDE.md` §1), retournée.
 *
 * **Cette suite entre par SA porte** (`CLAUDE.md` §5 quater) : elle ouvre la
 * fiche d'un chantier qui porte une note, glisse, et regarde ce qui arrive à la
 * note — en base, pas seulement à l'écran. Un contrôle qui se contenterait de
 * compter les boutons resterait vert le jour où le geste cesse d'aboutir.
 */

const BASE = ADRESSE;

let reussis = 0;
let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Jeter sa dictée, depuis l'écran où il la fait ===\n");

  const { rows } = await pool.query(
    `SELECT c.id
       FROM chantiers c
       JOIN notes_vocales n ON n.chantier_id = c.id
      WHERE c.deleted_at IS NULL
      LIMIT 1`
  );
  const chantierId = rows[0]?.id as string | undefined;
  if (!chantierId) throw new Error("aucun chantier avec une note vocale dans le jeu de démonstration");

  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext({ ...devices["iPhone 13"] })).newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/chantiers/${chantierId}/coordonnees`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const ligne = page.getByText("Votre dictée");
  await cas("la dictée se voit sur la fiche, sous le micro", async () => {
    assert.equal(await ligne.count(), 1, "rien ne dit qu'une dictée est là : il n'a rien à jeter");
    const boite = await ligne.first().boundingBox();
    // Refuser de conclure sur une boîte de zéro pixel (`CLAUDE.md` §5).
    assert.ok(boite && boite.height > 0, "la ligne n'a aucune dimension : mesure impossible");
  });

  await cas("elle GLISSE, et découvre « Retirer »", async () => {
    const rail = page.locator(".atlas-glisse").first();
    assert.ok(await rail.count(), "la ligne ne glisse pas : ce n'est pas le geste qu'il connaît");
    await rail.evaluate((e) => e.scrollBy({ left: 400, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(500);
    assert.equal(
      await page.getByRole("button", { name: /Retirer/i }).count(),
      1,
      "le glissement ne découvre rien : il glisserait sans savoir pourquoi"
    );
  });

  await cas("l'appui la retire, « Annuler » la retient — et la rend intacte", async () => {
    // **UN SEUL CAS, ET C'EST VOULU.** Le tiroir ne dure que six secondes : le
    // découper en deux épreuves laissait la première consommer le délai, et la
    // seconde cherchait un « Annuler » déjà parti — en détruisant pour de bon
    // la note du jeu de démonstration au passage. Ce qui se mesure ici est une
    // seule chose : jeter n'efface rien tant qu'il peut revenir en arrière.
    // On vise le « Retirer » DE LA DICTÉE : la pellicule des photos porte le
    // même libellé, et cliquer sur celui du voisin retirerait une photo.
    const retirerLaDictee = page.getByRole("button", { name: /Retirer/i });
    console.log(`    (« Retirer » sur l'écran : ${await retirerLaDictee.count()})`);
    await retirerLaDictee.last().click();
    // **Le tiroir DE LA DICTÉE**, pas celui de la pellicule : les deux vivent
    // sur cet écran et portent le même mot.
    const annuler = page.locator('[data-atlas="tiroir-de-la-dictee"]').getByRole("button", { name: /Annuler/i });
    await annuler.waitFor({ state: "visible", timeout: 5_000 });

    // **RIEN n'est encore détruit** : c'est tout l'objet du tiroir.
    const pendant = await pool.query(`SELECT count(*)::int AS n FROM notes_vocales WHERE chantier_id = $1`, [
      chantierId,
    ]);
    assert.equal(pendant.rows[0].n, 1, "la note est supprimée avant la fermeture du tiroir : « Annuler » ne rendrait rien");

    await annuler.click();
    await page.waitForTimeout(800);
    assert.equal(await page.getByText("Votre dictée").count(), 1, "la note n'est pas revenue à l'écran");
    const apres = await pool.query(`SELECT count(*)::int AS n FROM notes_vocales WHERE chantier_id = $1`, [chantierId]);
    assert.equal(apres.rows[0].n, 1, "la note a été détruite malgré « Annuler »");
  });

  console.log(
    echecs === 0
      ? `\n✅ Jeter sa dictée — ${reussis} réussi(s), 0 échec.`
      : `\n❌ Jeter sa dictée — ${echecs} échec(s).`
  );
  await navigateur.close();
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
