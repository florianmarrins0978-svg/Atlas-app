/**
 * CE QUE L'IA AVAIT LU SUR LA PHOTO, ET CE QU'IL EN A CORRIGÉ — sa planche du
 * 21 novembre 2026 (`appli/arrosage-dossiers.html`), « Voir la saisie » :
 * « Massif, 20 m sur 2,40 m (lu 2 m, corrigé par vous) ».
 *
 * **Pourquoi la cote lue voyage avec la zone.** Le plan enregistré sert de
 * trace : *« si un artisan me reproche un réseau qui ne se lève pas »*
 * (`ARCHITECTURE.md` §599). Une cote fausse peut venir de la photo ou de lui ;
 * seule la cote lue, gardée à côté de la cote finale, permet de le dire. La
 * zone porte donc ce que l'IA avait lu depuis la lecture (`DessinerLePlan.tsx`),
 * à travers le serveur (`lireLeDessin`, `croquisDuDessin`), jusqu'aux
 * paramètres du calcul, que l'enregistrement fige.
 *
 * **Ce qui ne la porte pas, et c'est délibéré** :
 *   · une zone ajoutée à la main : la photo n'en disait rien ;
 *   · un morceau de pelouse coupée autour d'un massif : aucun morceau n'a été
 *     lu, et lui prêter la cote de la pelouse entière serait faux ;
 *   · une haie : elle se lit en mètres linéaires, pas en longueur sur largeur.
 *
 * **Une cote que l'IA n'a pas lue reste vide.** La lecture pose alors une
 * taille à l'estime pour qu'il la voie (`plan-lu.ts`) : ce n'est pas une
 * lecture, et écrire « lu 2 m » serait inventer.
 */
import type { ZoneLueDessinee } from "./plan-lu";

export type CotesLues = {
  L: number | null;
  l: number | null;
  /** Les cotes que la lecture a DÉDUITES d'autres cotes écrites, et non lues. */
  deduites: ("L" | "l")[];
};

/** Ce que la lecture a rendu pour une zone, tel que le plan lu à vérifier l'ouvre. */
export function cotesLuesDe(z: ZoneLueDessinee): CotesLues | undefined {
  if (z.type === "haie") return undefined;
  const manque = z.aVerifier?.manque ?? [];
  return {
    L: manque.includes("L") ? null : z.L,
    l: manque.includes("l") ? null : z.l,
    deduites: (z.aVerifier?.deduites ?? []).map((d) => d.champ),
  };
}

/**
 * Relit des cotes lues venues d'un navigateur : `undefined` quand il n'y en a
 * pas, `"faux"` quand elles ne se lisent pas. Le plafond est celui de l'appelant,
 * le même que pour les cotes du plan.
 */
export function lireLesCotesLues(x: unknown, plafond: number): CotesLues | undefined | "faux" {
  if (x === undefined || x === null) return undefined;
  if (typeof x !== "object") return "faux";
  const o = x as Record<string, unknown>;
  const cote = (v: unknown): number | null | "faux" =>
    v === null ? null : typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= plafond ? v : "faux";
  const L = cote(o.L), l = cote(o.l);
  if (L === "faux" || l === "faux") return "faux";
  const brutes = o.deduites ?? [];
  if (!Array.isArray(brutes) || brutes.some((c) => c !== "L" && c !== "l")) return "faux";
  return { L, l, deduites: [...new Set(brutes as ("L" | "l")[])] };
}

const ecrit = (x: number) => `${String(Math.round(x * 100) / 100).replace(".", ",")} m`;
const pareil = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * « (lu 2 m, corrigé par vous) », ou `null` quand rien de ce que l'IA avait lu
 * n'a changé. Une zone tournée d'un quart de tour échange sa longueur et sa
 * largeur sans rien corriger : on compare donc dans le sens qui change le moins.
 */
export function noteDesCorrections(z: { L?: number; l?: number; luSurLaPhoto?: CotesLues }): string | null {
  const lu = z.luSurLaPhoto;
  if (!lu || z.L === undefined || z.l === undefined) return null;
  const finales = [z.L, z.l];
  const ecarts = (sens: ("L" | "l")[]) =>
    sens.map((c, i) => {
      const valeur = lu[c];
      return valeur !== null && !pareil(valeur, finales[i]) ? { valeur, deduite: lu.deduites.includes(c) } : null;
    });
  const droit = ecarts(["L", "l"]);
  const tourne = ecarts(["l", "L"]);
  const compte = (e: typeof droit) => e.filter(Boolean).length;
  const corrigees = (compte(tourne) < compte(droit) ? tourne : droit).filter((e): e is { valeur: number; deduite: boolean } => e !== null);
  if (corrigees.length === 0) return null;
  const memeOrigine = corrigees.every((e) => e.deduite === corrigees[0].deduite);
  const dit = memeOrigine
    ? `${corrigees[0].deduite ? "déduit" : "lu"} ${corrigees.map((e) => ecrit(e.valeur)).join(" sur ")}`
    : corrigees.map((e) => `${e.deduite ? "déduit" : "lu"} ${ecrit(e.valeur)}`).join(", ");
  return `(${dit}, corrigé par vous)`;
}
