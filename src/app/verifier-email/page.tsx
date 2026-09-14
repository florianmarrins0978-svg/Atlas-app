import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { adresseDuCompte, verificationEnAttente } from "@/server/repositories/verification-email";
import EcranDuCode from "./EcranDuCode";

export const dynamic = "force-dynamic";

/**
 * OÙ REVIENT UN COMPTE QUI N'A PAS FINI — 14 septembre 2026.
 *
 * Le code se demande normalement sur la porte, juste après « Créer mon
 * compte ». Mais il est en rendez-vous, il ferme l'application, il revient le
 * soir : la session est là, le compte existe, et le code n'a jamais été
 * entré. `GardeVerificationEmail` l'envoie ici, et la connexion aussi
 * (`accueilPourEmail`). La case est la même qu'à la porte — c'est la même
 * pièce, `SaisieDuCode`.
 *
 * Plus rien à vérifier : cette page n'a aucune raison de rester atteignable,
 * et elle passe le relais aux documents légaux, qui savent renvoyer sur
 * l'accueil quand ils sont acceptés.
 */
export default async function VerifierEmailPage() {
  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) redirect("/login");

  if (!(await verificationEnAttente(utilisateurId))) redirect("/documents-legaux");
  const email = await adresseDuCompte(utilisateurId);
  if (!email) redirect("/api/session-perimee");

  return <EcranDuCode email={email} />;
}
