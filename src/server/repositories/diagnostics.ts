/**
 * Les diagnostics d'une entreprise — isolés par RLS, comme tout le reste.
 *
 * **Tout passe par `withEntreprise`**, sans exception : une requête hors de ce
 * cadre ne renvoie rien, *silencieusement* (`CLAUDE.md` §3). La file de purge
 * des photos porte l'entreprise, exactement comme `audios_a_purger` — jamais un
 * contournement de la RLS pour se simplifier la vie (§4).
 */

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import {
  chantiers,
  diagnostics,
  dossiersDiagnostic,
  hypothesesDiagnostic,
  photosDiagnostic,
  photosDiagnosticAPurger,
} from "../db/schema";
import type { Ctx } from "./context";
import { echeanceDePurge, type PolitiqueRetentionPhotos } from "@/lib/retention-diagnostic";
import type { Confiance, MotifRefus, Partie, ResultatFige } from "@/lib/diagnostic-vegetal";

export type PhotoEnregistree = {
  storageKey: string;
  mimeType: string;
  tailleOctets: number;
  checksum: string;
  role: "initiale" | "complement";
  partieDemandee: Partie | null;
  /** **Prouvé ligne par ligne**, jamais supposé : la colonne permet de vérifier
   *  après coup que toutes les photos rangées ont bien été nettoyées. */
  exifRetire: boolean;
};

export async function ouvrirDiagnostic(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx
      .insert(diagnostics)
      .values({ entrepriseId: ctx.entrepriseId, statut: "en_analyse" })
      .returning({ id: diagnostics.id });
    return row.id;
  });
}

/**
 * Ranger une photo et programmer sa purge.
 *
 * **L'échéance est calculée ICI, à l'écriture**, depuis la politique
 * configurable — jamais gravée dans le code (sa consigne du 20 août). Une
 * politique qui ne purge pas (`0`) n'inscrit simplement rien dans la file :
 * mieux qu'y ranger une échéance lointaine qu'il faudrait ensuite se rappeler
 * d'ignorer.
 */
export async function ajouterPhoto(
  ctx: Ctx,
  diagnosticId: string,
  photo: PhotoEnregistree,
  politique: PolitiqueRetentionPhotos
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [diagnostic] = await tx
      .select({ chantierId: diagnostics.chantierId, dossierId: diagnostics.dossierId })
      .from(diagnostics)
      .where(eq(diagnostics.id, diagnosticId))
      .limit(1);
    if (!diagnostic) return null;

    const [row] = await tx
      .insert(photosDiagnostic)
      .values({ entrepriseId: ctx.entrepriseId, diagnosticId, ...photo })
      .returning({ id: photosDiagnostic.id, createdAt: photosDiagnostic.createdAt });

    const rangee = diagnostic.chantierId !== null || diagnostic.dossierId !== null;
    const echeance = echeanceDePurge(row.createdAt, rangee, politique);
    if (echeance) {
      await tx.insert(photosDiagnosticAPurger).values({
        photoId: row.id,
        entrepriseId: ctx.entrepriseId,
        storageKey: photo.storageKey,
        purgerLe: echeance,
      });
    }
    return row.id;
  });
}

export async function lirePhotos(ctx: Ctx, diagnosticId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select()
      .from(photosDiagnostic)
      .where(and(eq(photosDiagnostic.diagnosticId, diagnosticId), isNull(photosDiagnostic.purgeeLe)))
      .orderBy(photosDiagnostic.createdAt)
  );
}

export type Traces = { moteur: string; modele: string; versionBase: string };

export type Issue =
  | { type: "rendu"; ficheId: string; confiance: Confiance; resultat: ResultatFige }
  | { type: "complement"; consigne: string; partie: Partie | null }
  /** La CLÉ du refus, jamais sa phrase : l'écran la compose depuis la liste
   *  fermée, et sait ainsi quel geste proposer (migration 0087). */
  | { type: "inconclusif"; motif: MotifRefus }
  /** Ce que le fournisseur a dit — une trace pour qui dépanne. */
  | { type: "echoue"; panne: string };

