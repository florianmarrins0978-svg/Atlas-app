import { construireIndiceDictee } from "@/lib/vocabulaire-dictee";
import { termesPourConsigne } from "../repositories/termes-metier";
import { listerCartes } from "../repositories/mots-catalogue";
import type { Ctx } from "../repositories/context";
import { logger } from "../logger";

/**
 * Ce qu'on souffle au transcripteur avant qu'il écoute.
 *
 * **Sa colère du 28 août 2026 : « je lui ai dit désherbage mais il comprend
 * mal ».** Trois sources, et l'ordre compte — SES mots passent devant, parce
 * que ce sont eux qu'il faut sauver quand la place manque :
 *
 * 1. les mots qu'il a ajoutés au catalogue (`mots_catalogue`) ;
 * 2. le vocabulaire du métier tenu par Atlas (`termes_metier`) ;
 * 3. le fond de langue d'un paysagiste (`vocabulaire-dictee.ts`).
 *
 * **Un échec ici ne doit JAMAIS empêcher une dictée.** Sans indice, la
 * transcription retombe sur ce qu'elle faisait avant — c'est-à-dire ce qui
 * marchait à peu près. Perdre la dictée pour un vocabulaire manquant serait
 * échanger un mot mal entendu contre une panne.
 */
export async function indicePourDictee(ctx: Ctx): Promise<string> {
  try {
    const [termes, prestations, materiels] = await Promise.all([
      termesPourConsigne(),
      listerCartes(ctx, "prestation"),
      listerCartes(ctx, "materiel"),
    ]);

    const siens: string[] = [];
    for (const carte of [...prestations, ...materiels]) {
      // Le nom de l'entrée d'abord, puis les mots qu'il y a posés : ce sont
      // exactement les tournures qu'il emploie en parlant.
      siens.push(carte.nom, ...carte.mesMots.map((m) => m.mot));
    }
    // Les termes du métier ensuite : ils cadrent le domaine sans être les siens.
    // Seuls les INTITULÉS partent — une consigne de rédaction (« le détail va
    // sous le titre ») n'est pas un mot à entendre, et mangerait la place.
    const duMetier = termes.filter((t) => t.nature !== "regle").map((t) => t.intitule);

    return construireIndiceDictee([...siens, ...duMetier]);
  } catch (erreur) {
    logger.warn("indice_dictee_indisponible", { erreur });
    return construireIndiceDictee();
  }
}
