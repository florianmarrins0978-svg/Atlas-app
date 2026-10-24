import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import { achatsTva, devisRecus, factures, mouvementsBancaires, societesAchat, virementsRecus } from "../db/schema";
import type { NatureAchat } from "@/lib/achat-tva";
import { checkUp, type Justification, type MotifVirement, type Verdict } from "@/lib/pour-mon-comptable";
import type { Ctx } from "./context";

/**
 * POUR MON COMPTABLE — les lignes du relevé et ce qui les justifie
 * (migrations 0142 et 0143). Ses choix des 23 et 24 octobre 2026 sur
 * `appli/pour-mon-comptable.html`.
 *
 * Tout passe par `withEntreprise` : une ligne, un ticket ou une facture d'une
 * autre entreprise est invisible, la RLS l'a déjà décidé ; la clé double de
 * 0143 empêche en plus d'y relier une pièce étrangère.
 */

export type TicketDeLaLigne = {
  id: string;
  dateAchat: string;
  fournisseur: string;
  totalTtc: string | null;
  nature: NatureAchat | null;
  photoCle: string | null;
  tvaDeductible: string;
};

export type LigneDuReleve = {
  id: string;
  jour: string;
  montant: string;
  sens: "entree" | "sortie";
  contrepartie: string | null;
  libelle: string;
  /**
   * La justification QUI TIENT : une ligne « ticket » dont le ticket a été
   * effacé se lit vide, donc « à justifier ».
   */
  justification: Justification | null;
  reliePar: "atlas" | "patron" | null;
  motif: MotifVirement | null;
  ticket: TicketDeLaLigne | null;
  factureRecue: { id: string; nom: string; societe: string; totalTtc: string | null; fichierCle: string; nature: "photo" | "pdf" | "tableur" } | null;
  /** Pour une entrée : la facture d'Atlas qu'il a confirmée sur l'accueil. */
  factureEmise: { numero: string } | null;
  /** Quand sa justification a été posée : le verdict du comptable s'y rapporte. */
  justifieLe: Date | null;
};

/** Une entrée est justifiée par la facture d'Atlas confirmée ; une sortie, par ce qu'on lui a relié. */
export function ligneAJustifier(l: Pick<LigneDuReleve, "sens" | "justification" | "factureEmise">): boolean {
  return l.sens === "entree" ? l.factureEmise === null : l.justification === null;
}

/** Les lignes du relevé entre deux jours compris, dans l'ordre du relevé, avec leurs pièces. */
export async function lignesDuReleve(ctx: Ctx, du: string, au: string): Promise<LigneDuReleve[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => lireLesLignes(tx, du, au));
}

/**
 * La lecture elle-même, dans une transaction dont l'entreprise est DÉJÀ posée :
 * par `withEntreprise` pour le patron, par le jeton pour la page du comptable
 * (`verification-comptable.ts`). Une seule lecture : le comptable voit
 * exactement ce que le patron a justifié.
 */
export async function lireLesLignes(tx: DbOrTx, du: string, au: string): Promise<LigneDuReleve[]> {
  const lignes = await tx
    .select()
    .from(mouvementsBancaires)
    .where(and(gte(mouvementsBancaires.jour, du), lte(mouvementsBancaires.jour, au)))
    .orderBy(asc(mouvementsBancaires.jour), asc(mouvementsBancaires.createdAt));
  if (lignes.length === 0) return [];

  const idsAchats = lignes.flatMap((l) => (l.achatId ? [l.achatId] : []));
  const tickets = idsAchats.length
    ? await tx.select().from(achatsTva).where(and(inArray(achatsTva.id, idsAchats), isNull(achatsTva.deletedAt)))
    : [];
  const parTicket = new Map(tickets.map((t) => [t.id, t]));

  const idsFactures = lignes.flatMap((l) => (l.factureRecueId ? [l.factureRecueId] : []));
  const recues = idsFactures.length
    ? await tx
        .select({ id: devisRecus.id, nom: devisRecus.nom, totalTtc: devisRecus.totalTtc, societe: societesAchat.nom, fichierCle: devisRecus.fichierCle, nature: devisRecus.nature })
        .from(devisRecus)
        .innerJoin(societesAchat, eq(societesAchat.id, devisRecus.societeId))
        .where(and(inArray(devisRecus.id, idsFactures), isNull(devisRecus.deletedAt)))
    : [];
  const parFacture = new Map(recues.map((f) => [f.id, f]));

  const cles = lignes.filter((l) => l.sens === "entree").map((l) => l.cle);
  const confirmes = cles.length
    ? await tx
        .select({ cle: virementsRecus.cle, numero: factures.numeroCommercial })
        .from(virementsRecus)
        .innerJoin(factures, eq(factures.id, virementsRecus.factureId))
        .where(and(inArray(virementsRecus.cle, cles), eq(virementsRecus.etat, "confirme")))
    : [];
  const parCle = new Map(confirmes.map((c) => [c.cle, c.numero]));

  return lignes.map((l) => {
    const t = l.achatId ? parTicket.get(l.achatId) : undefined;
    const f = l.factureRecueId ? parFacture.get(l.factureRecueId) : undefined;
    const tient =
      l.justification === "ticket" ? Boolean(t) : l.justification === "facture" ? Boolean(f) : l.justification !== null;
    return {
      id: l.id,
      jour: l.jour,
      montant: l.montant,
      sens: l.sens,
      contrepartie: l.contrepartie,
      libelle: l.libelle,
      justification: tient ? l.justification : null,
      reliePar: tient ? l.reliePar : null,
      motif: tient ? l.motif : null,
      ticket: t
        ? { id: t.id, dateAchat: t.dateAchat, fournisseur: t.fournisseur, totalTtc: t.totalTtc, nature: t.nature, photoCle: t.photoCle, tvaDeductible: t.tvaDeductible }
        : null,
      factureRecue: f ? { id: f.id, nom: f.nom, societe: f.societe, totalTtc: f.totalTtc, fichierCle: f.fichierCle, nature: f.nature } : null,
      factureEmise: parCle.has(l.cle) ? { numero: parCle.get(l.cle)! } : null,
      justifieLe: tient ? l.justifieLe : null,
    };
  });
}

