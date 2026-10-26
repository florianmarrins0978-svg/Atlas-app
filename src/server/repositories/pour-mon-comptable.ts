import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import type { DbOrTx } from "../db/client";
import { achatsTva, devisRecus, factures, mouvementsBancaires, societesAchat, virementsRecus } from "../db/schema";
import type { NatureAchat } from "@/lib/achat-tva";
import type { LigneImprimee } from "@/lib/ticket-imprime";
import { checkUp, ecartDeMontant, estMotif, type Ecart, type Justification, type Motif, type Verdict } from "@/lib/pour-mon-comptable";
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
  /** Le ticket recopié ligne par ligne (migration 0146), `null` pour un ticket d'avant. */
  lignesImprimees: LigneImprimee[] | null;
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
  motif: Motif | null;
  ticket: TicketDeLaLigne | null;
  factureRecue: { id: string; nom: string; societe: string; totalTtc: string | null; fichierCle: string; nature: "photo" | "pdf" | "tableur" } | null;
  /** Pour une entrée : la facture d'Atlas qu'il a confirmée, sur l'accueil ou dans sa carte. */
  factureEmise: { numero: string; totalTtc: string } | null;
  /** Pour une entrée : la facture faite hors d'Atlas qu'il a jointe (migration 0150). */
  pieceJointe: { cle: string; nature: "photo" | "pdf"; total: string | null } | null;
  /**
   * Le montant de la pièce contre celui de la ligne. Une pièce jointe malgré
   * l'écart le porte pour toujours : le relevé, le dossier et le comptable le
   * lisent ICI, d'une seule règle (`ecartDeMontant`).
   */
  ecart: Ecart;
  /** Quand sa justification a été posée : le verdict du comptable s'y rapporte. */
  justifieLe: Date | null;
};

/**
 * Une ligne attend sa pièce tant que rien ne la justifie. Une entrée l'est
 * aussi par la facture d'Atlas confirmée, qui vit dans `virements_recus`.
 */
export function ligneAJustifier(l: Pick<LigneDuReleve, "sens" | "justification" | "factureEmise">): boolean {
  return l.justification === null && (l.sens === "sortie" || l.factureEmise === null);
}

/**
 * Le fichier qui justifie une ligne : la photo du ticket, la facture reçue, ou
 * la facture faite hors d'Atlas. Le même pour le patron et pour son comptable :
 * deux lectures finiraient par montrer deux pièces différentes.
 */
