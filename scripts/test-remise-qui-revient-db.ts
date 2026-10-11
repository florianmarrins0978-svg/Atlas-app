import assert from "node:assert";
import { pool } from "../src/server/db/client";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, mettreAJourEnTeteDevis } from "../src/server/repositories/devis";
import { nettoyerBase } from "./_test-db";

/**
 * UNE REMISE RETIRÉE NE REVIENT PAS TOUTE SEULE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le défaut, mesuré à la sonde le 13 septembre 2026, une fois sur deux.**
 *
 * Le patron vide la case « Prix accordé au client ». Le serveur enregistre le
 * retrait et rend la ligne sans remise — et, dans la seconde qui suit, la base
 * repasse à 15 %. Rien ne le dit. Il l'apprend en rouvrant son devis, ou sur
 * celui parti chez le client, plus cher que ce qu'il avait promis.
 *
 * **Deux chemins écrivent la même ligne, et un seul prenait le verrou :**
 *
 * | | |
 * |---|---|
 * | `getOuCreerDevisBrouillon` | régénère le devis à l'ouverture de l'écran, et réécrit ses totaux — **réduction comprise** (`calculerTotaux` la rend, le `.set` l'écrit). Prenait `pg_advisory_xact_lock(chantier)` |
 * | `mettreAJourEnTeteDevis` | enregistre le taux, les conditions, le prix accordé. **Ne prenait aucun verrou** |
 *
 * Les deux lisaient donc la ligne, la modifiaient chacune de son côté, et la
 * dernière à écrire gagnait. La régénération lisait les 15 % AVANT
 * l'effacement et les réécrivait APRÈS : la perte de mise à jour d'école, sur
 * un chiffre qui décide de ce que le client paie.
 *
 * **Un verrou qu'un seul des deux prend ne protège rien.**
 *
 * ─── CE QUE CE CONTRÔLE FAIT, ET POURQUOI PAS AU NAVIGATEUR ─────────────────
 *
 * La suite navigateur (`test-reduction-devis-e2e`) l'attrapait une fois sur
 * deux : elle dépend du moment où l'écran se rafraîchit. Trois sessions ont
 * conclu « elle est capricieuse » plutôt que « le produit perd une écriture ».
 *
 * Ici, les deux chemins partent **en même temps**, sans navigateur et sans
 * hasard : c'est la course elle-même qu'on joue. Retire le verrou de
 * `mettreAJourEnTeteDevis`, et ce contrôle rougit.
 */

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function creerEntrepriseComplete(nom: string) {
  const { rows: e } = await pool.query(`INSERT INTO entreprises (nom) VALUES ($1) RETURNING id`, [nom]);
  const entrepriseId = e[0].id as string;
  const { rows: u } = await pool.query(`INSERT INTO users (email, nom) VALUES ($1,$2) RETURNING id`, [
    `${nom.toLowerCase().replace(/\s/g, "-")}@test.local`,
    nom,
  ]);
  const utilisateurId = u[0].id as string;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      `INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1,$2,'proprietaire')`,
      [entrepriseId, utilisateurId]
    );
    // Sans compteur, aucun numéro de devis ne s'attribue — et l'erreur accuse
    // alors le devis plutôt que la fixture (`AGENTS.md`, « désigner le bon
    // coupable »).
    await client.query(`INSERT INTO entreprise_compteurs (entreprise_id) VALUES ($1)`, [entrepriseId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  return { entrepriseId, utilisateurId };
}

async function creerChantier(ctx: { entrepriseId: string }, nom: string): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query(`SELECT set_config('app.entreprise_id', $1, false)`, [ctx.entrepriseId]);
    const { rows } = await client.query(`INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,$2) RETURNING id`, [
      ctx.entrepriseId,
      nom,
    ]);
    return rows[0].id as string;
  } finally {
    client.release();
  }
}

