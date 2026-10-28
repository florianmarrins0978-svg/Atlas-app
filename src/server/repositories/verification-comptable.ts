import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import { attestationsComptable, dossiersComptables, entreprises, envoisComptable, retoursComptable, verdictsComptable } from "../db/schema";
import { empreinteDuJeton, tirerUnJeton } from "../empreinte-du-code";
import {
  VALIDITE_LIEN_COMPTABLE_JOURS,
  avancementDeLaVerification,
  etatDeVerification,
  noteDuRejet,
  type EtatDeVerification,
  type VerdictDuComptable,
} from "@/lib/pour-mon-comptable";
import { attestationAJour, type Conclusion, type LigneAttestee, type SaisieLue } from "@/lib/attestation-comptable";
import { courrielDuRetour } from "@/lib/retour-comptable";
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
  /** L'empreinte du PDF du dossier : l'attestation la cite, et la lie ainsi au fichier exact. */
  empreinte: string;
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
      empreinte: dossier.empreinte,
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
  /** La dernière attestation signée, et si elle vaut encore pour le dossier tel qu'il est. */
  attestation: AttestationDuDossier | null;
  /** Le dernier renvoi à corriger, et combien de lignes l'attendent « corrigées ». */
  retour: RetourDuDossier | null;
  corrigees: number;
};