/**
 * Écrire l'issue d'une analyse.
 *
 * **Le résultat est FIGÉ ici et ne bouge plus.** Une fiche corrigée demain ne
 * réécrit pas ce qu'il a lu aujourd'hui — sans quoi un diagnostic contesté six
 * mois plus tard deviendrait impossible à relire, au moment précis où on en a
 * besoin. Même raisonnement que l'instantané d'un devis envoyé.
 *
 * **`complementsDemandes` s'incrémente en SQL, jamais depuis une valeur lue en
 * JavaScript** : deux photos envoyées coup sur coup depuis un téléphone qui
 * rame se marcheraient dessus, et l'invariant « une seule relance » tomberait
 * précisément dans le cas qu'il doit couvrir.
 */
export async function conclureDiagnostic(
  ctx: Ctx,
  diagnosticId: string,
  issue: Issue,
  observation: unknown,
  traces: Traces,
  essence: { taxonId: string | null; certitude: string | null }
) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const commun = {
      observation: observation as object,
      moteur: traces.moteur,
      modele: traces.modele,
      versionBase: traces.versionBase,
      taxonId: essence.taxonId,
      essenceConfiance: essence.certitude,
      updatedAt: new Date(),
    };

    if (issue.type === "rendu") {
      await tx
        .update(diagnostics)
        .set({
          ...commun,
          statut: "rendu",
          ficheId: issue.ficheId,
          confiance: issue.confiance,
          resultat: issue.resultat,
          refus: null,
          panne: null,
          renduAt: new Date(),
        })
        .where(eq(diagnostics.id, diagnosticId));
      return;
    }

    if (issue.type === "complement") {
      await tx
        .update(diagnostics)
        .set({
          ...commun,
          statut: "complement_demande",
          complementConsigne: issue.consigne,
          complementPartie: issue.partie,
          complementsDemandes: sql`${diagnostics.complementsDemandes} + 1`,
        })
        .where(eq(diagnostics.id, diagnosticId));
      return;
    }

    await tx
      .update(diagnostics)
      .set({
        ...commun,
        statut: issue.type,
        refus: issue.type === "inconclusif" ? issue.motif : null,
        panne: issue.type === "echoue" ? issue.panne : null,
        renduAt: new Date(),
      })
      .where(eq(diagnostics.id, diagnosticId));
  });
}

/**
 * Ranger les hypothèses internes.
 *
 * **Jamais affichées** — elles existent pour qu'un diagnostic fautif puisse
 * s'expliquer six mois plus tard. Le score est écrit en millièmes entiers, et
 * cette échelle inhabituelle est délibérée : elle décourage de l'afficher comme
 * un pourcentage, ce qu'il n'est pas.
 *
 * Bornées à dix : au-delà, on range du bruit qu'aucune relecture n'ouvrira.
 */
export async function ecrireHypotheses(
  ctx: Ctx,
  diagnosticId: string,
  hypotheses: { ficheId: string; score: number; motifs: unknown[] }[]
) {
  if (hypotheses.length === 0) return;
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.delete(hypothesesDiagnostic).where(eq(hypothesesDiagnostic.diagnosticId, diagnosticId));
    await tx.insert(hypothesesDiagnostic).values(
      hypotheses.slice(0, 10).map((h, i) => ({
        entrepriseId: ctx.entrepriseId,
        diagnosticId,
        ficheId: h.ficheId,
        rang: i + 1,
        score: Math.round(h.score * 1000),
        motifs: h.motifs,
      }))
    );
  });
}

export async function lireDiagnostic(ctx: Ctx, diagnosticId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx.select().from(diagnostics).where(eq(diagnostics.id, diagnosticId)).limit(1);
    return row ?? null;
  });
}

