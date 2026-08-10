import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { documentsAAccepter, utilisateurExiste } from "@/server/repositories/documents-legaux";
import { logger } from "@/server/logger";

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
const CHEMINS_EXEMPTS = ["/login", "/documents-legaux", "/api", "/devis"];

// Chemins que le contrôle du compte laisse passer, et eux seuls.
//
// `/api` porte la route qui efface la session : l'y soumettre bouclerait.
// `/devis` et `/factures` sont les pages du CLIENT, qui n'a pas de compte —
// un artisan y arrivant avec un cookie mort n'a aucune raison d'être arraché
// à la lecture d'un document qui ne dépend d'aucune session.
//
// `/login` et `/documents-legaux`, eux, ne sont PAS exemptés, à la différence
// des documents légaux : c'est précisément là qu'un fantôme atterrit.
const CHEMINS_SANS_CONTROLE_DE_COMPTE = ["/api", "/devis", "/factures"];

function estExempt(chemin: string, exempts: string[]) {
  return exempts.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

export default async function GardeDocumentsLegaux() {
  const entetes = await headers();
  const chemin = entetes.get("x-atlas-pathname");

  // En-tête absent : rendu hors requête HTTP normale (génération statique,
  // outillage). On ne bloque pas — la garde n'a rien à protéger dans ce cas.
  if (!chemin) return null;
  if (estExempt(chemin, CHEMINS_SANS_CONTROLE_DE_COMPTE)) return null;

  const session = await auth();
  const utilisateurId = session?.user?.id;
  // Pas de session : le middleware a déjà redirigé vers /login. Rien à faire.
  if (!utilisateurId) return null;

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

  if (estExempt(chemin, CHEMINS_EXEMPTS)) return null;

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
    return null;
  }

  if (enAttente.length > 0) redirect("/documents-legaux");
  return null;
}
