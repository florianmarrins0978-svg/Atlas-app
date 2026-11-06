/**
 * LE PLAFOND DE LA FRANCHISE : ce que la base dit de l'année civile.
 *
 * Trois sommes, et rien d'autre : les factures ÉMISES de l'année (leur HT),
 * les factures IMPORTÉES (migration 0136, leur montant total : sans TVA en
 * franchise), les avoirs de l'année (leur HT). Le compte lui-même, ses
 * bornes et ses phrases vivent dans `src/lib/franchise-plafond.ts`, la même
 * règle pour l'écran et pour la facture qui part.
 *
 * **Par l'année de la pièce**, pas par l'encaissement : le BOFiP compte le
 * chiffre d'affaires des « livraisons de biens et prestations de services »
 * de l'année (BOI-TVA-DECLA-40-10-10, version du 1er juillet 2026). Un
 * brouillon ne compte pas : il n'est parti chez personne.
 *
 * **Une pièce importée à vérifier compte aussi** : son montant lu peut être
 * faux, mais l'ignorer ferait annoncer le plafond plus tard qu'il n'arrive.
 * Le côté sûr est de prévenir tôt.
 */
import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { compterLaFranchise, type ChiffresDeLAnnee, type CompteDeLaFranchise } from "@/lib/franchise-plafond";
import { jourIso } from "@/lib/jour";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import { avoirs, entreprises, factures, piecesImportees } from "../db/schema";
import type { Ctx } from "./context";

type Somme = { nombre: number; total: string };

async function somme(requete: Promise<{ nombre: number; total: string | null }[]>): Promise<Somme> {
  const [ligne] = await requete;
  return { nombre: Number(ligne?.nombre ?? 0), total: ligne?.total ?? "0" };
}

/** Les trois sommes d'une année civile, lues dans la transaction de l'appelant (RLS posée). */
export async function chiffresDeLAnnee(tx: DbOrTx, entrepriseId: string, annee: number): Promise<ChiffresDeLAnnee> {
  const du = `${annee}-01-01`;
  const au = `${annee + 1}-01-01`;
  const emises = await somme(
    tx
      .select({ nombre: sql<number>`count(*)::int`, total: sql<string | null>`sum(${factures.totalHt})::text` })
      .from(factures)
      .where(
        and(
          eq(factures.entrepriseId, entrepriseId),
          eq(factures.statut, "emise"),
          gte(factures.dateEmission, du),
          lt(factures.dateEmission, au)
        )
      )
  );
  const importees = await somme(
    tx
      .select({ nombre: sql<number>`count(*)::int`, total: sql<string | null>`sum(${piecesImportees.montantTtc})::text` })
      .from(piecesImportees)
      .where(
        and(
          eq(piecesImportees.entrepriseId, entrepriseId),
          eq(piecesImportees.genre, "facture"),
          isNotNull(piecesImportees.montantTtc),
          gte(piecesImportees.jour, du),
          lt(piecesImportees.jour, au)
        )
      )
  );
  const deduits = await somme(
    tx
      .select({ nombre: sql<number>`count(*)::int`, total: sql<string | null>`sum(${avoirs.totalHt})::text` })
      .from(avoirs)
      .where(and(eq(avoirs.entrepriseId, entrepriseId), gte(avoirs.dateEmission, du), lt(avoirs.dateEmission, au)))
  );
  return {
    annee,
    factures: { nombre: emises.nombre, totalHt: emises.total },
    importees: { nombre: importees.nombre, total: importees.total },
    avoirs: { nombre: deduits.nombre, totalHt: deduits.total },
  };
}

/**
 * Le compte de l'année en cours, et le régime de l'entreprise.
 *
 * Le compte se rend même en Assujettie : Votre TVA le montre sous la carte
 * Franchise en base dès qu'elle est choisie, avant même d'être enregistrée.
 * C'est à l'écran de ne rien montrer pour une entreprise Assujettie.
 */
export async function compteDeLaFranchise(
  ctx: Ctx,
  maintenant: Date = new Date()
): Promise<{ regime: "assujettie" | "franchise"; compte: CompteDeLaFranchise }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx
      .select({ regimeTva: entreprises.regimeTva })
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);
    // L'année se lit à Paris (`jourIso`) : le 31 décembre à 23 h 30, l'UTC dit
    // encore la veille, et le 1er janvier à 0 h 30 il dit déjà l'année d'après.
    const annee = Number(jourIso(maintenant).slice(0, 4));
    const compte = compterLaFranchise(await chiffresDeLAnnee(tx, ctx.entrepriseId, annee));
    return { regime: e?.regimeTva ?? "assujettie", compte };
  });
}
