import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { verificationEnAttente } from "@/server/repositories/verification-email";
import { documentsAAccepter, utilisateurExiste } from "@/server/repositories/documents-legaux";
import { logger } from "@/server/logger";

// LES DEUX ÉTAPES DU COMPTE, jouées par chaque écran (`garderLaPage`).
//
// **Elles vivaient seulement dans le gabarit racine** (`GardeVerificationEmail`,
// `GardeDocumentsLegaux`), que Next.js ne rejoue pas à la navigation interne :
// un compte en attente de son code, ou de son acceptation des conditions,
// passait d'un écran à l'autre par un clic (audit du 25 octobre 2026, E8, et
// `TODO.md` du 14 septembre). Leur texte est repris tel quel. Elles sont
// appelées à deux portes : le gabarit (`GardeEtapesDuCompte`, pour le vrai 307
// d'un chargement complet) et chaque écran (`garderLaPage`, pour les clics).
// L'ordre reste le leur : l'adresse avant les conditions.

/**
 * TANT QUE L'ADRESSE N'A PAS RÉPONDU, ON N'ENTRE PAS — 14 septembre 2026.
 *
 * Sa demande : *« j'ai réussi à me connecter avec une adresse fausse qui
 * n'existe pas ! […] il faut mettre une sécurité avec un numéro envoyé par
 * email à rentrer pour pouvoir valider son compte »*.
 *
 * Même place et même forme que `GardeDocumentsLegaux`, juste au-dessus dans le
 * layout, et **avant elle** : un compte dont l'adresse n'est pas prouvée n'a
 * pas à lire les conditions générales — on ne sait même pas qui les lit.
 *
 * **Ce qui décide, c'est une ligne dans `codes_verification_email`**, pas la
 * colonne `email_verified` : seuls les comptes créés par la porte en reçoivent
 * une. Ses comptes à lui, ses salariés, Google et Apple n'en ont pas, et rien
 * ne change pour eux (migration 0091).
 *
 * Les chemins exempts sont ceux de `GardeDocumentsLegaux`, plus l'écran du
 * code lui-même — sans quoi elle s'y renverrait en boucle. **Pas les documents
 * légaux** : un compte en attente qui y arriverait de lui-même repasse
 * d'abord par le code. (Et `GardeDocumentsLegaux` exempte `/verifier-email`
 * pour la même raison, dans l'autre sens.)
 */
const EXEMPTS_DE_L_ADRESSE = ["/login", "/verifier-email", "/api", "/devis", "/factures"];

function exemptDeLAdresse(chemin: string) {
  return EXEMPTS_DE_L_ADRESSE.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

export async function garderLAdresseVerifiee(chemin: string): Promise<void> {
  if (exemptDeLAdresse(chemin)) return;

  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) return;

  let enAttente = false;
  try {
    enAttente = await verificationEnAttente(utilisateurId);
  } catch (err) {
    // Une base muette ne ferme pas l'application à ceux qui sont déjà
    // entrés : `GardeDocumentsLegaux` fait le même choix, pour la même raison.
    logger.error("Vérification de l'adresse impossible", {
      utilisateurId,
      erreur: err instanceof Error ? err.message : String(err),
    });
    return;
  }
  if (enAttente) redirect("/verifier-email");
  return;
}

// Garde d'accès : tant qu'un document dont l'acceptation est requise n'a pas
// été accepté, l'application n'est pas utilisable (voir docs/RGPD.md §8).
//
// Sans cette garde, l'acceptation serait facultative — et une acceptation
// facultative ne vaut rien : elle ne prouve pas que l'artisan a pris
// connaissance du contrat, seulement qu'il aurait pu.
//
// Placée dans le layout racine plutôt que dans un middleware : la vérification
// interroge la base, ce que le middleware (exécuté en amont, sur un runtime
// restreint) ne doit pas faire.

// Chemins où la garde ne s'applique pas, sous peine de boucle de redirection
// ou de blocage de la connexion elle-même.
// `/devis` est la page de réponse du client : il n'a pas de compte, et n'a
// évidemment aucun document à accepter. L'y renvoyer le laisserait devant un
// écran qui ne le concerne pas.
// `/verifier-email` : le code d'abord, les conditions ensuite — sans cette
// exemption, les deux gardes se renverraient l'une à l'autre sans fin.
const EXEMPTS_DES_DOCUMENTS = ["/login", "/documents-legaux", "/verifier-email", "/api", "/devis"];