/**
 * Les tickets qui ne justifient encore aucune ligne, achetés entre deux jours.
 * Un ticket effacé n'en fait pas partie.
 */
export async function ticketsLibres(ctx: Ctx, du: string, au: string): Promise<TicketDeLaLigne[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const pris = await tx
      .select({ id: mouvementsBancaires.achatId })
      .from(mouvementsBancaires)
      .where(eq(mouvementsBancaires.justification, "ticket"));
    const dejaPris = new Set(pris.flatMap((p) => (p.id ? [p.id] : [])));
    const lignes = await tx
      .select()
      .from(achatsTva)
      .where(and(gte(achatsTva.dateAchat, du), lte(achatsTva.dateAchat, au), isNull(achatsTva.deletedAt)))
      .orderBy(asc(achatsTva.dateAchat));
    return lignes
      .filter((t) => !dejaPris.has(t.id))
      .map((t) => ({ id: t.id, dateAchat: t.dateAchat, fournisseur: t.fournisseur, totalTtc: t.totalTtc, nature: t.nature, photoCle: t.photoCle, tvaDeductible: t.tvaDeductible }));
  });
}

/** Les factures de fournisseurs qu'aucune ligne ne porte encore. */
export async function facturesRecuesLibres(
  ctx: Ctx
): Promise<{ id: string; nom: string; societe: string; totalTtc: string | null; recuLe: string }[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const prises = await tx
      .select({ id: mouvementsBancaires.factureRecueId })
      .from(mouvementsBancaires)
      .where(eq(mouvementsBancaires.justification, "facture"));
    const dejaPrises = new Set(prises.flatMap((p) => (p.id ? [p.id] : [])));
    const lignes = await tx
      .select({ id: devisRecus.id, nom: devisRecus.nom, totalTtc: devisRecus.totalTtc, recuLe: devisRecus.recuLe, societe: societesAchat.nom })
      .from(devisRecus)
      .innerJoin(societesAchat, eq(societesAchat.id, devisRecus.societeId))
      .where(and(eq(devisRecus.genre, "facture"), isNull(devisRecus.deletedAt)))
      .orderBy(asc(devisRecus.recuLe));
    return lignes.filter((f) => !dejaPrises.has(f.id));
  });
}

export type Refus = { ok: false; raison: string };
export type Fait = { ok: true } | Refus;

/** Le code PostgreSQL d'une erreur, que Drizzle range dans `cause`. */
function codeDeLErreur(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

async function poser(
  ctx: Ctx,
  mouvementId: string,
  valeurs: Partial<typeof mouvementsBancaires.$inferInsert>,
  seulementSiLibre = false
): Promise<Fait> {
  try {
    return await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const ligne = await tx
        .update(mouvementsBancaires)
        .set(valeurs)
        .where(
          seulementSiLibre
            ? and(eq(mouvementsBancaires.id, mouvementId), isNull(mouvementsBancaires.justification))
            : eq(mouvementsBancaires.id, mouvementId)
        )
        .returning({ id: mouvementsBancaires.id });
      return ligne.length ? { ok: true as const } : { ok: false as const, raison: "Cette ligne n'existe plus, ou elle est déjà justifiée." };
    });
  } catch (err) {
    // Deux refus attendus, que la base tient : un ticket déjà relié ailleurs
    // (l'index unique), et une pièce d'une autre entreprise (la clé double).
    const code = codeDeLErreur(err);
    if (code === "23505") return { ok: false, raison: "Ce ticket justifie déjà une autre ligne." };
    if (code === "23503") return { ok: false, raison: "Cette pièce n'existe pas." };
    throw err;
  }
}

