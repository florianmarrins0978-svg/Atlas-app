"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { creerChantier } from "@/server/repositories/chantiers";
import { creerClient, type CanalClient } from "@/server/repositories/clients";

export type CreerChantierInput = {
  nomChantier: string;
  nomClient?: string;
  telephone?: string;
  email?: string;
  /** Canal convenu avec le client pour recevoir son devis (docs/AGENT.md §2.1). */
  canal?: CanalClient;
  adresseChantier?: string;
  adresseClient?: string;
};

// Ne redirige pas elle-même (garde le comportement de navigation côté client,
// comme avant) — retourne l'id du chantier créé, ou lève une erreur explicite.
export async function creerChantierAction(data: CreerChantierInput): Promise<{ id: string }> {
  const nom = data.nomChantier.trim();
  if (!nom) {
    throw new Error("Le nom du chantier est requis.");
  }

  const ctx = await getCurrentCtx();

  let clientId: string | undefined;
  const nomClient = data.nomClient?.trim();
  if (nomClient) {
    const telephone = data.telephone?.trim() || undefined;
    const email = data.email?.trim() || undefined;

    // Un canal sans la coordonnée correspondante est un cul-de-sac : l'envoi
    // s'annoncerait possible puis échouerait au dernier moment. On préfère ne
    // rien enregistrer et laisser l'écran d'envoi le dire clairement.
    const canal =
      data.canal === "sms" && telephone
        ? "sms"
        : data.canal === "email" && email
          ? "email"
          : undefined;

    const client = await creerClient(ctx, {
      nom: nomClient,
      telephone,
      email,
      canalCommunication: canal,
      adresse: data.adresseClient?.trim() || undefined,
    });
    clientId = client.id;
  }

  const chantier = await creerChantier(ctx, {
    nom,
    adresseChantier: data.adresseChantier?.trim() || undefined,
    clientId,
  });

  return { id: chantier.id };
}
