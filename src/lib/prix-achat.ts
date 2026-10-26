import Decimal from "decimal.js";
import { filtrerClientsParNom, normaliserPourRecherche } from "./recherche-client";
import { rangerParNom } from "./bandes-clients";
import { tarifsCorrespondants } from "./tarifs-correspondants";
import { tarifAvecSonHomme } from "./main-oeuvre-dictee";

/**
 * CE QU'IL PAIE, ET LA MARGE QU'IL Y MET — sa planche du 18 et du 19 octobre
 * 2026 (`appli/reglages-fournisseurs-partenaires.html`, validée).
 *
 * Ses règles, tranchées par lui et à ne pas rouvrir :
 *
 * | | |
 * |---|---|
 * | l'ordre des prix d'une ligne dictée | **son prix de vente** (Réglages, Tarifs), puis **prix d'achat × marge**, puis **« à chiffrer »**, jamais zéro (« le A », 19 octobre) |
 * | les marges | deux générales, le matériel (fournisseurs) et la main d'œuvre (partenaires), en COEFFICIENT ; une marge propre possible par société |
 * | au-dessus de × 3 | une faute de frappe (« 20 » pour 20 %) : refusée, et l'on dit quoi taper |
 *
 * Fonctions pures : l'écran, le serveur et le devis dicté lisent les mêmes.
 */

export type RubriqueAchat = "fournisseur" | "partenaire";

export const MARGE_MAX = 3;

/** Les unités d'une ligne, celles de la planche. */
export const UNITES_ACHAT: Record<RubriqueAchat, readonly string[]> = {
  fournisseur: ["pièce", "sac", "m", "m²", "m³", "kg", "palette"],
  partenaire: ["heure", "journée", "m", "m²", "forfait"],
};

const virgule = (n: number | string) => String(n).replace(".", ",");

/** « 20 » ferait × 20. Pour 20 % de marge, tapez 1,20. */
export function conseilDeMarge(n: number): string {
  return `« ${virgule(n)} » ferait × ${virgule(n)}. Pour ${virgule(n)} % de marge, tapez ${virgule((1 + n / 100).toFixed(2))}.`;
}