/** Pour le patron, dans Mes dossiers : où en est son comptable, et ce qu'il a rejeté. */
export async function verificationsDesDossiers(ctx: Ctx): Promise<VerificationDuDossier[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const dossiers = await tx.select().from(dossiersComptables).orderBy(asc(dossiersComptables.du));
    const envois = new Set((await tx.select({ d: envoisComptable.dossierId }).from(envoisComptable)).map((e) => e.d));
    const resultat: VerificationDuDossier[] = [];
    for (const d of dossiers) {
      const brutes = await lireLesLignes(tx, d.du, d.au);
      const verdicts = await verdictsDuDossier(tx, d.id);
      const lignes = avecVerification(brutes, verdicts);
      const a = avancementDeLaVerification(lignes.map((l) => l.verification));
      resultat.push({
        dossierId: d.id,
        envoye: envois.has(d.id),
        verifiees: a.verifiees,
        total: a.total,
        attestation: await derniereAttestation(tx, d.id, brutes, verdicts),
        retour: await dernierRetour(tx, d.id),
        corrigees: lignes.filter((l) => l.verification.etat === "corrigee").length,
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

// ─── Lot 6 : l'attestation qu'il signe (migration 0151) ─────────────────────

export type AttestationDuDossier = {
  id: string;
  conclusion: Conclusion;
  lignes: number;
  validees: number;
  rejetees: number;
  signataireNom: string;
  signataireSociete: string;
  signeLe: Date;
  /** Rien n'a bougé depuis la signature : ni verdict, ni justification. */
  aJour: boolean;
};

/**
 * La dernière attestation du dossier, et si elle vaut encore. Le patron qui
 * reprend une ligne rejetée, le comptable qui change un verdict : l'une ou
 * l'autre, posée APRÈS la signature, la rend périmée (`attestationAJour`).
 */
async function derniereAttestation(
  tx: DbOrTx,
  dossierId: string,
  lignes: LigneDuReleve[],
  verdicts: Map<string, typeof verdictsComptable.$inferSelect>
): Promise<AttestationDuDossier | null> {
  const [a] = await tx
    .select()
    .from(attestationsComptable)
    .where(eq(attestationsComptable.dossierId, dossierId))
    .orderBy(desc(attestationsComptable.signeLe))
    .limit(1);
  if (!a) return null;
  const etats = avecVerification(lignes, verdicts).map((l) => l.verification);
  const av = avancementDeLaVerification(etats);
  const changements = [...lignes.map((l) => l.justifieLe), ...[...verdicts.values()].map((v) => v.poseLe)];
  return {
    id: a.id,
    conclusion: a.conclusion,
    lignes: a.lignes,
    validees: a.validees,
    rejetees: a.rejetees,
    signataireNom: a.signataireNom,
    signataireSociete: a.signataireSociete,
    signeLe: a.signeLe,
    aJour: attestationAJour(a.signeLe, changements, av.total > 0 && av.verifiees === av.total),
  };
}

/** L'attestation que le comptable a signée sur ce lien, ou rien. */
export async function attestationParJeton(jeton: string, maintenant: Date = new Date()): Promise<AttestationDuDossier | null> {
  return db.transaction(async (tx) => {
    const ouvert = await ouvrir(tx, jeton, maintenant);
    if (!ouvert) return null;
    const { dossier } = ouvert;
    return derniereAttestation(tx, dossier.id, await lireLesLignes(tx, dossier.du, dossier.au), await verdictsDuDossier(tx, dossier.id));
  });
}

export type DossierASigner = {
  entrepriseId: string;
  entreprise: string;
  /** L'adresse de l'entreprise, pour l'avis : rien si elle n'en a pas donné. */
  email: string | null;
  du: string;
  au: string;
  empreinteDuDossier: string;
  lignes: LigneAttestee[];
  /** Ce que la signature a vu : si l'état bouge avant le rangement, elle ne se range pas. */
  etat: string;
};

/** L'état des verdicts du dossier, en une chaîne : deux lectures qui l'égalent ont vu le même dossier. */
function etatDesVerdicts(verdicts: Map<string, typeof verdictsComptable.$inferSelect>): string {
  return [...verdicts.values()]
    .map((v) => `${v.mouvementId}:${v.verdict}:${v.poseLe.getTime()}`)
    .sort()
    .join("|");
}

/**
 * Le dossier tel que le comptable s'apprête à le signer. **Refusé tant qu'une
 * ligne reste à vérifier** : une attestation porte sur le dossier entier.
 */
export async function dossierASignerParJeton(jeton: string, maintenant: Date): Promise<{ ok: true; dossier: DossierASigner } | Refus> {
  return db.transaction(async (tx) => {
    const ouvert = await ouvrir(tx, jeton, maintenant);
    if (!ouvert) return { ok: false as const, raison: "Ce lien n'est plus valable. Demandez-en un nouveau." };
    const { envoi, dossier } = ouvert;
    const [ent] = await tx.select({ nom: entreprises.nom, email: entreprises.email }).from(entreprises).where(eq(entreprises.id, envoi.entrepriseId)).limit(1);
    const verdicts = await verdictsDuDossier(tx, dossier.id);
    const lignes = avecVerification(await lireLesLignes(tx, dossier.du, dossier.au), verdicts);
    if (lignes.length === 0 || lignes.some((l) => l.verification.etat !== "valide" && l.verification.etat !== "rejete")) {
      return { ok: false as const, raison: "Il reste des lignes à vérifier." };
    }
    return {
      ok: true as const,
      dossier: {
        entrepriseId: envoi.entrepriseId,
        entreprise: ent?.nom ?? "",
        email: ent?.email?.trim() || null,
        du: dossier.du,
        au: dossier.au,
        empreinteDuDossier: dossier.empreinte,
        lignes: lignes.map((l) => ({
          jour: l.jour,
          libelle: l.libelle || (l.contrepartie ?? ""),
          montant: l.montant,
          sens: l.sens,
          verdict: l.verification.etat === "rejete" ? ("rejete" as const) : ("valide" as const),
          note: l.verification.etat === "rejete" ? l.verification.note : null,
        })),
        etat: etatDesVerdicts(verdicts),
      },
    };
  });
}

/**
 * Range l'attestation signée. **Refusé si un verdict a bougé** depuis la
 * lecture : le PDF dirait un état que la base n'a plus.
 */
export async function rangerAttestationParJeton(
  jeton: string,
  a: { saisie: SaisieLue; etat: string; lignes: number; rejetees: number; fichierCle: string; tailleOctets: number; empreinte: string },
  maintenant: Date
): Promise<{ ok: true; attestation: AttestationDuDossier } | Refus> {
  return db.transaction(async (tx) => {
    const ouvert = await ouvrir(tx, jeton, maintenant);
    if (!ouvert) return { ok: false as const, raison: "Ce lien n'est plus valable. Demandez-en un nouveau." };
    const { dossier } = ouvert;
    if (etatDesVerdicts(await verdictsDuDossier(tx, dossier.id)) !== a.etat) {
      return { ok: false as const, raison: "Le dossier a changé pendant la signature. Relisez-le, puis signez à nouveau." };
    }
    const s = a.saisie.signataire;
    const [r] = await tx
      .insert(attestationsComptable)
      .values({
        entrepriseId: dossier.entrepriseId,
        dossierId: dossier.id,
        conclusion: a.saisie.conclusion,
        observations: a.saisie.observations,
        lignes: a.lignes,
        validees: a.lignes - a.rejetees,
        rejetees: a.rejetees,
        signataireNom: s.nom,
        signataireFonction: s.fonction,
        signataireSociete: s.societe,
        signataireOrdre: s.ordre,
        signataireSiren: s.siren,
        signataireAdresse: s.adresse,
        signataireEmail: s.email,
        signataireTelephone: s.telephone,
        fichierCle: a.fichierCle,
        tailleOctets: a.tailleOctets,
        empreinte: a.empreinte,
        signeLe: maintenant,
      })
      .returning();
    return {
      ok: true as const,
      attestation: {
        id: r.id,
        conclusion: r.conclusion,
        lignes: r.lignes,
        validees: r.validees,
        rejetees: r.rejetees,
        signataireNom: r.signataireNom,
        signataireSociete: r.signataireSociete,
        signeLe: r.signeLe,
        aJour: true,
      },
    };
  });
}

/** Le PDF de la dernière attestation de ce lien, pour que le comptable le garde. */
export async function fichierDeLAttestationParJeton(jeton: string, maintenant: Date = new Date()): Promise<{ cle: string } | null> {
  return db.transaction(async (tx) => {
    const ouvert = await ouvrir(tx, jeton, maintenant);
    if (!ouvert) return null;
    const [a] = await tx
      .select({ cle: attestationsComptable.fichierCle })
      .from(attestationsComptable)
      .where(eq(attestationsComptable.dossierId, ouvert.dossier.id))
      .orderBy(desc(attestationsComptable.signeLe))
      .limit(1);
    return a ?? null;
  });
}

/** Le PDF d'une attestation de l'entreprise, pour le patron. */
export async function fichierDeLAttestation(ctx: Ctx, id: string): Promise<{ cle: string } | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [a] = await tx.select({ cle: attestationsComptable.fichierCle }).from(attestationsComptable).where(eq(attestationsComptable.id, id)).limit(1);
    return a ?? null;
  });
}

export type AttestationAMontrer = { id: string; conclusion: Conclusion; signataireNom: string; lignes: number; rejetees: number; signeLe: Date };

/** Les attestations que le patron n'a pas encore vues, la plus récente d'abord : la carte de l'accueil. */
export async function attestationsAMontrer(ctx: Ctx): Promise<AttestationAMontrer[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({
        id: attestationsComptable.id,
        conclusion: attestationsComptable.conclusion,
        signataireNom: attestationsComptable.signataireNom,
        lignes: attestationsComptable.lignes,
        rejetees: attestationsComptable.rejetees,
        signeLe: attestationsComptable.signeLe,
      })
      .from(attestationsComptable)
      .where(isNull(attestationsComptable.vuLe))
      .orderBy(desc(attestationsComptable.signeLe))
  );
}

