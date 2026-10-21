import { cotesDuPlanTiennentDebout, type ParametresPlan, type ZoneParametre } from "./consignes";
import { AIMANT_M } from "./dessin-du-plan";

/**
 * CE QUE L'IA A MAL LU SE CORRIGE À LA MAIN — « la A », sa réponse du
 * 20 octobre 2026 (`appli/arrosage-cotes-des-zones.html`) : *« il faudrait
 * rajouter la possibilité de modifier les longueur largeur des zones à arroser
 * si jamais il arrive pas à lire le croquis correctement »*, puis *« pouvoir
 * supprimer une zone qui a été lue à tort ou qu'on ne voudrait plus »*, et
 * *« si il n'arrive pas à lire une zone, faut pouvoir la rajouter
 * manuellement »*.
 *
 * Chaque geste rend des PARAMÈTRES neufs, et le calcul refait le plan : comme
 * la discussion, l'écran ne retouche jamais un plan à la main (`consignes.ts`).
 * Et chaque geste repasse par la borne des cotes : ce qui vient de l'écran ne
 * vaut pas mieux que ce qui vient de la photo.
 */

/** Le nom d'une zone : celui du croquis, sinon celui de son type, comme le calcul l'écrit (`TYPES`, `calcul.js`). */
export function nomDeLaZone(z: Pick<ZoneParametre, "nom" | "type">): string {
  return z.nom || ({ gazon: "Pelouse", massif: "Massif", haie: "Haie", potager: "Potager" } as Record<string, string>)[z.type] || "Zone";
}

export type Geste = { ok: true; parametres: ParametresPlan } | { ok: false; raison: string };

/** Les paramètres, s'ils tiennent debout ; sinon la raison, celle de la borne commune. */
function verifie(parametres: ParametresPlan): Geste {
  const borne = cotesDuPlanTiennentDebout(parametres);
  return borne.ok ? { ok: true, parametres } : { ok: false, raison: borne.raison };
}

/** Une cote saisie : un nombre positif, ou rien. */
const positif = (x: number | undefined) => x !== undefined && Number.isFinite(x) && x > 0;

/** Corriger les cotes d'une zone. Une haie se corrige en longueur seule. */
export function modifierLaZone(parametres: ParametresPlan, id: number, cotes: { L?: number; l?: number; ml?: number }): Geste {
  const z = parametres.zones.find((x) => x.id === id);
  if (!z) return { ok: false, raison: "Cette zone n’est plus sur le plan." };
  const haie = z.type === "haie";
  if (haie ? !positif(cotes.ml) : !positif(cotes.L) || !positif(cotes.l)) {
    return { ok: false, raison: haie ? "Donnez la longueur de la haie." : "Donnez la longueur et la largeur." };
  }
  const modifiee: ZoneParametre = haie ? { ...z, ml: cotes.ml } : { ...z, L: cotes.L, l: cotes.l };
  return verifie({ ...parametres, zones: parametres.zones.map((x) => (x.id === id ? modifiee : x)) });
}

/** Supprimer une zone. La dernière reste : sans zone, il n'y a plus de plan à refaire. */
export function supprimerLaZone(parametres: ParametresPlan, id: number): Geste {
  if (!parametres.zones.some((x) => x.id === id)) return { ok: false, raison: "Cette zone n’est plus sur le plan." };
  if (parametres.zones.length <= 1) return { ok: false, raison: "C’est la seule zone du plan : reprenez plutôt la photo." };
  return verifie({ ...parametres, zones: parametres.zones.filter((x) => x.id !== id) });
}

