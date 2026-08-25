import { getFournisseurLLM } from "../providers/llm/fabrique";
import { couleurNettoyee, TYPOGRAPHIES } from "@/lib/allure-documents";
import { BORNES, type ConditionsLues } from "@/lib/conditions-documents";

/**
 * Lire l'ALLURE d'un devis photographié — pour que ses futurs documents lui
 * ressemblent sans qu'il ait à régler logo, police, couleur et conditions à la
 * main.
 *
 * **Sa demande du 25 août 2026 :** *« faut que l'utilisateur puisse prendre la
 * photo de son devis […] pareil pour sa facture »*, après *« on comprend rien,
 * trop compliqué pour modifier »* sur l'écran des documents. Dessiné d'abord
 * (`appli/photographier-mon-devis.html`), tranché ainsi : la photo reprend
 * l'ALLURE (couleurs, police) et les MENTIONS — jamais les lignes ni les prix.
 *
 * **Ce que la photo NE rend pas, et pourquoi c'est dit et non caché :**
 *   · **le logo.** Le modèle décrit une image, il ne la découpe pas : on ne
 *     peut pas en tirer un fichier PNG propre. Le logo reste posé à la main.
 *   · **une police non reconnue.** On ne pose une typographie que si le modèle
 *     nomme une famille que le PDF sait embarquer (les neuf de la liste). « Une
 *     serif quelconque » n'est pas une source : la deviner poserait une police
 *     qui n'est pas la sienne, et il ne le verrait qu'à l'impression.
 *
 * ## Ce qui est éprouvable ici, et ce qui ne l'est pas
 *
 * `lireReponseAllure` est une fonction PURE : elle prend le texte du modèle et
 * en tire des couleurs, une police et des conditions — ou refuse. Éprouvée sans
 * clé ni réseau (`scripts/test-lecture-allure-devis.ts`), là où vivent les
 * pièges : une couleur mal écrite, une police inventée, un acompte à 300 %.
 *
 * **L'appel au fournisseur de vision, lui, n'est PAS éprouvé ici** : aucune clé
 * dans cet environnement. Il se prouve sur le banc du patron, avec un vrai
 * devis — comme la dictée. Tant que ce n'est pas fait, ça reste « non vérifié »
 * (`AGENTS.md`).
 */

/** Ce que la lecture rend : chaque champ peut être `null` — non trouvé se dit. */
export type AllureLue = {
  /** Le fond de page, `#rrggbb`, ou `null`. */
  fond: string | null;
  /** L'accent (intertitres, filets), `#rrggbb`, ou `null`. */
  accent: string | null;
  /** La clef d'une des typographies connues, ou `null` si non reconnue. */
  typographie: string | null;
  /** Les mentions / conditions lues — mêmes champs que la saisie à la main. */
  conditions: ConditionsLues;
  /** Ce que la lecture n'a pas su faire, en français, pour l'écran. */
  reserve: string | null;
};

export type ResultatAllure =
  | { ok: true; allure: AllureLue }
  | { ok: false; raison: string };

const SYSTEME = `Tu regardes la photo d'un devis ou d'une facture d'artisan français, et tu en décris l'ALLURE — pas le contenu.
Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code.
Champs attendus :
- fond (string|null) : la couleur de fond de la page, au format "#rrggbb". Le blanc pur vaut "#ffffff".
- accent (string|null) : la couleur des intertitres, filets ou de l'en-tête, au format "#rrggbb".
- police (objet) : { "empattements": true|false|null, "nom": string|null }. "empattements" = true si le texte a des serifs (empattements), false si c'est une linéale. "nom" = le nom de la famille SEULEMENT si tu la reconnais avec certitude, sinon null.
- conditions (objet) : { "validite_jours": number|null, "acompte_pourcent": number|null, "delai_paiement_jours": number|null, "moyens_paiement": string|null, "penalites": true|false|null, "pied": string|null }. "pied" = la mention de bas de page ou la formule de politesse, telle qu'écrite.
Règles ABSOLUES :
- Tu ne DEVINES jamais. Un champ que tu ne lis pas clairement vaut null.
- Tu ne rends NI les lignes, NI les prix, NI le nom du client : seulement l'allure et les conditions.
- Les couleurs sont en hexadécimal "#rrggbb". Les pourcentages et durées sont des nombres.`;

const CONSIGNE = "Décris l'allure de ce document et rends l'objet JSON demandé.";

