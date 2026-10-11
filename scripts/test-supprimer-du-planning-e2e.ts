import assert from "node:assert/strict";
import { Pool } from "pg";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ouvrirLeTiroirDuPlanning } from "./_tiroir-planning-e2e";
import { MOIS_A_L_ECRAN } from "./_calendrier-e2e";
import { ADRESSE } from "./_adresse";

// ─────────────────────────────────────────────────────────────────────────────
// **UN DEVIS ACCEPTÉ PAR ERREUR SE SUPPRIME DU PLANNING — sa demande du
// 7 octobre 2026, et la B de `appli/supprimer-du-planning.html`.**
//
// *« Si un client valide un devis sans faire exprès [...] qu'on puisse les
// supprimer. Avec une protection, ce n'est pas un clic qu'on supprime. Il faut
// un clic, une mesure de sécurité, puis on supprime. »*
//
// La B : « Supprimer » à côté de « Déplacer » et « Retirer » sur la fiche du
// jour ; une question avant ; puis six secondes pour annuler. La même question
// devant « Retirer » dans « Sans date ».
//
// **LE DÉFAUT QUI A OUVERT CE LOT, mesuré au navigateur le 7 octobre 2026** :
// retirer le SEUL client de « Sans date » démontait le tiroir du bas, et
// « Annuler » avec lui. L'écriture partait quand même six secondes plus tard.
// C'est exactement son cas : un seul client accepté par erreur, et aucun
// moyen de revenir en arrière. Le premier cas de cette suite le rejoue, et il
// rougit sans le correctif.
//
// **Elle passe par SON chemin** (`CLAUDE.md` §5 quater) — le calendrier, la
// fiche du jour, le tiroir — et **interroge la base** : un écran qui n'affiche
// plus rien parce que la suppression est perdue serait vert ici, et faux.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
  }
}

const QUESTION = '[data-atlas="question-suppression"]';
const ANNULER_LE_RETRAIT = /^Annuler le retrait de /;

/** Un chantier dont le devis est parti : c'est ce qui a sa place au planning. */
async function chantierAuPlanning(page: Page, prefixe: string): Promise<{ id: string; nom: string }> {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `${prefixe} ${Date.now()}`);
  const id = await creerPuisFiche(page);
  // Le devis parti sans passer par l'envoi réel : ce que la suite éprouve est
  // la suppression, et un envoi enverrait pour de bon un lien à un client.
  await pool.query(
    "update chantiers set devis_genere_at = now(), devis_envoye_at = now() where id = $1",
    [id]
  );
  const { rows } = await pool.query("select nom from chantiers where id = $1", [id]);
  const nom = rows[0]?.nom as string | undefined;
  assert.ok(nom, `Le chantier créé n'a pas de nom : rien à chercher à l'écran (${id}).`);
  return { id, nom };
}

/** Le prochain jour ouvré après demain : il est au calendrier, et pas dans le passé. */
function jourOuvre(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Ce que la page du client écrit quand il accepte : la date, et ses deux
 * demi-journées. Posé en base parce que l'acceptation a sa propre suite
 * (`test-devis-client-e2e`) ; ici, c'est ce qu'il en reste au planning.
 */
async function poserSurLeJour(id: string, jour: string) {
  await pool.query(
    "update chantiers set date_planifiee = $2, creneau_debut = 'matin', duree_demi_journees = 2 where id = $1",
    [id, jour]
  );
  await pool.query(
    `insert into creneaux_chantier (entreprise_id, chantier_id, jour, demi)
     select entreprise_id, id, $2::date, d from chantiers, unnest(array['matin','apres_midi']) d where id = $1`,
    [id, jour]
  );
}

async function ouvrirLeJour(page: Page, jour: string) {
  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 30_000 });
  const caseDuJour = page.locator(`${MOIS_A_L_ECRAN} [data-jour="${jour}"]`);
  for (let essai = 0; essai < 3 && (await caseDuJour.count()) === 0; essai++) {
    await page.getByRole("button", { name: "Mois suivant" }).click();
    await page.waitForTimeout(400);
  }
  assert.ok(await caseDuJour.count(), `Le calendrier n'atteint pas le ${jour}.`);
  await caseDuJour.first().click();
  await page.waitForTimeout(600);
}

function blocDuChantier(page: Page, id: string) {
  return page.locator(`[data-atlas="bloc-chantier"][data-chantier="${id}"]`);
}

async function supprime(id: string): Promise<boolean> {
  const { rows } = await pool.query("select deleted_at from chantiers where id = $1", [id]);
  return rows[0]?.deleted_at != null;
}

