import { getFournisseurLLM } from "../providers/llm/fabrique";
import { METIER_ATLAS_COURT } from "../../../lib/metier-atlas";
import { estNatureAchat, tvaDepuisTtc, type NatureAchat } from "@/lib/achat-tva";
import { jourIso } from "@/lib/jour";
import { lignesImprimees, type LigneImprimee } from "@/lib/ticket-imprime";

/**
 * Lire un ticket de caisse photographié.
 *
 * *Sa demande du 12 août 2026 : « on passe les tickets gazoil devant, il les
 * scanne et les intègre automatiquement ».* Retenu sur maquette
 * (`docs/maquettes/37`), et **jamais « automatiquement » au sens de « sans
 * lui »** : ce que la lecture rend est une PROPOSITION, que l'écran montre et
 * qu'il confirme. Un ticket thermique pâlit, se froisse et sort du fond d'une
 * poche ; la lecture se trompera. Un chiffre faux entré tout seul coûte plus
 * cher que pas de chiffre du tout.
 *
 * ## Ce qui est éprouvable ici, et ce qui ne l'est pas
 *
 * `lireReponseTicket` est une fonction pure : elle prend le texte rendu par le
 * modèle et en tire des champs, ou refuse. Elle est éprouvée sans clé et sans
 * réseau (`scripts/test-lecture-ticket.ts`) — c'est là que vivent les vrais
 * pièges : un modèle qui répond en prose, qui entoure son objet de balises, qui
 * invente un montant négatif, ou qui rend une TVA supérieure au total.
 *
 * **L'appel au fournisseur, lui, n'est pas éprouvé dans cet environnement** :
 * il n'y a aucune clé ici. Il devra l'être sur le banc du patron, avec un vrai
 * ticket — et tant que ce n'est pas fait, ça s'écrit « non vérifié »
 * (`AGENTS.md`).
 */

export type TicketLu = {
  fournisseur: string | null;
  /** « AAAA-MM-JJ », ou `null` si la date n'était pas lisible. */
  date: string | null;
  totalTtc: number | null;
  tauxTva: number | null;
  tvaDeductible: number | null;
  /** Ce qu'est l'achat, PROPOSÉ : la puce arrive cochée, il la change d'un
   *  doigt. `null` si la lecture ne sait pas ; aucune puce n'est alors
   *  cochée à sa place. */
  nature: NatureAchat | null;
  /**
   * Chaque ligne imprimée, recopiée dans l'ordre (lot 5 de « Pour mon
   * comptable ») : la pièce réécrite du dossier est le ticket ENTIER, pas un
   * résumé. `null` quand la lecture ne les a pas rendues.
   */
  lignes: LigneImprimee[] | null;
  /** Ce que la lecture n'a pas su faire, dit en français au patron. */
  reserve: string | null;
};

export type ResultatLecture =
  | { ok: true; ticket: TicketLu }
  | { ok: false; raison: string };

const SYSTEME = `${METIER_ATLAS_COURT}

Tu lis ses tickets de caisse et ses factures d'achat.
Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code.
Champs attendus : fournisseur (string|null), date_ecrite (string|null : la date recopiée EXACTEMENT comme elle est imprimée, par exemple "26/10/26"),
date (string|null au format AAAA-MM-JJ),
total_ttc (number|null), taux_tva (number|null, en pour-cent), tva (number|null),
nature (string|null) : "carburant", "materiel", "repas", "hotel", "transport" (train, taxi, avion) ou "autre",
lignes (tableau) : CHAQUE ligne imprimée, du haut en bas, sous la forme {"g": "texte de gauche", "d": "ce qui est à droite, ou null"}.
Règles :
- Tu ne DEVINES jamais. Un champ illisible vaut null.
- « tva » est le montant de TVA écrit sur le ticket. S'il n'y figure pas, rends null : ne le calcule pas.
- Les montants sont en euros, en nombre décimal à point (12.34), sans symbole.
- Dans « lignes », tu recopies EXACTEMENT ce qui est imprimé, montants compris, tels qu'écrits (« 1,66 EUR A ») : rien de regroupé, même deux lignes identiques, rien de corrigé, rien d'ajouté.`;