export async function listerDiagnostics(ctx: Ctx, limite = 20) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: diagnostics.id,
        statut: diagnostics.statut,
        confiance: diagnostics.confiance,
        resultat: diagnostics.resultat,
        chantierId: diagnostics.chantierId,
        createdAt: diagnostics.createdAt,
      })
      .from(diagnostics)
      .orderBy(desc(diagnostics.createdAt))
      .limit(limite)
  );
}

export type RefusRangement = "diagnostic_absent" | "chantier_absent" | "dossier_absent";

/** Où il range, une fois le nom d'un dossier neuf relu par `lireNomDeDossier`. */
export type DestinationLue =
  | { genre: "chantier"; id: string }
  | { genre: "dossier"; id: string }
  | { genre: "nouveau"; nom: string };

/**
 * Ranger un diagnostic dans un dossier, avec sa note — **après coup, et
 * facultativement** (sa demande du 20 novembre 2026, migration 0189).
 *
 * Sa règle du 20 août tient toujours : le diagnostic fonctionne seul, aucun
 * dossier n'est nécessaire. **Un chantier est un dossier** ; ses dossiers à
 * lui servent à ce qui n'en a pas. UNE place par diagnostic : ranger ailleurs
 * déplace, la base refuse les deux à la fois (`diagnostics_une_seule_place_ck`).
 *
 * **L'échéance de purge des photos est RECALCULÉE**, et c'est le vrai travail
 * de cette fonction. Une photo prise libre était programmée pour disparaître
 * dans trois mois ; rangée, elle devient une pièce du dossier et suit la règle
 * d'un chantier. Un dossier à lui suit la même : il range pour retrouver, et
 * un dossier qui se viderait seul trahirait exactement ce qu'il a demandé.
 *
 * **La date du rangement ne bouge que si la place change** : corriger sa note
 * ne doit pas faire croire qu'il a rangé la photo aujourd'hui.
 *
 * L'existence du chantier ou du dossier est revérifiée SOUS RLS : elle ne se
 * déduit pas de ce que l'écran a envoyé.
 */
export async function rangerDansUnDossier(
  ctx: Ctx,
  diagnosticId: string,
  destination: DestinationLue,
  note: string | null,
  politique: PolitiqueRetentionPhotos
): Promise<{ ok: true } | { ok: false; refus: RefusRangement }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    let chantierId: string | null = null;
    let dossierId: string | null = null;

    if (destination.genre === "chantier") {
      const [chantier] = await tx
        .select({ id: chantiers.id })
        .from(chantiers)
        .where(and(eq(chantiers.id, destination.id), isNull(chantiers.deletedAt)))
        .limit(1);
      if (!chantier) return { ok: false as const, refus: "chantier_absent" as const };
      chantierId = chantier.id;
    } else if (destination.genre === "dossier") {
      const [dossier] = await tx
        .select({ id: dossiersDiagnostic.id })
        .from(dossiersDiagnostic)
        .where(eq(dossiersDiagnostic.id, destination.id))
        .limit(1);
      if (!dossier) return { ok: false as const, refus: "dossier_absent" as const };
      dossierId = dossier.id;
    } else {
      // Un nom déjà pris désigne le dossier qui le porte : deux dossiers du
      // même nom se confondraient dans la feuille (`dossiers_diagnostic_nom_uk`).
      await tx
        .insert(dossiersDiagnostic)
        .values({ entrepriseId: ctx.entrepriseId, nom: destination.nom })
        .onConflictDoNothing();
      const [dossier] = await tx
        .select({ id: dossiersDiagnostic.id })
        .from(dossiersDiagnostic)
        .where(sql`lower(btrim(${dossiersDiagnostic.nom})) = lower(btrim(${destination.nom}))`)
        .limit(1);
      if (!dossier) return { ok: false as const, refus: "dossier_absent" as const };
      dossierId = dossier.id;
    }

    const [avant] = await tx
      .select({ chantierId: diagnostics.chantierId, dossierId: diagnostics.dossierId, rangeLe: diagnostics.rangeLe })
      .from(diagnostics)
      .where(eq(diagnostics.id, diagnosticId))
      .limit(1);
    if (!avant) return { ok: false as const, refus: "diagnostic_absent" as const };
    const memePlace = avant.chantierId === chantierId && avant.dossierId === dossierId;

    await tx
      .update(diagnostics)
      .set({
        chantierId,
        dossierId,
        note,
        rangeLe: memePlace ? avant.rangeLe : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(diagnostics.id, diagnosticId));

    const photos = await tx
      .select({ id: photosDiagnostic.id, storageKey: photosDiagnostic.storageKey, createdAt: photosDiagnostic.createdAt })
      .from(photosDiagnostic)
      .where(and(eq(photosDiagnostic.diagnosticId, diagnosticId), isNull(photosDiagnostic.purgeeLe)));

    for (const photo of photos) {
      if (!photo.storageKey) continue;
      const echeance = echeanceDePurge(photo.createdAt, true, politique);
      await tx.delete(photosDiagnosticAPurger).where(eq(photosDiagnosticAPurger.photoId, photo.id));
      if (echeance) {
        await tx.insert(photosDiagnosticAPurger).values({
          photoId: photo.id,
          entrepriseId: ctx.entrepriseId,
          storageKey: photo.storageKey,
          purgerLe: echeance,
        });
      }
    }
    return { ok: true as const };
  });
}

