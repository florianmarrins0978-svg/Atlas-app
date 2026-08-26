/**
 * CE DONT L'ASSISTANT NE PARLE PAS — et ce qui l'en empêche vraiment.
 *
 * **Sa demande du 26 août 2026 :** *« si on lui demande est-ce que le CGR de
 * Mantes est ouvert, il ne doit pas y répondre. Mais toutes les questions ou
 * les gestes pour l'appli, il doit pouvoir le faire. »*
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI UNE FONCTION, ALORS QUE LA CONSIGNE LE DIT DÉJÀ.**
 *
 * Le service dit au modèle de s'en tenir à Atlas. C'est nécessaire et ça ne
 * suffit pas : une consigne se contourne, elle change avec le fournisseur, et
 * surtout **elle ne se vérifie pas**. Ici, le refus est décidé AVANT que le
 * modèle soit appelé — donc éprouvable sans clé, gratuit, et identique quel que
 * soit le fournisseur du jour.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **DEUX CONDITIONS, ET C'EST TOUT L'ART.**
 *
 * Refuser sur le seul mot « cinéma » ferait taire l'assistant devant « j'ai un
 * chantier au cinéma de Mantes » — un vrai chantier, une vraie question. Or un
 * garde-fou qui parle à tort s'apprend à être ignoré, et l'on perd alors le
 * garde-fou entier (`CLAUDE.md` §4 ter).
 *
 * On ne refuse donc que si les DEUX sont vraies :
 *
 * | | |
 * |---|---|
 * | la question porte une marque franche du dehors | cinéma, météo, recette, capitale… |
 * | et **aucun** mot d'Atlas | devis, chantier, client, planning, tarif… |
 *
 * Le doute profite à la question : elle part au modèle, qui a la consigne. Ce
 * filtre attrape le cas franc — le sien —, pas la totalité, et c'est assumé :
 * mieux vaut un filtre qu'on peut croire qu'un filtre qui bâillonne.
 */

/** Sans accents, en minuscules : il tape comme il parle. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Les mots du métier et de l'application.
 *
 * **Cette liste est le garde-fou du garde-fou** : tant qu'un de ces mots est
 * là, on ne refuse pas. L'allonger est sans danger ; la raccourcir fait taire
 * l'assistant sur de vraies questions.
 */
const MOTS_DATLAS = [
  "atlas", "devis", "facture", "facturer", "chantier", "client", "planning", "planifier",
  "tarif", "prix", "prestation", "materiel", "materiaux", "dictee", "vocale", "note", "photo",
  "arrosage", "arroseur", "tuyere", "turbine", "nourrice", "piquage", "croquis", "diagnostic",
  "entretien", "tva", "acompte", "reglage", "reglages", "abonnement", "equipe", "salarie",
  "commercial", "patron", "assistant", "appli", "application", "ecran", "bouton", "onglet",
  "catalogue", "vocabulaire", "identite", "siret", "iban", "echeance", "relance", "impaye",
  "brouillon", "envoyer", "envoi", "signature", "pdf", "adresse", "telephone", "mail", "sms",
  "elagage", "abattage", "haie", "tonte", "pelouse", "taille", "broyage", "terrasse", "cloture",
];

/**
 * Les marques franches du dehors.
 *
 * Choisies pour ne jamais désigner autre chose : un artisan qui écrit
 * « meteo » parle du temps, pas d'un chantier. Les mots ambigus — « ouvert »,
 * « horaire », « heure » — n'y sont PAS, et c'est délibéré : ils vivent aussi
 * dans le métier.
 */
const MARQUES_DU_DEHORS = [
  "cinema", "cgr", "ugc", "gaumont", "pathe", "film", "seance", "restaurant", "pizzeria",
  // « temps » seul est gardé : il dit aussi le temps PASSÉ sur un chantier.
  // Ces tournures-là, elles, ne parlent que du ciel.
  "meteo", "quel temps fait il", "quel temps fera", "va t il pleuvoir", "il va pleuvoir",
  "pluie demain", "temperature", "recette", "cuisine",
  "capitale", "president", "guerre", "election", "actualite", "bourse", "bitcoin",
  "football", "match", "ligue 1", "resultat du match",
  "medecin", "symptome", "maladie", "medicament", "avocat", "divorce", "impots sur le revenu",
  "traduis", "traduction", "poeme", "blague", "chatgpt", "python", "javascript",
  "train", "sncf", "vol pour", "hotel", "pharmacie de garde", "horaires d ouverture",
];

export type VerdictPerimetre = { dehors: true; marque: string } | { dehors: false };

/**
 * Cette question sort-elle d'Atlas ?
 *
 * Rend `dehors: false` au moindre doute — c'est la consigne du service qui
 * prend alors le relais.
 */
export function horsPerimetre(question: string): VerdictPerimetre {
  const propre = normaliser(question);
  if (!propre) return { dehors: false };

  const mots = new Set(propre.split(" "));
  // Un seul mot d'Atlas suffit à garder la question : le doute lui profite.
  if (MOTS_DATLAS.some((m) => mots.has(m))) return { dehors: false };

  const marque = MARQUES_DU_DEHORS.find((m) => (m.includes(" ") ? propre.includes(m) : mots.has(m)));
  return marque ? { dehors: true, marque } : { dehors: false };
}

/**
 * Ce qu'il lit quand la question sort du cadre.
 *
 * **Une phrase, pas un paragraphe** (sa règle du 25 août : le moins de mots
 * possible). Pas d'excuse, pas de « je peux néanmoins » : une porte entrouverte
 * se repousse, et il réessaierait.
 */
export const REPONSE_HORS_PERIMETRE = "Je ne réponds qu'aux questions sur Atlas.";
