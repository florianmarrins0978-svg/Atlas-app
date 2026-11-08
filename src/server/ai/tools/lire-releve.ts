import { z } from "zod";
import type { Outil } from "./types";
import { lignesDuReleve, premierJourDuReleve } from "../../repositories/pour-mon-comptable";
import { debutCouvert, jourEnMots, libellePeriode, totalSigne, totauxDuReleve } from "@/lib/pour-mon-comptable";
import { jourIso } from "@/lib/jour";

const JOUR = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Un jour AAAA-MM-JJ, compris dans la période.");

/**
 * Ce qui est entré et sorti du compte, sur une période — le relevé de la banque reliée.
 *
 * **Sa question du 8 novembre 2026** : *« c'est normal que quand je lui demande
 * mes entrées et mes sorties de l'année, il me les trouve pas ? »* Aucun outil ne
 * lisait le relevé, pourtant gardé ligne à ligne (`mouvements_bancaires`). Sa
 * planche (`appli/soignee/banque-entrees-sorties.html`) : les totaux, puis le
 * détail mois par mois.
 *
 * **Les mêmes lignes et les mêmes règles que l'écran du comptable**
 * (`lignesDuReleve`, `totauxDuReleve`, `totalSigne`) : l'assistant ne peut pas
 * dire un autre chiffre que celui que l'écran montre.
 *
 * **Avant le premier jour donné par la banque, rien n'est connu** : la période
 * commence alors à ce jour-là, et la réponse le dit (`debutCouvert`). Lire une
 * année entière là où la banque n'a donné que 90 jours serait inventer.
 *
 * L'assistant n'est ouvert qu'au patron (`peutUtiliserLAssistant`) : ce relevé
 * ne s'ouvre donc à personne qui ne voit déjà la banque.
 */
export const lireReleve: Outil = {
  nom: "LireReleve",
  description:
    "Lit le relevé de la banque reliée : ce qui est entré, ce qui est sorti et ce qui reste, sur une période (du, au, compris), " +
    "puis le détail mois par mois. Sans dates : depuis le 1er janvier de l'année en cours jusqu'à aujourd'hui. " +
    "À utiliser pour « mes entrées et sorties de l'année », « combien j'ai dépensé en octobre », « ce qui est rentré depuis septembre ». " +
    "Si « partielle » est rempli, le dire : la banque n'a pas donné ses lignes plus tôt.",
  schema: z.object({ du: JOUR.optional(), au: JOUR.optional() }),
  async executer({ ctx }, { du, au }) {
    const fin = au ?? jourIso(new Date());
    const demande = du ?? `${fin.slice(0, 4)}-01-01`;
    if (demande > fin) return { trouve: false, raison: "La période commence après sa fin." };

    const premier = await premierJourDuReleve(ctx);
    if (!premier) {
      return { trouve: false, raison: "Aucune ligne de banque : la banque n'est pas reliée, ou ne l'a pas encore été lue." };
    }
    const debut = debutCouvert(demande, premier);
    if (debut > fin) {
      return { trouve: false, raison: `La banque n'a donné ses lignes qu'à partir du ${jourEnMots(premier)} ${premier.slice(0, 4)}.` };
    }

    const lignes = await lignesDuReleve(ctx, debut, fin);
    const total = totauxDuReleve(lignes);
    const reste = total.entrees - total.sorties;
    const mois = [...new Set(lignes.map((l) => l.jour.slice(0, 7)))].sort();
    return {
      trouve: true,
      du: debut,
      au: fin,
      partielle:
        debut > demande
          ? `La banque n'a donné ses lignes qu'à partir du ${jourEnMots(debut)} ${debut.slice(0, 4)} : avant, rien n'est connu.`
          : null,
      entrees: totalSigne(total.entrees, "entree"),
      sorties: totalSigne(total.sorties, "sortie"),
      reste: totalSigne(Math.abs(reste), reste >= 0 ? "entree" : "sortie"),
      parMois: mois.map((m) => {
        const t = totauxDuReleve(lignes.filter((l) => l.jour.startsWith(m)));
        return { mois: libellePeriode(m), entrees: totalSigne(t.entrees, "entree"), sorties: totalSigne(t.sorties, "sortie") };
      }),
    };
  },
};