const VIDE = { achatId: null, factureRecueId: null, motif: null } as const;

/**
 * Relie un ticket à une sortie. Par Atlas (Check up), seulement si la ligne
 * attend encore sa pièce : un choix du patron ne se réécrit jamais derrière lui.
 */
export function relierTicket(ctx: Ctx, mouvementId: string, achatId: string, par: "atlas" | "patron"): Promise<Fait> {
  return poser(
    ctx,
    mouvementId,
    { ...VIDE, justification: "ticket", achatId, reliePar: par, justifieLe: new Date() },
    par === "atlas"
  );
}

export function joindreFactureRecue(ctx: Ctx, mouvementId: string, factureRecueId: string): Promise<Fait> {
  return poser(ctx, mouvementId, { ...VIDE, justification: "facture", factureRecueId, reliePar: "patron", justifieLe: new Date() });
}

/** « Ticket perdu » : la ligne est validée avec la mention ; sa TVA ne se déduit pas. */
export function marquerTicketPerdu(ctx: Ctx, mouvementId: string): Promise<Fait> {
  return poser(ctx, mouvementId, { ...VIDE, justification: "ticket_perdu", reliePar: "patron", justifieLe: new Date() });
}

export function poserMotif(ctx: Ctx, mouvementId: string, motif: MotifVirement): Promise<Fait> {
  return poser(ctx, mouvementId, { ...VIDE, justification: "motif", motif, reliePar: "patron", justifieLe: new Date() });
}

/** Défaire : la ligne revient « à justifier », le ticket redevient libre. */
export function delier(ctx: Ctx, mouvementId: string): Promise<Fait> {
  return poser(ctx, mouvementId, { ...VIDE, justification: null, reliePar: null, justifieLe: null });
}

export type BilanCheckUp = {
  /** Les lignes passées en revue : les sorties qui attendaient leur pièce. */
  vues: number;
  relies: string[];
  choix: Map<string, string[]>;
  aucun: string[];
};

/**
 * Le Check up : chaque sortie qui attend sa pièce, contre les tickets libres.
 *
 * Les tickets se cherchent jusqu'à cinq jours AVANT le début de la période :
 * un achat du 30 septembre peut passer à la banque le 2 octobre. Ce qui est
 * relié seul l'est par Atlas, et se défait d'un appui.
 */
export async function appliquerCheckUp(ctx: Ctx, du: string, au: string): Promise<BilanCheckUp> {
  const lignes = (await lignesDuReleve(ctx, du, au)).filter((l) => l.sens === "sortie" && l.justification === null);
  const debutTickets = new Date(`${du}T12:00:00Z`);
  debutTickets.setUTCDate(debutTickets.getUTCDate() - 5);
  const tickets = await ticketsLibres(ctx, debutTickets.toISOString().slice(0, 10), au);
  const verdicts: Map<string, Verdict> = checkUp(
    lignes.map((l) => ({ id: l.id, jour: l.jour, montant: l.montant })),
    tickets.map((t) => ({ id: t.id, dateAchat: t.dateAchat, totalTtc: t.totalTtc }))
  );
  const bilan: BilanCheckUp = { vues: lignes.length, relies: [], choix: new Map(), aucun: [] };
  for (const [id, v] of verdicts) {
    if (v.genre === "relie") {
      const r = await relierTicket(ctx, id, v.ticketId, "atlas");
      if (r.ok) bilan.relies.push(id);
      else bilan.aucun.push(id);
    } else if (v.genre === "choix") bilan.choix.set(id, v.ticketIds);
    else bilan.aucun.push(id);
  }
  return bilan;
}

/** La photo d'un ticket de l'entreprise, ou rien. Un ticket effacé n'en a plus. */
export async function photoDuTicket(ctx: Ctx, achatId: string): Promise<string | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [t] = await tx
      .select({ photoCle: achatsTva.photoCle })
      .from(achatsTva)
      .where(and(eq(achatsTva.id, achatId), isNull(achatsTva.deletedAt)))
      .limit(1);
    return t?.photoCle ?? null;
  });
}

