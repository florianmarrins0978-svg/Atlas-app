import { nomCategorie, type CleCompta } from "./categories-comptables";
import { ordreDesCategories, tauxDuRegistre, tauxEnMots, tvaAuTaux, type LigneComptable, type RangDuRegistre } from "./dossier-du-comptable";
import type { ComptesDuDossier, EcritureFec } from "./fec-import";
import { colonne, type Cellule, type Feuille } from "./xlsx";

/**
 * L'EXCEL DU DOSSIER : quatre onglets, les mêmes chiffres que le PDF et le FEC
 * (sa planche du 24 novembre 2026). Ventes, Achats, Banque, puis Comptes, la
 * balance tirée des écritures du FEC : le comptable vérifie d'un coup d'œil
 * que chaque compte retombe sur ce qu'il saisira.
 *
 * **Les montants sont des nombres, les dates des dates** : le comptable trie,
 * filtre et additionne sans rien retaper. Les totaux sont des formules, avec
 * leur valeur déjà calculée.
 */

const T = (v: string | null | undefined, gras = false): Cellule => ({ t: "texte", v: v ?? "", gras });
const N = (centimes: number): Cellule => ({ t: "nombre", v: centimes / 100 });
const D = (iso: string | null): Cellule => (iso ? { t: "date", v: iso } : { t: "vide" });
const somme = (col: string, n: number, centimes: number): Cellule => ({ t: "formule", f: n > 0 ? `SUM(${col}2:${col}${n + 1})` : "0", v: centimes / 100, gras: true });
const total = <X>(xs: readonly X[], f: (x: X) => number) => xs.reduce((s, x) => s + f(x), 0);

export type EntreeDeLExcel = {
  ventes: readonly RangDuRegistre[];
  lignes: readonly LigneComptable[];
  ecritures: readonly EcritureFec[];
  comptes: ComptesDuDossier & { tvaDeductible: string; tvaImmobilisations: string };
  /** Le numéro du compte des ventes, celui du registre. */
  compteDesVentes: string;
  /** La page du PDF où commence chaque catégorie. */
  pageDe: Partial<Record<CleCompta, number>>;
  /** Le compte d'une catégorie, pour nommer les catégories d'un compte de la balance. */
  compteDe: (cle: CleCompta) => string;
};

/** Les lignes de sortie dans l'ordre du PDF : catégorie par catégorie, puis par date. */
export function sortiesDansLOrdre(lignes: readonly LigneComptable[]): LigneComptable[] {
  const ordre = ordreDesCategories();
  return lignes
    .filter((l) => l.sens === "sortie")
    .map((l, i) => ({ l, i }))
    .sort((a, b) => ordre.indexOf(a.l.cle) - ordre.indexOf(b.l.cle) || a.l.jour.localeCompare(b.l.jour) || a.i - b.i)
    .map((x) => x.l);
}

