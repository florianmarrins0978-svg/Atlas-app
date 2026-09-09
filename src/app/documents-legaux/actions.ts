"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  documentsAAccepter,
  enregistrerAcceptations,
  utilisateurExiste,
} from "@/server/repositories/documents-legaux";
import { logger } from "@/server/logger";
import { adresseClient } from "@/lib/adresse-client";

export type EtatAcceptation = { erreur: string } | undefined;

export async function accepterDocumentsAction(
  _etatPrecedent: EtatAcceptation,
  formData: FormData
): Promise<EtatAcceptation> {
  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) redirect("/login");

  // **Le compte existe-t-il encore ?** C'est ICI que le défaut se voyait : la
  // garde du layout ne s'exécute pas avant une action serveur, et l'écriture
  // partait donc en base pour un compte disparu. Le patron recevait la clé
  // étrangère en pleine figure, sans un mot sur ce qu'il fallait en faire.
  // Même fonction que la garde : deux implémentations finiraient par diverger.
  if (!(await utilisateurExiste(utilisateurId))) redirect("/api/session-perimee");

  // On repart de ce que le serveur sait devoir être accepté — jamais de la
  // liste envoyée par le navigateur, qui pourrait en omettre. Le formulaire
  // sert à recueillir un consentement, pas à décider de son périmètre.
  const attendus = await documentsAAccepter(utilisateurId);
  if (attendus.length === 0) redirect("/");

  const manquants = attendus.filter((d) => formData.get(`accepte_${d.id}`) !== "oui");
  if (manquants.length > 0) {
    return {
      erreur:
        manquants.length === 1
          ? `Il reste à accepter : ${manquants[0].titre}.`
          : `Il reste ${manquants.length} documents à accepter.`,
    };
  }

  const entetes = await headers();
  const { enregistrees } = await enregistrerAcceptations(
    utilisateurId,
    attendus.map((d) => d.id),
    {
      adresseIp: adresseClient(entetes),
      agentUtilisateur: entetes.get("user-agent"),
    }
  );

  logger.info("Documents légaux acceptés", {
    utilisateurId,
    enregistrees,
    versions: attendus.map((d) => `${d.type}@${d.version}`),
  });

  redirect("/");
}
