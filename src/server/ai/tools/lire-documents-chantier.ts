import { z } from "zod";
import type { Outil } from "./types";
import { CHAMP_CHANTIER_VISE, chantierVise } from "./chantier-vise";
import { getChantier } from "../../repositories/chantiers";
import { ficheDuChantier } from "../../repositories/fiches-securite";
import { pieceDuChantier } from "@/lib/pieces-de-l-assistant";

/**
 * Les PDF d'un chantier : la feuille sans les prix, la fiche chantier, la
 * fiche de sécurité quand elle a été ouverte.
 *
 * **Sa réponse du 28 octobre 2026**, à « la fiche d'inter, c'est laquelle ? » :
 * *« de toute façon, il faut qu'il puisse nous donner tous les documents »*.
 * Les trois, donc, et l'assistant choisit d'après la question.
 */
export const lireDocumentsChantier: Outil = {
  nom: "LireDocumentsChantier",
  description:
    "Rend les PDF d'un chantier : la feuille de chantier (le devis sans les prix, celle du salarié, que le " +
    "patron appelle aussi fiche d'intervention), la fiche chantier, et la fiche de sécurité si elle existe. " +
    "Sans chantierId, ceux du chantier courant. Pour « la fiche d'inter », joins la feuille de chantier et, si " +
    "elle existe, la fiche de sécurité.",
  schema: z.object({ ...CHAMP_CHANTIER_VISE }),
  async executer(contexte, parametres) {
    const vise = chantierVise(contexte, parametres);
    if (!vise.ok) return vise.reponse;
    const chantier = await getChantier(contexte.ctx, vise.chantierId);
    if (!chantier) return { trouve: false, raison: "Ce chantier est introuvable." };
    const cible = { chantierId: chantier.id, nom: chantier.nom };
    const securite = await ficheDuChantier(contexte.ctx, chantier.id);
    return {
      trouve: true,
      chantier: chantier.nom,
      feuilleDeChantier: { piece: pieceDuChantier("feuille", cible) },
      ficheChantier: { piece: pieceDuChantier("fiche_chantier", cible) },
      ficheDeSecurite: securite
        ? { signee: securite.signeeLe !== null, piece: pieceDuChantier("fiche_securite", cible) }
        : null,
    };
  },
};
