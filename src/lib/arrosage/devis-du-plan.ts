import { CATALOGUE } from "./catalogue.js";
import { toutesLesPieces } from "./choix-de-pieces";
import { composerNourrice } from "./nourrice-eclatee";
import { normaliserPourRecherche } from "../recherche-client";
import type { LigneDevisLue } from "../devis-fournisseur-lu";

/**
 * IMPORTER UN DEVIS FOURNISSEUR DANS L'OUTIL D'ARROSAGE — sa planche du
 * 18 octobre 2026 (`appli/arrosage-import-devis.html`, validée) : *« si
 * quelqu'un a déjà fait un devis chez un fournisseur, il puisse rentrer le
 * devis, et que l'outil récupère la nomenclature et lui crée le montage »*.
 *
 * **Ce qu'un devis donne** : les pièces, leurs quantités, le nombre de réseaux
 * (une électrovanne, un réseau), donc la nourrice. **Ce qu'il ne donne pas** :
 * le jardin. Sans croquis complet, aucun plan (`.claude/rules/arrosage.md`).
 *
 * **Une ligne se reconnaît par sa RÉFÉRENCE** (ou un nom identique au caractère
 * près), jamais par un nom voisin : une pièce devinée sur un devis, c'est une
 * pièce fausse dans une tranchée. Ce qui ne se reconnaît pas se dit « Pas dans
 * le catalogue », et il choisit.
 */

type Cat = {
  piece(ref: string): { nom: string; marque?: string } | null;
  referenceDe(ref: string): string | null;
  buses: { ref: string; nom: string }[];
  ficheNourrice(n: number, goutte: number): { nom: string; pieces: { ref: string; q: number }[] } | null;
};
const CAT = CATALOGUE as unknown as Cat;

export const ELECTROVANNE_MM = "electrovanne-100dv";
export const ELECTROVANNE_FF = "electrovanne-100dv-ff";

export type PieceDuDevis = { cle: string; nom: string; reference: string | null; q: number; u: "u" | "ml" };
export type LigneInconnue = { lu: string };

const propre = (r: string | null | undefined) => (r ?? "").toUpperCase().replace(/[\s.\-_/]/g, "");

let table: { cle: string; nom: string; reference: string | null }[] | null = null;
function lesPieces() {
  if (table) return table;
  const vues = new Set<string>();
  table = [];
  for (const c of [...toutesLesPieces(), ...CAT.buses]) {
    if (vues.has(c.ref)) continue;
    vues.add(c.ref);
    table.push({ cle: c.ref, nom: c.nom, reference: CAT.referenceDe(c.ref) });
  }
  return table;
}

