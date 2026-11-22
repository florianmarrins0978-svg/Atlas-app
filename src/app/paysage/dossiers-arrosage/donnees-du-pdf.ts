/**
 * CE QUE LE PDF D'UN PLAN ENREGISTRÉ PORTE, tiré du plan figé et des DESSINS
 * DE L'ÉCRAN (sa demande du 21 novembre 2026, `ARCHITECTURE.md` §599).
 *
 * **Le réseau en couleur n'est pas redessiné pour le papier** : ce fichier
 * appelle `PlanDessine` et `LegendeDesSymboles`, les mêmes que l'écran, et
 * parcourt ce qu'ils rendent (`enNoeuds`). Ils n'ont ni état ni effet : les
 * appeler comme des fonctions donne exactement leurs éléments SVG. Le PDF
 * (`src/server/pdf/plan-arrosage-pdf.ts`) les trace ensuite. Ce parcours vit
 * ici, au niveau des écrans, parce qu'un fichier du serveur n'a pas le droit
 * de connaître un écran (`CLAUDE.md` §4 sexies).
 */
import { Fragment, isValidElement, type ReactNode } from "react";
import PlanDessine, { LegendeDesSymboles } from "../arrosage/PlanDessine";
import { montageDuPlan } from "@/lib/arrosage/le-plan";
import { cotesEcrites, lignesDuReseau, zonesDuReseau } from "@/lib/arrosage/lignes-du-reseau";
import { resumeDuPlan, type PlanFige, type SaisieDuPlan } from "@/lib/arrosage/plan-enregistre";
import { liaisonsDuReseau, phraseDeLaNourrice, quantiteDeLigne, voiesEnGoutte, zonesGoutteDuReseau } from "@/lib/arrosage/postes";
import { photoDeLaNourrice } from "@/lib/arrosage/nourrice-en-photo";
import { photoDe } from "@/lib/arrosage/photos";
import { composerNourrice } from "@/lib/arrosage/nourrice-eclatee";
import type { Retouches } from "@/lib/arrosage/retouches";
import type { Groupe } from "@/lib/arrosage/postes";
import { nomDeLaZone } from "@/lib/arrosage/zones-du-plan";
import type { DonneesPdfDuPlan, LigneNumerotee, SegmentDeTexte } from "@/server/pdf/plan-arrosage-pdf";
import type { NoeudSvg } from "@/server/pdf/svg-vers-pdf";

/** Les éléments que rend un composant sans état, à plat : les fonctions appelées, les fragments ouverts. */
export function enNoeuds(n: ReactNode): (NoeudSvg | string)[] {
  if (n === null || n === undefined || typeof n === "boolean") return [];
  if (typeof n === "string" || typeof n === "number") return [String(n)];
  if (Array.isArray(n)) return n.flatMap(enNoeuds);
  if (!isValidElement(n)) return [];
  const { type, props } = n as { type: unknown; props: Record<string, unknown> };
  if (type === Fragment) return enNoeuds(props.children as ReactNode);
  if (typeof type === "function") return enNoeuds((type as (p: Record<string, unknown>) => ReactNode)(props));
  if (typeof type !== "string") return [];
  const { children, ...reste } = props;
  return [{ type, props: reste, enfants: enNoeuds(children as ReactNode) }];
}

function premierSvg(noeuds: (NoeudSvg | string)[]): NoeudSvg | null {
  for (const n of noeuds) {
    if (typeof n === "string") continue;
    if (n.type === "svg") return n;
    const dedans = premierSvg(n.enfants);
    if (dedans) return dedans;
  }
  return null;
}

/** Le texte d'une ligne de légende, avec son mot en gras (« **rond** : une turbine »). */
function segments(noeuds: (NoeudSvg | string)[], gras = false): SegmentDeTexte[] {
  return noeuds.flatMap((n) => (typeof n === "string" ? [{ gras, texte: n }] : segments(n.enfants, gras || n.type === "b")));
}

/** La légende de l'écran, symbole par symbole. */
function legende(robinet: boolean): DonneesPdfDuPlan["legende"] {
  const racine = LegendeDesSymboles({ robinet });
  const lignes = isValidElement(racine) ? ((racine.props as { children?: ReactNode }).children as ReactNode) : null;
  return (Array.isArray(lignes) ? lignes : [lignes])
    .filter((l): l is React.ReactElement<{ symbole: ReactNode; texte: ReactNode }> => isValidElement(l))
    .map((l) => ({
      symbole: { type: "svg", props: { viewBox: "-1 -1 2 2" }, enfants: enNoeuds(l.props.symbole) },
      texte: segments(enNoeuds(l.props.texte)),
    }));
}

