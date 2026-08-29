/**
 * CE QUE LE PATRON LIT DOIT ÊTRE CE QUI SERA ÉCRIT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **LE DÉFAUT D'INTÉGRITÉ QUE CE FICHIER FERME** — lot de clôture,
 * 29 août 2026.
 *
 * Une proposition de l'assistant portait deux choses, toutes deux composées par
 * le modèle et **jamais confrontées** :
 *
 * | | |
 * |---|---|
 * | `description` | la phrase AFFICHÉE, celle que le patron lit et coche |
 * | `donnees` | la structure ÉCRITE, celle que l'application applique |
 *
 * Rien ne garantissait qu'elles disent la même chose. Un modèle — dérivé par
 * une injection dans un libellé, ou simplement maladroit — pouvait rendre
 * `description: « Ajouter la ligne Tonte — 120 € »` et
 * `donnees: { libelle: "Tonte", montant: "1200" }`. Le patron coche ce qu'il
 * lit ; ce qui s'écrit est autre chose. Sur un devis qui part chez un client.
 *
 * Son geste — *« très important que ça reste le doigt du patron »* — perdait
 * alors tout son sens : approuver une phrase qui ne décrit pas l'écriture ne
 * protège de rien.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **LA CORRECTION : LA DESCRIPTION SE RECALCULE, ELLE NE SE RECOPIE PLUS.**
 *
 * `donnees` devient la seule source de vérité, et la phrase affichée en est
 * **dérivée côté serveur**. Il ne peut donc plus y avoir d'écart : ce qui est
 * lu et ce qui est écrit sortent du même endroit.
 *
 * C'est la règle que le dépôt applique déjà aux écrans — *« un récapitulatif se
 * RECALCULE, il ne se recopie pas »* (`CLAUDE.md` §4 bis), née d'un écran qui
 * portait « 8 tés » dans son tableau et « 9 tés » dans sa phrase. Elle n'avait
 * jamais été appliquée aux propositions de l'assistant.
 *
 * **Ce qu'on perd, et pourquoi c'est un bon échange.** La prose du modèle était
 * parfois plus élégante. Mais une phrase élégante qui ment sur ce qui va être
 * écrit n'a aucune valeur — et le patron approuve une écriture, pas un texte.
 */

import type { TypeActionProposee } from "@/server/ai/propositions";

/** Le verbe de chaque geste, tel qu'il se lit à l'écran. */
const VERBES: Record<string, string> = {
  ajouter_prestation: "Ajouter la prestation",
  supprimer_prestation: "Supprimer la prestation",
  modifier_prestation: "Modifier la prestation",
  ajouter_materiel: "Ajouter le matériel",
  supprimer_materiel: "Supprimer le matériel",
  modifier_materiel: "Modifier le matériel",
  modifier_duree: "Changer la durée",
  modifier_equipe: "Changer la taille d'équipe",
  ajouter_ligne_prix: "Ajouter la ligne",
  copier_ligne_devis: "Reprendre une ligne d'un autre devis",
  creer_chantier: "Ouvrir un chantier",
  modifier_client: "Corriger la fiche du client",
  modifier_adresse_chantier: "Changer l'adresse du chantier",
  noter_chantier: "Écrire le pense-bête",
  planifier_chantier: "Poser au planning",
  deplacer_chantier: "Déplacer",
  retirer_du_planning: "Retirer du planning",
  creer_tarif: "Créer le tarif",
  modifier_tarif: "Changer le tarif",
  preparer_facture: "Préparer la facture",
};

/** Une valeur de `donnees` rendue lisible, ou `null` si elle n'apporte rien. */
function lisible(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "oui" : "non";
  return null;
}

/**
 * Les champs de `donnees` qui DÉCIDENT, dans l'ordre où on les lit.
 *
 * **On ne montre pas tout `donnees`**, et ce n'est pas de la coquetterie : un
 * identifiant technique noyé dans la phrase la rend illisible, et une phrase
 * qu'on ne lit plus ne protège de rien. Ce qui figure ici est ce dont le
 * patron a besoin pour dire oui ou non — un libellé, un montant, une date, un
 * nom.
 *
 * **Les identifiants sont délibérément absents** : ils ne veulent rien dire
 * pour lui, et ils ne sont jamais ce qui distingue deux propositions à ses
 * yeux. Ils restent dans `donnees`, qui fait foi.
 */
const CHAMPS_DECISIFS = [
  "libelle",
  "intitule",
  "nom",
  "client",
  "montant",
  "prix",
  "unite",
  "quantite",
  "adresse",
  "canalCommunication",
  "note",
  "jour",
  "quand",
  "nouvelleDuree",
  "nouvelleEquipe",
] as const;

/** Comment chaque champ décisif s'annonce, quand il ne se suffit pas à lui-même. */
const ETIQUETTES: Record<string, string> = {
  montant: "",
  prix: "",
  adresse: "à",
  canalCommunication: "par",
  note: "—",
  jour: "le",
  nouvelleDuree: "durée",
  nouvelleEquipe: "équipe",
  unite: "par",
};

/**
 * La phrase que le patron lira, composée **à partir de ce qui sera écrit**.
 *
 * Rend toujours quelque chose : un geste dont `donnees` ne porte aucun champ
 * décisif — retirer du planning, préparer une facture — se décrit par son verbe
 * seul, et c'est exact.
 */
export function decrireProposition(
  type: TypeActionProposee | string,
  donnees: Record<string, unknown>
): string {
  const verbe = VERBES[type] ?? type.replace(/_/g, " ");

  const morceaux: string[] = [];
  for (const champ of CHAMPS_DECISIFS) {
    const valeur = lisible(donnees[champ]);
    if (valeur === null) continue;
    const etiquette = ETIQUETTES[champ];
    // Une valeur trop longue est coupée : la phrase doit tenir sous les yeux
    // du patron, sur un téléphone, entre deux chantiers.
    const court = valeur.length > 80 ? `${valeur.slice(0, 77)}…` : valeur;
    morceaux.push(etiquette === undefined ? court : etiquette === "" ? court : `${etiquette} ${court}`);
  }

  // **Le montant porte son unité**, sinon « 1200 » et « 1200 € » se lisent
  // pareil et c'est précisément l'écart qu'on cherche à rendre visible.
  const i = CHAMPS_DECISIFS.findIndex((c) => c === "montant" || c === "prix");
  if (i >= 0 && (lisible(donnees.montant) !== null || lisible(donnees.prix) !== null)) {
    const brut = lisible(donnees.montant) ?? lisible(donnees.prix)!;
    const rang = morceaux.indexOf(brut);
    if (rang >= 0) morceaux[rang] = `${brut} €`;
  }

  return morceaux.length === 0 ? verbe : `${verbe} : ${morceaux.join(" · ")}`;
}