/** « J'ai vu » : la carte quitte l'accueil. L'attestation, elle, ne bouge pas. */
export async function marquerAttestationVue(ctx: Ctx, id: string): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .update(attestationsComptable)
      .set({ vuLe: sql`now()` })
      .where(and(eq(attestationsComptable.id, id), isNull(attestationsComptable.vuLe)))
  );
}

// ─── Lot 7 : renvoyer à corriger (migration 0152) ───────────────────────────

export type RetourDuDossier = { id: string; renvoyeLe: Date; message: string | null; email: string | null; rejetees: number };

async function dernierRetour(tx: DbOrTx, dossierId: string): Promise<RetourDuDossier | null> {
  const [r] = await tx
    .select({ id: retoursComptable.id, renvoyeLe: retoursComptable.renvoyeLe, message: retoursComptable.message, email: retoursComptable.email, rejetees: retoursComptable.rejetees })
    .from(retoursComptable)
    .where(eq(retoursComptable.dossierId, dossierId))
    .orderBy(desc(retoursComptable.renvoyeLe))
    .limit(1);
  return r ?? null;
}

/**
 * Le comptable renvoie le dossier à corriger. **Refusé sans ligne rejetée** :
 * les lignes à reprendre sont ses rejets, il n'y a rien d'autre à renvoyer.
 * L'avis part chez le patron, à l'adresse de son entreprise ; il ne porte rien
 * du dossier (`courrielDuRetour`).
 */
