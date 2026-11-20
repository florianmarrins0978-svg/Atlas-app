import Decimal from "decimal.js";
import { filtrerClientsParNom, normaliserPourRecherche } from "./recherche-client";
import { rangerParNom } from "./bandes-clients";
import { tarifsCorrespondants } from "./tarifs-correspondants";
import { tarifAvecSonHomme } from "./main-oeuvre-dictee";
import { enEuros } from "./euros";

/**
 * CE QU'IL PAIE, ET LA MARGE QU'IL Y MET — sa planche du 18 et du 19 octobre
 * 2026 (`appli/reglages-fournisseurs-partenaires.html`, validée).
 *
 * Ses règles, tranchées par lui et à ne pas rouvrir :
 *
 * | | |
 * |---|---|
 * | l'ordre des prix d'une ligne dictée | **son prix de vente** (Réglages, Tarifs), puis **prix d'achat × marge**, puis **« à chiffrer »**, jamais zéro (« le A », 19 octobre) |
 * | les marges | deux générales, le matériel (fournisseurs) et la main d'œuvre (partenaires) ; une marge propre possible par société |
 * | la marge se tape en POUR CENT | sa planche B du 20 novembre 2026 (`appli/sans-marge-sur-les-pieces.html`) : « 30 » fait 30 %, « 0 » fait sans marge. La base garde le coefficient (1,30) : aucune migration, et le calcul ne bouge pas |
 * | vide n'est pas « sans marge » | une case oubliée laisse la ligne « à chiffrer » ; la lire comme 0 % vendrait au prix d'achat sans rien dire |
 * | au-dessus de 200 % | une faute de frappe : refusée |
 *
 * Fonctions pures : l'écran, le serveur et le devis dicté lisent les mêmes.
 */

export type RubriqueAchat = "fournisseur" | "partenaire";

/** « m » et « ml » : un prix au mètre linéaire, quelle que soit l'écriture choisie. */
export function auMetreLineaire(unite: string | null | undefined): boolean {
  return unite === "m" || unite === "ml";
}

/** Le coefficient le plus haut, 200 % de marge. */
export const MARGE_MAX = 3;

/** Les unités d'une ligne, celles de la planche. */
export const UNITES_ACHAT: Record<RubriqueAchat, readonly string[]> = {
  // « ml » à côté de « m » : sa demande du 20 novembre 2026. Les deux disent un
  // mètre linéaire (`auMetreLineaire`), et le plan d'arrosage les lit pareil.
  fournisseur: ["pièce", "sac", "m", "ml", "m²", "m³", "kg", "palette"],
  partenaire: ["heure", "journée", "m", "m²", "forfait"],
};

const virgule = (n: number | string) => String(n).replace(".", ",");


