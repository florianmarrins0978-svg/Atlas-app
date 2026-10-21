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
import { memesDocuments, phraseDAcceptation } from "@/lib/acceptation-documents";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { abonnementDeLEntreprise, enregistrerLAbonnement } from "@/server/repositories/abonnements";
import { resilierEtRembourser } from "@/server/paiement/stripe";
import { estRaisonDepart, texteDeDepart } from "@/lib/resiliation";

// `relire` : la liste a changé sous ses yeux ; l'écran se recharge pour la montrer.
export type EtatAcceptation = { erreur: string; relire?: boolean } | undefined;

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

  // **Ce qu'il a lu, et rien d'autre.** Une version publiée entre l'affichage
  // et le geste ne s'accepte pas à son insu : il relit (`memesDocuments`).
  const affiches = formData.getAll("affiche").map(String);
  if (!memesDocuments(affiches, attendus.map((d) => d.id))) {
    return { erreur: "Un document vient de changer. Relisez la liste, puis acceptez.", relire: true };
  }

  const entetes = await headers();
  const { enregistrees } = await enregistrerAcceptations(
    utilisateurId,
    attendus.map((d) => d.id),
    {
      adresseIp: adresseClient(entetes),
      agentUtilisateur: entetes.get("user-agent"),
      // Recalculée ici depuis la liste du serveur, par la fonction même qui l'a
      // affichée : les deux listes étant égales, c'est la phrase qu'il a lue.
      formuleAcceptee: phraseDAcceptation(attendus.length),
    }
  );

  logger.info("Documents légaux acceptés", {
    utilisateurId,
    enregistrees,
    versions: attendus.map((d) => `${d.type}@${d.version}`),
  });

  redirect("/");
}

export type ResultatRefus =
  | { ok: true; rembourseCentimes: number; moisNonUtilises: number; remboursementEchoue: boolean }
  | { ok: false; message: string };

/**
 * REFUSER LA NOUVELLE VERSION ET RÉSILIER — son choix du 18 octobre 2026 (la
 * B, `docs/A-FAIRE.md` §17) : c'est nous qui changeons les règles, il part
 * tout de suite et les mois payés non utilisés lui sont rendus.
 *
 * **Seulement quand il y a vraiment une nouvelle version à refuser**, et pour
 * le patron : un salarié ne résilie pas l'entreprise. Le montant n'est jamais
 * envoyé par l'écran : le serveur le calcule sur ce que le prestataire a
 * encaissé (`resilierEtRembourser`).
 */
export async function refuserEtResilierAction(raison: string | null, texte: string | null): Promise<ResultatRefus> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "résilier l’abonnement");

  if ((await documentsAAccepter(ctx.utilisateurId)).length === 0) {
    return { ok: false, message: "Aucune nouvelle version à refuser." };
  }
  const abonnement = await abonnementDeLEntreprise(ctx);
  if (!abonnement?.abonnementPrestataire || abonnement.statut !== "actif") {
    return { ok: false, message: "Vous n’avez pas d’abonnement en cours." };
  }

  const r = await resilierEtRembourser({
    abonnementPrestataire: abonnement.abonnementPrestataire,
    raison: estRaisonDepart(raison) ? raison : null,
    texte: texteDeDepart(texte),
    maintenant: new Date(),
  });
  if (!r.ok) {
    return { ok: false, message: "La résiliation n’a pas pu se faire. Réessayez dans un instant." };
  }

  // Résilié : la lecture seule prend le relais (`etatDeLAcces`).
  await enregistrerLAbonnement(ctx, r.etat);
  logger.info("Nouvelles conditions refusées, abonnement résilié", {
    entrepriseId: ctx.entrepriseId,
    rembourseCentimes: r.rembourseCentimes,
    remboursementEchoue: r.remboursementEchoue,
  });
  return {
    ok: true,
    rembourseCentimes: r.rembourseCentimes,
    moisNonUtilises: r.moisNonUtilises,
    remboursementEchoue: r.remboursementEchoue,
  };
}

