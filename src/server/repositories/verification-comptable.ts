import { and, asc, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { dossiersComptables, entreprises, envoisComptable, verdictsComptable } from "../db/schema";
import { empreinteDuJeton, tirerUnJeton } from "../empreinte-du-code";
import {
  VALIDITE_LIEN_COMPTABLE_JOURS,
  avancementDeLaVerification,
  etatDeVerification,
  noteDuRejet,
  type EtatDeVerification,
  type VerdictDuComptable,
} from "@/lib/pour-mon-comptable";
import { lireLesLignes, pieceDeLaLigne, type LigneDuReleve } from "./pour-mon-comptable";
import type { Ctx } from "./context";

/**
 * POUR MON COMPTABLE, LOT 4 — le comptable vérifie, par un lien privé
 * (migration 0145, écran 7 de `appli/pour-mon-comptable.html`).
 *
 * Le comptable n'a pas de compte. Comme le client devant son devis
 * (`envois-devis.ts`, `lireParJeton`), la transaction pose d'abord l'empreinte
 * de son jeton, qui ouvre SA ligne d'envoi et elle seule (politique dédiée),
 * puis l'entreprise lue sur cet envoi : le reste se lit sous l'isolation
 * ordinaire. Jamais une entreprise venue du navigateur.
 */

export type Refus = { ok: false; raison: string };

export type LignePourLeComptable = LigneDuReleve & { verification: EtatDeVerification };

export type DossierPourLeComptable = {
  entreprise: string;
  du: string;
  au: string;
  envoyeLe: Date;
  lignes: LignePourLeComptable[];
};

/** Un nouveau lien pour ce dossier. Le jeton n'est rendu qu'ici : la base n'en garde que l'empreinte. */
export async function creerLienComptable(ctx: Ctx, dossierId: string, maintenant: Date): Promise<{ ok: true; jeton: string } | Refus> {
  const jeton = tirerUnJeton();
  try {
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.insert(envoisComptable).values({
        entrepriseId: ctx.entrepriseId,
        dossierId,
        jetonEmpreinte: empreinteDuJeton(jeton),
        creePar: ctx.utilisateurId,
        expireLe: new Date(maintenant.getTime() + VALIDITE_LIEN_COMPTABLE_JOURS * 86_400_000),
      })
    );
  } catch (err) {
    // La clé double refuse un dossier d'une autre entreprise, ou inconnu.
    const e = err as { code?: string; cause?: { code?: string } };
    if ((e?.cause?.code ?? e?.code) === "23503") return { ok: false, raison: "Ce dossier n'existe pas." };
    throw err;
  }
  return { ok: true, jeton };
}

/**
 * Ouvre la transaction sur le dossier du jeton : l'envoi d'abord (par son
 * empreinte), puis son entreprise. Rien pour un jeton inconnu ou expiré.
 */
async function ouvrir(tx: DbOrTx, jeton: string, maintenant: Date) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(jeton)) return null;
  await tx.execute(sql`SELECT set_config('app.jeton_comptable', ${empreinteDuJeton(jeton)}, true)`);
  const [envoi] = await tx.select().from(envoisComptable).where(eq(envoisComptable.jetonEmpreinte, empreinteDuJeton(jeton))).limit(1);
  if (!envoi || envoi.expireLe.getTime() <= maintenant.getTime()) return null;
  await tx.execute(sql`SELECT set_config('app.entreprise_id', ${envoi.entrepriseId}, true)`);
  const [dossier] = await tx.select().from(dossiersComptables).where(eq(dossiersComptables.id, envoi.dossierId)).limit(1);
  if (!dossier) return null;
  return { envoi, dossier };
}

async function verdictsDuDossier(tx: DbOrTx, dossierId: string) {
  const v = await tx.select().from(verdictsComptable).where(eq(verdictsComptable.dossierId, dossierId));
  return new Map(v.map((x) => [x.mouvementId, x]));
}

function avecVerification(lignes: LigneDuReleve[], verdicts: Map<string, typeof verdictsComptable.$inferSelect>): LignePourLeComptable[] {
  return lignes.map((l) => ({ ...l, verification: etatDeVerification(verdicts.get(l.id) ?? null, l.justifieLe) }));
}

