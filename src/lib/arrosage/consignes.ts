import { CATALOGUE } from "./catalogue.js";

/**
 * CE QUE LA DISCUSSION A LE DROIT DE CHANGER — et rien d'autre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **Sa demande du 21 août 2026 :** *« j'ai besoin que si l'utilisateur a besoin
 * de te demander de faire une modification, qu'il puisse le faire — une petite
 * interface pour qu'il puisse discuter avec toi »*. Avec deux bornes qu'il a
 * posées lui-même, et qui commandent tout ce fichier :
 *
 *   · *« La discussion ne doit JAMAIS créer un plan avec des réseaux. Elle peut
 *     seulement modifier ou recréer si un croquis avec tous les bons éléments
 *     aux bons endroits a été fourni. »*
 *   · *« Il ne faut pas mettre les phrases pré-écrites, mais il faut un endroit
 *     où on puisse discuter avec toi. »*
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **ATLAS NE DESSINE PAS LE PLAN. IL POSE UN PARAMÈTRE.**
 *
 * C'est la phrase de la maquette qu'il a validée, et c'est l'architecture
 * entière : ce qui sort de la discussion n'est jamais un tracé, jamais un
 * chiffre, jamais une liste de pièces — c'est **une consigne** prise dans la
 * liste ci-dessous. Le calcul refait ensuite le plan comme il l'aurait fait
 * d'un croquis.
 *
 * **Pourquoi cette borne est vitale.** Un plan retouché à la main ne se
 * recalcule plus : la fois d'après, le tracé, les métrés et les pièces ne
 * viennent plus de la même source, et deux d'entre eux finissent par se
 * contredire (`CLAUDE.md` §3). En passant par les paramètres, tout ce qui
 * s'affiche reste issu du même calcul — y compris ce que la modification
 * casse ailleurs, qu'on peut alors DIRE.
 *
 * **Et rien n'est inventé** (`CLAUDE.md` §4) : une marque, un corps ou une buse
 * qui ne sont pas au catalogue sont REFUSÉS, pas rapprochés du plus proche. Un
 * modèle qui répond « passez en 5006 » ne doit pas faire commander une
 * référence qui n'existe pas.
 */

/** Une modification que la discussion peut poser sur le calcul. */
export type Consigne =
  | { quoi: "marque"; valeur: string }
  | { quoi: "corps"; valeur: string }
  | { quoi: "materiel"; zone: number; valeur: "turbine" | "tuyere" | "auto" }
  | { quoi: "buse"; zone: number; valeur: string }
  | { quoi: "sonde"; valeur: boolean };

/** Une zone du plan, telle que les paramètres la portent. */
export type ZoneParametre = {
  id: number;
  type: string;
  nom?: string;
  L?: number;
  l?: number;
  ml?: number;
  x?: number;
  y?: number;
  /** Imposé par lui dans la discussion : 'turbine', 'tuyere' ou 'auto'. */
  materiel?: string;
  /** La référence de buse qu'il a demandée, ou rien — et le calcul choisit. */
  buse?: string;
};

/** Tout ce qu'il faut pour refaire le plan, sans la photo. */
export type ParametresPlan = {
  seau: number;
  temps: number;
  pression: number;
  compteur: string;
  regardVersZone: number;
  zones: ZoneParametre[];
  marque?: string;
  corps?: string;
  sonde?: boolean;
  /**
   * L'endroit du regard, en mètres, sur le repère où les zones sont posées.
   *
   * **Il voyage avec les paramètres, mais il NE SE DISCUTE PAS.** Il vient du
   * croquis, et `CLAUDE.md` §4 bis est sans appel : *« c'est l'utilisateur qui
   * placera la nourrice où il veut »*. Aucune consigne ne peut le changer —
   * pour le déplacer, on corrige le croquis et on le renvoie. Il est ici parce
   * que le DESSIN en a besoin à chaque recalcul, pas parce qu'il est réglable.
   */
  nourrice: { x: number; y: number } | null;
};

export type LectureConsigne =
  | { ok: true; consigne: Consigne }
  | { ok: false; raison: string };

/**
 * Ce que le modèle a rendu, transformé en consigne — ou refusé.
 *
 * **Chaque refus nomme ce qui n'existe pas**, jamais « demande invalide ». Le
 * patron doit pouvoir corriger sans deviner : s'il a dit « 5006 » et que le
 * catalogue n'a pas de 5006, c'est cela qu'il faut lire.
 */