/**
 * La page de la nourrice — sa demande du 22 novembre 2026 : *« il manque la
 * nourrice »*. Son éclaté vu du dessus (la photo de la 3D, `nourrice-en-photo.ts`)
 * et ses pièces, celles que la liste compte. Au nez de robinet il n'y a pas de
 * nourrice ; supprimée en entier, elle n'a plus rien à montrer.
 *
 * **Numérotées comme à l'écran** (sa demande du même soir : savoir tout de suite
 * à quoi correspond chaque ligne) : dans l'ordre de `composerNourrice`, que la
 * légende de l'écran suit. Le bout de tube sous chaque voie n'est pas numéroté :
 * c'est le départ du réseau, compté avec lui, et son diamètre est celui du
 * réseau. Ce que la photo ne montre pas (regard, programmateur, pile…) vient
 * après, sans numéro, comme le bac « Avec la nourrice » de l'écran.
 */
function laNourrice(fige: PlanFige, r: Retouches, nez: boolean): DonneesPdfDuPlan["nourrice"] {
  const n = fige.nourrice;
  if (nez || n.voies.length === 0 || Object.keys(n.lignes).length === 0) return null;
  const goutte = voiesEnGoutte(fige.plan, n.voies);
  const ordre = (composerNourrice(n.voies.length, goutte)?.ordre ?? []).filter((ref) => ref in n.nombre);
  // La pièce qu'il a mise à la place compte sous SA référence ; une pièce supprimée reste, barrée.
  const montree = (ref: string) => r.remplacees[`nr:${ref}`]?.ref ?? ref;
  const numerotees = ordre.map((ref, i) => {
    const ligne = n.lignes[montree(ref)];
    const barree = n.barrees[montree(ref)];
    return { numero: i + 1, ref, quantite: ligne ? quantiteDeLigne(ligne) : null, nom: (ligne ?? barree)?.nom ?? ref, retiree: !ligne };
  });
  const vues = new Set(ordre.map(montree));
  return {
    titre: n.nom,
    phrase: phraseDeLaNourrice(goutte),
    photo: photoDeLaNourrice(n.voies.length, goutte),
    places: `${n.voies.length}-${goutte}`,
    numerotees,
    avec: Object.entries(n.lignes)
      .filter(([ref]) => !vues.has(ref))
      .map(([, l]) => ({ quantite: quantiteDeLigne(l), nom: l.nom })),
  };
}

/**
 * Les pièces d'un réseau, numérotées : celles de SON groupe dans la liste, dans
 * le même ordre, chacune avec sa photo. Le PDF pose le numéro sur chaque photo
 * de la page.
 */
function laListeDuReseau(groupes: Groupe[], i: number): { liste: LigneNumerotee[]; numeros: Record<string, number> } {
  const g = groupes.find((x) => x.bloc === String(i));
  const liste = Object.entries(g?.lignes ?? {}).map(([ref, l], k) => ({ numero: k + 1, ref, quantite: quantiteDeLigne(l), nom: l.nom, photo: photoDe(ref) }));
  return { liste, numeros: Object.fromEntries(liste.map((l) => [l.ref, l.numero])) };
}

export function donneesDuPdf(d: { entreprise: string; dossier: string; enregistreLe: Date; saisie: SaisieDuPlan; fige: PlanFige }): DonneesPdfDuPlan {
  const { plan, dessin, postes, groupes } = d.fige;
  const nez = montageDuPlan(d.saisie.parametres) === "nez";
  return {
    entreprise: d.entreprise,
    dossier: d.dossier,
    date: d.enregistreLe.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }),
    resume: `${resumeDuPlan(d.fige)}.`,
    legende: legende(nez),
    nourrice: laNourrice(d.fige, d.saisie.retouches, nez),
    reseaux: postes.reseaux.map((r) => ({
      titre: `Réseau ${r.i + 1}`,
      couleur: r.couleur,
      zones: zonesDuReseau(d.saisie.parametres, plan, r.i).map((z) => `${nomDeLaZone(z)}, ${cotesEcrites(z)}`),
      lignes: lignesDuReseau(d.fige, d.saisie.retouches, r.i),
      plan: dessin
        ? premierSvg(enNoeuds(PlanDessine({ dessin, reseau: r.i, liaisons: liaisonsDuReseau(dessin, plan, r.i), zonesGoutte: zonesGoutteDuReseau(plan, r.i), piquage: nez ? "robinet" : "nourrice" })))
        : null,
      tuyau: { poste: r.pe, texte: `PEHD Ø25, ${r.metres}` },
      pieces: r.plan,
      rail: r.rail,
      ajoutees: r.ajoutees,
      chaine: r.chaine,
      ...laListeDuReseau(groupes, r.i),
    })),
    groupes: groupes.map((g) => ({ titre: g.titre, lignes: Object.values(g.lignes).map((e) => ({ quantite: quantiteDeLigne(e), nom: e.nom })) })),
  };
}