/** Le dossier tel que le comptable le vérifie, ou rien. */
export async function dossierParJeton(jeton: string, maintenant: Date = new Date()): Promise<DossierPourLeComptable | null> {
  return db.transaction(async (tx) => {
    const ouvert = await ouvrir(tx, jeton, maintenant);
    if (!ouvert) return null;
    const { envoi, dossier } = ouvert;
    const [ent] = await tx.select({ nom: entreprises.nom }).from(entreprises).where(eq(entreprises.id, envoi.entrepriseId)).limit(1);
    const lignes = await lireLesLignes(tx, dossier.du, dossier.au);
    return {
      entreprise: ent?.nom ?? "",
      du: dossier.du,
      au: dossier.au,
      envoyeLe: envoi.creeLe,
      lignes: avecVerification(lignes, await verdictsDuDossier(tx, dossier.id)),
    };
  });
}

/**
 * Valider, rejeter, ou enlever le verdict (`null`) d'une ligne du dossier.
 * La ligne doit être DANS la période du dossier : un jeton n'ouvre pas le
 * reste du relevé.
 */
export async function poserVerdictParJeton(
  jeton: string,
  mouvementId: string,
  verdict: VerdictDuComptable | null,
  note: string | null,
  maintenant: Date = new Date()
): Promise<{ ok: true } | Refus> {
  return db.transaction(async (tx) => {
    const ouvert = await ouvrir(tx, jeton, maintenant);
    if (!ouvert) return { ok: false as const, raison: "Ce lien n'est plus valable. Demandez-en un nouveau." };
    const { dossier } = ouvert;
    const ligne = (await lireLesLignes(tx, dossier.du, dossier.au)).find((l) => l.id === mouvementId);
    if (!ligne) return { ok: false as const, raison: "Cette ligne n'est pas dans le dossier." };

    const avant = (await verdictsDuDossier(tx, dossier.id)).get(mouvementId) ?? null;
    if (verdict === null) {
      await tx.delete(verdictsComptable).where(and(eq(verdictsComptable.dossierId, dossier.id), eq(verdictsComptable.mouvementId, mouvementId)));
      return { ok: true as const };
    }
    const etatAvant = etatDeVerification(avant, ligne.justifieLe);
    const valeurs = {
      verdict,
      note: verdict === "rejete" ? noteDuRejet(note) : null,
      avaitValide: verdict === "rejete" && (etatAvant.etat === "valide" || (etatAvant.etat === "rejete" && etatAvant.avaitValide)),
      ligneJustifieeLe: ligne.justifieLe,
      poseLe: maintenant,
    };
    await tx
      .insert(verdictsComptable)
      .values({ entrepriseId: dossier.entrepriseId, dossierId: dossier.id, mouvementId, ...valeurs })
      .onConflictDoUpdate({ target: [verdictsComptable.dossierId, verdictsComptable.mouvementId], set: valeurs });
    return { ok: true as const };
  });
}

/** Le fichier d'une pièce de la ligne (photo du ticket, facture reçue), pour le comptable. */
export async function pieceParJeton(
  jeton: string,
  mouvementId: string,
  maintenant: Date = new Date()
): Promise<{ cle: string; nature: "photo" | "pdf" } | null> {
  return db.transaction(async (tx) => {
    const ouvert = await ouvrir(tx, jeton, maintenant);
    if (!ouvert) return null;
    const ligne = (await lireLesLignes(tx, ouvert.dossier.du, ouvert.dossier.au)).find((l) => l.id === mouvementId);
    if (!ligne) return null;
    return pieceDeLaLigne(ligne);
  });
}

export type VerificationDuDossier = {
  dossierId: string;
  /** Rien tant qu'aucun lien n'est parti. */
  envoye: boolean;
  verifiees: number;
  total: number;
  rejets: { ligne: LigneDuReleve; note: string | null; avaitValide: boolean }[];
};

/** Pour le patron, dans Mes dossiers : où en est son comptable, et ce qu'il a rejeté. */
export async function verificationsDesDossiers(ctx: Ctx): Promise<VerificationDuDossier[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const dossiers = await tx.select().from(dossiersComptables).orderBy(asc(dossiersComptables.du));
    const envois = new Set((await tx.select({ d: envoisComptable.dossierId }).from(envoisComptable)).map((e) => e.d));
    const resultat: VerificationDuDossier[] = [];
    for (const d of dossiers) {
      const lignes = avecVerification(await lireLesLignes(tx, d.du, d.au), await verdictsDuDossier(tx, d.id));
      const a = avancementDeLaVerification(lignes.map((l) => l.verification));
      resultat.push({
        dossierId: d.id,
        envoye: envois.has(d.id),
        verifiees: a.verifiees,
        total: a.total,
        rejets: lignes.flatMap((l) =>
          l.verification.etat === "rejete"
            ? [{ ligne: l, note: l.verification.note, avaitValide: l.verification.avaitValide }]
            : []
        ),
      });
    }
    return resultat;
  });
}