/** Un nombre écrit à la française, ou `null`. */
function nombreLu(brut: string): number | null {
  const t = brut.replace(/\s/g, "").replace(",", ".");
  if (t === "" || !/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/**
 * Une marge tapée. Vide : pas de marge (la générale reprend, ou la ligne reste
 * à chiffrer). Au-delà de × 3 : refusée, avec ce qu'il fallait taper.
 */
export function lireMarge(brut: string): { ok: true; marge: string | null } | { ok: false; raison: string } {
  if (brut.trim() === "") return { ok: true, marge: null };
  const n = nombreLu(brut);
  if (n === null || n <= 0) return { ok: false, raison: "Tapez un coefficient : 1,30 pour 30 % de marge." };
  if (n > MARGE_MAX) return { ok: false, raison: conseilDeMarge(n) };
  return { ok: true, marge: new Decimal(n).toFixed(2) };
}

/**
 * L'adresse mail d'un fournisseur, tapée sur sa fiche. Vide : pas d'adresse, et
 * le mail s'ouvrira sans destinataire. La base refuse la même chose (0133).
 */
export function lireAdresseMail(brut: string): { ok: true; email: string | null } | { ok: false; raison: string } {
  const email = brut.trim();
  if (email === "") return { ok: true, email: null };
  if (email.length > 200 || /\s/.test(email) || !/^[^@]+@[^@]+$/.test(email)) return { ok: false, raison: "Tapez une adresse comme commande@fournisseur.fr." };
  return { ok: true, email };
}

/** Le plus long début ou fin de message gardé (0133). */
export const MORCEAU_DE_MESSAGE_MAX = 2000;

/** Le début ou la fin de SON message à un fournisseur. Vide : celui d'office reprend. */
export function lireMorceauDeMessage(brut: string): string | null {
  const t = brut.replace(/\r\n?/g, "\n").trim().slice(0, MORCEAU_DE_MESSAGE_MAX);
  return t === "" ? null : t;
}

/** Un prix hors taxes tapé, ou `null` s'il ne se lit pas. */
export function lirePrixHt(brut: string): string | null {
  const n = nombreLu(brut);
  return n === null ? null : new Decimal(n).toFixed(2);
}

/** « × 1,30 ». */
export function enCoefficient(marge: string | number): string {
  return `× ${virgule(new Decimal(marge).toFixed(2))}`;
}

/** La marge qui vaut chez une société : la sienne, sinon la générale de sa rubrique. */
export function margeQuiVaut(propre: string | null, generale: string | null): string | null {
  return propre ?? generale;
}

/** Ce que la carte d'une société dit de sa marge. */
export function ligneDeMarge(propre: string | null, generale: string | null): string {
  const vaut = margeQuiVaut(propre, generale);
  if (vaut === null) return "Marge à donner";
  return `Marge ${enCoefficient(vaut)}${propre !== null ? ", la sienne" : ""}`;
}

/** Ce que la fiche dit sous la case de sa marge. */
export function phraseDeLaMargePropre(propre: string | null, generale: string | null): string {
  if (propre !== null) {
    return `La sienne. Videz la case pour reprendre la marge générale${generale !== null ? ` (${enCoefficient(generale)})` : ""}.`;
  }
  if (generale !== null) return `Votre marge générale, ${enCoefficient(generale)}. Tapez-en une autre pour lui seul.`;
  return "Pas encore donnée.";
}

/**
 * Les deux lettres du rond d'une société, comme celui d'un client (sa planche
 * soignée du 26 octobre 2026, `appli/soignee/reglages-fournisseurs.html`).
 *
 * **Les mots qui portent une majuscule d'abord** : « Jardinerie du Centre »
 * donne JC, et non JD. Un nom tout en minuscules reprend ses deux premiers
 * mots, et un nom vide ne laisse pas un rond vide.
 */
export function initialesDeLaSociete(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  const marquants = mots.filter((m) => /^\p{Lu}/u.test(m));
  const retenus = (marquants.length > 0 ? marquants : mots).slice(0, 2);
  return retenus.map((m) => Array.from(m)[0]).join("").toUpperCase() || "?";
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** « 2 prix, 1 devis reçu, 0 demande ». */
export function resumeDeLaSociete(n: { prix: number; devis: number; demandes: number }): string {
  return [
    pluriel(n.prix, "prix", "prix"),
    pluriel(n.devis, "devis reçu", "devis reçus"),
    pluriel(n.demandes, "demande", "demandes"),
  ].join(", ");
}

/** Le rangement de A à Z de la liste des clients (`rangerParNom`), pour toute ligne nommée. */
function deAaZ<T extends { nom: string }>(lignes: readonly T[]): T[] {
  return rangerParNom(lignes.map((l) => ({ nom: l.nom, dernierJour: null, l }))).map((x) => x.l);
}

// ── La liste des sociétés : la recherche et le rangement des clients ─────────

export type SocieteCherchable = {
  nom: string;
  /** Ce qu'elle porte : ses fournitures, ses devis, ses demandes. */
  contenu: readonly string[];
};

/**
 * Les sociétés à montrer, de A à Z. **La recherche est celle des clients**
 * (`filtrerClientsParNom`) : chaque mot tapé se trouve, dans n'importe quel
 * ordre, sans accents. Une société se trouve aussi par ce qu'elle porte (sa
 * demande du 19 octobre : *« si on a besoin de rechercher les devis ou les
 * listes qu'on envoie »*).
 */
export function societesAMontrer<T extends SocieteCherchable>(societes: readonly T[], saisie: string): T[] {
  const trouvees = filtrerClientsParNom(
    societes.map((s) => ({ nom: [s.nom, ...s.contenu].join(" "), societe: s })),
    saisie
  ).map((x) => x.societe);
  return deAaZ(trouvees);
}

/** Ce qui a fait trouver une société quand ce n'est pas son nom. */
export function ceQuiLaTrouve(s: SocieteCherchable, saisie: string): string[] {
  if (!normaliserPourRecherche(saisie) || filtrerClientsParNom([{ nom: s.nom }], saisie).length > 0) return [];
  return s.contenu.filter((c) => filtrerClientsParNom([{ nom: c }], saisie).length > 0);
}

/** Des lignes nommées, filtrées par la recherche et rangées de A à Z. */
export function lignesAMontrer<T extends { nom: string }>(lignes: readonly T[], saisie: string): T[] {
  return deAaZ(filtrerClientsParNom(lignes, saisie));
}

/**
 * Les devis reçus ou les demandes à montrer : pendant une recherche, tous ceux
 * qui la portent ; sinon, ceux de la période choisie (le filtre de date de
 * l'application, `FiltreDeDate`).
 */
export function dateesAMontrer<T extends { nom: string; jour: string }>(
  lignes: readonly T[],
  choix: { saisie: string; periode: string }
): T[] {
  if (normaliserPourRecherche(choix.saisie)) return lignesAMontrer(lignes, choix.saisie);
  return lignesAMontrer(
    lignes.filter((l) => l.jour.startsWith(choix.periode)),
    ""
  );
}

// ── Le devis dicté : un prix d'achat × la marge ─────────────────────────────

const MOTS_VIDES = new Set([
  "il", "me", "faut", "de", "des", "du", "la", "le", "les", "un", "une", "et", "pour", "avec",
  "ai", "besoin", "en", "au", "aux", "sur",
]);
const racine = (mot: string) => mot.replace(/s$/, "");
const motsDe = (texte: string) =>
  normaliserPourRecherche(texte)
    .split(" ")
    .filter((m) => m.length > 2 && !/^\d/.test(m) && !MOTS_VIDES.has(m))
    .map(racine);

/** « 3 sacs de ciment » : 3. Un nombre écrit, sinon « deux », « trois », sinon 1. */
export function quantiteDictee(texte: string): number {
  const chiffre = texte.match(/\d+(?:[.,]\d+)?/);
  if (chiffre) return Number(chiffre[0].replace(",", "."));
  const t = normaliserPourRecherche(texte);
  if (/\bdeux\b/.test(t)) return 2;
  if (/\btrois\b/.test(t)) return 3;
  return 1;
}

export type PrixAchatCandidat = {
  id: string;
  nom: string;
  unite: string;
  prixHt: string;
  /** « 12/10/2026 ». */
  releveLe: string;
  societeNom: string;
  rubrique: RubriqueAchat;
  /** La marge propre de la société, `null` si elle suit la générale. */
  margePropre: string | null;
};

/**
 * Les lignes qui partagent le plus de mots avec ce qui est dicté. Aucun mot en
 * commun : aucune. **La même règle pour ses tarifs de vente et ses prix
 * d'achat** : si l'achat se trouvait par les mots et la vente seulement à la
 * lettre, « 3 sacs de ciment » prendrait le prix d'achat devant son tarif
 * « Sac de ciment », à l'envers de son ordre (trouvé le 19 octobre 2026 par
 * `test-devis-prix-achat-db.ts`).
 */
function lesMieuxNommees<T>(texte: string, candidats: readonly T[], nom: (c: T) => string): T[] {
  const dictes = motsDe(texte);
  let score = 0;
  let mieux: T[] = [];
  for (const c of candidats) {
    const siens = new Set(motsDe(nom(c)));
    const n = dictes.filter((m) => siens.has(m)).length;
    if (n === 0 || n < score) continue;
    if (n > score) {
      score = n;
      mieux = [c];
    } else mieux.push(c);
  }
  return mieux;
}

/**
 * Le prix d'achat qui répond à une ligne dictée : celui qui partage le plus de
 * mots avec elle, et à égalité le moins cher (la planche validée). Aucun mot en
 * commun : aucun prix, la ligne reste à chiffrer.
 */
export function prixAchatCorrespondant(texte: string, candidats: readonly PrixAchatCandidat[]): PrixAchatCandidat | null {
  const mieux = lesMieuxNommees(texte, candidats, (c) => `${c.nom} ${c.societeNom}`);
  return mieux.reduce<PrixAchatCandidat | null>((m, c) => (m === null || new Decimal(c.prixHt).lt(m.prixHt) ? c : m), null);
}

export type PrixDepuisAchat = {
  /** `null` : pas de marge donnée, la ligne reste à chiffrer. */
  venteHt: string | null;
  achatHt: string;
  quantite: number;
  source: string;
};

/**
 * Prix d'achat × quantité × marge, et la phrase qui dit d'où il vient. Sans
 * marge, aucun prix : rien n'est ajouté d'office.
 */
export function prixDepuisAchat(
  c: PrixAchatCandidat,
  quantite: number,
  marges: { materiel: string | null; mainOeuvre: string | null }
): PrixDepuisAchat {
  const generale = c.rubrique === "partenaire" ? marges.mainOeuvre : marges.materiel;
  const marge = margeQuiVaut(c.margePropre, generale);
  const achat = new Decimal(c.prixHt).times(quantite);
  const vente = marge === null ? null : achat.times(marge).toDecimalPlaces(2).toFixed(2);
  const euros = (d: Decimal) => `${virgule(d.toFixed(2))} €`;
  const debut =
    c.rubrique === "partenaire"
      ? `Main d’œuvre de ${c.societeNom} : ${euros(achat)} le ${c.releveLe}`
      : `Acheté ${euros(achat)} chez ${c.societeNom} le ${c.releveLe}`;
  const fin =
    marge === null
      ? c.rubrique === "partenaire"
        ? ". Donnez votre marge sur la main d’œuvre."
        : ". Donnez votre marge sur le matériel."
      : `, ${enCoefficient(marge)}${
          c.margePropre !== null ? ", sa marge à part." : c.rubrique === "partenaire" ? ", votre marge sur la main d’œuvre." : ", votre marge sur le matériel."
        }`;
  return { venteHt: vente, achatHt: achat.toFixed(2), quantite, source: debut + fin };
}

// ── L'ordre des prix d'une ligne dictée : « le A », 19 octobre 2026 ──────────

export type TarifDeVente = { tarifId: string; intitule: string; prix: string; unite: string | null };

export type PrixDUneLigne = {
  origine: "vente" | "achat" | "a_chiffrer";
  /** `null` : à chiffrer, jamais zéro. */
  montant: string | null;
  quantite: string;
  unite: string | null;
  prixUnitaire: string;
  /** Ce que l'explication du devis écrit sous la ligne. */
  detail: string;
  /** Le tarif de vente retenu, quand c'en est un : il dit si l'engin part avec son homme. */
  tarif?: TarifDeVente;
};

/**
 * Le prix d'une ligne dictée, dans SON ordre : **son prix de vente d'abord**
 * (un seul de ses tarifs y répond, parmi tous ceux qu'on lui passe), puis **prix d'achat × marge**, puis **à
 * chiffrer**. Plusieurs de ses tarifs qui répondent ne se départagent pas à sa
 * place, et ne laissent pas non plus passer un prix d'achat devant eux : la
 * ligne reste à chiffrer et le dit.
 */
export function prixDUneLigneDictee(
  texte: string,
  quantite: number,
  sources: {
    tarifs: readonly TarifDeVente[];
    achats: readonly PrixAchatCandidat[];
    marges: { materiel: string | null; mainOeuvre: string | null };
  },
  /**
   * L'unité qu'il a PRONONCÉE avec la quantité, quand il en a dit une.
   *
   * **Son tarif ne se multiplie que par SA propre unité** (21 octobre 2026) :
   * « 15 tonnes » d'évacuation sur un tarif « Évacuation » au forfait donnait
   * 15 × 150 €. Des tonnes ne comptent pas des forfaits. Une unité qui diffère
   * de celle du tarif rend le tarif tel quel, une fois. Sans unité dite (« 3
   * sacs de ciment », compté), rien ne change.
   */
  uniteDite: string | null = null,
  /**
   * A-t-il dicté des hommes sur ce chantier ? `null` : on ne sait pas.
   *
   * **Ce qui départage « Mini pelle » et « Mains d'œuvre plus mini pelle »**
   * (sa règle du 21 octobre 2026) : *« une mini pelle seule, c'est 400 € si on
   * la loue ; la mini pelle plus un bonhomme, c'est 500 € »*. Avec des hommes
   * dictés, l'engin part avec son conducteur ; sans, il part seul. C'est SA
   * règle qui choisit, pas une préférence : sans elle, les deux tarifs se
   * valent et la ligne reste à chiffrer, comme avant.
   */
  hommesDictes: boolean | null = null
): PrixDUneLigne {
  const q = new Decimal(quantite);
  // À la lettre d'abord (`tarifsCorrespondants`), par les mots ensuite : jamais
  // moins tolérant pour sa vente que pour son achat.
  const litteraux = tarifsCorrespondants(sources.tarifs.map((t) => ({ ...t, id: t.tarifId })), [texte]);
  const repondent = litteraux.length > 0 ? litteraux : lesMieuxNommees(texte, sources.tarifs, (t) => t.intitule);
  const selonLesHommes =
    repondent.length > 1 && hommesDictes !== null
      ? repondent.filter((t) => tarifAvecSonHomme(t.intitule) === hommesDictes)
      : [];
  const tarifs = selonLesHommes.length === 1 ? selonLesHommes : repondent;
  if (tarifs.length === 1) {
    const t = tarifs[0];
    const parSonUnite =
      !!t.unite && (uniteDite === null || normaliserPourRecherche(uniteDite) === normaliserPourRecherche(t.unite));
    const montant = parSonUnite ? new Decimal(t.prix).times(q) : new Decimal(t.prix);
    return {
      origine: "vente",
      montant: montant.toFixed(2),
      quantite: parSonUnite ? q.toString() : "1",
      unite: t.unite,
      prixUnitaire: t.unite ? new Decimal(t.prix).toFixed(2) : montant.toFixed(2),
      detail: `Votre prix de vente « ${t.intitule} » : ${virgule(new Decimal(t.prix).toFixed(2))} €${t.unite ? ` / ${t.unite}` : ""}.`,
      tarif: t,
    };
  }
  if (tarifs.length > 1) {
    return {
      origine: "a_chiffrer",
      montant: null,
      quantite: q.toString(),
      unite: null,
      prixUnitaire: "0",
      detail: `Plusieurs de vos tarifs répondent à « ${texte} » : ${tarifs.map((t) => `« ${t.intitule} »`).join(", ")}. Choisissez le prix.`,
    };
  }
  const achat = prixAchatCorrespondant(texte, sources.achats);
  if (!achat) {
    return {
      origine: "a_chiffrer",
      montant: null,
      quantite: q.toString(),
      unite: null,
      prixUnitaire: "0",
      detail: `« ${texte} » : aucun prix chez vos fournisseurs ni vos partenaires.`,
    };
  }
  const p = prixDepuisAchat(achat, quantite, sources.marges);
  return {
    origine: p.venteHt === null ? "a_chiffrer" : "achat",
    montant: p.venteHt,
    quantite: q.toString(),
    unite: achat.unite,
    prixUnitaire: p.venteHt === null ? "0" : new Decimal(p.venteHt).div(q).toDecimalPlaces(2).toFixed(2),
    detail: `${achat.nom} : ${p.source}`,
  };
}
