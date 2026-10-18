import { CATALOGUE } from "./catalogue.js";

/**
 * CE QU'ON PEUT AJOUTER OU METTRE À LA PLACE — la liste que la feuille
 * « Ajouter une pièce » et « Changer la pièce » parcourt, par catégorie ou par
 * mot cherché.
 *
 * Tout vient du catalogue, mot pour mot (`CLAUDE.md` §4 bis) : les pièces de
 * nourrice, celles du réseau, les coudes SBE, les corps d'arroseur, les tubes
 * de goutte-à-goutte, les pièces Aqua Plus relevées, et ses raccords Plasson
 * du Ø16 rigide, sans référence (*« je ne sais pas si c'est ça la référence »*,
 * 18 octobre 2026). Une référence ne s'écrit que si elle a été relevée.
 */
export type Choix = { ref: string; nom: string; categorie: string; sansReference?: boolean };

type Cat = {
  piecesNourrice: Record<string, { nom: string; marque?: string }>;
  piecesReseau: Record<string, { nom: string; marque?: string }>;
  coudes: { ref: string; nom: string; detail: string }[];
  corps: { ref: string; nom: string; detail?: string }[];
  gaines: { ref: string; nom: string }[];
  piecesAjoutables: { ref: string; nom: string; categorie: string }[];
  raccords16Rigide?: { ref: string; nom: string; categorie: string }[];
};
const CAT = CATALOGUE as unknown as Cat;

const avecMarque = (p: { nom: string; marque?: string }) => (p.marque ? `${p.marque} ${p.nom}` : p.nom);

export const CATEGORIES: [string, string][] = [
  ["nourrice", "Nourrice"],
  ["reseau", "Réseau"],
  ["arroseur", "Arroseurs"],
  ["raccord PE", "Raccords PE"],
  ["electrovanne", "Électrovannes"],
  ["regard", "Regards"],
  ["programmateur", "Programmateurs"],
  ["raccord goutte-à-goutte", "Goutte-à-goutte"],
  ["tube PE", "Tubes PE"],
  ["robinetterie", "Robinetterie"],
  ["électricité", "Électricité"],
];

let liste: Choix[] | null = null;
/** La liste se compose une fois : le catalogue ne change pas pendant la vie du module. */
export function toutesLesPieces(): Choix[] {
  if (liste) return liste;
  const out: Choix[] = [];
  for (const [ref, p] of Object.entries(CAT.piecesNourrice)) out.push({ ref, nom: avecMarque(p), categorie: "nourrice" });
  for (const [ref, p] of Object.entries(CAT.piecesReseau)) out.push({ ref, nom: avecMarque(p), categorie: "reseau" });
  for (const c of CAT.coudes) out.push({ ref: c.ref, nom: `${c.nom}, ${c.detail}`, categorie: "reseau" });
  for (const c of CAT.corps) out.push({ ref: c.ref, nom: c.nom + (c.detail ? `, ${c.detail}` : ""), categorie: "arroseur" });
  for (const g of CAT.gaines) out.push({ ref: g.ref, nom: g.nom, categorie: "raccord goutte-à-goutte" });
  for (const x of CAT.piecesAjoutables) if (!out.some((y) => y.ref === x.ref)) out.push({ ref: x.ref, nom: x.nom, categorie: x.categorie });
  for (const x of CAT.raccords16Rigide ?? []) out.push({ ref: x.ref, nom: x.nom, categorie: x.categorie, sansReference: true });
  liste = out;
  return out;
}

export function trouverLaPiece(ref: string): Choix | null {
  return toutesLesPieces().find((x) => x.ref === ref) ?? null;
}

/** La catégorie d'une pièce posée, pour ouvrir la feuille au bon endroit ; « reseau » quand on ne la connaît pas. */
export function categorieDe(ref: string): string {
  return trouverLaPiece(ref)?.categorie ?? "reseau";
}

/** Ce que la feuille montre : la catégorie choisie, ou ce que le mot cherché attrape, soixante au plus. */
export function piecesVisibles(categorie: string, recherche: string): Choix[] {
  const q = recherche.trim().toLowerCase();
  return toutesLesPieces()
    .filter((x) => (q ? `${x.nom} ${x.ref}`.toLowerCase().includes(q) : x.categorie === categorie))
    .slice(0, 60);
}