/**
 * **Le jour de la lecture est dit au modèle.** Le 26 octobre 2026, un ticket
 * du jour a été rangé en « Octobre 2023 » : le modèle ne sait pas quel jour on
 * est, et devant une année sur deux chiffres ou absente, il complétait avec
 * celle de ses souvenirs.
 */
export function consigneDeLecture(aujourdHui: string): string {
  return `Nous sommes le ${aujourdHui}. Une année écrite sur deux chiffres (26) se lit 2026. Un ticket sans année est de l'année en cours, ou de la précédente si son jour et son mois tombent après aujourd'hui. Lis ce ticket et rends l'objet JSON demandé.`;
}

/**
 * La date IMPRIMÉE, lue par le code et non par le modèle.
 *
 * *Sa correction du 23 octobre 2026 : « il y a une date sur le ticket, utilise
 * celle-ci ! »*. Le modèle recopie ce qu'il voit ; c'est ici qu'on la lit, au
 * format français jour, mois, année. Une année sur deux chiffres est de ce
 * siècle. Une date qui n'existe pas (31/02) rend `null` : la corriger en
 * silence serait inventer.
 *
 * `undefined` : rien de reconnaissable, on se rabat sur la date du modèle.
 */
export function dateImprimee(ecrite: string): string | null | undefined {
  const m = ecrite.match(/(?<!\d)(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})(?!\d)/);
  if (!m) return undefined;
  const jour = Number(m[1]);
  const mois = Number(m[2]);
  const annee = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const reel = new Date(Date.UTC(annee, mois - 1, jour));
  if (reel.getUTCFullYear() !== annee || reel.getUTCMonth() !== mois - 1 || reel.getUTCDate() !== jour) return null;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/**
 * Le plus ancien jour dont la TVA se récupère encore : le 1er janvier d'il y a
 * deux ans (CGI, annexe II, art. 208 : jusqu'au 31 décembre de la deuxième
 * année qui suit). Un ticket plus vieux qu'on scanne aujourd'hui est une
 * lecture fautive bien plus souvent qu'un vrai ticket, et il ne compterait pas.
 */
function premierJourRecuperable(aujourdHui: string): string {
  return `${Number(aujourdHui.slice(0, 4)) - 2}-01-01`;
}

/**
 * Ce que le modèle a répondu, transformé en champs — ou refusé.
 *
 * **Trois défenses, chacune contre un travers observé des modèles :**
 *
 *  1. *Il entoure son objet.* Balises de code, « Voici le résultat : », un mot
 *     d'excuse. On extrait donc le premier objet accoladé plutôt que d'exiger
 *     un JSON nu.
 *  2. *Il rend des chaînes là où on attend des nombres* — « 96,00 € ». On les
 *     accepte et on les convertit, plutôt que de jeter une lecture juste.
 *  3. *Il invente pour faire plaisir.* Une TVA supérieure au total, un montant
 *     négatif, une date de l'an 3000 : refusés, et le champ retombe à `null`.
 *     C'est la règle du dépôt — sans source fiable, on n'écrit pas.
 */