const quantiteLue = (q: string | null): number | null => {
  if (!q) return null;
  const n = Number(q.replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Les lignes lues : reconnues par le catalogue, ou à choisir. */
export function reconnaitreLeDevis(lignes: readonly LigneDevisLue[]): { connues: PieceDuDevis[]; inconnues: LigneInconnue[] } {
  const connues: PieceDuDevis[] = [];
  const inconnues: LigneInconnue[] = [];
  for (const l of lignes) {
    const r = propre(l.reference);
    const nom = normaliserPourRecherche(l.designation);
    const p = lesPieces().find((x) => (r && (propre(x.reference) === r || propre(x.cle) === r)) || normaliserPourRecherche(x.nom) === nom);
    const q = quantiteLue(l.quantite);
    // Sans pièce reconnue ou sans quantité lisible, rien ne se suppose : il choisit.
    if (!p || q === null) {
      inconnues.push({ lu: [l.designation, l.reference].filter(Boolean).join(", ") });
      continue;
    }
    const deja = connues.find((c) => c.cle === p.cle);
    if (deja) deja.q += q;
    else connues.push({ cle: p.cle, nom: p.nom, reference: p.reference, q, u: l.unite === "m" ? "ml" : "u" });
  }
  return { connues, inconnues };
}

export type MontageDuDevis = {
  voies: number;
  goutte: number;
  /** « La nourrice 3 voies ». */
  titre: string;
  /** « 3 électrovannes sur le devis, donc 3 réseaux, dont 1 en goutte-à-goutte. » */
  phrase: string;
  nourrice: NonNullable<ReturnType<typeof composerNourrice>> | null;
  /** Les poses du dessin que le devis n'apporte pas : elles se grisent. */
  absentes: Set<number>;
  /** Les pièces posées avec la nourrice (le bac), et celles que le devis n'apporte pas. */
  bac: { cle: string; nom: string; q: number; absente: boolean }[];
  /** Ce que la fiche de la nourrice demande et que le devis ne porte pas. */
  manque: { cle: string; nom: string; q: number }[];
};

const nomCourt = (cle: string) => CAT.piece(cle)?.nom ?? cle;

/**
 * Le montage du devis : la nourrice validée (`composerNourrice`, jamais
 * redessinée), au nombre de voies que donnent ses électrovannes. Une
 * électrovanne FF, une voie de goutte-à-goutte (sa fiche du 18 octobre 2026).
 * `completee` : il a ajouté ce qui manque, tout est apporté.
 */
export function montageDuDevis(connues: readonly PieceDuDevis[], completee: boolean): MontageDuDevis {
  const a: Record<string, number> = {};
  for (const c of connues) a[c.cle] = (a[c.cle] ?? 0) + c.q;
  const mm = a[ELECTROVANNE_MM] ?? 0;
  const ff = a[ELECTROVANNE_FF] ?? 0;
  const voies = mm + ff;
  const n = composerNourrice(voies, ff);
  const fiche = CAT.ficheNourrice(voies, ff);
  const base = {
    voies,
    goutte: ff,
    titre: `La nourrice ${voies} voies`,
    phrase: `${voies} électrovannes sur le devis, donc ${voies} réseaux${ff ? `, dont ${ff} en goutte-à-goutte.` : "."}`,
  };
  if (!n || !fiche) return { ...base, nourrice: null, absentes: new Set(), bac: [], manque: [] };
  const reste: Record<string, number> = {};
  for (const x of fiche.pieces) reste[x.ref] = completee ? x.q : Math.min(x.q, a[x.ref] ?? 0);
  const absentes = new Set<number>();
  n.poses.forEach((p, i) => {
    // Le départ en PEHD dessiné sous chaque vanne n'est pas une pièce de la
    // fiche : il se compte avec le tuyau des réseaux, jamais grisé ici.
    if (!(p.ref in reste)) return;
    if (reste[p.ref] > 0) reste[p.ref]--;
    else absentes.add(i);
  });
  const bac = Object.entries(n.reste)
    .filter(([, q]) => q > 0)
    .map(([cle, q]) => ({ cle, nom: nomCourt(cle), q, absente: (reste[cle] ?? 0) < q }));
  const manque = fiche.pieces
    .filter((x) => (a[x.ref] ?? 0) < x.q)
    .map((x) => ({ cle: x.ref, nom: nomCourt(x.ref), q: x.q - (a[x.ref] ?? 0) }));
  return { ...base, nourrice: n, absentes, bac, manque };
}

/** Le message au fournisseur : ce qui manque à son devis, puis ce qu'il a ajouté, marque devant, référence derrière. */
export function messageDuComplement(manque: readonly { cle: string; nom: string; q: number }[], extras: readonly { ref: string; nom: string; q: number }[]): string {
  const lignes = manque
    .map((x) => {
      const p = CAT.piece(x.cle);
      const ref = CAT.referenceDe(x.cle);
      return `${x.q}x ${p?.marque ? `${p.marque} ` : ""}${x.nom}${ref ? `, réf. ${ref}` : ""}`;
    })
    .concat(extras.map((x) => `${x.q}x ${x.nom}, réf. ${x.ref}`));
  return ["Bonjour,", "", "En complément de votre devis, merci de m’ajouter :", "", ...lignes, "", "Merci."].join("\n");
}