/**
 * Ce que la base porte VRAIMENT — pas ce que l'écran croit.
 *
 * **Le contexte d'entreprise se pose ICI, sur la connexion qu'on prend.** Sans
 * lui, `atlas_app` ne voit rien et la RLS rend zéro ligne *silencieusement*
 * (`CLAUDE.md` §3) : le contrôle accuserait alors le devis d'avoir disparu.
 */
async function remiseEnBase(entrepriseId: string, chantierId: string) {
  const connexion = await pool.connect();
  try {
    await connexion.query(`SELECT set_config('app.entreprise_id', $1, false)`, [entrepriseId]);
    const { rows } = await connexion.query(
      `SELECT reduction_pourcent, total_ht FROM devis WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`,
      [chantierId]
    );
    assert.ok(rows[0], "aucun devis pour ce chantier : la mesure est impossible, pas réussie");
    return rows[0] as { reduction_pourcent: string | null; total_ht: string };
  } finally {
    connexion.release();
  }
}

async function main() {
  await nettoyerBase();
  const A = await creerEntrepriseComplete("Remise A");

  await test("le retrait du prix accordé tient, même si l'écran se régénère en même temps", async () => {
    const chantier = await creerChantier(A, "Jardin des Tilleuls");
    await ajouterLignePrix(A, chantier, "Abattage d'un tilleul", "870.00");
    const devis = await getOuCreerDevisBrouillon(A, chantier);
    assert.ok(devis, "aucun devis brouillon");

    // 15 % accordés, et la base le porte.
    await mettreAJourEnTeteDevis(A, devis!.id, { reductionPourcent: "15" });
    assert.equal((await remiseEnBase(A.entrepriseId, chantier)).reduction_pourcent, "15.00");

    // **LA COURSE, jouée dix fois.** Le patron vide la case pendant que son
    // écran se régénère. Sans verrou commun, la régénération — qui a lu les
    // 15 % — les réécrit après le retrait.
    for (let essai = 0; essai < 10; essai++) {
      await mettreAJourEnTeteDevis(A, devis!.id, { reductionPourcent: "15" });
      await Promise.all([
        mettreAJourEnTeteDevis(A, devis!.id, { reductionPourcent: null }),
        getOuCreerDevisBrouillon(A, chantier),
      ]);
      const apres = await remiseEnBase(A.entrepriseId, chantier);
      assert.equal(
        apres.reduction_pourcent,
        null,
        `essai ${essai + 1} : la remise est revenue toute seule (${apres.reduction_pourcent} %) — ` +
          "le devis du client est plus cher que ce qui lui a été promis"
      );
      // Et le total suit : une remise fantôme qui ne changerait que le
      // pourcentage laisserait un total faux, ce qui est pire.
      assert.equal(apres.total_ht, "870.00", `essai ${essai + 1} : le total garde une remise retirée`);
    }
  });

  await test("et le sens inverse tient aussi : une remise POSÉE ne s'efface pas", async () => {
    // La même course, dans l'autre sens. Sans elle, on croirait le verrou bon
    // alors qu'il ne protège qu'un seul geste.
    const chantier = await creerChantier(A, "Haie du Presbytère");
    await ajouterLignePrix(A, chantier, "Taille de haie", "1000.00");
    const devis = await getOuCreerDevisBrouillon(A, chantier);

    for (let essai = 0; essai < 10; essai++) {
      await mettreAJourEnTeteDevis(A, devis!.id, { reductionPourcent: null });
      await Promise.all([
        mettreAJourEnTeteDevis(A, devis!.id, { reductionPourcent: "10" }),
        getOuCreerDevisBrouillon(A, chantier),
      ]);
      const apres = await remiseEnBase(A.entrepriseId, chantier);
      assert.equal(
        apres.reduction_pourcent,
        "10.00",
        `essai ${essai + 1} : la remise accordée a disparu — le client paie le prix plein`
      );
      assert.equal(apres.total_ht, "900.00", `essai ${essai + 1} : le total ignore la remise accordée`);
    }
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
