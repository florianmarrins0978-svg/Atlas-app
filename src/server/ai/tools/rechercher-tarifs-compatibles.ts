import { z } from "zod";
import type { Outil } from "./types";
import { listerTarifs } from "../../repositories/tarifs";
import { lireMarges, prixAchatCandidats } from "../../repositories/fournisseurs-partenaires";
import { tarifsCorrespondants } from "../../../lib/tarifs-correspondants";
import { prixDUneLigneDictee } from "../../../lib/prix-achat";

export const rechercherTarifsCompatibles: Outil = {
  nom: "RechercherTarifsCompatibles",
  description:
    "Recherche, parmi les tarifs déjà définis par l'entreprise, ceux dont l'intitulé correspond à un mot-clé " +
    "(ex. « élagage », « carrelage »). Sans tarif, cherche un prix d'achat chez ses fournisseurs ou ses " +
    "partenaires, multiplié par sa marge. Ne renvoie jamais un prix inventé : uniquement des prix réellement " +
    "enregistrés, avec leur source.",
  schema: z.object({ motCle: z.string() }),
  async executer({ ctx }, parametres) {
    const { motCle } = parametres as { motCle: string };
    const tarifs = await listerTarifs(ctx);
    const correspondances = tarifsCorrespondants(tarifs, [motCle]).map((t) => ({
      ...t,
      source: "tarif de l'entreprise",
    }));
    if (correspondances.length > 0) return { correspondances };

    // Son ordre (« le A », 19 octobre 2026) : sa vente d'abord, puis l'achat ×
    // sa marge. La même règle que le devis dicté (`prixDUneLigneDictee`).
    const [achats, marges] = await Promise.all([prixAchatCandidats(ctx), lireMarges(ctx)]);
    const p = prixDUneLigneDictee(motCle, 1, {
      tarifs: tarifs.map((t) => ({ tarifId: t.id, intitule: t.intitule, prix: t.prix, unite: t.unite })),
      achats,
      marges,
    });
    if (p.origine === "a_chiffrer") return { correspondances: [], aChiffrer: p.detail };
    return {
      correspondances: [
        {
          intitule: motCle,
          prix: p.prixUnitaire,
          unite: p.unite,
          source: p.origine === "vente" ? "tarif de l'entreprise" : "prix d'achat multiplié par sa marge",
          detail: p.detail,
        },
      ],
    };
  },
};
