import { z } from "zod";
import type { Outil } from "./types";
import { listerClients } from "../../repositories/clients";

/**
 * Les clients de l'entreprise, avec ce qui permet de les joindre.
 *
 * **Il rend l'identifiant**, parce que c'est par lui que `modifier_client`
 * cible : deux Martin ne se distinguent pas par leur nom, et corriger le
 * téléphone du mauvais Martin, c'est un devis qui part chez quelqu'un d'autre.
 *
 * **Ce qui manque se DIT** (`null`), au lieu d'être tu : c'est justement ce que
 * l'agent doit pouvoir signaler — un client sans canal ne recevra jamais son
 * devis.
 */
export const lireClients: Outil = {
  nom: "LireClients",
  description:
    "Liste les clients de l'entreprise avec leur identifiant, leur téléphone, leur e-mail, leur adresse et le " +
    "canal convenu (SMS ou e-mail). Filtre sur un bout du nom. À utiliser avant de proposer une correction " +
    "de fiche client.",
  schema: z.object({
    motCle: z.string().nullish().describe("Un bout du nom du client. Vide : tous."),
  }),
  async executer({ ctx }, parametres) {
    const { motCle } = parametres as { motCle?: string | null };
    const tous = await listerClients(ctx);
    const cherche = (motCle ?? "").trim().toLowerCase();
    const retenus = cherche ? tous.filter((c) => c.nom.toLowerCase().includes(cherche)) : tous;

    if (retenus.length === 0) return { trouve: false, raison: "Aucun client ne correspond." };
    return {
      trouve: true,
      clients: retenus.slice(0, 25).map((c) => ({
        clientId: c.id,
        nom: c.nom,
        telephone: c.telephone ?? null,
        email: c.email ?? null,
        adresse: c.adresse ?? null,
        canal: c.canalCommunication ?? null,
      })),
      autresNonMontres: Math.max(0, retenus.length - 25),
    };
  },
};
