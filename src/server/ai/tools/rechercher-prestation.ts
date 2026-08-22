import { z } from "zod";
import type { Outil } from "./types";
import { rechercherCartes } from "../../repositories/mots-catalogue";

export const rechercherPrestation: Outil = {
  nom: "RechercherPrestation",
  description:
    "Recherche les prestations correspondant à un mot-clé dans le vocabulaire partagé d'Atlas ET dans les mots " +
    "ajoutés par l'entreprise (ex. « sapin » peut correspondre à « Élagage »).",
  schema: z.object({ motCle: z.string() }),
  // **Depuis le 17 août 2026, cette recherche voit AUSSI ses mots à lui.**
  // Un mot ajouté à l'écran du catalogue et ignoré ici serait visible et muet :
  // il croirait avoir appris quelque chose à Atlas sans que rien ne change.
  async executer(contexte, parametres) {
    const { motCle } = parametres as { motCle: string };
    const cartes = await rechercherCartes(contexte.ctx, "prestation", motCle);
    return {
      correspondances: cartes.map((c) => ({
        prestationId: c.id,
        nomCanonique: c.nom,
        // Le mot de l'entreprise et celui d'Atlas ne se distinguent plus ici :
        // pour la dictée, ils désignent la même chose. `aMoi` dit seulement que
        // l'entrée entière n'existe que chez elle — donc sans historique de
        // prix ni paramètres de chiffrage partagés.
        variantes: c.motsCommuns,
        mesMots: c.mesMots.map((m) => m.mot),
        aMoi: c.aMoi,
      })),
    };
  },
};
