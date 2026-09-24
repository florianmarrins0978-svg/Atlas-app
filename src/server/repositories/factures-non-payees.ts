import { and, eq, isNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, factures, facturesNonPayees } from "../db/schema";
import type { Ctx } from "./context";
import { facturesAvecPaiements } from "./paiements-facture";

/**
 * « Il ne me paiera pas » (planche `appli/il-ne-paiera-pas.html`, 24 septembre
 * 2026).
 *
 * **La facture ne bouge pas** : le BOFiP le dit pour l'impayé (§310), *« la
 * dette du client défaillant subsiste et la facture initiale ne doit pas être
 * modifiée »*. On note seulement qu'il l'a dit : le rappel se tait, et la
 * facture se range dans la catégorie « Non payées » de Terminés.
 *
 * **« Non payée » se DÉDUIT, il ne se pose pas** : la déclaration ET un reste
 * dû. S'il paie, le reste tombe à zéro et la facture sort de la catégorie
 * d'elle-même, sans un second geste à oublier — c'est la règle qu'écrivent déjà
 * les rappels : la somme des règlements décide, jamais un état posé à la main.
 */

export type ResultatNonPayee = { ok: true } | { ok: false; refus: string };

export async function declarerNonPayee(ctx: Ctx, factureId: string): Promise<ResultatNonPayee> {
  const facture = (await facturesAvecPaiements(ctx)).find((f) => f.id === factureId);
  if (!facture) return { ok: false, refus: "Cette facture est introuvable, ou n'est pas encore envoyée." };
  if (facture.etat === "soldee") return { ok: false, refus: "Cette facture est déjà réglée." };
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .insert(facturesNonPayees)
      .values({ factureId, entrepriseId: ctx.entrepriseId, declareePar: ctx.utilisateurId })
      .onConflictDoNothing()
  );
  return { ok: true };
}

export type FactureNonPayee = {
  factureId: string;
  chantierId: string;
  chantierNom: string;
  numero: string;
  clientNom: string | null;
  reste: string;
  declareeLe: Date;
};

/** Les factures de la catégorie « Non payées » : déclarées, et encore dues. */
export async function listerFacturesNonPayees(ctx: Ctx): Promise<FactureNonPayee[]> {
  const [toutes, declarees] = await Promise.all([
    facturesAvecPaiements(ctx),
    withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx
        .select({
          factureId: facturesNonPayees.factureId,
          declareeLe: facturesNonPayees.declareeLe,
          chantierNom: chantiers.nom,
        })
        .from(facturesNonPayees)
        .innerJoin(factures, eq(factures.id, facturesNonPayees.factureId))
        .innerJoin(chantiers, and(eq(chantiers.id, factures.chantierId), isNull(chantiers.deletedAt)))
    ),
  ]);
  const parId = new Map(toutes.map((f) => [f.id, f]));
  const sortie: FactureNonPayee[] = [];
  for (const d of declarees) {
    const f = parId.get(d.factureId);
    if (!f || f.etat === "soldee") continue;
    sortie.push({
      factureId: f.id,
      chantierId: f.chantierId,
      chantierNom: d.chantierNom,
      numero: f.numeroCommercial,
      clientNom: f.clientNom,
      reste: f.reste,
      declareeLe: d.declareeLe,
    });
  }
  return sortie.sort((a, b) => b.declareeLe.getTime() - a.declareeLe.getTime());
}
