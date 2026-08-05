import { analyserDemandeTexte, MOTS_AMBIGUS } from "../orchestrateur/analyse-demande";
import type { PropositionExtraction } from "./schemas/extraction";

// Lire une dictée **mot à mot**, sans modèle de langage.
//
// Ce découpage existait déjà, enfoui dans le fournisseur LLM de développement.
// Il en sort ici pour une raison précise : c'est le **filet** du parcours. Quand
// le fournisseur réel ne répond pas, répond à côté, ou n'est pas raccordé, le
// patron se retrouvait devant « Réponse du fournisseur non conforme (JSON
// invalide). » et son chantier n'avançait plus d'un pouce — alors qu'une lecture
// littérale de sa dictée était disponible, sans réseau et sans clé.
//
// Ce qu'elle sait faire : rendre chaque segment dicté, avec sa quantité quand
// elle est écrite, et ranger à part ce qui parle du devenir des déchets, de
// l'accès, de la durée et de l'équipe.
//
// Ce qu'elle ne sait PAS faire, et qu'il ne faut pas lui prêter : comprendre.
// Elle ignore qu'un chêne mort s'abat et qu'une haie se taille ; elle recopie.
// C'est pourquoi tout ce qui en sort est présenté au patron comme une lecture
// littérale, à vérifier — jamais comme une analyse.

// Ce qui parle du **devenir des déchets**, et non du travail lui-même.
//
// « bois » n'en fait pas partie. Pour un élagueur, le bois est sa matière, pas
// son rebut : « couper le bois en 50 cm, fendre, laisser sur place » — deux
// heures de travail facturable — était intégralement reclassé en gestion des
// déchets, donc retiré des prestations. Le patron a vu son abattage disparaître.
const MOTS_DECHETS =
  /d[ée]chets?|branchages?|[ée]vacuations?|[ée]vacuer|benne|d[ée]ch[eè]terie|gravats?|d[ée]blais?|(?:laisser?|laiss[ée]s?|reste[nr]?|rest[ea]nt)\s+sur\s+place|emport(?:er|e)|br[ûu]l(?:er|age)/i;
const MOTS_ACCES =
  /acc[èe]s|portail|[ée]chafaudage|[ée]tage|stationnement|ruelle|cour\b|passage [ée]troit|chemin [ée]troit|terrain en pente/i;

/**
 * Sépare, dans un segment, ce qui relève du travail et ce qui relève du devenir
 * des déchets (ou d'une contrainte d'accès).
 *
 * Le segment entier basculait dans une seule case. « Couper le bois en 50 cm
 * fendre laisser sur place » partait donc tout entier en gestion des déchets, à
 * cause des trois derniers mots — et la prestation n'existait plus nulle part.
 *
 * Ici l'expression détectée est retirée : ce qui reste redevient une prestation.
 * Sauf si le reste parle encore de déchets (« évacuation des déchets ») ou ne
 * porte plus rien : le segment est alors bien, en entier, une information de
 * chantier.
 */
function separer(segment: string, motif: RegExp): { travail: string | null; information: string | null } {
  const trouve = segment.match(motif);
  if (!trouve) return { travail: segment, information: null };

  const reste = segment.replace(trouve[0], " ").replace(/\s+/g, " ").trim();
  if (reste.length < 4 || motif.test(reste)) return { travail: null, information: segment };
  return { travail: reste, information: trouve[0] };
}

// Quantité explicitement écrite dans le texte, avec son unité. Uniquement ce
// qui est réellement présent : sans nombre ET unité reconnaissables, les deux
// champs restent nuls — une lecture littérale n'extrapole jamais une quantité à
// partir d'un pluriel ou d'un contexte.
const REGEX_QUANTITE = /(\d+(?:[.,]\d+)?)\s*(m²|m2|ml|m³|m3|cm|mm|m|kg|t|litres?|l|sacs?|plaques?|rouleaux?|palettes?|unit[ée]s?|heures?|h)\b/i;

function enLigneExtraite(segment: string) {
  const m = segment.match(REGEX_QUANTITE);
  return {
    libelle: segment,
    // Le segment brut sert déjà de libellé : aucune description séparée n'est
    // inventée ici. Un vrai fournisseur, lui, peut en produire une.
    description: null,
    quantite: m ? m[1] : null,
    unite: m ? m[2] : null,
    aConfirmer: MOTS_AMBIGUS.test(segment),
  };
}

/** Découpe une dictée en proposition structurée, sans réseau et sans clé. */
export function lireLitteralement(texte: string): PropositionExtraction {
  const { prestations, materiel, ambiguites, dureeTexte, equipeTexte, annonces } = analyserDemandeTexte(texte);

  // Ce qui parle de déchets ou d'accès est une information de chantier, pas un
  // travail à chiffrer — mais on n'en retire du segment que la partie
  // concernée, jamais le segment entier (voir `separer`).
  const dechets: string[] = [];
  const acces: string[] = [];
  const travaux: string[] = [];
  for (const segment of prestations) {
    const surDechets = separer(segment, MOTS_DECHETS);
    if (surDechets.information) dechets.push(surDechets.information);
    if (!surDechets.travail) continue;

    const surAcces = separer(surDechets.travail, MOTS_ACCES);
    if (surAcces.information) acces.push(surAcces.information);
    if (surAcces.travail) travaux.push(surAcces.travail);
  }

  const informationsManquantes: string[] = [];
  if (!dureeTexte) informationsManquantes.push("Durée prévue non détectée");
  if (!equipeTexte) informationsManquantes.push("Taille d'équipe non détectée");
  if (dechets.length === 0) informationsManquantes.push("Gestion des déchets non précisée");

  return {
    prestations: travaux.map(enLigneExtraite),
    materiel: materiel.map(enLigneExtraite),
    dureePrevue: dureeTexte,
    tailleEquipe: equipeTexte,
    gestionDechets: dechets.length > 0 ? dechets.join(" ; ") : null,
    contraintesAcces: acces.length > 0 ? acces.join(" ; ") : null,
    // Les phrases qui annonçaient une durée ou une équipe finissent ici : le
    // patron les retrouve, son client ne les lit pas sur son devis.
    remarques: annonces.length > 0 ? annonces.join(" ; ") : null,
    ambiguites,
    informationsManquantes,
  };
}