export function feuillesDuDossier(e: EntreeDeLExcel): Feuille[] {
  const taux = tauxDuRegistre(e.ventes);
  const V = e.ventes;
  // F le HT, une colonne par taux, puis le TTC, la date du paiement et le reste dû.
  const lettreTtc = colonne(6 + taux.length);
  const ventes: Feuille = {
    nom: "Ventes",
    largeurs: [14, 11, 22, 26, 9, 12, ...taux.map(() => 11), 12, 11, 11],
    lignes: [
      ["N° de facture", "Date", "Client", "Chantier", "Compte", "HT", ...taux.map((t) => `TVA ${tauxEnMots(t).replace(" ", " ")}`), "TTC", "Payée le", "Reste dû"].map((t) => T(t)),
      ...V.map((r) => [
        T(r.genre === "avoir" ? `${r.numero} (avoir sur ${r.facture})` : r.numero),
        D(r.date),
        T(r.client),
        T(r.chantier),
        T(e.compteDesVentes),
        N(r.ht),
        ...taux.map((t) => N(tvaAuTaux(r, t))),
        N(r.ttc),
        D(r.payeeLe),
        N(r.reste),
      ]),
      [
        T("Total", true),
        { t: "vide" },
        { t: "vide" },
        { t: "vide" },
        { t: "vide" },
        somme("F", V.length, total(V, (r) => r.ht)),
        ...taux.map((t, k) => somme(colonne(6 + k), V.length, total(V, (r) => tvaAuTaux(r, t)))),
        somme(lettreTtc, V.length, total(V, (r) => r.ttc)),
        { t: "vide" },
        somme(colonne(8 + taux.length), V.length, total(V, (r) => r.reste)),
      ],
    ],
  };

  const A = sortiesDansLOrdre(e.lignes);
  const achats: Feuille = {
    nom: "Achats",
    largeurs: [10, 11, 22, 26, 9, 11, 10, 11, 11, 38, 30, 9],
    lignes: [
      ["Pièce", "Date", "Payé à", "Catégorie", "Compte", "HT", "TVA", "Compte TVA", "TTC", "Ligne de banque", "Justificatif", "Page PDF"].map((t) => T(t)),
      ...A.map((l) => [
        T(l.ref),
        D(l.jour),
        T(l.tiers),
        T(nomCategorie(l.cle)),
        T(l.compte),
        N(l.ht),
        N(l.tva),
        T(l.tva > 0 ? l.compteTva : ""),
        N(l.ttc),
        T(l.libelle),
        T(l.tvaNonLue ? `${l.pieceEnMots}, TVA à lire sur la pièce` : l.pieceEnMots),
        e.pageDe[l.cle] ? { t: "nombre" as const, v: e.pageDe[l.cle]! } : ({ t: "vide" } as Cellule),
      ]),
      [
        T("Total", true),
        { t: "vide" },
        { t: "vide" },
        { t: "vide" },
        { t: "vide" },
        somme("F", A.length, total(A, (l) => l.ht)),
        somme("G", A.length, total(A, (l) => l.tva)),
        { t: "vide" },
        somme("I", A.length, total(A, (l) => l.ttc)),
      ],
    ],
  };

  const B = e.lignes;
  const banque: Feuille = {
    nom: "Banque",
    largeurs: [11, 40, 12, 12, 14, 26, 9],
    lignes: [
      ["Date", "Libellé de la banque", "Débit", "Crédit", "Pièce", "Catégorie", "Compte"].map((t) => T(t)),
      ...B.map((l) => [
        D(l.jour),
        T(l.libelle),
        l.sens === "sortie" ? N(l.ttc) : ({ t: "vide" } as Cellule),
        l.sens === "entree" ? N(l.ttc) : ({ t: "vide" } as Cellule),
        T(l.ref),
        T(l.cle === "clients" ? "Paiement de client" : nomCategorie(l.cle)),
        T(l.compte),
      ]),
      [
        T("Total", true),
        { t: "vide" },
        somme("C", B.length, total(B, (l) => (l.sens === "sortie" ? l.ttc : 0))),
        somme("D", B.length, total(B, (l) => (l.sens === "entree" ? l.ttc : 0))),
      ],
    ],
  };

  // La balance : ce que les écritures du FEC mettent sur chaque compte.
  const parCompte = new Map<string, { lib: string; debit: number; credit: number }>();
  for (const x of e.ecritures) {
    const b = parCompte.get(x.compte) ?? { lib: x.compteLib, debit: 0, credit: 0 };
    b.debit += x.debit;
    b.credit += x.credit;
    parCompte.set(x.compte, b);
  }
  const fixes: [string, string][] = [
    [e.comptes.clients, "Clients"],
    [e.comptes.fournisseurs, "Fournisseurs"],
    [e.comptes.banque, "Banque"],
    [e.compteDesVentes, nomCategorie("ventes")],
    [e.comptes.tvaCollectee, nomCategorie("tvaCollectee")],
    [e.comptes.tvaEnAttente, nomCategorie("tvaEnAttente")],
    [e.comptes.tvaDeductible, nomCategorie("tvaDeductible")],
    [e.comptes.tvaImmobilisations, nomCategorie("tvaImmobilisations")],
  ];
  const categoriesDu = (compte: string) => [
    ...new Set([...fixes.filter(([c]) => c === compte).map(([, n]) => n), ...e.lignes.filter((l) => e.compteDe(l.cle) === compte && l.cle !== "clients").map((l) => nomCategorie(l.cle))]),
  ];
  const bal = [...parCompte.entries()].sort(([a], [b]) => a.localeCompare(b));
  const n = bal.length;
  const comptes: Feuille = {
    nom: "Comptes",
    largeurs: [10, 44, 40, 13, 13, 13],
    lignes: [
      ["Compte", "Intitulé", "Catégories de Cause", "Débit", "Crédit", "Solde"].map((t) => T(t)),
      ...bal.map(([compte, b], i) => [T(compte), T(b.lib), T(categoriesDu(compte).join(", ")), N(b.debit), N(b.credit), { t: "formule" as const, f: `D${i + 2}-E${i + 2}`, v: (b.debit - b.credit) / 100 }]),
      [
        T("Total", true),
        { t: "vide" },
        { t: "vide" },
        somme("D", n, total(bal, ([, b]) => b.debit)),
        somme("E", n, total(bal, ([, b]) => b.credit)),
        { t: "formule", f: `D${n + 2}-E${n + 2}`, v: (total(bal, ([, b]) => b.debit) - total(bal, ([, b]) => b.credit)) / 100, gras: true },
      ],
    ],
  };
  return [ventes, achats, banque, comptes];
}

/** « Dossier 2026-10.xlsx », « Dossier 2026-10-01 au 2026-10-15.xlsx » : le même découpage que le FEC. */
export function nomDeLExcel(nomDuFec: string): string {
  const periode = nomDuFec.replace(/^.*_import_FEC_/, "").replace(/\.txt$/, "").replace("_", " au ");
  return `Dossier ${periode}.xlsx`;
}