/** Glisse la ligne de « Sans date », puis touche le « Retirer » qui se découvre. */
async function retirerDeSansDate(page: Page, nom: string) {
  const tiroir = await ouvrirLeTiroirDuPlanning(page);
  assert.ok(tiroir, "Le tiroir du planning ne s'ouvre pas : le geste n'est pas atteignable.");
  const bouton = page.getByRole("button", { name: `Retirer le chantier ${nom}` });
  assert.equal(await bouton.count(), 1, `« Sans date » ne porte pas « ${nom} ».`);
  const ligne = page.locator(".atlas-glisse").filter({ hasText: nom }).first();
  await ligne.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: "instant" as ScrollBehavior }));
  await page.waitForTimeout(400);
  await bouton.click();
  await page.waitForTimeout(300);
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ hasTouch: true });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  const aRendre: string[] = [];
  const jour = jourOuvre();

  // ── 1. Sur la fiche du jour : la question, puis le retrait ─────────────
  const accepte = await chantierAuPlanning(page, "Accepte");
  await poserSurLeJour(accepte.id, jour);
  await ouvrirLeJour(page, jour);

  await cas("« Supprimer » est sur la fiche du jour, à côté de « Retirer »", async () => {
    const actes = blocDuChantier(page, accepte.id).locator('[data-atlas="actes-chantier"]');
    assert.equal(await actes.locator('[data-atlas="retirer"]').count(), 1, "« Retirer » a quitté la fiche du jour.");
    assert.equal(
      await actes.locator('[data-atlas="supprimer"]').count(),
      1,
      "La fiche du jour ne propose pas « Supprimer » : il faut encore deux gestes pour enlever un client accepté par erreur."
    );
  });

  await cas("un appui ne supprime rien : il pose la question", async () => {
    await blocDuChantier(page, accepte.id).locator('[data-atlas="supprimer"]').click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator(QUESTION).count(), 1, "Aucune question avant de supprimer.");
    assert.equal(await blocDuChantier(page, accepte.id).count(), 1, "Le chantier a quitté la fiche avant la réponse.");
    await page.locator(QUESTION).getByRole("button", { name: "Annuler" }).click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator(QUESTION).count(), 0, "« Annuler » ne referme pas la question.");
    assert.equal(await blocDuChantier(page, accepte.id).count(), 1, "Renoncer a quand même retiré le chantier.");
    assert.equal(await supprime(accepte.id), false, "Renoncer a quand même écrit la suppression.");
  });

  await cas("« Supprimer » confirmé : il quitte le jour, et « Annuler » reste six secondes", async () => {
    await blocDuChantier(page, accepte.id).locator('[data-atlas="supprimer"]').click();
    await page.locator(QUESTION).locator('[data-atlas="confirmer-suppression"]').click();
    await page.waitForTimeout(500);
    assert.equal(await blocDuChantier(page, accepte.id).count(), 0, "Le chantier est encore sur la fiche du jour.");
    const annuler = page.getByRole("button", { name: ANNULER_LE_RETRAIT });
    assert.equal(await annuler.count(), 1, "Aucun « Annuler » après la suppression.");
    assert.ok(await annuler.isVisible(), "« Annuler » existe mais ne se voit pas : le tiroir du bas est resté fermé.");
    await page.waitForTimeout(7_500);
    assert.equal(await supprime(accepte.id), true, "Six secondes plus tard, la base ne l'a pas supprimé.");
  });

  // ── 2. « Annuler » rend le chantier, et rien n'est écrit ───────────────
  const regrette = await chantierAuPlanning(page, "Regrette");
  await poserSurLeJour(regrette.id, jour);
  aRendre.push(regrette.id);
  await ouvrirLeJour(page, jour);

  await cas("« Annuler » le rend à son jour, et la base n'a rien supprimé", async () => {
    await blocDuChantier(page, regrette.id).locator('[data-atlas="supprimer"]').click();
    await page.locator(QUESTION).locator('[data-atlas="confirmer-suppression"]').click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: ANNULER_LE_RETRAIT }).click();
    await page.waitForTimeout(500);
    assert.equal(await blocDuChantier(page, regrette.id).count(), 1, "« Annuler » n'a pas rendu le chantier à son jour.");
    await page.waitForTimeout(7_000);
    assert.equal(await supprime(regrette.id), false, "Un retrait annulé a quand même été écrit en base.");
  });

  // ── 3. Le SEUL client de « Sans date » : « Annuler » ne part pas avec lui ─
  //
  // **Le défaut du 7 octobre 2026.** Pour le rejouer, il faut que rien d'autre
  // ne tienne le tiroir ouvert : les autres chantiers de la démonstration sont
  // mis de côté le temps du cas, puis rendus tels quels.
  const seul = await chantierAuPlanning(page, "Seul");
  const { rows: autres } = await pool.query(
    `update chantiers set deleted_at = now()
       where entreprise_id = (select entreprise_id from chantiers where id = $1)
         and id <> $1 and deleted_at is null
     returning id`,
    [seul.id]
  );
  try {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 30_000 });

    await cas("« Retirer » dans « Sans date » pose la même question", async () => {
      await retirerDeSansDate(page, seul.nom);
      assert.equal(await page.locator(QUESTION).count(), 1, "« Retirer » a supprimé sans rien demander.");
      await page.locator(QUESTION).locator('[data-atlas="confirmer-suppression"]').click();
      await page.waitForTimeout(500);
    });

    await cas("retirer le seul client sans date laisse « Annuler » à l'écran", async () => {
      const annuler = page.getByRole("button", { name: ANNULER_LE_RETRAIT });
      assert.equal(
        await annuler.count(),
        1,
        "Le seul client sans date retiré, le tiroir s'est démonté et « Annuler » avec lui : la suppression part sans retour."
      );
      assert.ok(await annuler.isVisible(), "« Annuler » existe mais ne se voit pas.");
      await annuler.click();
      await page.waitForTimeout(7_000);
      assert.equal(await supprime(seul.id), false, "« Annuler » touché, la base a quand même supprimé.");
    });
  } finally {
    // **On rend la base comme on l'a trouvée** : les suites se suivent sur la
    // même démonstration (`run-e2e-tests.ts`).
    await pool.query("update chantiers set deleted_at = null where id = any($1::uuid[])", [
      autres.map((r) => r.id as string),
    ]);
    aRendre.push(seul.id);
    await pool.query("update chantiers set deleted_at = now() where id = any($1::uuid[])", [aRendre]);
  }

  await navigateur.close();
  await pool.end();

  if (echecs > 0) {
    console.error(`\n${echecs} cas en échec.`);
    process.exit(1);
  }
  console.log("\nSupprimer du planning : la question, puis six secondes pour annuler.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
