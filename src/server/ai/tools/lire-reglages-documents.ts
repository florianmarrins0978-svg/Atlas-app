import { z } from "zod";
import type { Outil } from "./types";
import { getEntreprise } from "../../repositories/entreprises";
import { conditionsDepuisEntreprise } from "@/lib/conditions-documents";

/**
 * Ce qui est réglé sur ses documents, pour ne pas l'écraser à l'aveugle.
 *
 * **Sa demande du 27 août 2026 : « fais la dernière ».** Régler la validité ou
 * l'acompte suppose de savoir ce qui y est déjà : proposer « validité 30 jours »
 * à quelqu'un qui a mis 45 le ferait revenir en arrière sans qu'il l'ait
 * demandé, et cela s'imprimerait sur des documents que ses clients gardent.
 */
export const lireReglagesDocuments: Outil = {
  nom: "LireReglagesDocuments",
  description:
    "Ce qui est réglé sur les devis et factures de l'entreprise : durée de validité, acompte, " +
    "délai de paiement, moyens de paiement, rappel des pénalités, texte de pied de page. " +
    "À lire AVANT de proposer d'en changer un.",
  schema: z.object({}),
  async executer({ ctx }) {
    const entreprise = await getEntreprise(ctx);
    if (!entreprise) return { erreur: "Entreprise introuvable." };
    // `conditionsDepuisEntreprise` applique les défauts d'Atlas : ce qu'on rend
    // est donc ce qui S'IMPRIME, pas seulement ce qu'il a saisi. C'est cela qui
    // compte pour décider s'il faut changer quelque chose.
    return conditionsDepuisEntreprise(entreprise);
  },
};
