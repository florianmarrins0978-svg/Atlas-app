import { eq, inArray } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { avoirs, chantiers, factures, lignesFacture } from "../db/schema";
import { categoriesDeLAvoir, categoriesDeLaFacture, type CategoriePiece } from "@/lib/tva-par-taux";
import { enCentimes, type FactureDuDossier, type PartDeTaux } from "@/lib/dossier-du-comptable";
import type { LigneRemisable } from "@/lib/reduction-devis";
import { facturesAvecPaiements } from "./paiements-facture";
import type { Ctx } from "./context";

/**
 * Les factures que le registre des ventes du dossier lit : celles de la
 * période, celles qu'un client a payées pendant, celles qu'un avoir de la
 * période corrige, et celles que paie une ligne de la banque du dossier.
 *
 * **La TVA par taux est celle de l'émission** (`categoriesDeLaFacture`, remise
 * comprise), la même que le relevé de TVA : une seconde façon de ventiler
 * finirait par imprimer dans le dossier une autre TVA que sur la facture.
 *
 * Tout passe par `withEntreprise` : la RLS ne laisse voir que ses factures.
 */
export async function facturesDuDossier(ctx: Ctx, du: string, au: string, numerosPayes: readonly string[]): Promise<FactureDuDossier[]> {
  const dedans = (j: string) => j >= du && j <= au;
  const toutes = await facturesAvecPaiements(ctx);
  const utiles = toutes.filter(
    (f) => dedans(f.dateEmission) || f.paiements.some((p) => dedans(p.date)) || f.avoirs.some((a) => dedans(a.date)) || numerosPayes.includes(f.numeroCommercial)
  );
  if (utiles.length === 0) return [];
  const ids = utiles.map((f) => f.id);

  const { pieces, lignes, avoirsLus } = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [pieces, lignes, avoirsLus] = await Promise.all([
      tx
        .select({ id: factures.id, tauxTva: factures.tauxTva, reductionPourcent: factures.reductionPourcent, chantier: chantiers.nom })
        .from(factures)
        .leftJoin(chantiers, eq(chantiers.id, factures.chantierId))
        .where(inArray(factures.id, ids)),
      tx
        .select({ factureId: lignesFacture.factureId, montant: lignesFacture.montant, tauxTva: lignesFacture.tauxTva, supplement: lignesFacture.supplement })
        .from(lignesFacture)
        .where(inArray(lignesFacture.factureId, ids)),
      tx.select({ factureId: avoirs.factureId, numero: avoirs.numero, totalTva: avoirs.totalTva, lignes: avoirs.lignes }).from(avoirs).where(inArray(avoirs.factureId, ids)),
    ]);
    return { pieces, lignes, avoirsLus };
  });
  const lignesPar = new Map<string, LigneRemisable[]>();
  for (const l of lignes) lignesPar.set(l.factureId, [...(lignesPar.get(l.factureId) ?? []), l]);
  const piecePar = new Map(pieces.map((p) => [p.id, p]));
  const partsDeLAvoir = new Map(avoirsLus.map((a) => [a.numero, categoriesDeLAvoir(a)]));
  const enParts = (c: readonly CategoriePiece[]): PartDeTaux[] => c.map((x) => ({ taux: x.taux, ht: enCentimes(x.ht), tva: enCentimes(x.tva) }));

  return utiles.map((f): FactureDuDossier => {
    const piece = piecePar.get(f.id);
    return {
      numero: f.numeroCommercial,
      date: f.dateEmission,
      client: f.clientNom ?? "Client sans nom",
      chantier: piece?.chantier ?? null,
      parTaux: piece ? enParts(categoriesDeLaFacture(lignesPar.get(f.id) ?? [], piece.tauxTva, piece.reductionPourcent)) : [],
      ht: enCentimes(f.totalHt),
      tva: enCentimes(f.totalTva),
      ttc: enCentimes(f.totalTtc),
      avoirs: f.avoirs.map((a) => ({ numero: a.numero, date: a.date, parTaux: enParts(partsDeLAvoir.get(a.numero) ?? []), ht: enCentimes(a.ht), tva: enCentimes(a.tva), ttc: enCentimes(a.ttc) })),
      paiements: f.paiements.map((p) => ({ date: p.date, montant: enCentimes(p.montant) })),
    };
  });
}