/**
 * Rapproche ce que le modèle dit de la police d'une des typographies connues.
 *
 * **On ne pose une typographie que sur un NOM reconnu.** La liste ne porte que
 * des polices que le PDF sait embarquer ; en désigner une « au genre » (serif
 * ou linéale) reviendrait à choisir sa police à sa place. Non reconnue → `null`,
 * et l'écran le dit : il la choisira à la main.
 */
export function typographieDepuisNom(nom: string | null): string | null {
  if (!nom) return null;
  const propre = nom.toLowerCase().replace(/\s+/g, " ").trim();
  if (propre === "") return null;
  const sansEspace = propre.replace(/\s+/g, "");
  for (const t of TYPOGRAPHIES) {
    if (t.clef === "systeme" || !t.famille) continue;
    const famille = t.famille.toLowerCase();
    if (famille === propre || famille.replace(/\s+/g, "") === sansEspace) return t.clef;
    // « Playfair » pour « Playfair Display », « Garamond » pour « EB Garamond ».
    if (propre.length >= 4 && (famille.includes(propre) || propre.includes(famille))) return t.clef;
  }
  return null;
}

/**
 * Le texte du modèle, transformé en allure — ou refusé.
 *
 * **Ne réutilise que ce qui est VALIDE.** Une couleur mal écrite ne devient pas
 * une couleur au hasard : elle vaut `null`, et le champ d'avant restera. Un
 * acompte hors bornes tombe. Chaque perte se dit en réserve.
 */
export function lireReponseAllure(texte: string): ResultatAllure {
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
  const booleen = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
  const dansBornes = (n: number | null, b: { min: number; max: number }): number | null =>
    n !== null && n >= b.min && n <= b.max ? n : null;

  const reserves: string[] = [];

  const fond = couleurNettoyee(chaine(brut.fond));
  const accent = couleurNettoyee(chaine(brut.accent));
  if (fond === null && accent === null) reserves.push("les couleurs n’ont pas pu être lues");

  const police = (brut.police ?? {}) as Record<string, unknown>;
  const typographie = typographieDepuisNom(chaine(police.nom));
  if (typographie === null) {
    // Reconnue ou non, on le dit : sa police est peut-être hors de la liste des
    // neuf, et alors elle reste à choisir à la main plutôt qu'approchée.
    reserves.push("la police n’a pas été reconnue parmi les neuf disponibles — à choisir à la main");
  }

  const c = (brut.conditions ?? {}) as Record<string, unknown>;
  const validiteJours = dansBornes(nombre(c.validite_jours), BORNES.validiteJours);
  const acompteBrut = dansBornes(nombre(c.acompte_pourcent), BORNES.acomptePourcent);
  const delaiPaiementJours = dansBornes(nombre(c.delai_paiement_jours), BORNES.delaiPaiementJours);
  const conditions: ConditionsLues = {
    validiteJours,
    // L'acompte se garde en chaîne, comme la saisie à la main (un « 30 » lu
    // devient « 30 »), pour passer par la même validation que l'écran.
    acomptePourcent: acompteBrut === null ? null : String(acompteBrut),
    delaiPaiementJours,
    moyensPaiement: chaine(c.moyens_paiement),
    rappelerPenalites: booleen(c.penalites),
    textePied: chaine(c.pied),
  };

  // **Le logo se dit toujours**, parce qu'on ne sait pas le reprendre d'une
  // photo : il reste à poser à la main, et il ne faut pas le lui laisser croire.
  reserves.push("le logo n’est pas repris d’une photo — ajoutez-le à la main");

  return {
    ok: true,
    allure: {
      fond,
      accent,
      typographie,
      conditions,
      reserve: reserves.length === 0 ? null : `${reserves.join(" · ")}.`,
    },
  };
}

/**
 * Photographier, lire l'allure, proposer.
 *
 * **Sans fournisseur de vision, on refuse proprement** — l'écran retombe sur le
 * réglage à la main, qui reste dessous. Un fournisseur peut ne pas porter
 * `lireImage` : c'est un état prévu, pas une panne.
 */
export async function lireAllureDevis(base64: string, mimeType: string): Promise<ResultatAllure> {
  const fournisseur = getFournisseurLLM();
  if (!fournisseur.lireImage) {
    return { ok: false, raison: "La lecture automatique n’est pas disponible ici." };
  }
  const r = await fournisseur.lireImage(SYSTEME, CONSIGNE, { base64, mimeType });
  if (!r.succes) {
    return { ok: false, raison: r.erreur.message };
  }
  return lireReponseAllure(r.texte);
}
