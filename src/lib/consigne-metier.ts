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
 * **Porté de 6 000 à 9 000 le 9 août 2026, sur une mesure et non sur une
 * intuition.** Les six mille d'origine étaient un ordre de grandeur choisi à
 * vide, quand le vocabulaire tenait en une dizaine de termes. Le jour où les
 * devis réels du confrère en ont apporté vingt-quatre, le compte a été fait :
 * dire tout ce que le dépôt sait coûte **8 512 caractères**, et le budget en
 * écartait **douze termes sur vingt-sept**. Ajouter du vocabulaire à un
 * document dont la moitié ne part jamais, c'est faire semblant de l'ajouter.
 *
 * Neuf mille, et pas davantage, parce qu'il faut un point de comparaison :
 * la consigne d'extraction générique fait à elle seule environ 7 300
 * caractères. Ce que CET artisan a appris à Atlas n'a aucune raison de peser
 * moins que l'instruction générique qu'il vient corriger — mais pas non plus
 * de l'écraser d'un ordre de grandeur.
 *
 * Le garde-fou n'est pas levé pour autant, il est recalé : quand le
 * vocabulaire dépassera neuf mille à son tour, il écartera de nouveau — par
 * ordre d'importance, et **en disant ce qu'il écarte**.
 */
export const BUDGET_CARACTERES = 9000;

/** Au-delà, les exemples se répètent plus qu'ils n'enseignent. */
export const MAX_EXEMPLES = 5;

/**
 * La part du budget tenue en réserve pour SES corrections.
 *
 * **Ajouté le 9 août 2026, sur un défaut mesuré et non supposé.** Ce jour-là,
 * vingt-quatre termes tirés de devis réels sont entrés dans le vocabulaire. La
 * consigne est passée à 6 044 caractères, et le compte a été fait : quinze
 * termes retenus sur vingt-six, et **zéro exemple sur cinq**. Les mots avaient
 * mangé la place de ses corrections.
 *
 * C'était une régression franche. Un vocabulaire est écrit une fois par
 * l'éditeur pour tous les artisans ; une correction est ce que CE patron a
 * changé de sa main sur SON devis. Sa phrase du 7 août : *« le mieux, c'est que
 * je fasse plein de devis et que tu enregistres toutes mes modifications, et
 * dans un mois tu sauras les remplir tout seul. »* Une mécanique qui jette ces
 * modifications-là pour faire tenir la définition de « jumelle » travaille
 * contre lui.
 *
 * La réserve n'est pas rendue aux mots quand elle sert : elle leur revient
 * seulement s'il n'y a **aucune** correction à envoyer — un artisan qui débute
 * n'a rien corrigé encore, et sa consigne n'a aucune raison d'être plus courte.
 */