export function lireReponseTicket(texte: string, aujourdHui: string): ResultatLecture {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut === -1 || fin <= debut) {
    return { ok: false, raison: "La lecture n'a rien rendu d'exploitable." };
  }

  let brut: Record<string, unknown>;
  try {
    brut = JSON.parse(texte.slice(debut, fin + 1)) as Record<string, unknown>;
  } catch {
    return { ok: false, raison: "La lecture n'a rien rendu d'exploitable." };
  }

  const chaine = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const p = v.trim();
    return p === "" || p.toLowerCase() === "null" ? null : p;
  };

  const nombre = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v !== "string") return null;
    const p = v.replace(/[^\d,.-]/g, "").replace(",", ".");
    if (p === "" || p === "-" || p === ".") return null;
    const n = Number(p);
    return Number.isFinite(n) ? n : null;
  };

  const positif = (n: number | null): number | null => (n === null || n < 0 ? null : Math.round(n * 100) / 100);

  const fournisseur = chaine(brut.fournisseur);
  const ecrite = chaine(brut.date_ecrite);
  const imprimee = ecrite === null ? undefined : dateImprimee(ecrite);
  const dateBrute = imprimee === undefined ? chaine(brut.date) : imprimee;
  const dateBienFormee = dateBrute && /^\d{4}-\d{2}-\d{2}$/.test(dateBrute) ? dateBrute : null;
  // Une date doit avoir la forme ET être plausible : un ticket de demain
  // n'existe pas, et un ticket trop vieux pour sa TVA est une année mal lue
  // (« 2023 » pour un ticket du jour). Les deux rangeraient l'achat dans une
  // période que le patron ne consultera jamais.
  const date =
    dateBienFormee && dateBienFormee <= aujourdHui && dateBienFormee >= premierJourRecuperable(aujourdHui)
      ? dateBienFormee
      : null;

  const totalTtc = positif(nombre(brut.total_ttc));
  const tauxBrut = positif(nombre(brut.taux_tva));
  // Un taux de TVA au-delà de 100 % n'existe pas ; à 0 non plus, ce serait
  // « pas de TVA », ce que le montant dira mieux.
  const tauxTva = tauxBrut !== null && tauxBrut > 0 && tauxBrut <= 100 ? tauxBrut : null;
  let tva = positif(nombre(brut.tva));

  const reserves: string[] = [];

  // **Une TVA plus grande que le total est une lecture fautive, pas un cas
  // rare.** La laisser passer ferait grossir le relevé d'un montant imaginaire.
  if (tva !== null && totalTtc !== null && tva > totalTtc) {
    tva = null;
    reserves.push("le montant de TVA lu dépassait le total");
  }

  // Le ticket ne l'affichait pas : on le calcule, et **on le dit**. Le patron
  // doit savoir que ce chiffre-là vient d'un calcul et non de son papier.
  if (tva === null && totalTtc !== null && tauxTva !== null) {
    tva = tvaDepuisTtc(totalTtc, tauxTva);
    if (tva !== null) reserves.push("la TVA n’était pas lisible : elle a été calculée depuis le total et le taux");
  }

  // Un total sans taux ni TVA : souvent un ticket qui n'en écrit aucune (son
  // ticket Uber Eats du 27 octobre 2026). Rien ne s'invente : la feuille
  // s'ouvre sans taux et le note sans TVA (`tvaDuTicket`), et la phrase le dit.
  if (tva === null && totalTtc !== null && tauxTva === null) {
    reserves.push("aucun taux de TVA n’a été lu : sans TVA écrite, l’achat se note sans TVA");
  } else if (tva === null) reserves.push("le montant de TVA n’a pas pu être lu");
  if (fournisseur === null) reserves.push("le nom du fournisseur n’a pas pu être lu");
  if (date === null) reserves.push(dateBienFormee ? "la date lue ne tenait pas debout" : "la date n’a pas pu être lue");

  return {
    ok: true,
    ticket: {
      fournisseur,
      date,
      totalTtc,
      tauxTva,
      tvaDeductible: tva,
      // Une nature hors de la liste est une invention : elle retombe à null,
      // et il choisit lui-même.
      nature: estNatureAchat(chaine(brut.nature)) ? (chaine(brut.nature) as NatureAchat) : null,
      lignes: lignesImprimees(brut.lignes),
      reserve: reserves.length === 0 ? null : `${enPhrase(reserves.join(", "))}. Vérifiez avant d’ajouter.`,
    },
  };
}

/**
 * Photographier, lire, proposer.
 *
 * **Sans fournisseur de vision, on refuse proprement** — l'écran retombe alors
 * sur la saisie à la main, ce qui est un parcours entier et non une panne. Un
 * fournisseur peut ne pas porter `lireImage` : c'est un état prévu.
 */
export async function lireTicket(base64: string, mimeType: string): Promise<ResultatLecture> {
  const fournisseur = getFournisseurLLM();
  if (!fournisseur.lireImage) {
    return { ok: false, raison: "La lecture automatique n’est pas disponible ici." };
  }
  const aujourdHui = jourIso(new Date());
  const r = await fournisseur.lireImage(SYSTEME, consigneDeLecture(aujourdHui), { base64, mimeType });
  if (!r.succes) {
    // Le message du fournisseur est repris tel quel : « clé refusée » et
    // « quota dépassé » ne se réparent pas de la même façon, et une seule
    // phrase pour les deux ferait chercher au mauvais endroit.
    return { ok: false, raison: r.erreur.message };
  }
  return lireReponseTicket(r.texte, aujourdHui);
}

/** La réserve s'affiche telle quelle : elle commence comme une phrase. */
function enPhrase(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
