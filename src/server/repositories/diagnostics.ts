/**
 * Les diagnostics d'une entreprise — isolés par RLS, comme tout le reste.
 *
 * **Tout passe par `withEntreprise`**, sans exception : une requête hors de ce
 * cadre ne renvoie rien, *silencieusement* (`CLAUDE.md` §3). La file de purge
 * des photos porte l'entreprise, exactement comme `audios_a_purger` — jamais un
 * contournement de la RLS pour se simplifier la vie (§4).
 */

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import {
  chantiers,
  diagnostics,
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
      .select({ chantierId: diagnostics.chantierId })
      .from(diagnostics)
      .where(eq(diagnostics.id, diagnosticId))
      .limit(1);
    if (!diagnostic) return null;

    const [row] = await tx
      .insert(photosDiagnostic)
      .values({ entrepriseId: ctx.entrepriseId, diagnosticId, ...photo })
      .returning({ id: photosDiagnostic.id, createdAt: photosDiagnostic.createdAt });

    const echeance = echeanceDePurge(row.createdAt, diagnostic.chantierId !== null, politique);
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
  | { type: "inconclusif"; motif: MotifRefus; phrase: string }
  | { type: "echoue"; phrase: string };

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
          motifRefus: null,
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
        statut: issue.type === "echoue" ? "echoue" : "inconclusif",
        motifRefus: issue.phrase,
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

export type RefusRattachement = "diagnostic_absent" | "chantier_absent";

/**
 * Rattacher un diagnostic à un chantier — **après coup, et facultativement**.
 *
 * Sa règle du 20 août : le diagnostic fonctionne de manière totalement
 * autonome ; aucun chantier n'est nécessaire. C'est la même objection qu'il
 * avait faite pour le plan d'arrosage : un outil qui exige un chantier ne sert
 * pas en visite de devis, quand le client n'existe pas encore.
 *
 * **L'échéance de purge des photos est RECALCULÉE**, et c'est le vrai travail
 * de cette fonction. Une photo prise libre était programmée pour disparaître
 * dans trois mois ; versée au dossier d'un chantier, elle devient une pièce du
 * dossier et suit sa règle. L'oublier viderait le dossier d'un client toujours
 * en cours, sans que personne ait rien demandé.
 *
 * L'existence du chantier est revérifiée SOUS RLS : elle ne se déduit pas de ce
 * que l'écran a envoyé.
 */
export async function rattacherAUnChantier(
  ctx: Ctx,
  diagnosticId: string,
  chantierId: string,
  politique: PolitiqueRetentionPhotos
): Promise<{ ok: true } | { ok: false; refus: RefusRattachement }> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [chantier] = await tx
      .select({ id: chantiers.id })
      .from(chantiers)
      .where(eq(chantiers.id, chantierId))
      .limit(1);
    if (!chantier) return { ok: false as const, refus: "chantier_absent" as const };

    const misAJour = await tx
      .update(diagnostics)
      .set({ chantierId, updatedAt: new Date() })
      .where(eq(diagnostics.id, diagnosticId))
      .returning({ id: diagnostics.id });
    if (misAJour.length === 0) return { ok: false as const, refus: "diagnostic_absent" as const };

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
