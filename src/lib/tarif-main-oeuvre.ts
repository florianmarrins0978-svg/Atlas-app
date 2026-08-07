import Decimal from "decimal.js";

/**
 * Le prix de la main d'œuvre, pris dans la grille du patron plutôt que calculé.
 *
 * **Le défaut du 7 août 2026.** Le patron dicte « deux hommes, camion broyeur,
 * une journée » et lit 858,00 € sur son devis. Sa question : *« à quoi
 * correspond ce prix ? Il n'est pas allé chercher dans la grille de prix, ça ne
 * correspond pas du tout. »*
 *
 * Il avait raison, et la cause était structurelle. Le rapprochement tarifaire
 * se fait par le TEXTE : on cherche un tarif dont l'intitulé se retrouve dans le
 * libellé d'une prestation. Son tarif s'appelle « Main d'œuvre (jour/homme) » ;
 * sa prestation s'appelle « Abattage d'un cèdre mort ». Aucun mot commun, donc
 * aucun tarif retenu — et l'application basculait sur ses **paramètres de
 * chiffrage**, c'est-à-dire un coût interne majoré d'une marge. Deux chiffres
 * qui n'ont rien à voir : l'un est ce que le travail lui coûte, l'autre ce
 * qu'il le vend.
 *
 * **La main d'œuvre ne se rapproche pas par le texte, mais par l'unité.** Un
 * tarif au « jour/homme » ne décrit aucune prestation en particulier : il
 * s'applique à toutes, dès qu'on connaît une durée et une équipe. C'est
 * exactement ce que le patron dicte à chaque fois.
 *
 * Ce fichier ne décide de rien d'autre : il ne cherche pas de tarif à la
 * prestation (le rapprochement par intitulé existe déjà et reste inchangé), et
 * il ne remplace pas le moteur de chiffrage — il passe devant lui, parce qu'un
 * prix de vente déjà décidé vaut mieux qu'un prix reconstitué.
 */
export type TarifSimple = { id: string; intitule: string; prix: string; unite: string | null };

export type MainOeuvreChiffree = {
  tarifId: string;
  intitule: string;
  prixUnitaire: string;
  /** Ce qui a été multiplié par quoi, en français, pour l'écran d'explication. */
  detail: string;
  montant: string;
};

/**
 * Les unités qui désignent un prix de main d'œuvre, et par quoi il se multiplie.
 *
 * Volontairement littéral : on ne devine pas une unité, on reconnaît celles que
 * le patron écrit réellement. Une unité inconnue ne devient jamais de la main
 * d'œuvre — mieux vaut ne pas trouver que de multiplier au hasard le prix d'un
 * mètre carré par un nombre de jours.
 */
const UNITES: { motifs: string[]; parHomme: boolean; parJour: boolean }[] = [
  { motifs: ["jour/homme", "jour / homme", "jour homme", "j/h", "journee/homme", "homme/jour"], parHomme: true, parJour: true },
  { motifs: ["jour", "journee", "j"], parHomme: false, parJour: true },
];

function normaliser(u: string): string {
  return u
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Un tarif est-il un prix de main d'œuvre, et comment se multiplie-t-il ? */
function reconnaitre(unite: string | null): { parHomme: boolean; parJour: boolean } | null {
  if (!unite) return null;
  const u = normaliser(unite);
  for (const regle of UNITES) {
    if (regle.motifs.includes(u)) return { parHomme: regle.parHomme, parJour: regle.parJour };
  }
  return null;
}

/**
 * Chiffre la main d'œuvre depuis la grille, si la grille sait le faire.
 *
 * Rend `null` — jamais un montant approché — dès qu'il manque quoi que ce soit :
 * pas de tarif au jour, pas de durée, pas d'équipe. Le refus est une réponse
 * (`docs/AGENT.md` §3) ; un prix reconstitué de travers n'en est pas une.
 *
 * @param jours    Durée du chantier en journées. `null` si elle n'a pas été dite.
 * @param hommes   Taille de l'équipe. `null` si elle n'a pas été dite.
 */
export function chiffrerMainOeuvre(
  tarifs: TarifSimple[],
  jours: number | null,
  hommes: number | null
): MainOeuvreChiffree | null {
  if (jours === null || !Number.isFinite(jours) || jours <= 0) return null;

  // Le plus précis d'abord : un tarif au jour/homme dit exactement ce qu'on
  // cherche. Un tarif à la journée seule ne connaît pas la taille de l'équipe,
  // et le multiplier par le nombre d'hommes serait une décision qu'on prend à
  // la place du patron.
  for (const regle of UNITES) {
    const tarif = tarifs.find((t) => {
      const r = reconnaitre(t.unite);
      return r !== null && r.parHomme === regle.parHomme && r.parJour === regle.parJour;
    });
    if (!tarif) continue;

    const r = reconnaitre(tarif.unite)!;
    if (r.parHomme && (hommes === null || !Number.isFinite(hommes) || hommes <= 0)) continue;

    let prix: Decimal;
    try {
      prix = new Decimal(tarif.prix);
    } catch {
      continue;
    }
    if (!prix.isFinite() || prix.lessThanOrEqualTo(0)) continue;

    const montant = r.parHomme ? prix.times(jours).times(hommes!) : prix.times(jours);
    const detail = r.parHomme
      ? `${jours} jour(s) × ${hommes} homme(s) × ${tarif.prix} € (votre tarif « ${tarif.intitule} »).`
      : `${jours} jour(s) × ${tarif.prix} € (votre tarif « ${tarif.intitule} »).`;

    return {
      tarifId: tarif.id,
      intitule: tarif.intitule,
      prixUnitaire: tarif.prix,
      detail,
      montant: montant.toFixed(2),
    };
  }

  return null;
}