/** Un nombre écrit à la française, ou `null`. */
function nombreLu(brut: string): number | null {
  const t = brut.replace(/\s/g, "").replace(",", ".");
  if (t === "" || !/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/**
 * Une marge tapée, EN POUR CENT, rendue en coefficient pour la base : « 30 »
 * donne 1.30, « 0 » donne 1.00 (sans marge). Vide : pas de marge (la générale
 * reprend, ou la ligne reste à chiffrer).
 *
 * **Un nombre entier seulement.** La base garde deux décimales au coefficient :
 * 12,5 % y deviendrait 13 % sans le dire. Et « 1,30 », l'ancienne façon de
 * taper, ne se lit pas comme 1,3 % : elle est refusée, avec ce qu'il faut taper.
 */
export function lireMarge(brut: string): { ok: true; marge: string | null } | { ok: false; raison: string } {
  const t = brut.replace(/\s/g, "").replace(/%$/, "");
  if (t === "") return { ok: true, marge: null };
  if (!/^\d+$/.test(t)) return { ok: false, raison: "Tapez la marge en pour cent : 30 pour 30 %." };
  const coefficient = new Decimal(t).dividedBy(100).plus(1);
  if (coefficient.greaterThan(MARGE_MAX)) return { ok: false, raison: "Au-delà de 200 %, vérifiez le chiffre." };
  return { ok: true, marge: coefficient.toFixed(2) };
}

/** Le coefficient de la base, écrit en pour cent dans la case : « 30 », « 0 », ou rien. */
export function margeEnPourcent(marge: string | null): string {
  return marge === null ? "" : new Decimal(marge).minus(1).times(100).toDecimalPlaces(0).toString();
}

/** Une marge en mots : « 30 % », ou « sans marge » pour 0 %. */
export function margeEnMots(marge: string | number): string {
  const pourcent = margeEnPourcent(String(marge));
  return pourcent === "0" ? "sans marge" : `${pourcent} %`;
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

/**
 * Le téléphone d'un fournisseur, tapé ou lu sur son devis (migration 0189).
 * Vide : pas de téléphone. Des chiffres, des espaces, « + », « . », « - » et
 * des parenthèses, au moins six chiffres : « appelez-nous » ne s'enregistre pas.
 */
export function lireTelephone(brut: string): { ok: true; telephone: string | null } | { ok: false; raison: string } {
  const t = brut.replace(/\s+/g, " ").trim();
  if (t === "") return { ok: true, telephone: null };
  const chiffres = t.replace(/\D/g, "").length;
  if (t.length > 30 || !/^\+?[\d\s.()-]+$/.test(t) || chiffres < 6) return { ok: false, raison: "Tapez un numéro comme 04 75 12 34 56." };
  return { ok: true, telephone: t };
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

const ARTICLE_DE_L_UNITE: Record<string, string> = {
  pièce: "la pièce",
  palette: "la palette",
  journée: "la journée",
  heure: "l’heure",
  forfait: "le forfait",
};

/** « 8,90 € HT le sac » : un prix d'achat, tel qu'il le paie. */
export function prixDAchatEnMots(p: { prixHt: string; unite: string }): string {
  return `${enEuros(p.prixHt)} HT ${ARTICLE_DE_L_UNITE[p.unite] ?? `le ${p.unite}`}`;
}

/**
 * « Matériaux Garnier, 8,90 € HT le sac » : ce qui reste écrit sous une ligne
 * chiffrée depuis un prix d'achat, pour lui seul (sa planche du 20 novembre
 * 2026, `appli/le-prix-d-une-piece.html`). L'écran l'écrit au toucher, le
 * serveur le recopie en base : la même phrase des deux côtés.
 */
export function achatRetenuEnMots(c: { societeNom: string; prixHt: string; unite: string }): string {
  return `${c.societeNom}, ${prixDAchatEnMots(c)}`;
}

/**
 * Une ligne de devis telle qu'une action la rend au navigateur : sans le prix
 * d'achat qui l'a chiffrée (migration 0188). Ses prix d'achat sont au patron
 * seul ; une action d'édition sert aussi le commercial, et ce qu'elle rend
 * se lit dans la réponse, même si l'écran ne l'affiche pas.
 */
export function sansAchatRetenu<T extends { achatRetenu: string | null }>(ligne: T): T {
  return { ...ligne, achatRetenu: null };
}

/** La marge qui vaut chez une société : la sienne, sinon la générale de sa rubrique. */
export function margeQuiVaut(propre: string | null, generale: string | null): string | null {
  return propre ?? generale;
}

/** Ce que la carte d'une société dit de sa marge. */
export function ligneDeMarge(propre: string | null, generale: string | null): string {
  const vaut = margeQuiVaut(propre, generale);
  if (vaut === null) return "Marge à donner";
  const mots = margeEnMots(vaut);
  return `${mots === "sans marge" ? "Sans marge" : `Marge ${mots}`}${propre !== null ? ", la sienne" : ""}`;
}

/** Ce que la fiche dit sous la case de sa marge. */
export function phraseDeLaMargePropre(propre: string | null, generale: string | null): string {
  if (propre !== null) {
    return `La sienne. Videz la case pour reprendre la marge générale${generale !== null ? ` (${margeEnMots(generale)})` : ""}.`;
  }
  if (generale !== null) return `Votre marge générale, ${margeEnMots(generale)}. Tapez-en une autre pour lui seul.`;
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
  // **L'emballage ne dit pas ce qu'on achète** (trouvé le 20 novembre 2026, en
  // codant sa planche du prix d'une pièce) : « sac » rapprochait « Sac de
  // terreau » de « Sac de ciment » autant que du terreau, et à égalité le moins
  // cher gagnait. Le devis dicté chiffrait ainsi ses sacs de terreau au prix
  // du ciment.
  "sac", "sacs", "big", "bag", "bags", "palette", "palettes", "seau", "seaux",
  "bidon", "bidons", "carton", "cartons", "paquet", "paquets",
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
  return prixAchatsProposes(texte, candidats)[0] ?? null;
}

/**
 * Tous les prix d'achat qui répondent à une ligne, **le moins cher d'abord** :
 * ce que le devis tapé à la main lui propose sous la ligne (sa planche du
 * 20 novembre 2026, `appli/le-prix-d-une-piece.html`), et dont le devis dicté
 * garde le premier. Une seule règle pour les deux (`CLAUDE.md` §3).
 */
export function prixAchatsProposes<T extends PrixAchatCandidat>(texte: string, candidats: readonly T[]): T[] {
  return lesMieuxNommees(texte, candidats, (c) => `${c.nom} ${c.societeNom}`)
    .map((c, rang) => ({ c, rang }))
    .sort((a, b) => new Decimal(a.c.prixHt).comparedTo(b.c.prixHt) || a.rang - b.rang)
    .map((x) => x.c);
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
      : margeEnMots(marge) === "sans marge"
        ? ", sans marge."
        : `, plus ${margeEnMots(marge)}${
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
  /**
   * Le prix d'achat qui a chiffré la ligne, en mots (« Point P, 8,00 € HT le
   * sac »), quand c'en est un : il reste écrit sous la ligne, pour lui seul
   * (migration 0188, sa planche du 19 novembre 2026,
   * `appli/devis-fournisseur-pour-vous-seul.html`).
   */
  achatRetenu?: string;
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
    ...(p.venteHt === null ? {} : { achatRetenu: achatRetenuEnMots(achat) }),
  };
}
