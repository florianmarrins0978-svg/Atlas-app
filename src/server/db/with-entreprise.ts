import { and, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "./client";
import { abonnements, entreprises, membresEntreprise } from "./schema";
import { enLectureSeule } from "@/lib/abonnements";
import { compteFerme } from "@/lib/fermeture-compte";
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
//
// ET LE COMPTE FERMÉ SE REFERME ICI AUSSI — 5 novembre 2026 (question 33 de
// `docs/QUESTIONS.md`). Passé sa date d'effet, un compte fermé est en lecture
// seule comme un essai terminé, par la même porte, et **seul le patron y
// entre** : la planche le lui a dit, « vos salariés n'auront plus accès à
// Atlas ». Ce refus vit ici plutôt que dans chaque écran pour la même raison
// que la lecture seule : un écran oublié leur laisserait voir les factures.

export class AccesRefuseError extends Error {
  constructor(utilisateurId: string, entrepriseId: string) {
    super(`Utilisateur ${utilisateurId} n'est pas membre de l'entreprise ${entrepriseId}.`);
    this.name = "AccesRefuseError";
  }
}

/**
 * Le compte de l'entreprise est fermé, et celui qui frappe n'en est pas le
 * patron (5 novembre 2026). Un refus d'accès comme un autre pour tout ce qui
 * l'attrape déjà ; `garderLaPage` le reconnaît pour lui montrer l'écran qui
 * le dit (`/compte-ferme`) plutôt qu'une page d'erreur.
 */
export class CompteFermeError extends AccesRefuseError {
  constructor(utilisateurId: string, entrepriseId: string) {
    super(utilisateurId, entrepriseId);
    this.name = "CompteFermeError";
  }
}

/**
 * Levée quand un geste tente d'écrire en lecture seule : essai terminé,
 * abonnement résilié depuis le 18 octobre 2026, compte fermé depuis le
 * 5 novembre 2026.
 *
 * Le message ne parvient jamais à l'écran tel quel (Next.js le remplace en
 * production, `AGENTS.md` piège 0 ter) : c'est le ruban de l'accueil et la
 * phrase sous le bouton éteint qui le disent. Cette classe sert à qui lit le
 * journal — et aux suites, qui vérifient que c'est bien CE refus-là.
 */
export class LectureSeuleError extends Error {
  constructor(entrepriseId: string) {
    super(`L'entreprise ${entrepriseId} est en lecture seule : essai terminé, abonnement résilié ou compte fermé.`);
    this.name = "LectureSeuleError";
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
   * Autorise l'écriture MÊME en lecture seule (essai terminé, abonnement
   * résilié). Réservé à l'enregistrement de l'abonnement : c'est le geste qui
   * y met fin, et il doit pouvoir s'écrire depuis elle.
   */
  pourSortirDeLEssai?: true;
  /**
   * Autorise l'écriture sur un compte FERMÉ, pour le seul geste qui le rouvre
   * (`fermeture-compte.ts`). La lecture seule de l'abonnement, elle, tient
   * toujours : rouvrir un compte n'offre pas un abonnement.
   */
  pourRouvrirLeCompte?: true;
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
    // La fermeture du compte vient dans la même requête, pour la même raison.
    const [adhesion] = await tx
      .select({
        id: membresEntreprise.id,
        role: membresEntreprise.role,
        statut: abonnements.statut,
        periodeFin: abonnements.periodeFin,
        fermetureDemandeeLe: entreprises.fermetureDemandeeLe,
        fermetureLe: entreprises.fermetureLe,
        resteEffaceLe: entreprises.resteEffaceLe,
      })
      .from(membresEntreprise)
      .innerJoin(entreprises, eq(entreprises.id, membresEntreprise.entrepriseId))
      .leftJoin(abonnements, eq(abonnements.entrepriseId, membresEntreprise.entrepriseId))
      .where(
        and(eq(membresEntreprise.utilisateurId, utilisateurId), eq(membresEntreprise.entrepriseId, entrepriseId))
      )
      .limit(1);

    if (!adhesion) {
      throw new AccesRefuseError(utilisateurId, entrepriseId);
    }

    const maintenant = new Date();
    const ferme = compteFerme(
      { demandeeLe: adhesion.fermetureDemandeeLe, effectiveLe: adhesion.fermetureLe, resteEffaceLe: adhesion.resteEffaceLe },
      maintenant
    );
    if (ferme && adhesion.role !== "proprietaire") {
      logger.warn("Accès refusé : compte fermé, réservé au patron", { entrepriseId });
      throw new CompteFermeError(utilisateurId, entrepriseId);
    }

    const abonnementFerme =
      !options.pourSortirDeLEssai &&
      adhesion.statut !== null &&
      enLectureSeule({ statut: adhesion.statut, periodeFin: adhesion.periodeFin }, maintenant);
    const lectureSeule = abonnementFerme || (ferme && !options.pourSortirDeLEssai && !options.pourRouvrirLeCompte);

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
      logger.warn("Écriture refusée : lecture seule (essai terminé, abonnement résilié ou compte fermé)", { entrepriseId, ferme });
      throw new LectureSeuleError(entrepriseId);
    }
  });
}
