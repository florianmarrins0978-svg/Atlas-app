import Decimal from "decimal.js";
import { LIBELLE_LIGNE_MAIN_DOEUVRE } from "@/lib/main-doeuvre-devis";
import { margeQuiVaut, prixDepuisAchat, type PrixAchatCandidat } from "@/lib/prix-achat";
import { montantDeLaLigne } from "@/lib/montant-de-ligne";
import { enEuros } from "@/lib/euros";

/**
 * ─── LA FEUILLE « MAIN D'ŒUVRE » DU DEVIS — sa planche du 1er novembre 2026 ───
 *
 * « + Main d'œuvre » ajoutait une ligne vide où taper un montant. La planche
 * (`appli/soignee/chantier.html?ecran=devis`), choisie le soir même (*« laisse
 * comme tu as fait, ensuite code ça »*), ouvre une feuille qui montre le calcul
 * AVANT d'ajouter : son équipe (hommes × durée × son prix du jour par homme),
 * ou l'un de ses partenaires (« Mes partenaires », son idée du même jour).
 *
 * **Rien ne s'invente** (`docs/AGENT.md` §3) : sans tarif au jour/homme, ou
 * sans marge sur la main d'œuvre d'un partenaire, la ligne arrive « à
 * chiffrer », jamais avec un prix plausible.
 */

/** Les durées que le compteur propose : la demi-journée, puis jour par jour. */
export const DUREES_MAIN_OEUVRE: readonly { libelle: string; jours: number }[] = [
  { libelle: "½ journée", jours: 0.5 },
  { libelle: "1 journée", jours: 1 },
  ...Array.from({ length: 199 }, (_, i) => ({ libelle: `${i + 2} jours`, jours: i + 2 })),
];

/** Le cran du compteur le plus proche de la durée dictée ; une journée sans dictée. */
export function rangDeLaDuree(jours: number | null): number {
  if (jours === null || !Number.isFinite(jours) || jours <= 0) return 1;
  let mieux = 0;
  DUREES_MAIN_OEUVRE.forEach((d, i) => {
    if (Math.abs(d.jours - jours) < Math.abs(DUREES_MAIN_OEUVRE[mieux].jours - jours)) mieux = i;
  });
  return mieux;
}

/**
 * Ce que la feuille renvoie quand il appuie : un CHOIX, jamais un prix.
 *
 * **Le prix se recalcule au serveur, jamais sur la parole de l'écran** : les
 * mêmes fonctions qui ont construit la feuille (`ligneDeSonEquipe`,
 * `ligneDeSonPartenaire`) revalident ce qu'elle renvoie, à partir des prix de
 * ses partenaires lus en base (`CLAUDE.md` §3). Le tarif de son équipe vaut
 * comme un prix tapé sur une ligne : c'est le sien.
 */
export type ChoixDeMainOeuvre =
  | { qui: "equipe"; hommes: number; jours: number; tarif: string | null }
  | { qui: "partenaire"; prixId: string; quantite: number };

/** Ce que la feuille sait en s'ouvrant : sa dictée, son prix du jour, ses partenaires. */
export type DonneesMainOeuvre = {
  hommes: number | null;
  jours: number | null;
  tarifJour: string | null;
  partenaires: PrixDePartenaire[];
};

/** Ce que la feuille pose sur la pièce : une ligne de main d'œuvre, chiffrée ou à chiffrer. */
export type LigneDeMainOeuvre = {
  libelle: string;
  quantite: string;
  unite: string;
  /** `null` : rien ne permet de dire un prix, la ligne arrive à chiffrer. */
  prixUnitaire: string | null;
};

function prixPositif(prix: string | null | undefined): string | null {
  if (prix === null || prix === undefined) return null;
  try {
    const d = new Decimal(String(prix).replace(",", "."));
    return d.greaterThan(0) ? d.toDecimalPlaces(2).toFixed(2) : null;
  } catch {
    return null;
  }
}

/**
 * Son équipe : des jours d'homme au prix du jour par homme — comme l'écrit la
 * préparation du devis (`propositionAvecMainOeuvre`, mode « ligne »), pour que
 * la même main d'œuvre se lise pareil, dictée ou ajoutée à la main.
 */