export const PART_RESERVEE_CORRECTIONS = 0.25;

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
      // **L'en-tête est payé D'AVANCE, avec la première ligne du bloc.**
      //
      // Il était compté après coup, au motif qu'un bloc sans titre n'apprend
      // rien. L'intention était juste, le calcul non : trois blocs faisaient
      // dépasser le budget de leurs trois en-têtes. Mesuré le 9 août 2026 sur
      // les données réelles — 6 020 caractères pour un budget de 6 000.
      //
      // Le contrôle qui l'affirmait passait, et pour une mauvaise raison : avec
      // deux cents termes il épuisait le budget dès le premier bloc, si bien
      // que les en-têtes suivants n'existaient pas. Un scénario extrême cachait
      // le cas ordinaire (`CLAUDE.md` §5 — un contrôle jamais vu rouge ne
      // prouve rien).
      //
      // Payer d'avance garde l'intention — un bloc retenu a toujours son titre
      // — et rend le budget vrai.
      const coutEntete = gardees.length === 0 ? entete.length + 1 : 0;
      // +1 pour le saut de ligne qui la séparera de la suivante.
      if (coutEntete + ligne.length + 1 > reste) {
        ecartes.push(`${quoi} : « ${resume(ligne)} »`);
        continue;
      }
      gardees.push(ligne);
      reste -= coutEntete + ligne.length + 1;
      retenues++;
    }
    if (gardees.length === 0) return 0;
    morceaux.push(`${entete}\n${gardees.join("\n")}`);
    return retenues;
  }

  const nbRegles = ajouter(
    "RÈGLES DE CET ARTISAN — elles priment sur tes habitudes :",
    regles.map(formaterTerme),
    "Règle écartée"
  );

  // **Les mots ne peuvent pas prendre toute la place restante.** Une réserve
  // est mise de côté pour ses corrections avant qu'ils ne se servent — sans
  // elle, vingt-quatre définitions suffisent à les faire toutes disparaître,
  // ce qui a été mesuré le 9 août 2026 (voir `PART_RESERVEE_CORRECTIONS`).
  //
  // La réserve ne s'applique que s'il y a quelque chose à réserver : sans
  // correction enregistrée, rien ne justifie d'amputer le vocabulaire.
  const exemples = corrections.slice(0, MAX_EXEMPLES).map(formaterCorrection);
  const reserve = exemples.length > 0 ? Math.floor(budget * PART_RESERVEE_CORRECTIONS) : 0;
  const disponiblePourLesMots = Math.max(0, reste - reserve);
  const misDeCote = reste - disponiblePourLesMots;
  reste = disponiblePourLesMots;

  const nbMots = ajouter(
    "VOCABULAIRE DE CET ARTISAN — emploie ces mots, et traite-les comme indiqué :",
    mots.map(formaterTerme),
    "Terme écarté"
  );

  // --- Puis ses corrections, comme preuves ---------------------------------
  //
  // La réserve leur revient, augmentée de ce que les mots n'ont pas consommé.
  reste += misDeCote;
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
  // Même neutralisation que les corrections : ces termes sont écrits par
  // l'éditeur, mais ils voyagent dans le même bloc et une seule brèche suffit.
  const consigne = t.consigne?.trim();
  return `- « ${neutraliser(t.intitule, 80)} » : ${neutraliser(t.definition, 200)}${
    consigne ? ` → ${neutraliser(consigne, 200)}` : ""
  }`;
}

/**
 * **CE QUI ENTRE ICI EST ÉCRIT PAR DES HUMAINS, ET SE NEUTRALISE** — lot de
 * clôture, 29 août 2026.
 *
 * Les libellés de lignes de devis partaient **entiers et bruts** dans le bloc
 * envoyé au modèle. Or un libellé peut venir de `copier_ligne_devis`,
 * c'est-à-dire du devis d'un autre client, lui-même issu d'un texte collé ou
 * d'une dictée. Sur plusieurs lignes, il pouvait ouvrir ce qui ressemblait à
 * une nouvelle section de consigne.
 *
 * Deux gestes, et ils sont structurels plutôt que persuasifs :
 *
 *   1. **les retours à la ligne et les chevrons disparaissent** — un libellé
 *      ne peut plus fabriquer de ligne à lui, ni forger la balise qui délimite
 *      le bloc ;
 *   2. **il est tronqué** comme la dictée l'était déjà. Un libellé de deux
 *      mille caractères noyait les autres exemples sans rien apprendre de plus.
 */
function neutraliser(texte: string, max: number): string {
  return resume(texte.replace(/[\r\n<>]+/g, " "), max);
}

function formaterCorrection(c: CorrectionApprise): string {
  // Volontairement compact : ce qui enseigne, c'est l'ÉCART entre les deux, pas
  // le détail de chacun. Un exemple qui prend dix lignes chasse les autres du
  // budget sans rien apprendre de plus.
  const lignes = (l: { libelle: string; montant: string }[]) =>
    l.length === 0
      ? "rien"
      : l.map((x) => `${neutraliser(x.libelle, 80)} ${neutraliser(x.montant, 20)} €`).join(" | ");
  return `- Dicté : « ${neutraliser(c.dictee, 220)} »\n  Proposé : ${lignes(c.propose)}\n  Retenu par lui : ${lignes(c.retenu)}`;
}

function resume(texte: string, max = 70): string {
  const propre = texte.trim().replace(/\s+/g, " ");
  return propre.length <= max ? propre : `${propre.slice(0, max - 1)}…`;
}
