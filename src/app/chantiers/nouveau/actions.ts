"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { creerChantier } from "@/server/repositories/chantiers";
import { creerClient } from "@/server/repositories/clients";

export type CreerChantierInput = {
  nomChantier: string;
  nomClient?: string;
  telephone?: string;
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
    const client = await creerClient(ctx, {
      nom: nomClient,
      telephone: data.telephone?.trim() || undefined,
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
