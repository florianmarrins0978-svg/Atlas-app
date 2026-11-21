/**
 * CE QU'UN RÉSEAU PORTE, EN MOTS — sur l'écran du plan comme dans le PDF d'un
 * plan enregistré (sa demande du 21 novembre 2026 : un réseau par page).
 *
 * « 9x Turbine 3504 buse 0,75, portée 5 m », « 48 m de PEHD Ø25 » : ces
 * phrases s'écrivaient dans l'écran. Le PDF les redit ; écrites deux fois,
 * elles finiraient par différer, et le papier contredirait l'écran (`CLAUDE.md`
 * §3). Une seule fonction les écrit, pour les deux.
 */
import type { ParametresPlan, ZoneParametre } from "./consignes";
import type { LePlan } from "./le-plan";
import type { Dessin } from "./plan-dessine";
import { metresDeTubeDuReseau, type Postes } from "./postes";
import type { Retouches } from "./retouches";

/** Le nombre de l'écran du plan : une décision, une virgule. */
function virgule(x: number, d = 1): string {
  return (Math.round(x * 10 ** d) / 10 ** d).toString().replace(".", ",");
}

/** « 12 m sur 10 m », ou « 6 m » pour une haie : au centième, comme la feuille qui les corrige. */
export function cotesEcrites(z: ZoneParametre): string {
  const v = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");
  return z.type === "haie" ? `${v(z.ml ?? 0)} m` : `${v(z.L ?? 0)} m sur ${v(z.l ?? 0)} m`;
}

/** Les zones qu'un réseau arrose, dans l'ordre des paramètres. */
export function zonesDuReseau(parametres: Pick<ParametresPlan, "zones">, plan: Pick<LePlan, "reseauxDeZone">, i: number): ZoneParametre[] {
  return parametres.zones.filter((z) => (plan.reseauxDeZone[String(z.id)] ?? []).includes(i));
}

/** Une ligne : la quantité en or (ou rien), puis ce qu'elle désigne. */
export type LigneDuReseau = { quantite: string | null; texte: string };

/**
 * Le matériel d'un réseau, tel que sa carte le liste : les têtes et leur buse,
 * le goutte-à-goutte, puis son tuyau. Zéro mètre tracé n'est pas une longueur :
 * le tuyau reste « à mesurer », il ne vaut pas rien.
 */
export function lignesDuReseau(
  f: { plan: LePlan; dessin: Dessin | null; postes: Postes },
  retouches: Pick<Retouches, "sortie">,
  i: number
): LigneDuReseau[] {
  const { plan, dessin, postes } = f;
  const s = plan.secteurs[i];
  const rd = dessin?.reseaux.find((x) => x.numero === i) ?? null;
  const lignes: LigneDuReseau[] = (rd?.materiels ?? []).map((m) => ({
    quantite: `${m.nombre}x`,
    texte: `${m.libelle}, ${m.bridee ? "bridée à" : "portée"} ${virgule(m.portee)} m`,
  }));
  if (s?.famille === "Goutte-à-goutte") {
    const tube = postes.reseaux[i]?.tube;
    lignes.push({
      quantite: null,
      texte: `Goutte-à-goutte Toro, ${tube ? `${tube}, ` : ""}${retouches.sortie === "boucle" ? "deux lignes en circuit fermé" : "une seule ligne"}, ${metresDeTubeDuReseau(plan, i)} m de tube`,
    });
  }
  if (rd) {
    const d = plan.diametres[i] ?? 25;
    lignes.push(rd.metresTuyau > 0 ? { quantite: `${virgule(rd.metresTuyau, 0)} m`, texte: `de PEHD Ø${d}` } : { quantite: null, texte: `PEHD Ø${d}, à mesurer` });
  }
  return lignes;
}
