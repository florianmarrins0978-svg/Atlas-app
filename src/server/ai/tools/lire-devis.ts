import { z } from "zod";
import type { Outil } from "./types";
import { CHAMP_CHANTIER_VISE, chantierVise } from "./chantier-vise";
import { getLignesDevis, listerVersionsDevis, lireVersionDevis } from "../../repositories/devis";

/**
 * Lire un devis — **celui qu'on demande, pas seulement le dernier**.
 *
 * **Sa question du 25 août 2026 :** *« Peux-tu me ressortir le PREMIER devis de
 * M. Bernard ? »* Cet outil ne savait rendre que le dernier, et l'assistant en
 * a tiré une affirmation fausse qu'il a servie au patron : *« Atlas conserve
 * uniquement le dernier devis par chantier »*.
 *
 * **C'était faux, et c'est important :** un brouillon se réécrit en place, mais
 * **un devis ENVOYÉ est conservé** — le suivant devient une version 2
 * (`getOuCreerDevisBrouillon`). Ses anciens devis sont là ; c'est cet outil qui
 * ne savait pas les demander.
 *
 * **Un outil muet fait inventer une explication.** Le modèle ne dispose que de
 * ce qu'on lui rend : ne lui rendre que la dernière version, sans jamais dire
 * qu'il en existe d'autres, c'est lui laisser conclure qu'il n'y en a qu'une.
 * D'où `versionsDisponibles`, rendu à chaque appel.
 *
 * **Et il accepte un `chantierId`**, pour que `RechercherChantier` puisse le
 * lui passer : sans cela, l'assistant ouvert depuis la liste reste aveugle,
 * quel que soit le nom qu'on lui donne.
 */
export const lireDevis: Outil = {
  nom: "LireDevis",
  description:
    "Lit un devis d'un chantier, avec ses lignes et ses totaux, et dit quelles versions existent. " +
    "Sans chantierId, lit celui du chantier courant ; sans version, la plus récente. " +
    "Pour « le premier devis », demander la version 1.",
  schema: z.object({
    ...CHAMP_CHANTIER_VISE,
    version: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Le numéro de version : 1 pour le PREMIER devis. Omis, rend le plus récent."),
  }),
  async executer(contexte, parametres) {
    const { version } = parametres as { version?: number };
    // La règle du chantier visé est partagée par tous les outils de lecture
    // (`chantier-vise.ts`) : elle en portait une copie, et cinq autres la
    // portaient aussi. Le refus y nomme la suite à donner.
    const vise = chantierVise(contexte, parametres);
    if (!vise.ok) return vise.reponse;
    const { ctx } = contexte;
    const cible = vise.chantierId;

    const versions = await listerVersionsDevis(ctx, cible);
    if (versions.length === 0) return { existe: false, versionsDisponibles: [] };

    const devis = await lireVersionDevis(ctx, cible, version);
    if (!devis) {
      return {
        existe: false,
        versionsDisponibles: versions,
        erreur: `Ce chantier n'a pas de version ${version}.`,
      };
    }

    const lignes = await getLignesDevis(ctx, devis.id);
    return {
      existe: true,
      // **Toutes les versions, à chaque appel.** C'est ce qui empêche
      // d'affirmer qu'il n'y en a qu'une — l'erreur servie au patron.
      versionsDisponibles: versions,
      numeroCommercial: devis.numeroCommercial,
      numeroVersion: devis.numeroVersion,
      statut: devis.statut,
      totalHt: devis.totalHt,
      totalTva: devis.totalTva,
      totalTtc: devis.totalTtc,
      lignes: lignes.map((l) => ({ libelle: l.libelle, montant: l.montant })),
    };
  },
};