export function ligneDeSonEquipe(hommes: number, jours: number, tarifJour: string | null): LigneDeMainOeuvre {
  const journees = new Decimal(Math.max(0, hommes)).times(Math.max(0, jours)).toDecimalPlaces(2);
  return {
    libelle: LIBELLE_LIGNE_MAIN_DOEUVRE,
    quantite: journees.toString(),
    unite: "jour/homme",
    prixUnitaire: prixPositif(tarifJour),
  };
}

/** Un prix de partenaire tel que la feuille le montre : le sien, et ce qu'il devient sur le devis. */
export type PrixDePartenaire = {
  id: string;
  societeNom: string;
  nom: string;
  unite: string;
  /** Son prix, HT, pour une unité. */
  prixHt: string;
  /** La marge qui s'applique : la sienne, sinon celle de la main d'œuvre ; `null` si aucune. */
  marge: string | null;
  margePropre: boolean;
  /** Son prix multiplié par la marge, pour une unité ; `null` sans marge. */
  venteHt: string | null;
};

/**
 * Les prix de main d'œuvre de ses partenaires, prêts pour la feuille. Le calcul
 * est celui que l'appli applique déjà à une ligne dictée (`prixDepuisAchat`) :
 * une seule règle, dictée ou choisie du doigt (`CLAUDE.md` §3).
 */
export function prixDesPartenaires(
  candidats: readonly PrixAchatCandidat[],
  marges: { materiel: string | null; mainOeuvre: string | null }
): PrixDePartenaire[] {
  return candidats
    .filter((c) => c.rubrique === "partenaire")
    .map((c) => ({
      id: c.id,
      societeNom: c.societeNom,
      nom: c.nom,
      unite: c.unite,
      prixHt: new Decimal(c.prixHt).toFixed(2),
      marge: margeQuiVaut(c.margePropre, marges.mainOeuvre),
      margePropre: c.margePropre !== null,
      venteHt: prixDepuisAchat(c, 1, marges).venteHt,
    }));
}

/** Un partenaire choisi : la ligne dit son nom, son unité, et son prix marge comprise. */
export function ligneDeSonPartenaire(p: PrixDePartenaire, quantite: number): LigneDeMainOeuvre {
  return {
    libelle: `${LIBELLE_LIGNE_MAIN_DOEUVRE} : ${p.societeNom}`,
    quantite: new Decimal(Math.max(0, quantite)).toDecimalPlaces(2).toString(),
    unite: p.unite,
    prixUnitaire: prixPositif(p.venteHt),
  };
}

/** À la journée : le partenaire travaille les jours de son chantier, il ne se tape pas. */
export function aLaJournee(unite: string): boolean {
  return unite === "journée" || unite === "jour";
}

/**
 * La quantité d'un partenaire : les jours du chantier quand il se paie à la
 * journée, sinon ce qu'il tape, au-dessus de zéro. `null` quand rien ne se lit.
 *
 * **Le serveur la rejoue sur les jours dictés** : une quantité à la journée
 * envoyée par l'écran n'est jamais crue, elle se relit sur le chantier.
 */
export function quantiteDuPartenaire(p: PrixDePartenaire, jours: number, tapee: number | null): number | null {
  if (aLaJournee(p.unite)) return Number.isFinite(jours) && jours > 0 ? jours : null;
  if (tapee === null || !Number.isFinite(tapee) || tapee <= 0 || tapee > 99999) return null;
  return Math.round(tapee * 100) / 100;
}

const virgule = (n: number | string) => String(n).replace(".", ",");
const sansCentimes = (prix: string) => enEuros(prix).replace(/,00(?=\s*€)/, "");

/** « 3 jours », « 6,5 heures », « 40 ml » : l'unité du partenaire, dite comme il la dit. */
export function enUnite(unite: string, n: number): string {
  const mot: Record<string, [string, string]> = {
    journée: ["jour", "jours"],
    jour: ["jour", "jours"],
    heure: ["heure", "heures"],
    h: ["heure", "heures"],
    forfait: ["forfait", "forfaits"],
  };
  const m = mot[unite];
  return `${virgule(n)} ${m ? m[n > 1 ? 1 : 0] : unite}`;
}

/** « 380 € la journée », « 32 € le m² » : le prix tel qu'il le lit sur sa fiche. */
export function prixEnMots(p: PrixDePartenaire): string {
  const article: Record<string, string> = { journée: "la journée", heure: "l’heure", forfait: "le forfait" };
  return `${sansCentimes(p.prixHt)} ${article[p.unite] ?? `le ${p.unite}`}`;
}

