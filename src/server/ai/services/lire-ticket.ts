import { getFournisseurLLM } from "../providers/llm/fabrique";
import { METIER_ATLAS_COURT } from "../../../lib/metier-atlas";
import { tvaDepuisTtc } from "@/lib/achat-tva";

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
  /** Ce que la lecture n'a pas su faire, dit en français au patron. */
  reserve: string | null;
};

export type ResultatLecture =
  | { ok: true; ticket: TicketLu }
  | { ok: false; raison: string };

const SYSTEME = `${METIER_ATLAS_COURT}

Tu lis ses tickets de caisse et ses factures d'achat.
Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code.
Champs attendus : fournisseur (string|null), date (string|null au format AAAA-MM-JJ),
total_ttc (number|null), taux_tva (number|null, en pour-cent), tva (number|null).
Règles :
- Tu ne DEVINES jamais. Un champ illisible vaut null.
- « tva » est le montant de TVA écrit sur le ticket. S'il n'y figure pas, rends null : ne le calcule pas.
- Les montants sont en euros, en nombre décimal à point (12.34), sans symbole.`;

const CONSIGNE = "Lis ce ticket et rends l'objet JSON demandé.";

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
export function lireReponseTicket(texte: string): ResultatLecture {
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
  const dateBrute = chaine(brut.date);
  // Une date doit avoir la forme ET être plausible : un ticket de l'an 3000
  // rangerait l'achat dans une période que le patron ne consultera jamais.
  const date =
    dateBrute && /^\d{4}-\d{2}-\d{2}$/.test(dateBrute) && Number(dateBrute.slice(0, 4)) >= 2000 && Number(dateBrute.slice(0, 4)) <= 2100
      ? dateBrute
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

  if (tva === null) reserves.push("le montant de TVA n’a pas pu être lu");
  if (fournisseur === null) reserves.push("le nom du fournisseur n’a pas pu être lu");
  if (date === null) reserves.push("la date n’a pas pu être lue");

  return {
    ok: true,
    ticket: {
      fournisseur,
      date,
      totalTtc,
      tauxTva,
      tvaDeductible: tva,
      reserve: reserves.length === 0 ? null : `${reserves.join(", ")}. Vérifiez avant d’ajouter.`,
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
  const r = await fournisseur.lireImage(SYSTEME, CONSIGNE, { base64, mimeType });
  if (!r.succes) {
    // Le message du fournisseur est repris tel quel : « clé refusée » et
    // « quota dépassé » ne se réparent pas de la même façon, et une seule
    // phrase pour les deux ferait chercher au mauvais endroit.
    return { ok: false, raison: r.erreur.message };
  }
  return lireReponseTicket(r.texte);
}