/** Où le diagnostic est rangé, pour la fiche : le nom du chantier ou du
 *  dossier, et le jour. Nul tant qu'il n'est rangé nulle part. */
export async function lireRangement(ctx: Ctx, diagnosticId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx
      .select({
        chantierId: diagnostics.chantierId,
        dossierId: diagnostics.dossierId,
        note: diagnostics.note,
        rangeLe: diagnostics.rangeLe,
        nomChantier: chantiers.nom,
        nomDossier: dossiersDiagnostic.nom,
      })
      .from(diagnostics)
      .leftJoin(chantiers, and(eq(chantiers.id, diagnostics.chantierId), isNull(chantiers.deletedAt)))
      .leftJoin(dossiersDiagnostic, eq(dossiersDiagnostic.id, diagnostics.dossierId))
      .where(eq(diagnostics.id, diagnosticId))
      .limit(1);
    const nom = d?.nomChantier ?? d?.nomDossier ?? null;
    if (!d || !nom) return null;
    return {
      nom,
      note: d.note,
      rangeLe: d.rangeLe,
      chantierId: d.nomChantier ? d.chantierId : null,
      dossierId: d.nomDossier ? d.dossierId : null,
    };
  });
}

/** Ses dossiers à lui, pour la feuille « Ranger cette photo ». */
export async function listerMesDossiers(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({ id: dossiersDiagnostic.id, nom: dossiersDiagnostic.nom })
      .from(dossiersDiagnostic)
      .orderBy(dossiersDiagnostic.nom)
  );
}

export type DossierDeDiagnostics = {
  id: string;
  genre: "chantier" | "dossier";
  nom: string;
  nombre: number;
  derniere: Date | null;
};

/**
 * « Mes dossiers » sur l'écran Diagnostic : les chantiers qui portent au moins
 * un diagnostic, et ses dossiers à lui, le plus récent d'abord. Un chantier
 * sans diagnostic n'y figure pas : la liste de ses chantiers existe ailleurs.
 */
