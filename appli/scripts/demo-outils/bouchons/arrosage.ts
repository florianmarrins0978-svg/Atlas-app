/** Le plan d'arrosage : ce que le serveur rendrait, sans serveur. */
import { calculerEtDessiner } from "@/lib/arrosage/le-plan";
import type { ParametresPlan } from "@/lib/arrosage/consignes";
import { fabrique, refus, type Action } from "./commun";

/**
 * LE JARDIN DE LA DÉMONSTRATION. Sa demande du 20 novembre 2026 : « un
 * exemple avec deux réseaux, par exemple un réseau pour le gazon avec
 * 4 arroseurs [Rain Bird], et un réseau de goutte à goutte », et « qu'on
 * puisse cliquer sur 25 ou 32, que ça modifie le nombre de réseaux ».
 *
 * Rien n'est choisi à la main dans le résultat : on a cherché, avec le vrai
 * calcul, le jardin où toucher 25 ou 32 change réellement les réseaux. Une
 * pelouse de 4 turbines sur un seul réseau n'en change pas (elle passe déjà en
 * Ø25) ; celle-ci, de 20 m sur 8 m, donne en Ø25 deux réseaux de 4 turbines
 * 3504 et le goutte-à-goutte du massif, et en Ø32 une seule ligne de 8
 * turbines : un réseau de moins. Le débit (10 L en 12 s) et la pression
 * (2,5 bar) sont ceux d'un compteur de ville ; l'amenée et le trajet du regard
 * sont ce que la lecture d'un croquis de ce jardin donnerait. La nourrice est
 * posée par nous, parce qu'une démonstration n'a pas de croquis : dans
 * l'outil, c'est l'artisan qui la place (.claude/rules/arrosage.md).
 */
export const JARDIN_DE_LA_DEMO: ParametresPlan = {
  seau: 10,
  temps: 12,
  pression: 2.5,
  compteur: "oui",
  regardVersZone: 3,
  amenee: 8,
  zones: [
    { id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 20, l: 8 },
    { id: 2, type: "massif", nom: "Massif", x: 0, y: 9, L: 20, l: 1.2, sortieGoutte: "boucle" },
  ] as ParametresPlan["zones"],
  nourrice: { x: 20.5, y: 4 },
  couronne: 50,
};

let dejaLu = 0;

export const { bouchon, constante } = fabrique({
  "src/app/paysage/arrosage/actions.ts": {
    // Le croquis « lu » : ce que le serveur rend, composé par la même fonction
    // pure que lui (`calculerEtDessiner`, src/lib/arrosage/le-plan.ts).
    // **Une seule fois.** Le premier envoi, fait au chargement, ouvre le plan
    // du jardin d'exemple. Un croquis repris ensuite (« Modifier », une photo,
    // un dessin) donnerait dans l'appli SON plan, que la démonstration ne sait
    // pas calculer sans serveur : elle le dit, au lieu de rendre l'exemple à
    // la place de ce qui a été dessiné.
    lireLeCroquis: async () => (dejaLu++ > 0 ? { etat: "refus", raison: "Dans l’appli, votre croquis devient le plan. Ici, c’est une démonstration : touchez Recommencer." } : {
      etat: "lu",
      zones: JARDIN_DE_LA_DEMO.zones.map((z) => ({ type: z.type, nom: z.nom ?? null, L: z.L ?? null, l: z.l ?? null, ml: null })),
      reserves: [],
      sansDessin: null,
      // Les paramètres, le plan et son dessin, rendus par la fonction même.
      ...calculerEtDessiner(JARDIN_DE_LA_DEMO, null),
    }),
    discuterDuPlan: refus("Dans l’appli, l’assistant refait le plan d’après votre message. Ici, c’est une démonstration."),
  },
  "src/app/paysage/arrosage/actions-fournisseurs.ts": {
    // Aucun fournisseur enregistré : la liste part par « Copier » ou
    // « Envoyer », sans prix, comme chez un artisan qui commence.
    prixDesFournisseursAction: async () => null,
    enregistrerLaDemandeAction: async () => ({ ok: true, nom: "votre fournisseur" }),
  },
} satisfies Record<string, Record<string, Action>>);
