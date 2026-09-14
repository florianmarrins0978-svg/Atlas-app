import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { verificationEnAttente } from "@/server/repositories/verification-email";
import { logger } from "@/server/logger";

/**
 * TANT QUE L'ADRESSE N'A PAS RÉPONDU, ON N'ENTRE PAS — 14 septembre 2026.
 *
 * Sa demande : *« j'ai réussi à me connecter avec une adresse fausse qui
 * n'existe pas ! […] il faut mettre une sécurité avec un numéro envoyé par
 * email à rentrer pour pouvoir valider son compte »*.
 *
 * Même place et même forme que `GardeDocumentsLegaux`, juste au-dessus dans
 * `template.tsx`, et **avant elle** : un compte dont l'adresse n'est pas prouvée n'a
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
const CHEMINS_EXEMPTS = ["/login", "/verifier-email", "/api", "/devis", "/factures"];

function estExempt(chemin: string) {
  return CHEMINS_EXEMPTS.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

export default async function GardeVerificationEmail() {
  const chemin = (await headers()).get("x-atlas-pathname");
  if (!chemin || estExempt(chemin)) return null;

  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) return null;

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
    return null;
  }
  if (enAttente) redirect("/verifier-email");
  return null;
}
