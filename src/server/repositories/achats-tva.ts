import type { LigneImprimee } from "@/lib/ticket-imprime";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import { achatsTva } from "../db/schema";
import type { Ctx } from "./context";
import {
  recuperation,
  type NatureAchat,
  type RepasAchat,
  type SaisieAchat,
  type VehiculeAchat,
} from "@/lib/achat-tva";

/**
 * Les achats du patron, et la TVA qu'il peut déduire.
 *
 * **Tout passe par `withEntreprise`** — une requête hors de ce cadre ne rend
 * rien, silencieusement (`CLAUDE.md` §3). Sur cette table plus qu'ailleurs :
 * les tickets d'un artisan disent où il fait le plein et ce qu'il achète.
 */

export type AchatTva = {
  id: string;
  dateAchat: string;
  fournisseur: string;
  totalTtc: string | null;
  tauxTva: string | null;
  tvaDeductible: string;
  photoCle: string | null;
  saisie: SaisieAchat;
  nature: NatureAchat | null;
  vehicule: VehiculeAchat | null;
  repas: RepasAchat | null;
  avecQui: string | null;
  pourquoi: string | null;
  justificatif: boolean | null;
  tvaTicket: string | null;
};

/**
 * Les achats d'une période, du plus récent au plus ancien.
 *
 * Bornes **incluses** des deux côtés, comme `periodeTva` les rend : un achat du
 * 31 août appartient à août. Un intervalle ouvert à droite perdrait le dernier
 * jour de chaque mois — soit douze jours par an, et personne ne s'en
 * apercevrait avant de comparer avec le comptable.
 */
export async function listerAchatsTva(ctx: Ctx, debut: string, fin: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: achatsTva.id,
        dateAchat: achatsTva.dateAchat,
        fournisseur: achatsTva.fournisseur,
        totalTtc: achatsTva.totalTtc,
        tauxTva: achatsTva.tauxTva,
        tvaDeductible: achatsTva.tvaDeductible,
        photoCle: achatsTva.photoCle,
        saisie: achatsTva.saisie,
        nature: achatsTva.nature,
        vehicule: achatsTva.vehicule,
        repas: achatsTva.repas,
        avecQui: achatsTva.avecQui,
        pourquoi: achatsTva.pourquoi,
        justificatif: achatsTva.justificatif,
        tvaTicket: achatsTva.tvaTicket,
      })
      .from(achatsTva)
      .where(
        and(
          isNull(achatsTva.deletedAt),
          gte(achatsTva.dateAchat, debut),
          lte(achatsTva.dateAchat, fin)
        )
      )
      .orderBy(desc(achatsTva.dateAchat), desc(achatsTva.createdAt))
  );
}

/**
 * Le total déductible d'une période, compté par la base.
 *
 * **En SQL et non en additionnant la liste en JavaScript** : les montants sont
 * des `numeric`, et les rendre en chaînes pour les recoller en nombres
 * flottants réintroduirait précisément l'erreur d'arrondi que `numeric` évite.
 * `COALESCE` parce qu'une période sans achat doit rendre zéro, pas `null` —
 * l'écran soustrairait alors `null` et afficherait « NaN ».
 */
export async function totalTvaDeductible(ctx: Ctx, debut: string, fin: string): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .select({
        total: sql<string>`COALESCE(SUM(${achatsTva.tvaDeductible}), 0)::text`,
      })
      .from(achatsTva)
      .where(
        and(
          isNull(achatsTva.deletedAt),
          gte(achatsTva.dateAchat, debut),
          lte(achatsTva.dateAchat, fin)
        )
      );
    return Number(row?.total ?? 0);
  });
}

/**
 * Enregistrer un achat.
 *
 * **La part qui compte se calcule ICI, jamais ne se reçoit.** Le navigateur
 * envoie la TVA du ticket et la nature ; `recuperation` en tire ce qui entre
 * au total, avec la même fonction que l'écran (`CLAUDE.md` §3). Un écran
 * trafiqué ne peut donc pas faire compter un hôtel.
 */
