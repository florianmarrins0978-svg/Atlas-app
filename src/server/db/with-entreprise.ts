import { and, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "./client";
import { abonnements, membresEntreprise } from "./schema";
import { enLectureSeule } from "@/lib/abonnements";
import { logger } from "../logger";

// Cœur de la sécurité multi-entreprise (voir docs/ARCHITECTURE_DONNEES.md §7 et
// docs/ARCHITECTURE_DONNEES_v2.1_corrections.md, corrections 2, 3, 8).
//
// - Le contexte RLS est fixé via set_config(..., true) : portée strictement
//   limitée à la transaction courante (jamais à la connexion, qui est mutualisée).
// - L'adhésion de l'utilisateur à l'entreprise est revalidée à CHAQUE appel,
//   même si l'entrepriseId provient d'un JWT signé côté serveur — une adhésion
//   a pu être révoquée depuis l'émission du jeton.
// - Aucune fonction de repository ne doit appeler `db` directement : tout passe
//   par withEntreprise().
//
// ═══════════════════════════════════════════════════════════════════════════
// ET C'EST ICI QUE L'ESSAI TERMINÉ SE REFERME — 13 septembre 2026.
//
// Sa décision du 10 septembre, au 16ᵉ jour de l'essai gratuit : *« il ne doit
// plus rien pouvoir faire à part enregistrer ses documents, ses clients »*.
// Tout se lit, rien ne s'écrit.
//
// L'application compte 176 gestes qui écrivent. Les fermer un par un — une
// garde par action — finirait par diverger, et il suffirait d'un oubli pour
// que l'un d'eux reste ouvert : c'est exactement le trou que `garde-action.ts`
// raconte pour les rôles. La fermeture se pose donc à L'UNIQUE endroit par où
// passe tout ce qu'un utilisateur fait dans sa session : **la transaction est
// déclarée `READ ONLY`**, et c'est Postgres qui refuse la première écriture
// (erreur 25006), quel que soit le chemin qui l'a demandée.
//
// Ce que cela ne touche PAS, et c'est structurel : les chemins sans session —
// la rétention, l'exécuteur d'agenda, le crochet de paiement — posent leur
// contexte eux-mêmes et ne passent pas ici. Purger un audio au bout de trente
// jours reste dû, essai fini ou non.
//
// **Une seule porte reste ouverte** : s'abonner (`pourSortirDeLEssai`). Sans
// elle, l'enregistrement du paiement serait lui-même refusé, et il ne pourrait
// jamais rouvrir ce qu'il vient de payer.

export class AccesRefuseError extends Error {
  constructor(utilisateurId: string, entrepriseId: string) {
    super(`Utilisateur ${utilisateurId} n'est pas membre de l'entreprise ${entrepriseId}.`);
    this.name = "AccesRefuseError";
  }
}

/**
 * Levée quand un geste tente d'écrire alors que l'essai est terminé.
 *
 * Le message ne parvient jamais à l'écran tel quel (Next.js le remplace en
 * production, `AGENTS.md` piège 0 ter) : c'est le ruban de l'accueil et la
 * phrase sous le bouton éteint qui le disent. Cette classe sert à qui lit le
 * journal — et aux suites, qui vérifient que c'est bien CE refus-là.
 */
export class EssaiTermineError extends Error {
  constructor(entrepriseId: string) {
    super(`L'essai de l'entreprise ${entrepriseId} est terminé : lecture seule.`);
    this.name = "EssaiTermineError";
  }
}

/** Le code Postgres d'une écriture dans une transaction en lecture seule. */
const READ_ONLY_SQL_TRANSACTION = "25006";

function estUnRefusDeLectureSeule(e: unknown): boolean {
  // Drizzle enveloppe l'erreur du pilote : le code est sur `cause`, pas sur
  // l'erreur reçue (`test-drizzle-enveloppe`). On regarde les deux.
  const codes = [(e as { code?: unknown })?.code, (e as { cause?: { code?: unknown } })?.cause?.code];
  return codes.includes(READ_ONLY_SQL_TRANSACTION);
}

export type OptionsEntreprise = {
  /**
   * Autorise l'écriture MÊME si l'essai est terminé. Réservé à l'enregistrement
   * de l'abonnement : c'est le geste qui met fin à la lecture seule, et il doit
   * pouvoir s'écrire depuis elle.
   */
  pourSortirDeLEssai?: true;
};

export async function withEntreprise<T>(
  utilisateurId: string,
  entrepriseId: string,
  fn: (tx: DbOrTx) => Promise<T>,
  options: OptionsEntreprise = {}
): Promise<T> {
  return db.transaction(async (tx) => {
    // Contexte RLS — SET LOCAL n'accepte pas de paramètre lié côté protocole
    // Postgres ; set_config(), lui, est un appel de fonction normal, paramétrable.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entrepriseId}, true)`);

    // **L'adhésion et l'abonnement en UNE requête**, pas deux : cette fonction
    // ouvre chaque transaction de l'application, et un aller-retour de plus ici
    // se paie sur tous les écrans. L'abonnement est en jointure externe — la
    // plupart des entreprises n'en ont pas, et elles ne doivent rien sentir.
    const [adhesion] = await tx
      .select({
        id: membresEntreprise.id,
        statut: abonnements.statut,
        periodeFin: abonnements.periodeFin,
      })
      .from(membresEntreprise)
      .leftJoin(abonnements, eq(abonnements.entrepriseId, membresEntreprise.entrepriseId))
      .where(
        and(eq(membresEntreprise.utilisateurId, utilisateurId), eq(membresEntreprise.entrepriseId, entrepriseId))
      )
      .limit(1);

    if (!adhesion) {
      throw new AccesRefuseError(utilisateurId, entrepriseId);
    }

    const lectureSeule =
      !options.pourSortirDeLEssai &&
      adhesion.statut !== null &&
      enLectureSeule({ statut: adhesion.statut, periodeFin: adhesion.periodeFin }, new Date());

    if (!lectureSeule) return fn(tx);

    // Passer en lecture seule est permis à tout moment d'une transaction ;
    // c'est le sens inverse que Postgres refuse après la première requête.
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    try {
      return await fn(tx);
    } catch (e) {
      if (!estUnRefusDeLectureSeule(e)) throw e;
      // Rendre le refus bavard AVANT de le lever : sans cette ligne, un « ça ne
      // marche pas » chez lui n'aurait aucune trace à lire (`AGENTS.md`).
      logger.warn("Écriture refusée : essai terminé, lecture seule", { entrepriseId });
      throw new EssaiTermineError(entrepriseId);
    }
  });
}
