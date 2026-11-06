import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { chantiers, clients, contratsEntretien, factures, lignesFacture, piecesImportees } from "../db/schema";
import type { Ctx } from "./context";
import type { JourIso } from "@/lib/disponibilites";
import {
  momentDuChantierPose,
  parleDArrosage,
  type FaitsDArrosage,
  type HivernagePose,
} from "@/lib/hivernage";

/**
 * L'HIVERNAGE DE L'ARROSAGE D'UN CLIENT — ce que la base sait, rien de plus.
 *
 * Sa planche du 5 novembre 2026 (`appli/soignee/hiverner-l-arrosage.html`,
 * « la B »). Ce fichier LIT et ÉCRIT ; ce qui se montre se décide dans
 * `src/lib/hivernage.ts` (`ceQueLaFicheDit`), qui ne voit jamais la base.
 */
export type EtatHivernage = {
  faits: FaitsDArrosage;
  /** Le jour de sa plus récente facture dont une ligne parle d'arrosage. */
  factureQuiParle: JourIso | null;
  /** Un contrat d'entretien qu'il a accepté : la source la plus sûre qu'il en a un. */
  aUnContrat: boolean;
  poses: HivernagePose[];
};

/**
 * Ce que la fiche d'un client doit savoir de son arrosage. `null` : ce client
 * n'est pas à vous, ou il a été supprimé.
 *
 * **Les factures lues sont celles qui sont ÉMISES**, et les factures importées
 * rangées : un brouillon n'a rien dit au client, il ne fait rien demander.
 * **Le contrat compte quand il est ACCEPTÉ** : un brouillon ou un envoi sans
 * réponse ne disent pas qu'il y a un jardin entretenu chez lui.
 */
export async function etatHivernageDuClient(ctx: Ctx, clientId: string): Promise<EtatHivernage | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [client] = await tx
      .select({
        arrosageAutomatique: clients.arrosageAutomatique,
        hivernageParNous: clients.hivernageParNous,
        hiverneLe: clients.hiverneLe,
      })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.entrepriseId, ctx.entrepriseId), isNull(clients.deletedAt)))
      .limit(1);
    if (!client) return null;

    const [lignes, importees, contrats, sesHivernages] = await Promise.all([
      tx
        .select({ libelle: lignesFacture.libelle, jour: factures.dateEmission })
        .from(lignesFacture)
        .innerJoin(factures, eq(factures.id, lignesFacture.factureId))
        .innerJoin(chantiers, eq(chantiers.id, factures.chantierId))
        .where(
          and(
            eq(chantiers.entrepriseId, ctx.entrepriseId),
            eq(chantiers.clientId, clientId),
            eq(factures.statut, "emise")
          )
        ),
      tx
        .select({ objet: piecesImportees.objet, jour: piecesImportees.jour })
        .from(piecesImportees)
        .where(
          and(
            eq(piecesImportees.entrepriseId, ctx.entrepriseId),
            eq(piecesImportees.clientId, clientId),
            eq(piecesImportees.genre, "facture"),
            eq(piecesImportees.statut, "rangee")
          )
        ),
      tx
        .select({ id: contratsEntretien.id })
        .from(contratsEntretien)
        .where(
          and(
            eq(contratsEntretien.entrepriseId, ctx.entrepriseId),
            eq(contratsEntretien.clientId, clientId),
            eq(contratsEntretien.statut, "accepte")
          )
        )
        .limit(1),
      tx
        .select({
          id: chantiers.id,
          jour: chantiers.datePlanifiee,
          creneauDebut: chantiers.creneauDebut,
          dureeDemiJournees: chantiers.dureeDemiJournees,
        })
        .from(chantiers)
        .where(
          and(
            eq(chantiers.entrepriseId, ctx.entrepriseId),
            eq(chantiers.clientId, clientId),
            eq(chantiers.nature, "hivernage"),
            isNull(chantiers.deletedAt),
            isNotNull(chantiers.datePlanifiee)
          )
        ),
    ]);

    // **La règle du mot vit dans `lib`** (`parleDArrosage`) : la redire en SQL
    // (`ILIKE`) en ferait deux, et l'une oublierait les accents.
    const jours = [
      ...lignes.filter((l) => parleDArrosage(l.libelle)).map((l) => l.jour),
      ...importees.filter((p) => p.objet && parleDArrosage(p.objet) && p.jour).map((p) => p.jour as string),
    ].sort();

    return {
      faits: client,
      factureQuiParle: jours[jours.length - 1] ?? null,
      aUnContrat: contrats.length > 0,
      poses: sesHivernages.map((c) => ({
        chantierId: c.id,
        jour: c.jour as string,
        moment: momentDuChantierPose(c.creneauDebut, c.dureeDemiJournees),
      })),
    };
  });
}

/**
 * SA RÉPONSE À L'UNE DES DEUX QUESTIONS. Rend `false` quand le client n'est
 * pas à vous : zéro ligne touchée ne doit jamais s'annoncer « noté ».
 */
export async function repondreSurLArrosage(
  ctx: Ctx,
  clientId: string,
  question: "arrosage" | "hivernage",
  oui: boolean
): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .update(clients)
      .set({
        ...(question === "arrosage" ? { arrosageAutomatique: oui } : { hivernageParNous: oui }),
        updatedAt: new Date(),
      })
      .where(and(eq(clients.id, clientId), eq(clients.entrepriseId, ctx.entrepriseId), isNull(clients.deletedAt)))
      .returning({ id: clients.id });
    return lignes.length > 0;
  });
}

/**
 * « C'EST FAIT » : l'hivernage est noté à ce jour, et la goutte part.
 *
 * Rend le jour d'AVANT, pour que « Annuler » le remette tel qu'il était — un
 * hivernage de la saison passée ne doit pas devenir « jamais » sous un doigt
 * qui s'est trompé. `null` dans `precedent` : rien n'avait jamais été noté.
 */
export async function noterHivernageFait(
  ctx: Ctx,
  clientId: string,
  jour: JourIso
): Promise<{ precedent: JourIso | null } | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const filtre = and(eq(clients.id, clientId), eq(clients.entrepriseId, ctx.entrepriseId), isNull(clients.deletedAt));
    const [avant] = await tx.select({ hiverneLe: clients.hiverneLe }).from(clients).where(filtre).limit(1);
    if (!avant) return null;
    await tx.update(clients).set({ hiverneLe: jour, updatedAt: new Date() }).where(filtre);
    return { precedent: avant.hiverneLe };
  });
}

/** « Annuler » après « C'est fait » : le jour d'avant revient. */
export async function annulerHivernageFait(ctx: Ctx, clientId: string, precedent: JourIso | null): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const lignes = await tx
      .update(clients)
      .set({ hiverneLe: precedent, updatedAt: new Date() })
      .where(and(eq(clients.id, clientId), eq(clients.entrepriseId, ctx.entrepriseId), isNull(clients.deletedAt)))
      .returning({ id: clients.id });
    return lignes.length > 0;
  });
}