/**
 * Ajouter une zone que l'IA n'a pas lue.
 *
 * **Elle se pose SOUS les autres, jamais par-dessus**, et reste marquée « à
 * placer » tant qu'il ne l'a pas glissée : une zone posée sur une autre
 * mêlerait leurs têtes, et une place devinée en silence ferait commander un
 * tuyau mesuré sur un terrain qui n'existe pas. Le plan le dit
 * (`le-plan.ts`), et le glissement est facultatif : non glissée, elle compte
 * quand même dans les réseaux et les arroseurs.
 *
 * **Le goutte-à-goutte est une surface** (`massif`), comme le calcul le couche
 * en lignes ; il reprend la sortie déjà choisie sur ce plan, une ligne ou deux
 * en boucle, sans quoi rien n'en serait compté.
 */
export function ajouterUneZone(
  parametres: ParametresPlan,
  nouvelle: { nom: string; arrosage: "goutte" | "arroseurs"; L: number; l: number }
): Geste {
  if (!positif(nouvelle.L) || !positif(nouvelle.l)) return { ok: false, raison: "Donnez la longueur et la largeur." };
  const id = Math.max(0, ...parametres.zones.map((x) => x.id)) + 1;
  const places = parametres.zones.filter((x) => Number.isFinite(x.x) && Number.isFinite(x.y));
  const gauche = places.length ? Math.min(...places.map((x) => x.x!)) : 0;
  const dessous = places.length ? Math.max(...places.map((x) => x.y! + (x.l ?? 0))) + 1 : 0;
  const sortie = parametres.zones.find((x) => x.sortieGoutte)?.sortieGoutte;
  const goutte = nouvelle.arrosage === "goutte";
  const zone: ZoneParametre = {
    id,
    type: goutte ? "massif" : "gazon",
    nom: nouvelle.nom.trim() || (goutte ? "Goutte-à-goutte" : "Pelouse"),
    L: nouvelle.L,
    l: nouvelle.l,
    x: gauche,
    y: dessous,
    aPlacer: true,
    ...(goutte && sortie ? { sortieGoutte: sortie } : {}),
  };
  return verifie({ ...parametres, zones: [...parametres.zones, zone] });
}

/** Au-delà, ce n'est plus un jardin : une place démesurée, comme une cote démesurée. */
const PLACE_MAX_M = 200;

/**
 * Glisser une zone à sa place, en mètres, sur le repère du plan.
 *
 * **L'aimant de 50 cm**, celui du dessin du plan (validé le 19 octobre 2026) :
 * un bord à moins de 50 cm d'un bord d'une autre zone s'y colle. Le doigt ne
 * pose jamais une zone au centimètre ; sans aimant, deux pelouses jointives
 * laisseraient entre elles une bande de 20 cm que le calcul croirait à arroser.
 */
export function glisserLaZone(parametres: ParametresPlan, id: number, x: number, y: number): Geste {
  const z = parametres.zones.find((q) => q.id === id);
  if (!z) return { ok: false, raison: "Cette zone n’est plus sur le plan." };
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > PLACE_MAX_M || Math.abs(y) > PLACE_MAX_M) {
    return { ok: false, raison: "Cette place sort du plan." };
  }
  const L = z.L ?? z.ml ?? 0, l = z.l ?? 0;
  const autres = parametres.zones.filter((q) => q.id !== id && Number.isFinite(q.x) && Number.isFinite(q.y));
  const bords = (axe: "x" | "y") => autres.flatMap((q) => (axe === "x" ? [q.x!, q.x! + (q.L ?? q.ml ?? 0)] : [q.y!, q.y! + (q.l ?? 0)]));
  const coller = (v: number, taille: number, cibles: number[]) => {
    let meilleur = v, ecart = AIMANT_M;
    for (const c of cibles) {
      for (const candidat of [c, c - taille]) {
        if (Math.abs(v - candidat) < ecart) { ecart = Math.abs(v - candidat); meilleur = candidat; }
      }
    }
    return meilleur;
  };
  const posee: ZoneParametre = { ...z, x: coller(x, L, bords("x")), y: coller(y, l, bords("y")), aPlacer: false };
  return verifie({ ...parametres, zones: parametres.zones.map((q) => (q.id === id ? posee : q)) });
}