// Chemins que le contrôle du compte laisse passer, et eux seuls.
//
// `/api` porte la route qui efface la session : l'y soumettre bouclerait.
// `/devis` et `/factures` sont les pages du CLIENT, qui n'a pas de compte —
// un artisan y arrivant avec un cookie mort n'a aucune raison d'être arraché
// à la lecture d'un document qui ne dépend d'aucune session.
//
// **`/login` en fait partie, et c'est un correctif, pas un oubli.**
//
// Le 10 août 2026 au soir, le patron a vu son application tourner en rond :
// `/login` → `/api/session-perimee` → `/login`, sans fin. La cause première
// était ailleurs (l'effacement du cookie était refusé par le navigateur, voir
// `api/session-perimee/route.ts`), mais **c'est cette garde qui transformait
// une panne en boucle** : renvoyée vers l'effacement, la page de connexion y
// retournait au tour suivant, indéfiniment.
//
// Un remède qui boucle est pire que le défaut qu'il répare. Sur `/login`, il
// n'y a d'ailleurs rien à protéger : aucune donnée n'y est lue, et la connexion
// remplace le cookie de toute façon. Ne jamais l'y remettre.
const CHEMINS_SANS_CONTROLE_DE_COMPTE = ["/api", "/devis", "/factures", "/login"];

function estExempt(chemin: string, exempts: string[]) {
  return exempts.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

export async function garderLesDocumentsLegaux(chemin: string): Promise<void> {
  if (estExempt(chemin, CHEMINS_SANS_CONTROLE_DE_COMPTE)) return;

  const session = await auth();
  const utilisateurId = session?.user?.id;
  // Pas de session : le middleware a déjà redirigé vers /login. Rien à faire.
  if (!utilisateurId) return;

  // **Le compte de cette session existe-t-il encore ?**
  //
  // Le 10 août 2026, le jeu de démonstration a été refait : l'ancien compte a
  // disparu, et le navigateur du patron portait toujours sa session. Le cookie
  // est SIGNÉ, donc valide — l'application le laissait entrer, puis refusait
  // toute écriture. Il a vu « aucune adhésion d'entreprise », puis un `insert`
  // en échec sur une clé étrangère, sans que rien ne relie ces messages.
  //
  // Ce contrôle vit ici, dans le layout, et non dans la page : une page rend
  // sous la frontière de `loading.tsx`, où l'enveloppe est DÉJÀ partie. Sa
  // redirection ne peut alors plus être un 307 — elle devient un renvoi joué
  // par le navigateur, donc suspendu à JavaScript. Le layout, lui, précède le
  // premier octet : le renvoi est un vrai 307. Éprouvé, et pas supposé : la
  // page rendait 200 pendant que le contrôle passait au vert.
  //
  // Le `redirect()` est hors du `try` : il lève une exception par conception,
  // et un `catch` la prendrait pour une panne de base.
  let compteConnu = true;
  try {
    compteConnu = await utilisateurExiste(utilisateurId);
  } catch (err) {
    // Base indisponible : voir plus bas — on laisse passer plutôt que de
    // déconnecter tout le monde parce qu'une requête n'a pas abouti.
    logger.error("Vérification du compte impossible", {
      utilisateurId,
      erreur: err instanceof Error ? err.message : String(err),
    });
  }
  if (!compteConnu) redirect("/api/session-perimee");

  if (estExempt(chemin, EXEMPTS_DES_DOCUMENTS)) return;

  let enAttente;
  try {
    enAttente = await documentsAAccepter(utilisateurId);
  } catch (err) {
    // Fail-closed serait ici pire que fail-open : une base indisponible
    // renverrait tous les artisans vers un écran d'acceptation qui ne
    // fonctionnerait pas davantage. On journalise et on laisse passer — la
    // page demandée échouera d'elle-même si elle a besoin de la base.
    logger.error("Vérification des documents légaux impossible", {
      utilisateurId,
      erreur: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (enAttente.length > 0) redirect("/documents-legaux");
  return;
}