export async function renvoyerParJeton(
  jeton: string,
  r: { message: string | null; email: string | null },
  maintenant: Date
): Promise<{ ok: true; retour: RetourDuDossier; courriel: { a: string; objet: string; texte: string } | null } | Refus> {
  return db.transaction(async (tx) => {
    const ouvert = await ouvrir(tx, jeton, maintenant);
    if (!ouvert) return { ok: false as const, raison: "Ce lien n'est plus valable. Demandez-en un nouveau." };
    const { envoi, dossier } = ouvert;
    const lignes = avecVerification(await lireLesLignes(tx, dossier.du, dossier.au), await verdictsDuDossier(tx, dossier.id));
    const rejetees = lignes.filter((l) => l.verification.etat === "rejete").length;
    if (rejetees === 0) return { ok: false as const, raison: "Aucune ligne rejetée à renvoyer." };
    const [ent] = await tx.select({ email: entreprises.email }).from(entreprises).where(eq(entreprises.id, envoi.entrepriseId)).limit(1);
    const [retour] = await tx
      .insert(retoursComptable)
      .values({ entrepriseId: dossier.entrepriseId, dossierId: dossier.id, message: r.message, email: r.email, rejetees, renvoyeLe: maintenant })
      .returning({ id: retoursComptable.id, renvoyeLe: retoursComptable.renvoyeLe, message: retoursComptable.message, email: retoursComptable.email, rejetees: retoursComptable.rejetees });
    const email = ent?.email?.trim() || null;
    return { ok: true as const, retour, courriel: email ? { a: email, ...courrielDuRetour({ du: dossier.du, au: dossier.au, rejetees }) } : null };
  });
}

/** Le dernier renvoi de ce dossier, pour la page du comptable. */
export async function dernierRetourParJeton(jeton: string, maintenant: Date = new Date()): Promise<RetourDuDossier | null> {
  return db.transaction(async (tx) => {
    const ouvert = await ouvrir(tx, jeton, maintenant);
    return ouvert ? dernierRetour(tx, ouvert.dossier.id) : null;
  });
}

export type RetourAMontrer = { id: string; message: string | null; rejetees: number; renvoyeLe: Date };

/** Les renvois que le patron n'a pas encore vus, le plus récent d'abord : la carte de l'accueil. */
export async function retoursAMontrer(ctx: Ctx): Promise<RetourAMontrer[]> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .select({ id: retoursComptable.id, message: retoursComptable.message, rejetees: retoursComptable.rejetees, renvoyeLe: retoursComptable.renvoyeLe })
      .from(retoursComptable)
      .where(isNull(retoursComptable.vuLe))
      .orderBy(desc(retoursComptable.renvoyeLe))
  );
}

/** « J'ai vu » : la carte quitte l'accueil. La demande, elle, reste dans Mes dossiers. */
export async function marquerRetourVu(ctx: Ctx, id: string): Promise<void> {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx
      .update(retoursComptable)
      .set({ vuLe: sql`now()` })
      .where(and(eq(retoursComptable.id, id), isNull(retoursComptable.vuLe)))
  );
}