/**
 * Un partenaire pour une quantité : la ligne, son montant, et le calcul en
 * clair. La feuille du devis, la question de la dictée et le serveur lisent
 * cette fonction-ci, et aucune autre (`CLAUDE.md` §3).
 */
export function mainOeuvreDUnPartenaire(
  p: PrixDePartenaire,
  quantite: number
): { ligne: LigneDeMainOeuvre; montant: string | null; calcul: string } {
  const ligne = ligneDeSonPartenaire(p, quantite);
  return {
    ligne,
    montant: montantDeLaMainOeuvre(ligne),
    calcul:
      p.marge === null
        ? "Sans marge sur la main d’œuvre, la ligne arrivera à chiffrer."
        : `${enUnite(p.unite, quantite)} × ${sansCentimes(p.prixHt)} × ${virgule(Number(p.marge).toFixed(2))}`,
  };
}

/**
 * Le total de la ligne, montré avant d'ajouter ; `null` quand elle arrivera à
 * chiffrer. **La règle de toutes les lignes** (`montantDeLaLigne`) : ce que la
 * feuille annonce est ce que le devis comptera, au centime.
 */
export function montantDeLaMainOeuvre(l: LigneDeMainOeuvre): string | null {
  if (l.prixUnitaire === null) return null;
  return montantDeLaLigne(l.quantite, l.prixUnitaire);
}

/** Une quantité tapée : virgule ou point, au-dessus de zéro. `null` sinon. */
export function quantiteTapee(saisie: string): number | null {
  const brut = saisie.replace(/[^\d,.]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(brut)) return null;
  const n = Number(brut);
  return n > 0 && n <= 99999 ? Math.round(n * 100) / 100 : null;
}

// ── RÉPARTIE SUR LES TRAVAUX — la même feuille, l'autre choix ───────────────

/** Un travail du devis qui peut recevoir une part : chiffré, et pas la main d'œuvre elle-même. */
export type TravailQuiRecoit = {
  id: string;
  quantite: string;
  prixUnitaire: string;
  partMainDoeuvre: string | null;
};

export type TravailRepris = {
  id: string;
  prixUnitaire: string;
  montant: string;
  /** Ce que la ligne porte de main d'œuvre APRÈS : l'ancienne part, plus la nouvelle. */
  partMainDoeuvre: string;
  /** La part réellement posée par CETTE répartition, au centime. */
  partPosee: string;
};

/**
 * Ce que chaque travail devient quand il reçoit sa part.
 *
 * **La part entre dans le prix unitaire, la quantité ne bouge pas** : « 12 m²
 * à 18 € » reçoit 150 € et devient « 12 m² à 30,50 € ». Le client garde sa
 * quantité et son unité ; la préparation du devis, elle, réécrit la ligne au
 * forfait, ce qui effacerait ici ce qu'il a déjà écrit.
 *
 * **La part posée est celle que le prix rend, au centime près** : un prix
 * unitaire n'a que deux décimales, donc 150 € sur 7 m² font 149,99 €. C'est
 * CE chiffre qui est gardé et compté dans « dont main d'œuvre HT », jamais le
 * voulu : la somme dite au client tombe juste avec ses lignes.
 */
export function partsAppliquees(
  travaux: readonly TravailQuiRecoit[],
  parts: Readonly<Record<string, string>>
): TravailRepris[] {
  return travaux.flatMap((t) => {
    const voulu = parts[t.id];
    if (voulu === undefined) return [];
    const q = new Decimal(t.quantite || "0");
    const part = new Decimal(voulu);
    if (!q.greaterThan(0) || !part.greaterThan(0)) return [];
    // Avant et après : la règle de toutes les lignes, jamais une multiplication
    // recopiée ici (`test-montant-de-ligne`, « la règle n'est écrite qu'à UN
    // endroit »).
    const avant = new Decimal(montantDeLaLigne(t.quantite, t.prixUnitaire));
    const nouveauPu = avant.plus(part).div(q).toDecimalPlaces(2);
    const apres = new Decimal(montantDeLaLigne(t.quantite, nouveauPu.toFixed(2)));
    const posee = apres.minus(avant);
    const ancienne = new Decimal(t.partMainDoeuvre || "0");
    return [
      {
        id: t.id,
        prixUnitaire: nouveauPu.toFixed(2),
        montant: apres.toFixed(2),
        partMainDoeuvre: ancienne.plus(posee).toFixed(2),
        partPosee: posee.toFixed(2),
      },
    ];
  });
}
