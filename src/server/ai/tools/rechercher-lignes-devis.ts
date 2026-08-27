import { z } from "zod";
import type { Outil } from "./types";
import { rechercherLignesDevisEntreprise } from "../../repositories/devis";

/**
 * Chercher une ligne dans les devis de TOUS les clients.
 *
 * **Sa demande du 25 août 2026 :** aller chercher une ligne dans le devis de
 * n'importe quel client pour la poser sur un devis déjà ouvert.
 *
 * **Il rend l'identifiant de la ligne, et c'est LUI qui compte.** Le montant
 * affiché ici sert à choisir, jamais à écrire : la copie relit le prix en base
 * au moment de l'appliquer (`getLigneDevisPourCopie`). Un prix qui traverse le
 * modèle puis le navigateur est un prix qu'on peut changer en chemin — sur un
 * document qui part chez un client.
 */
export const rechercherLignesDevis: Outil = {
  nom: "RechercherLignesDevis",
  description:
    "Cherche une ligne dans les devis de TOUS les clients de l'entreprise, pour pouvoir la reprendre sur " +
    "le devis en cours. Filtre par un mot du libellé et/ou par le nom du client. Rend l'identifiant de chaque " +
    "ligne — c'est cet identifiant qu'il faut donner à une proposition « copier_ligne_devis ».",
  // `nom` accepté comme `motCle`, pour la même raison qu'ailleurs : trois noms
  // pour une même idée dans le registre, c'est une invitation à se tromper.
  schema: z.object({
    motCle: z.string().nullish().describe("Un mot du libellé cherché : « élagage », « haie », « broyage »."),
    client: z.string().nullish().describe("Tout ou partie du nom du client sur le devis d'origine."),
    nom: z.string().nullish(),
  }),
  async executer({ ctx }, parametres) {
    const p = parametres as { motCle?: string | null; client?: string | null; nom?: string | null };
    const motCle = p.motCle ?? p.nom;
    const client = p.client;
    if (!motCle?.trim() && !client?.trim()) {
      return {
        trouve: false,
        raison: "Il faut au moins un mot du libellé ou un nom de client — je ne parcours pas tous les devis.",
      };
    }
    const lignes = await rechercherLignesDevisEntreprise(ctx, { motCle, client });
    if (lignes.length === 0) return { trouve: false, raison: "Aucune ligne de devis ne correspond." };
    return { trouve: true, lignes };
  },
};
