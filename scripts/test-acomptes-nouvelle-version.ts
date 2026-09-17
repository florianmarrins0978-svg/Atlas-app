import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import {
  getOuCreerDevisBrouillon,
  getAcomptesDevis,
  poserAcompteSuivant,
  retirerAcompte,
} from "../src/server/repositories/devis";
import type { Ctx } from "../src/server/repositories/context";

/**
 * ─── UNE NOUVELLE VERSION GARDE L'ÉCHÉANCIER QU'IL A POSÉ ───────────────────
 *
 * **Sa panne du 17 septembre 2026, capture à l'appui :** *« ça prend qu'un
 * seul acompte, ça m'a supprimé mes 2 autres et je n'arrive pas à les
 * remettre »*. Son devis portait 30 / 50 / 75 ; rouvert pour correction, il
 * n'en portait plus qu'un — celui des Réglages.
 *
 * **La racine, mesurée avant de corriger :** rouvrir un devis parti crée une
 * NOUVELLE VERSION, et celle-ci reposait l'acompte des Réglages, seul. Les deux
 * autres n'étaient pas « supprimés » par un geste : ils n'étaient jamais
 * recopiés. Le commentaire du dépôt en faisait une décision (*« elle repart des
 * Réglages, comme le taux de TVA et la remise »*) — il l'a corrigée : ce qu'il
 * a posé à la main sur un devis suit sa correction.
 *
 * **Ce qui NE change pas** : un devis tout neuf prend le réglage, d'office ; et
 * un devis dont il a retiré tous les acomptes n'en reprend aucun — recopier
 * « rien » est aussi fidèle que recopier trois lignes.
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

async function creerEntreprise(nom: string, acomptePourcent: string | null) {
  const { rows: e } = await pool.query(
    `INSERT INTO entreprises (nom, acompte_pourcent) VALUES ($1, $2) RETURNING id`,
    [nom, acomptePourcent]
  );
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
    const { rows: ch } = await client.query(
      `INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,$2) RETURNING id`,
      [entrepriseId, `Chantier ${nom}`]
    );
    const chantierId = ch[0].id as string;
    // Le compteur de numéros : sans lui, `attribuerNumeroDevis` ne rend rien et
    // l'erreur accuse le devis au lieu du montage de la suite.
    await client.query(
      `INSERT INTO entreprise_compteurs (entreprise_id, prochain_numero_devis) VALUES ($1, 1)`,
      [entrepriseId]
    );
    await client.query(
      `INSERT INTO lignes_prix (entreprise_id, chantier_id, libelle, quantite, prix_unitaire, montant, ordre)
       VALUES ($1,$2,'Terrasse bois','1','2370.00','2370.00',0)`,
      [entrepriseId, chantierId]
    );
    await client.query("COMMIT");
    return { ctx: { entrepriseId, utilisateurId } as Ctx, chantierId };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

const taux = (acomptes: { tauxCumule: string }[]) => acomptes.map((a) => a.tauxCumule);

/**
 * Le devis part chez le client : la version suivante sera une NOUVELLE version.
 *
 * **Le contexte d'entreprise est POSÉ** : `devis` est sous FORCE RLS, et un
 * `UPDATE` sans contexte touche zéro ligne **sans lever d'erreur**
 * (`CLAUDE.md` invariant 7). La première version de cette suite s'est fait
 * prendre : elle mesurait un devis resté brouillon et concluait « aucune
 * nouvelle version », ce qui accusait le produit à tort.
 */
async function marquerEnvoye(entrepriseId: string, devisId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    const r = await client.query(`UPDATE devis SET statut = 'envoye' WHERE id = $1`, [devisId]);
    assert.equal(r.rowCount, 1, "le devis n'a pas été marqué envoyé : la suite ne mesurerait rien");
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  await nettoyerBase();
  console.log("\n=== Une nouvelle version garde l'échéancier posé ===\n");

  await test("les trois acomptes de son devis SUIVENT la correction", async () => {
    const { ctx, chantierId } = await creerEntreprise("Vidal", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await poserAcompteSuivant(ctx, v1.id);
    await poserAcompteSuivant(ctx, v1.id);
    assert.deepEqual(taux(await getAcomptesDevis(ctx, v1.id)), ["30.00", "50.00", "75.00"]);

    await marquerEnvoye(ctx.entrepriseId, v1.id);
    const v2 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.notEqual(v2.id, v1.id, "aucune nouvelle version n'a été créée : le cas n'est pas éprouvé");
    assert.equal(v2.numeroVersion, 2);
    assert.deepEqual(
      taux(await getAcomptesDevis(ctx, v2.id)),
      ["30.00", "50.00", "75.00"],
      "la version corrigée a perdu les acomptes qu'il avait posés"
    );
  });

  await test("un devis dont il a tout retiré n'en reprend AUCUN", async () => {
    const { ctx, chantierId } = await creerEntreprise("Linotte", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.deepEqual(taux(await getAcomptesDevis(ctx, v1.id)), ["30.00"]);
    await retirerAcompte(ctx, v1.id, 1);
    assert.deepEqual(taux(await getAcomptesDevis(ctx, v1.id)), []);

    await marquerEnvoye(ctx.entrepriseId, v1.id);
    const v2 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.deepEqual(
      taux(await getAcomptesDevis(ctx, v2.id)),
      [],
      "l'acompte des Réglages revient sur une version où il l'avait retiré"
    );
  });

  await test("un refus DIT pourquoi — il ne rend plus un silence", async () => {
    const { ctx, chantierId } = await creerEntreprise("Benali", "30");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    await poserAcompteSuivant(ctx, v1.id);
    await poserAcompteSuivant(ctx, v1.id);
    const quatrieme = await poserAcompteSuivant(ctx, v1.id);
    assert.equal(quatrieme.ok, false, "un quatrième acompte a été posé : il n'y a pas de mot pour lui");
    assert.match(quatrieme.ok ? "" : quatrieme.raison, /Trois acomptes au maximum/);

    await marquerEnvoye(ctx.entrepriseId, v1.id);
    const surUnDevisParti = await poserAcompteSuivant(ctx, v1.id);
    assert.equal(surUnDevisParti.ok, false);
    assert.match(surUnDevisParti.ok ? "" : surUnDevisParti.raison, /parti chez votre client/);
  });

  await test("un devis TOUT NEUF prend le réglage, d'office — inchangé", async () => {
    const { ctx, chantierId } = await creerEntreprise("Chausson", "40");
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.deepEqual(taux(await getAcomptesDevis(ctx, v1.id)), ["40.00"]);
  });

  await test("sans réglage d'acompte, un devis neuf n'en porte aucun — inchangé", async () => {
    const { ctx, chantierId } = await creerEntreprise("Grospiron", null);
    const v1 = await getOuCreerDevisBrouillon(ctx, chantierId);
    assert.deepEqual(taux(await getAcomptesDevis(ctx, v1.id)), []);
  });

  console.log(`\n${failed} échec(s), ${passed} réussi(s).`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
