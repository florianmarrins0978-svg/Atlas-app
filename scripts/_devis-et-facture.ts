import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { lignesFacture } from "../src/server/db/schema";
import { complementsDeLaFacture, donneesFacture } from "../src/server/repositories/factures";
import { composerFacturePdf } from "../src/server/pdf/facture-pdf";
import type { Ctx } from "../src/server/repositories/context";
import { eq } from "drizzle-orm";
import type { factures } from "../src/server/db/schema";

/**
 * Le montage commun aux suites qui suivent un devis jusqu'à sa facture : une
 * entreprise, son chantier, une ligne de prix, et les gestes qu'une suite
 * pose sous FORCE RLS sans passer par l'écran.
 */

export async function creerEntreprise(nom: string, acomptePourcent: string | null) {
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

/**
 * Le devis part chez le client : la version suivante sera une NOUVELLE version.
 *
 * **Le contexte d'entreprise est POSÉ** : `devis` est sous FORCE RLS, et un
 * `UPDATE` sans contexte touche zéro ligne **sans lever d'erreur**
 * (`CLAUDE.md` invariant 7). La première version de cette suite s'est fait
 * prendre : elle mesurait un devis resté brouillon et concluait « aucune
 * nouvelle version », ce qui accusait le produit à tort.
 */
export async function marquerEnvoye(entrepriseId: string, devisId: string) {
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

/** Pose sur un brouillon ce qu'il aurait réglé à l'écran, contexte posé (FORCE RLS). */
export async function regler(entrepriseId: string, devisId: string, colonnes: Record<string, string>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    const noms = Object.keys(colonnes);
    const r = await client.query(
      `UPDATE devis SET ${noms.map((n, i) => `${n} = $${i + 2}`).join(", ")} WHERE id = $1`,
      [devisId, ...noms.map((n) => colonnes[n])]
    );
    assert.equal(r.rowCount, 1, "le réglage n'a touché aucun devis : la suite ne mesurerait rien");
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Le texte du papier de la facture, tel que le client le recevrait. */
export async function papierDeLaFacture(ctx: Ctx, facture: typeof factures.$inferSelect): Promise<string> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx.select().from(lignesFacture).where(eq(lignesFacture.factureId, facture.id));
    assert.ok(lignes.length > 0, "la facture n'a aucune ligne : la suite ne lirait rien");
    const data = donneesFacture(facture, lignes, await complementsDeLaFacture(tx, ctx.entrepriseId, facture));
    return (await composerFacturePdf(data)).trace.textes.map((t) => t.contenu).join(" ");
  });
}