export function lireConsigne(brut: unknown, parametres: ParametresPlan): LectureConsigne {
  if (typeof brut !== "object" || brut === null) {
    return { ok: false, raison: "aucune modification n’a été comprise" };
  }
  const o = brut as Record<string, unknown>;
  const quoi = typeof o.quoi === "string" ? o.quoi : "";

  if (quoi === "sonde") {
    if (typeof o.valeur !== "boolean") return { ok: false, raison: "la sonde de pluie se met ou se retire, rien d’autre" };
    return { ok: true, consigne: { quoi: "sonde", valeur: o.valeur } };
  }

  if (quoi === "marque") {
    const cle = String(o.valeur ?? "").toLowerCase();
    const connue = CATALOGUE.marques.find((m: { cle: string }) => m.cle === cle);
    if (!connue) {
      return {
        ok: false,
        raison: `« ${o.valeur} » n’est pas une marque du catalogue (${CATALOGUE.marques
          .filter((m: { cache?: boolean }) => !m.cache)
          .map((m: { nom: string }) => m.nom)
          .join(", ")})`,
      };
    }
    return { ok: true, consigne: { quoi: "marque", valeur: cle } };
  }

  if (quoi === "corps") {
    const ref = String(o.valeur ?? "");
    const connu = CATALOGUE.corps.find((c: { ref: string }) => c.ref === ref);
    if (!connu) return { ok: false, raison: `le corps « ${ref} » n’est pas au catalogue` };
    return { ok: true, consigne: { quoi: "corps", valeur: ref } };
  }

  const zone = Number(o.zone);
  const laZone = parametres.zones.find((z) => z.id === zone);
  if (quoi === "materiel" || quoi === "buse") {
    if (!laZone) return { ok: false, raison: `aucune zone n’a le numéro ${o.zone} sur ce plan` };
  }

  if (quoi === "materiel") {
    const v = String(o.valeur ?? "");
    if (v !== "turbine" && v !== "tuyere" && v !== "auto") {
      return { ok: false, raison: `« ${v} » n’est ni une turbine, ni une tuyère` };
    }
    return { ok: true, consigne: { quoi: "materiel", zone, valeur: v } };
  }

  if (quoi === "buse") {
    const ref = String(o.valeur ?? "");
    const connue = CATALOGUE.buses.find((b: { ref: string }) => b.ref === ref);
    if (!connue) return { ok: false, raison: `la buse « ${ref} » n’est pas au catalogue` };
    return { ok: true, consigne: { quoi: "buse", zone, valeur: ref } };
  }

  return { ok: false, raison: "aucune modification n’a été comprise" };
}

/**
 * Les paramètres, une consigne posée dessus.
 *
 * **On rend une COPIE.** Les paramètres d'origine voyagent depuis l'écran et
 * repartent vers lui : les modifier sur place ferait diverger ce qu'il voit de
 * ce que le calcul a reçu, et le prochain message partirait d'un état que
 * personne n'a affiché.
 */
export function appliquer(parametres: ParametresPlan, consigne: Consigne): ParametresPlan {
  const zones = parametres.zones.map((z) => ({ ...z }));
  const suivant: ParametresPlan = { ...parametres, zones };

  switch (consigne.quoi) {
    case "marque":
      suivant.marque = consigne.valeur;
      // **Le corps est remis au choix du calcul.** Un corps Rain Bird gardé
      // après un passage chez Hunter ferait commander une référence que le
      // fournisseur n'a pas — et la marque a été changée pour de bon.
      delete suivant.corps;
      zones.forEach((z) => delete z.buse);
      break;
    case "corps":
      suivant.corps = consigne.valeur;
      // Changer de corps change les buses possibles : celles qu'il avait
      // imposées appartiennent à l'ancien, et le calcul doit re-choisir.
      zones.forEach((z) => delete z.buse);
      break;
    case "sonde":
      suivant.sonde = consigne.valeur;
      break;
    case "materiel": {
      const z = zones.find((x) => x.id === consigne.zone);
      if (z) {
        z.materiel = consigne.valeur;
        // Une turbine et une tuyère n'ont pas les mêmes buses.
        delete z.buse;
      }
      break;
    }
    case "buse": {
      const z = zones.find((x) => x.id === consigne.zone);
      if (z) z.buse = consigne.valeur;
      break;
    }
  }
  return suivant;
}