export async function lireMesDossiersDeDiagnostics(ctx: Ctx): Promise<DossierDeDiagnostics[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const desChantiers = await tx
      .select({
        id: chantiers.id,
        nom: chantiers.nom,
        nombre: sql<number>`count(${diagnostics.id})::int`,
        derniere: sql<Date | null>`max(${diagnostics.createdAt})`,
      })
      .from(diagnostics)
      .innerJoin(chantiers, and(eq(chantiers.id, diagnostics.chantierId), isNull(chantiers.deletedAt)))
      .groupBy(chantiers.id, chantiers.nom);
    const lesSiens = await tx
      .select({
        id: dossiersDiagnostic.id,
        nom: dossiersDiagnostic.nom,
        nombre: sql<number>`count(${diagnostics.id})::int`,
        derniere: sql<Date | null>`max(${diagnostics.createdAt})`,
      })
      .from(dossiersDiagnostic)
      .leftJoin(diagnostics, eq(diagnostics.dossierId, dossiersDiagnostic.id))
      .groupBy(dossiersDiagnostic.id, dossiersDiagnostic.nom);
    const date = (v: Date | string | null) => (v === null ? null : new Date(v));
    return [
      ...desChantiers.map((c) => ({ ...c, genre: "chantier" as const, derniere: date(c.derniere) })),
      ...lesSiens.map((d) => ({ ...d, genre: "dossier" as const, derniere: date(d.derniere) })),
    ].sort((a, b) => (b.derniere?.getTime() ?? 0) - (a.derniere?.getTime() ?? 0));
  });
}

/**
 * Un dossier et ses diagnostics : le chantier ou le dossier à lui que désigne
 * cet identifiant (deux UUID ne se rencontrent pas), revérifié sous RLS. Chaque
 * diagnostic porte sa première photo encore gardée, pour la vignette.
 */
export async function lireUnDossierDeDiagnostics(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [chantier] = await tx
      .select({ nom: chantiers.nom })
      .from(chantiers)
      .where(and(eq(chantiers.id, id), isNull(chantiers.deletedAt)))
      .limit(1);
    const [dossier] = chantier
      ? []
      : await tx.select({ nom: dossiersDiagnostic.nom }).from(dossiersDiagnostic).where(eq(dossiersDiagnostic.id, id)).limit(1);
    if (!chantier && !dossier) return null;
    const genre = chantier ? ("chantier" as const) : ("dossier" as const);

    const lignes = await tx
      .select({
        id: diagnostics.id,
        statut: diagnostics.statut,
        resultat: diagnostics.resultat,
        note: diagnostics.note,
        createdAt: diagnostics.createdAt,
      })
      .from(diagnostics)
      .where(genre === "chantier" ? eq(diagnostics.chantierId, id) : eq(diagnostics.dossierId, id))
      .orderBy(desc(diagnostics.createdAt));

    const photos =
      lignes.length === 0
        ? []
        : await tx
            .select({ id: photosDiagnostic.id, diagnosticId: photosDiagnostic.diagnosticId })
            .from(photosDiagnostic)
            .where(
              and(
                inArray(
                  photosDiagnostic.diagnosticId,
                  lignes.map((l) => l.id)
                ),
                isNull(photosDiagnostic.purgeeLe)
              )
            )
            .orderBy(photosDiagnostic.createdAt);
    const premiere = new Map<string, string>();
    for (const p of photos) if (!premiere.has(p.diagnosticId)) premiere.set(p.diagnosticId, p.id);

    return {
      genre,
      nom: (chantier ?? dossier).nom,
      diagnostics: lignes.map((l) => ({
        id: l.id,
        statut: l.statut,
        nomDeLaFiche: (l.resultat as ResultatFige | null)?.nom ?? null,
        note: l.note,
        createdAt: l.createdAt,
        photoId: premiere.get(l.id) ?? null,
      })),
    };
  });
}

/** La clé de stockage d'une de SES photos de diagnostic, encore gardée. Par
 *  identifiant seulement : une clé reçue de l'extérieur ne se sert jamais. */
export async function lireClePhotoDiagnostic(ctx: Ctx, photoId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [photo] = await tx
      .select({ storageKey: photosDiagnostic.storageKey })
      .from(photosDiagnostic)
      .where(
        and(
          eq(photosDiagnostic.id, photoId),
          // En défense en profondeur, comme `/api/fichiers` : la RLS suffit
          // sous `atlas_app`, plus dès que le rôle change.
          eq(photosDiagnostic.entrepriseId, ctx.entrepriseId),
          isNull(photosDiagnostic.purgeeLe)
        )
      )
      .limit(1);
    return photo?.storageKey ?? null;
  });
}
