/**
 * Ce qu'Atlas emporte avec chaque dictée : le vocabulaire du patron, ses règles,
 * et ses propres corrections passées.
 *
 * **Pourquoi cette consigne existe.** Le 7 août 2026, le patron dicte « le bois
 * on le coupe en 50, on le fend et on le laisse sur place » — et cette phrase
 * disparaît du devis, rangée dans la gestion des déchets. Sa question, la même
 * jour : *« comment je fais pour le nourrir et qu'il apprenne de ces erreurs ? »*
 *
 * Deux réponses, et elles ne se remplacent pas :
 *
 * - **une règle énoncée dit QUOI faire.** « Fendre en 50 → c'est une prestation,
 *   pas de la gestion de déchets. » Une seule phrase écrite par lui aurait suffi
 *   à éviter la ligne perdue ;
 * - **un exemple réel montre JUSQU'OÙ.** « Proposé 1 020 € sur une ligne →
 *   retenu 850 € + 250 € sur deux lignes » enseigne sa façon de découper mieux
 *   que trois paragraphes.
 *
 * **Le budget de caractères n'est pas une précaution, c'est la fonction.** Cent
 * définitions envoyées à chaque dictée, c'est une consigne plus longue que ce
 * que le patron a dit — et un modèle qui s'y noie au lieu d'écouter. Ce qui
 * dépasse est écarté **par ordre décroissant d'importance, celui que le patron
 * a fixé lui-même**, et ce qui a été écarté est dit. Tronquer en silence
 * laisserait croire à une consigne complète.
 */
export type TermeMetier = {
  nature: "mot" | "regle";
  intitule: string;
  definition: string;
  consigne: string | null;
};

export type CorrectionApprise = {
  dictee: string;
  propose: { libelle: string; montant: string }[];
  retenu: { libelle: string; montant: string }[];
};

export type ConsigneMetier = {
  /** Le texte à ajouter à la consigne système. Vide si rien n'est à dire. */
  texte: string;
  /** Combien de termes et d'exemples sont réellement partis. */
  termesRetenus: number;
  exemplesRetenus: number;
  /** Ce qui n'a pas tenu dans le budget — jamais tu. */
  ecartes: string[];
};

/**
 * Le budget, en caractères.
 *
 * Ordre de grandeur volontairement modeste : une dictée de chantier fait deux à
 * quatre cents caractères. Une consigne de six mille en tête de message reste
 * lisible par le modèle sans écraser ce qu'on lui demande d'analyser.
 */
export const BUDGET_CARACTERES = 6000;

/** Au-delà, les exemples se répètent plus qu'ils n'enseignent. */
export const MAX_EXEMPLES = 5;

export function construireConsigneMetier(
  termes: TermeMetier[],
  corrections: CorrectionApprise[],
  budget: number = BUDGET_CARACTERES
): ConsigneMetier {
  const ecartes: string[] = [];
  const morceaux: string[] = [];
  let reste = budget;

  // --- Les règles d'abord ---------------------------------------------------
  //
  // Elles passent avant les mots, et ce n'est pas un détail : une règle mal
  // appliquée fausse un prix, un mot mal compris fausse un libellé. Si le
  // budget doit sacrifier quelque chose, que ce soit le moins cher.
  const regles = termes.filter((t) => t.nature === "regle");
  const mots = termes.filter((t) => t.nature === "mot");

  function ajouter(entete: string, lignes: string[], quoi: string): number {
    if (lignes.length === 0) return 0;
    let retenues = 0;
    const gardees: string[] = [];
    for (const ligne of lignes) {
      // +1 pour le saut de ligne qui la séparera de la suivante.
      if (ligne.length + 1 > reste) {
        ecartes.push(`${quoi} : « ${resume(ligne)} »`);
        continue;
      }
      gardees.push(ligne);
      reste -= ligne.length + 1;
      retenues++;
    }
    if (gardees.length === 0) return 0;
    const bloc = `${entete}\n${gardees.join("\n")}`;
    // L'en-tête est compté après coup : le refuser pour quelques caractères
    // reviendrait à envoyer des lignes sans dire ce qu'elles sont.
    reste -= entete.length + 1;
    morceaux.push(bloc);
    return retenues;
  }

  const nbRegles = ajouter(
    "RÈGLES DE CET ARTISAN — elles priment sur tes habitudes :",
    regles.map(formaterTerme),
    "Règle écartée"
  );

  const nbMots = ajouter(
    "VOCABULAIRE DE CET ARTISAN — emploie ces mots, et traite-les comme indiqué :",
    mots.map(formaterTerme),
    "Terme écarté"
  );

  // --- Puis ses corrections, comme preuves ---------------------------------
  const exemples = corrections.slice(0, MAX_EXEMPLES).map(formaterCorrection);
  const nbExemples = ajouter(
    "CE QU'IL A CORRIGÉ LES FOIS PRÉCÉDENTES — c'est sa façon de faire, reprends-la :",
    exemples,
    "Exemple écarté"
  );
  if (corrections.length > MAX_EXEMPLES) {
    ecartes.push(`${corrections.length - MAX_EXEMPLES} correction(s) plus ancienne(s), au-delà des ${MAX_EXEMPLES} retenues.`);
  }

  return {
    texte: morceaux.join("\n\n"),
    termesRetenus: nbRegles + nbMots,
    exemplesRetenus: nbExemples,
    ecartes,
  };
}

function formaterTerme(t: TermeMetier): string {
  const consigne = t.consigne?.trim();
  return `- « ${t.intitule.trim()} » : ${t.definition.trim()}${consigne ? ` → ${consigne}` : ""}`;
}

function formaterCorrection(c: CorrectionApprise): string {
  // Volontairement compact : ce qui enseigne, c'est l'ÉCART entre les deux, pas
  // le détail de chacun. Un exemple qui prend dix lignes chasse les autres du
  // budget sans rien apprendre de plus.
  const lignes = (l: { libelle: string; montant: string }[]) =>
    l.length === 0 ? "rien" : l.map((x) => `${x.libelle.trim()} ${x.montant} €`).join(" | ");
  return `- Dicté : « ${resume(c.dictee, 220)} »\n  Proposé : ${lignes(c.propose)}\n  Retenu par lui : ${lignes(c.retenu)}`;
}

function resume(texte: string, max = 70): string {
  const propre = texte.trim().replace(/\s+/g, " ");
  return propre.length <= max ? propre : `${propre.slice(0, max - 1)}…`;
}