export function pieceDeLaLigne(l: LigneDuReleve): { cle: string; nature: "photo" | "pdf" } | null {
  if (l.justification === "ticket" && l.ticket?.photoCle) return { cle: l.ticket.photoCle, nature: "photo" };
  if (l.justification === "facture" && l.factureRecue && l.factureRecue.nature !== "tableur") {
    return { cle: l.factureRecue.fichierCle, nature: l.factureRecue.nature };
  }
  if (l.justification === "facture_hors_atlas" && l.pieceJointe) return { cle: l.pieceJointe.cle, nature: l.pieceJointe.nature };
  return null;
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
        .select({ cle: virementsRecus.cle, numero: factures.numeroCommercial, totalTtc: factures.totalTtc })
        .from(virementsRecus)
        .innerJoin(factures, eq(factures.id, virementsRecus.factureId))
        .where(and(inArray(virementsRecus.cle, cles), eq(virementsRecus.etat, "confirme")))
    : [];
  const parCle = new Map(confirmes.map((c) => [c.cle, { numero: c.numero, totalTtc: c.totalTtc }]));

  return lignes.map((l) => {
    const t = l.achatId ? parTicket.get(l.achatId) : undefined;
    const f = l.factureRecueId ? parFacture.get(l.factureRecueId) : undefined;
    const jointe = l.pieceCle && l.pieceNature ? { cle: l.pieceCle, nature: l.pieceNature, total: l.pieceTotal } : null;
    const tient =
      l.justification === "ticket"
        ? Boolean(t)
        : l.justification === "facture"
          ? Boolean(f)
          : l.justification === "facture_hors_atlas"
            ? Boolean(jointe)
            : l.justification !== null;
    const justification = tient ? l.justification : null;
    const emise = parCle.get(l.cle) ?? null;
    const totalDeLaPiece =
      justification === "ticket"
        ? (t?.totalTtc ?? null)
        : justification === "facture"
          ? (f?.totalTtc ?? null)
          : justification === "facture_hors_atlas"
            ? (jointe?.total ?? null)
            : justification === null && l.sens === "entree"
              ? (emise?.totalTtc ?? null)
              : null;
    return {
      id: l.id,
      jour: l.jour,
      montant: l.montant,
      sens: l.sens,
      contrepartie: l.contrepartie,
      libelle: l.libelle,
      justification,
      reliePar: tient ? l.reliePar : null,
      motif: tient ? l.motif : null,
      ticket: t
        ? { id: t.id, dateAchat: t.dateAchat, fournisseur: t.fournisseur, totalTtc: t.totalTtc, nature: t.nature, photoCle: t.photoCle, tvaDeductible: t.tvaDeductible, lignesImprimees: t.lignesImprimees ?? null }
        : null,
      factureRecue: f ? { id: f.id, nom: f.nom, societe: f.societe, totalTtc: f.totalTtc, fichierCle: f.fichierCle, nature: f.nature } : null,
      factureEmise: emise,
      pieceJointe: tient ? jointe : null,
      // Ticket perdu, motif : pas de pièce, donc rien à comparer. Ne pas savoir
      // n'est pas un écart.
      ecart: totalDeLaPiece === null ? { genre: "inconnu" as const } : ecartDeMontant(l.montant, totalDeLaPiece),
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
      .map((t) => ({ id: t.id, dateAchat: t.dateAchat, fournisseur: t.fournisseur, totalTtc: t.totalTtc, nature: t.nature, photoCle: t.photoCle, tvaDeductible: t.tvaDeductible, lignesImprimees: t.lignesImprimees ?? null }));
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

/**
 * Un refus, avec sa phrase. `ecart` quand la pièce ne tombe pas sur le montant
 * de la ligne : l'écran montre les deux montants, et le patron joint quand même
 * s'il le veut (un acompte, deux factures pour un virement).
 */
export type Refus = { ok: false; raison: string; ecart?: { ligne: number; piece: number } };
/**
 * `pieceRetiree` : le fichier d'une facture faite hors d'Atlas que la nouvelle
 * justification remplace. Plus rien ne le montre ; l'appelant le retire du
 * stockage, une fois l'écriture faite.
 */
export type Fait = { ok: true; pieceRetiree?: string } | Refus;

/** Le code PostgreSQL d'une erreur, que Drizzle range dans `cause`. */
function codeDeLErreur(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

type LigneEnBase = typeof mouvementsBancaires.$inferSelect;

/**
 * Pose une justification. `controle` lit la ligne, VERROUILLÉE, dans la même
 * transaction que l'écriture : entre les deux, rien ne peut changer le montant
 * contre lequel la pièce a été comparée.
 */
async function poser(
  ctx: Ctx,
  mouvementId: string,
  valeurs: Partial<typeof mouvementsBancaires.$inferInsert>,
  options: { seulementSiLibre?: boolean; controle?: (ligne: LigneEnBase, tx: DbOrTx) => Promise<Refus | null> } = {}
): Promise<Fait> {
  try {
    return await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const [ligne] = await tx.select().from(mouvementsBancaires).where(eq(mouvementsBancaires.id, mouvementId)).for("update");
      if (!ligne || (options.seulementSiLibre && ligne.justification !== null)) {
        return { ok: false as const, raison: "Cette ligne n'existe plus, ou elle est déjà justifiée." };
      }
      const refus = options.controle ? await options.controle(ligne, tx) : null;
      if (refus) return refus;
      await tx.update(mouvementsBancaires).set(valeurs).where(eq(mouvementsBancaires.id, mouvementId));
      const retiree = ligne.pieceCle && ligne.pieceCle !== valeurs.pieceCle ? ligne.pieceCle : null;
      return retiree ? { ok: true as const, pieceRetiree: retiree } : { ok: true as const };
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

const VIDE = { achatId: null, factureRecueId: null, motif: null, pieceCle: null, pieceNature: null, pieceTotal: null } as const;

/** Le refus d'une pièce qui ne tombe pas juste, sauf si le patron a dit de la joindre quand même. */
function refusDEcart(ligne: LigneEnBase, totalDeLaPiece: string | null, malgreEcart: boolean): Refus | null {
  const e = ecartDeMontant(ligne.montant, totalDeLaPiece);
  if (e.genre !== "ecart" || malgreEcart) return null;
  return { ok: false, raison: "Pas le même montant.", ecart: { ligne: e.ligne, piece: e.piece } };
}

/**
 * Relie un ticket à une sortie. Par Atlas (Check up), seulement si la ligne
 * attend encore sa pièce : un choix du patron ne se réécrit jamais derrière lui.
 *
 * **Un ticket d'un autre montant ne se relie pas sans son accord** (sa
 * remarque du 25 octobre 2026). Le Check up ne relie que ce qui tombe juste ;
 * le patron, lui, peut joindre quand même, et l'écart reste écrit.
 */
export function relierTicket(ctx: Ctx, mouvementId: string, achatId: string, par: "atlas" | "patron", malgreEcart = false): Promise<Fait> {
  return poser(
    ctx,
    mouvementId,
    { ...VIDE, justification: "ticket", achatId, reliePar: par, justifieLe: new Date() },
    {
      seulementSiLibre: par === "atlas",
      controle: async (ligne, tx) => {
        if (ligne.sens !== "sortie") return { ok: false, raison: "Un ticket justifie une sortie, pas un virement reçu." };
        const [t] = await tx.select({ totalTtc: achatsTva.totalTtc }).from(achatsTva).where(and(eq(achatsTva.id, achatId), isNull(achatsTva.deletedAt))).limit(1);
        if (!t) return { ok: false, raison: "Cette pièce n'existe pas." };
        return refusDEcart(ligne, t.totalTtc, malgreEcart);
      },
    }
  );
}

/** Ce que dit la ligne de banque d'un ticket qu'on s'apprête à ranger pour elle : `null` s'il tombe juste. */
export async function ecartAvecLaLigne(ctx: Ctx, mouvementId: string, totalDuTicket: string | null): Promise<Refus | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [ligne] = await tx.select().from(mouvementsBancaires).where(eq(mouvementsBancaires.id, mouvementId)).limit(1);
    if (!ligne) return { ok: false as const, raison: "Cette ligne n'existe plus." };
    return refusDEcart(ligne, totalDuTicket, false);
  });
}

export function joindreFactureRecue(ctx: Ctx, mouvementId: string, factureRecueId: string, malgreEcart = false): Promise<Fait> {
  return poser(ctx, mouvementId, { ...VIDE, justification: "facture", factureRecueId, reliePar: "patron", justifieLe: new Date() }, {
    controle: async (ligne, tx) => {
      if (ligne.sens !== "sortie") return { ok: false, raison: "Une facture de fournisseur justifie une sortie, pas un virement reçu." };
      const [f] = await tx.select({ totalTtc: devisRecus.totalTtc }).from(devisRecus).where(and(eq(devisRecus.id, factureRecueId), isNull(devisRecus.deletedAt))).limit(1);
      if (!f) return { ok: false, raison: "Cette pièce n'existe pas." };
      return refusDEcart(ligne, f.totalTtc, malgreEcart);
    },
  });
}

/**
 * Une facture faite hors d'Atlas pour un virement reçu : son fichier est déjà
 * rangé (`deposerFactureHorsAtlasAction`), son total lu dessus ou tapé par lui.
 * Un total illisible ne se compare pas, et ne se devine pas : il reste vide.
 */
export function joindreFactureHorsAtlas(
  ctx: Ctx,
  mouvementId: string,
  piece: { cle: string; nature: "photo" | "pdf"; total: string | null },
  malgreEcart = false
): Promise<Fait> {
  return poser(
    ctx,
    mouvementId,
    { ...VIDE, justification: "facture_hors_atlas", pieceCle: piece.cle, pieceNature: piece.nature, pieceTotal: piece.total, reliePar: "patron", justifieLe: new Date() },
    {
      controle: async (ligne, tx) => {
        if (ligne.sens !== "entree") return { ok: false, raison: "Une facture faite hors d'Atlas justifie un virement reçu." };
        if (await factureConfirmee(tx, ligne.cle)) return { ok: false, raison: "Ce virement paie déjà une facture d'Atlas." };
        return refusDEcart(ligne, piece.total, malgreEcart);
      },
    }
  );
}

/** « Ticket perdu » : la ligne est validée avec la mention ; sa TVA ne se déduit pas. */
export function marquerTicketPerdu(ctx: Ctx, mouvementId: string): Promise<Fait> {
  return poser(ctx, mouvementId, { ...VIDE, justification: "ticket_perdu", reliePar: "patron", justifieLe: new Date() }, {
    controle: async (ligne) => (ligne.sens !== "sortie" ? { ok: false, raison: "Un virement reçu n'a pas de ticket." } : null),
  });
}

/**
 * Ce qu'est un virement qui n'appelle pas de facture. **La réponse doit être
 * celle de son sens** : un salaire ne s'écrit pas sur ce qui entre.
 *
 * Sur un virement REÇU, la question de l'accueil se ferme dans la même
 * transaction : l'accueil demanderait sinon « paie-t-il la facture F-012 ? »
 * d'un argent qu'il vient de dire être un remboursement.
 */
export function poserMotif(ctx: Ctx, mouvementId: string, motif: Motif): Promise<Fait> {
  return poser(ctx, mouvementId, { ...VIDE, justification: "motif", motif, reliePar: "patron", justifieLe: new Date() }, {
    controle: async (ligne, tx) => {
      if (!estMotif(motif, ligne.sens)) return { ok: false, raison: "Dites ce qu'est ce virement." };
      if (ligne.sens === "entree") {
        if (await factureConfirmee(tx, ligne.cle)) return { ok: false, raison: "Ce virement paie déjà une facture d'Atlas." };
        await tx
          .update(virementsRecus)
          .set({ etat: "ecarte", reponduAt: new Date() })
          .where(and(eq(virementsRecus.cle, ligne.cle), eq(virementsRecus.etat, "nouveau")));
      }
      return null;
    },
  });
}

async function factureConfirmee(tx: DbOrTx, cle: string): Promise<boolean> {
  const [v] = await tx.select({ id: virementsRecus.id }).from(virementsRecus).where(and(eq(virementsRecus.cle, cle), eq(virementsRecus.etat, "confirme"))).limit(1);
  return Boolean(v);
}

/** Défaire : la ligne revient « à justifier », le ticket redevient libre. */
export function delier(ctx: Ctx, mouvementId: string): Promise<Fait> {
  return poser(ctx, mouvementId, { ...VIDE, justification: null, reliePar: null, justifieLe: null });
}

/** La ligne d'un virement reçu, pour la confirmer d'une facture d'Atlas (`confirmerLaLigneRecue`). */
export async function ligneRecue(ctx: Ctx, mouvementId: string): Promise<{ montant: string; justifiee: boolean } | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx.select().from(mouvementsBancaires).where(and(eq(mouvementsBancaires.id, mouvementId), eq(mouvementsBancaires.sens, "entree"))).limit(1);
    if (!l) return null;
    return { montant: l.montant, justifiee: l.justification !== null || (await factureConfirmee(tx, l.cle)) };
  });
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

/** Le fichier qui justifie une ligne de l'entreprise, ou rien (`pieceDeLaLigne`). */
export async function pieceDuPatron(ctx: Ctx, mouvementId: string): Promise<{ cle: string; nature: "photo" | "pdf" } | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx.select({ jour: mouvementsBancaires.jour }).from(mouvementsBancaires).where(eq(mouvementsBancaires.id, mouvementId)).limit(1);
    if (!l) return null;
    const ligne = (await lireLesLignes(tx, l.jour, l.jour)).find((x) => x.id === mouvementId);
    return ligne ? pieceDeLaLigne(ligne) : null;
  });
}

/** Une facture faite hors d'Atlas déjà jointe à une ligne : elle ne s'abandonne pas. */
export async function pieceDejaJointe(ctx: Ctx, cle: string): Promise<boolean> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx.select({ id: mouvementsBancaires.id }).from(mouvementsBancaires).where(eq(mouvementsBancaires.pieceCle, cle)).limit(1);
    return Boolean(l);
  });
}
