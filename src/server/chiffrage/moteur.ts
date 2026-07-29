import Decimal from "decimal.js";
import type { Chiffrage, ChiffrageAvecVariantes, EntreesChiffrage, LigneExplication, TypeVariante } from "./types";

// Ajustement de marge par variante — un simple décalage en points de
// pourcentage, jamais une seconde formule opaque. Aucune complexité
// d'interface : l'assistant présente les trois en texte si on le lui demande.
const AJUSTEMENT_VARIANTE: Record<TypeVariante, string> = {
  prudent: "-5",
  standard: "0",
  premium: "+10",
};

// Calcule un chiffrage pour une marge cible donnée. Fonction pure, sans accès
// base de données : toutes les entrées sont déjà connues et validées par
// l'appelant (repository/outil). Aucune invention : une donnée absente reste
// absente et déclenche un avertissement plutôt qu'une valeur par défaut cachée.
export function calculerChiffrage(entrees: EntreesChiffrage, margeCiblePourcentOverride?: string): Chiffrage {
  const explications: LigneExplication[] = [];
  const avertissements: string[] = [];

  const p = entrees.parametres;
  const margePourcent = new Decimal(margeCiblePourcentOverride ?? p.margeCiblePourcent);

  // --- Coût main-d'œuvre ---
  let coutMainOeuvre = new Decimal(0);
  if (entrees.joursEstimes != null && entrees.nombreOuvriers != null) {
    const coutOuvriers = new Decimal(entrees.joursEstimes)
      .times(entrees.nombreOuvriers)
      .times(p.coutJournalierOuvrier);
    const coutChef = entrees.aUnChefEquipe
      ? new Decimal(entrees.joursEstimes).times(p.coutJournalierChefEquipe)
      : new Decimal(0);
    coutMainOeuvre = coutOuvriers.plus(coutChef);
    explications.push({
      libelle: "Main-d'œuvre",
      detail: `${entrees.joursEstimes} jour(s) × ${entrees.nombreOuvriers} ouvrier(s) × ${p.coutJournalierOuvrier} €/jour${
        entrees.aUnChefEquipe ? ` + 1 chef d'équipe × ${p.coutJournalierChefEquipe} €/jour` : ""
      } (paramètres de l'entreprise).`,
    });
  } else {
    avertissements.push("Durée ou taille d'équipe non connue : coût de main-d'œuvre non calculé (laissé à 0).");
  }

  // --- Coût matériel ---
  // Aucune donnée de coût matériel fiable n'est encore reliée au catalogue à ce
  // stade (lot IA-06) : jamais inventé, toujours signalé explicitement.
  const coutMateriel = new Decimal(0);
  avertissements.push("Aucun coût matériel chiffré : à compléter manuellement si nécessaire.");

  // --- Coût déplacement ---
  const coutDeplacement = new Decimal(p.coutDeplacement);
  explications.push({ libelle: "Déplacement", detail: `Forfait déplacement configuré : ${p.coutDeplacement} €.` });

  const autresCouts = new Decimal(0);

  const sousTotal = coutMainOeuvre.plus(coutMateriel).plus(coutDeplacement).plus(autresCouts);
  const marge = sousTotal.times(margePourcent).dividedBy(100);
  const prixConseille = sousTotal.plus(marge);
  const tva = prixConseille.times(p.tauxTvaDefaut).dividedBy(100);
  const prixTtc = prixConseille.plus(tva);

  explications.push({
    libelle: "Marge",
    detail: `${margePourcent.toFixed(2)} % du sous-total (${sousTotal.toFixed(2)} €), paramètre de l'entreprise${
      margeCiblePourcentOverride ? " ajusté pour cette variante" : ""
    }.`,
  });
  if (entrees.nomPrestation) {
    explications.push({ libelle: "Prestation", detail: `Catalogue : ${entrees.nomPrestation}.` });
  }

  return {
    coutMainOeuvre: coutMainOeuvre.toFixed(2),
    coutMateriel: coutMateriel.toFixed(2),
    coutDeplacement: coutDeplacement.toFixed(2),
    autresCouts: autresCouts.toFixed(2),
    sousTotal: sousTotal.toFixed(2),
    margePourcent: margePourcent.toFixed(2),
    marge: marge.toFixed(2),
    prixConseille: prixConseille.toFixed(2),
    tauxTva: p.tauxTvaDefaut,
    tva: tva.toFixed(2),
    prixTtc: prixTtc.toFixed(2),
    explications,
    avertissements,
  };
}

// Trois variantes de marge, formules identiques — jamais une seconde logique
// de calcul cachée, uniquement un ajustement du pourcentage de marge.
export function calculerVariantes(
  entrees: EntreesChiffrage,
  historique?: ChiffrageAvecVariantes["historique"]
): ChiffrageAvecVariantes {
  const margeBase = new Decimal(entrees.parametres.margeCiblePourcent);
  const variantes = {
    prudent: calculerChiffrage(entrees, margeBase.plus(AJUSTEMENT_VARIANTE.prudent).toFixed(2)),
    standard: calculerChiffrage(entrees),
    premium: calculerChiffrage(entrees, margeBase.plus(AJUSTEMENT_VARIANTE.premium).toFixed(2)),
  };
  return { variantes, historique: historique ?? null };
}