export async function creerAchatTva(
  ctx: Ctx,
  data: {
    dateAchat: string;
    fournisseur: string;
    totalTtc?: number | null;
    tauxTva?: number | null;
    tvaTicket: number;
    nature: NatureAchat;
    vehicule?: VehiculeAchat | null;
    repas?: RepasAchat | null;
    avecQui?: string | null;
    pourquoi?: string | null;
    justificatif?: boolean;
    photoCle?: string | null;
    lignesImprimees?: LigneImprimee[] | null;
    saisie: SaisieAchat;
  }
) {
  // Une précision qui ne concerne pas cette nature ne s'enregistre pas : un
  // véhicule sur un repas mentirait sur la ligne, et on ne saurait plus lequel
  // des deux croire.
  const vehicule = data.nature === "carburant" ? (data.vehicule ?? null) : null;
  const repas = data.nature === "repas" ? (data.repas ?? null) : null;
  const affaires = repas === "affaires";
  const avecQui = affaires ? data.avecQui?.trim() || null : null;
  const pourquoi = affaires ? data.pourquoi?.trim() || null : null;
  const justificatif = affaires ? Boolean(data.justificatif) : null;
  const { tvaRecuperee } = recuperation({
    nature: data.nature,
    vehicule,
    repas,
    avecQui,
    pourquoi,
    justificatif: Boolean(justificatif),
    totalTtc: data.totalTtc ?? null,
    tauxTva: data.tauxTva ?? null,
    tvaTicket: data.tvaTicket,
  });
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(achatsTva)
      .values({
        entrepriseId: ctx.entrepriseId,
        dateAchat: data.dateAchat,
        fournisseur: data.fournisseur.trim(),
        // Les `numeric` se posent en chaînes : un nombre flottant recollé par
        // le pilote perdrait des centimes sur les grands montants.
        totalTtc: data.totalTtc === null || data.totalTtc === undefined ? null : data.totalTtc.toFixed(2),
        tauxTva: data.tauxTva === null || data.tauxTva === undefined ? null : data.tauxTva.toFixed(2),
        tvaTicket: data.tvaTicket.toFixed(2),
        tvaDeductible: tvaRecuperee.toFixed(2),
        nature: data.nature,
        vehicule,
        repas,
        avecQui,
        pourquoi,
        justificatif,
        photoCle: data.photoCle ?? null,
        lignesImprimees: data.lignesImprimees ?? null,
        saisie: data.saisie,
        createdBy: ctx.utilisateurId,
      })
      .returning();
    return row;
  });
}

/**
 * Retrait réversible — la ligne reste, marquée.
 *
 * Rend `undefined` quand rien n'a bougé : c'est ce que voit une autre
 * entreprise qui tenterait le geste, la RLS filtrant sans lever d'exception.
 * L'écran doit pouvoir remettre la ligne plutôt que la faire disparaître à
 * tort (`ARCHITECTURE.md` §48).
 */
export async function supprimerAchatTva(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .update(achatsTva)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(achatsTva.id, id), isNull(achatsTva.deletedAt)))
      .returning();
    return row;
  });
}

/**
 * Compléter les preuves d'un repas d'affaires noté sans elles.
 *
 * *« Si on n'a pas de stylo pour l'écrire sur le ticket, comment on fait ? »*
 * On l'écrit plus tard, dans le camion : le texte ne dit pas que ce doit être
 * fait à table. Le repas a été noté sans compter ; il compte dès que les trois
 * preuves sont là, recalculé ici par la même règle.
 *
 * Rend `undefined` quand la ligne n'est pas un repas d'affaires de cette
 * entreprise : la RLS filtre sans lever, et l'écran doit le dire.
 */
export async function completerRepasAchat(
  ctx: Ctx,
  id: string,
  preuves: { avecQui: string; pourquoi: string; justificatif: boolean }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx
      .select()
      .from(achatsTva)
      .where(and(eq(achatsTva.id, id), isNull(achatsTva.deletedAt)));
    if (!ligne || ligne.nature !== "repas" || ligne.repas !== "affaires" || ligne.tvaTicket === null) {
      return undefined;
    }
    const avecQui = preuves.avecQui.trim() || null;
    const pourquoi = preuves.pourquoi.trim() || null;
    const { tvaRecuperee } = recuperation({
      nature: "repas",
      vehicule: null,
      repas: "affaires",
      avecQui,
      pourquoi,
      justificatif: preuves.justificatif,
      totalTtc: ligne.totalTtc === null ? null : Number(ligne.totalTtc),
      tauxTva: ligne.tauxTva === null ? null : Number(ligne.tauxTva),
      tvaTicket: Number(ligne.tvaTicket),
    });
    const [row] = await tx
      .update(achatsTva)
      .set({
        avecQui,
        pourquoi,
        justificatif: preuves.justificatif,
        tvaDeductible: tvaRecuperee.toFixed(2),
        updatedAt: new Date(),
      })
      .where(and(eq(achatsTva.id, id), isNull(achatsTva.deletedAt)))
      .returning();
    return row;
  });
}

/**
 * La photo d'un ticket, par l'identifiant de l'ACHAT, relue sous la RLS.
 *
 * **On sert par identifiant, jamais par clé** (la règle de
 * `/api/phyto/image/[id]`) : c'est ce qui permet à l'assistant de joindre un
 * ticket sans qu'aucune clé de stockage ne passe par le navigateur.
 *
 * **Et le préfixe se revérifie** : une clé posée avant le contrôle du
 * 29 août 2026 (`termines/tva/actions.ts`) pouvait viser un autre dossier.
 * Une clé hors des tickets de l'entreprise ne s'ouvre pas.
 */
export async function photoDuTicket(ctx: Ctx, achatId: string): Promise<string | null> {
  const [ligne] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({ photoCle: achatsTva.photoCle })
      .from(achatsTva)
      .where(and(eq(achatsTva.id, achatId), isNull(achatsTva.deletedAt)))
      .limit(1)
  );
  const cle = ligne?.photoCle ?? null;
  return cle && cle.startsWith(`entreprises/${ctx.entrepriseId}/tickets/`) ? cle : null;
}
