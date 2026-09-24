import { z } from "zod";
import type { Outil } from "./types";
import { FICHES_MODE_EMPLOI, chercherFiches, ficheParId, type FicheModeEmploi } from "@/lib/mode-emploi";

/** Toutes les fiches par leur intitulé : de quoi choisir, rien à réciter. */
function sommaire() {
  return FICHES_MODE_EMPLOI.map((f) => ({ id: f.id, ecran: f.ecran, intitule: f.intitule }));
}

/** Ce que le modèle lit d'une fiche : ni ses mots-clés, ni ses preuves. */
function lue(f: FicheModeEmploi) {
  return { ecran: f.ecran, ou: f.ou, intitule: f.intitule, geste: f.geste, reserve: f.reserve ?? null };
}

/**
 * « Comment je fais pour… » — le seul outil qui ne lit pas la base.
 *
 * Il ne consulte aucune donnée d'entreprise : le mode d'emploi est le même pour
 * tout le monde. Il ne prend donc pas de `ctx`, et il n'y a rien à isoler.
 *
 * **Il rend un refus, pas une approximation.** Quand la recherche par mots ne
 * trouve rien, `trouve: false` — et le service impose à l'assistant de le dire
 * plutôt que d'inventer un geste. Un geste faux se cherche cinq minutes à
 * l'écran avant qu'on ne conclue que l'application est cassée.
 *
 * **Mais le refus porte le SOMMAIRE** (sa demande du 24 septembre 2026 : *« il
 * DOIT pouvoir lui répondre »*). La recherche par mots ratait toute tournure
 * qu'aucun mot-clé n'avait prévue ; le modèle, lui, comprend que « la touche
 * pour envoyer » est la fiche « Envoyer le devis ». Il lit donc les intitulés,
 * et redemande la bonne fiche par son identifiant. Il choisit ; il ne récrit
 * pas : le geste qui sort est toujours celui de la fiche, confrontée au code.
 */
export const rechercherModeEmploi: Outil = {
  nom: "RechercherModeEmploi",
  description:
    "Explique COMMENT on fait quelque chose dans Atlas, et OÙ se trouve chaque chose : le geste exact, " +
    "écran par écran. À utiliser pour toute question du type « comment je fais pour… », « où est… », " +
    "« où sont rangés… », « je cherche le bouton… », « à quoi sert… ». Donne « question » telle qu'il l'a " +
    "posée. Si aucune des fiches rendues ne répond vraiment, rappelle avec « sommaire » = true pour lire " +
    "la liste de toutes les fiches, puis redemande celle qui répond avec « fiche » (son id). " +
    "Ne lit aucune donnée de chantier : c'est le mode d'emploi de l'application, pas son contenu.",
  schema: z
    .object({
      question: z.string().optional().describe("La question de l'utilisateur, dans ses mots, telle qu'il l'a posée."),
      motCle: z.string().optional(),
      fiche: z.string().optional().describe("L'identifiant d'une fiche lue dans le sommaire."),
      sommaire: z.boolean().optional().describe("true pour lire la liste de toutes les fiches."),
    })
    .refine((v) => v.sommaire === true || Boolean((v.fiche ?? v.question ?? v.motCle ?? "").trim()), {
      message: "Donne la question dans « question », ou l'identifiant lu au sommaire dans « fiche ».",
    }),
  async executer(_contexte, parametres) {
    const p = parametres as { question?: string; motCle?: string; fiche?: string; sommaire?: boolean };
    // **Le sommaire se DEMANDE aussi, pas seulement quand rien ne sort.** Avec
    // deux cents fiches, la recherche par mots rend parfois trois fiches
    // voisines et pas la bonne : le modèle, qui voit qu'aucune ne répond, doit
    // pouvoir aller lire la liste plutôt que de réciter la moins fausse.
    if (p.sommaire === true) return { trouve: false, sommaire: sommaire() };
    if (p.fiche) {
      const fiche = ficheParId(p.fiche.trim());
      if (fiche) return { trouve: true, fiches: [lue(fiche)] };
      return { trouve: false, consigne: "Cet identifiant n'est pas au sommaire. N'invente jamais un geste." };
    }
    const fiches = chercherFiches(p.question ?? p.motCle ?? "", 5);
    if (fiches.length === 0) {
      return {
        trouve: false,
        consigne:
          "Aucune fiche ne partage les mots de la question. Lis le sommaire : si une fiche y répond, " +
          "rappelle RechercherModeEmploi avec « fiche » = son id. Sinon, dis franchement que tu ne " +
          "connais pas ce geste. N'invente jamais un geste, un nom de bouton ou un écran.",
        sommaire: sommaire(),
      };
    }
    return { trouve: true, fiches: fiches.map(lue) };
  },
};
