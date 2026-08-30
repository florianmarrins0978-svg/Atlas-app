// Les questions qui coûtent de l'argent — et elles seules.
//
// **La règle, confirmée par le patron le 6 août 2026** (`docs/EXEMPLE-DICTEE.md`
// §7) : une information qui **change le prix** se demande *avant* de chiffrer ;
// une ambiguïté qui ne le change pas se **signale sur le devis**, sans
// interrompre.
//
// Elle réconcilie deux réponses qu'il avait données à une heure d'intervalle —
// « pose-moi toutes les questions » et « donne-moi le devis avec les trous
// signalés ». Les deux ne portaient pas sur la même chose.
//
// **Pourquoi ça compte, sur sa propre dictée.** Il a dicté « un chêne mort à
// abattre, de vingt mètres de haut ». L'abattage vaut, chez lui :
//
//   au pied 600 € · démontage 1 000 € · démontage avec rétention 1 400 €
//
// Ce qui décide, c'est la **technique** et le **diamètre du tronc**. Sa dictée
// donne la *hauteur*, qui ne décide de rien, et ne dit pas la technique. Un
// agent qui chiffre sans demander se trompe **du simple au double**, et un
// devis faux de 800 € ne se rattrape pas par une petite mention en bas de page.
//
// **La limite à ne pas franchir.** `docs/AGENT.md` §2 : l'arrêt doit rester
// « franchissable en quelques secondes ». On ne pose donc pas dix questions —
// on pose celles qui portent de l'argent. Ce module a autant pour rôle de
// **taire** les autres que de poser celles-là.

import { diametreLu, hauteurLue } from "./mesures-arbre";
import { TECHNIQUES_PAR_DEFAUT, type Technique } from "./grille-prix";

/** Une réponse proposée, quand la question se referme sur un choix connu. */
export type OptionReponse = {
  valeur: string;
  /** Ce que le patron lit. */
  libelle: string;
};

export type QuestionChiffrage = {
  /**
   * Identifiant stable de la question, `<sujet>#<rang>` — il sert de clé de
   * persistance. Stable veut dire : la même question, sur le même chantier,
   * doit retrouver la réponse déjà donnée après un rechargement ou une
   * relecture de la dictée. Le rang distingue deux arbres dans une même note.
   */
  id: string;
  /** De quelle ligne on parle, mot pour mot depuis la dictée. */
  libellePrestation: string;
  question: string;
  /** Choix fermé, ou `null` quand la réponse est un nombre à saisir. */
  options: OptionReponse[] | null;
  /** Unité attendue quand la réponse est un nombre (`null` pour un choix). */
  unite: string | null;
};

// --- Le métier, tel qu'il l'a dicté --------------------------------------
//
// Ces règles ne sont PAS un barème : elles ne disent aucun prix, seulement
// **quelle information manque pour en établir un**. Les montants, eux,
// viennent de ses tarifs et de sa mémoire — voir `docs/EXEMPLE-DICTEE.md` §9,
// et notamment §9c : tant que la mémoire est vide, l'agent demande le prix
// plutôt que d'en fabriquer un.

/** Mots qui désignent un arbre qu'on abat ou qu'on démonte. */
const ABATTAGE = /\b(abattage|abattre|abatt|démont|demont|dessouch)/i;

/**
 * La technique est-elle DÉJÀ dite ?
 *
 * **Le piège, et il a mordu.** La première version cherchait le premier mot de
 * chaque technique — dont « Abattage ». « Abattage d'un chêne mort » comptait
 * donc comme une technique déclarée, et la question qui vaut 800 € n'était
 * jamais posée : exactement le défaut que ce module existe pour empêcher, dans
 * le module lui-même.
 *
 * « Abattage » est le mot **générique** du métier, pas une technique.
 * La technique, c'est ce qui suit : au pied, démontage, avec rétention.
 */
function techniqueDeja(ligne: LignePourQuestions): boolean {
  return /\b(au\s+pied|démont|demont|rétention|retention)/i.test(
    [ligne.libelle, ligne.description ?? ""].join(" ")
  );
}
/**
 * Mots qui désignent une SOUCHE, c'est-à-dire un arbre DÉJÀ abattu.
 *
 * **Sa remarque du 30 août 2026, et elle corrige une incohérence que nous
 * n'avions pas vue :** *« lorsque l'on parle de souche, ça sous-entend que
 * l'arbre a déjà été abattu et qu'il ne reste que les racines à enlever — donc
 * s'il n'y a pas d'arbre, pourquoi il y a la question de comment on l'abat ? »*
 *
 * L'écran demandait « Comment s'abat-il ? » sur une ligne « Dessouchage — deux
 * souches de 60 cm ». La faute vient d'un raccourci : le dessouchage avait été
 * rangé avec l'abattage **pour ne pas redemander le diamètre du même tronc**
 * (voir `abattageDansLaDictee` plus bas), et la question de la technique a
 * suivi le raccourci sans que personne y regarde. Le regroupement reste juste
 * pour le diamètre ; il est faux pour la technique.
 *
 * Aucun test ne pouvait le dire : la question était **posée**, elle était
 * lisible, et son identifiant était stable. Elle n'avait simplement aucun sens.
 */
const DESSOUCHAGE = /\b(dessouch|souche)/i;

function estDessouchage(ligne: LignePourQuestions): boolean {
  const cle = ligne.nature?.trim();
  if (cle) return cle === "dessouchage";
  return DESSOUCHAGE.test(ligne.libelle);
}

/** Mots qui désignent une haie qu'on taille. */
const HAIE = /\bhaie/i;

// Une quantité en mètres linéaires, sous les formes qu'une dictée produit :
// « 20 ml », « 20 m linéaires », « vingt mètres de long ».
const LONGUEUR = /(\bml\b|mètres?\s+linéaires?|m\s*linéaires?|de\s+long\b|longueur)/i;

/** Ce qu'on fend : le bois d'un arbre abattu, que le client peut refuser. */
const FENDAGE = /\b(fend|fente)/i;

/**
 * Le texte dit-il déjà ce qu'on s'apprête à demander ?
 *
 * Regarde le libellé, la description, la quantité ET l'unité : le modèle peut
 * ranger « 70 cm » dans l'un ou l'autre selon la phrase, et redemander une
 * information déjà donnée est le plus sûr moyen de rendre l'arrêt pénible.
 */
function contient(ligne: LignePourQuestions, motif: RegExp): boolean {
  return motif.test(toutLeTexte(ligne));
}

function toutLeTexte(ligne: LignePourQuestions): string {
  return [ligne.libelle, ligne.description ?? "", ligne.quantite ?? "", ligne.unite ?? ""].join(" ");
}

/**
 * Une mesure n'est acquise que si elle porte un NOMBRE.
 *
 * La première version se contentait de voir le mot « diamètre » quelque part.
 * « Diamètre à préciser sur place » comptait donc pour une réponse, et la
 * question qui vaut 800 € n'était jamais posée. Le même vocabulaire que le
 * chiffrage (`src/lib/mesures-arbre.ts`) — deux lectures divergentes feraient
 * poser une question déjà répondue, ou l'inverse.
 */
function contientDiametre(ligne: LignePourQuestions): boolean {
  return diametreLu(toutLeTexte(ligne)) !== null;
}

function contientHauteur(ligne: LignePourQuestions): boolean {
  return hauteurLue(toutLeTexte(ligne)) !== null;
}

export type LignePourQuestions = {
  libelle: string;
  description?: string | null;
  quantite?: string | null;
  unite?: string | null;
  /**
   * Sa nature métier, quand elle est connue (colonne ou dictée).
   *
   * **Elle passe AVANT le texte** depuis le 27 août 2026 : « Intervention chez
   * Mme Martin » ne ressemble à rien et peut parfaitement être une taille de
   * haie. Absente, les motifs ci-dessus reprennent la main — c'est le cas des
   * prestations d'avant, et des dictées lues mot à mot.
   */
  nature?: string | null;
};

/**
 * Cette ligne parle-t-elle de ce travail-là ?
 *
 * **Un seul endroit où l'on choisit entre la colonne et le texte.** Le laisser
 * à chaque appel ferait diverger les trois questions au premier ajustement.
 */
function estDeNature(ligne: LignePourQuestions, cles: readonly string[], motif: RegExp): boolean {
  const cle = ligne.nature?.trim();
  if (cle) return cles.includes(cle);
  return motif.test(ligne.libelle);
}

/**
 * Les questions à poser avant de chiffrer, dans l'ordre des prestations.
 *
 * Fonction pure : aucune base, aucun réseau, aucune date. Elle se joue sur la
 * dictée de référence (`docs/EXEMPLE-DICTEE.md`) dans
 * `scripts/test-questions-chiffrage.ts`.
 *
 * `dejaRepondu` porte les identifiants déjà renseignés sur ce chantier : une
 * question à laquelle il a répondu ne revient jamais, y compris après une
 * relecture de la dictée. C'est ce qui empêche l'arrêt de se rouvrir tout seul.
 */
export function questionsAvantChiffrage(
  prestations: LignePourQuestions[],
  dejaRepondu: ReadonlySet<string> = new Set(),
  /**
   * Les façons d'abattre de l'entreprise. Les valeurs de départ quand on ne les
   * a pas sous la main — c'est le cas des suites pures, jamais du produit :
   * `devis-depuis-dictee.ts` passe les siennes.
   */
  techniques: readonly Technique[] = TECHNIQUES_PAR_DEFAUT
): QuestionChiffrage[] {
  // **Les façons d'abattre viennent de SES grilles depuis le 14 août 2026.**
  // Il peut en ajouter une (`tranches_grille`, axe `technique`), et une
  // question qui continuerait à proposer les trois d'origine laisserait sa
  // quatrième rangée vide pour toujours : la case existerait, rien ne pourrait
  // jamais la désigner. C'est la règle dupliquée que `CLAUDE.md` §3 interdit.
  const questions: QuestionChiffrage[] = [];
  const optionsTechnique: OptionReponse[] = techniques.map((t) => ({
    valeur: t.cle,
    libelle: t.libelle[0].toUpperCase() + t.libelle.slice(1),
  }));

  // Le diamètre appartient à l'ARBRE, pas à la ligne de devis. Quand un
  // abattage est dicté, c'est lui qui porte la question — la demander une
  // seconde fois pour la fente ferait répondre deux fois la même chose sur le
  // même tronc, et l'arrêt doit rester franchissable en quelques secondes.
  // Le dessouchage compte comme un abattage POUR LA QUESTION : le diamètre est
  // celui du même tronc, et le redemander ferait répondre deux fois la même
  // chose. C'est pourquoi cette liste ne se confond pas avec le référentiel.
  const abattageDansLaDictee = prestations.some((l) => estDeNature(l, ["abattage", "dessouchage"], ABATTAGE));

  // La hauteur aussi appartient à l'arbre, et la dictée la donne souvent sur la
  // ligne de l'abattage — *« un chêne mort de vingt mètres de haut »*. La
  // redemander sur la ligne de la fente serait faire répéter au patron ce qu'il
  // vient de dire.
  //
  // **Ce n'est tenable que parce que le chiffrage lit les mêmes textes.**
  // `preparerPropositionPrix` passe les lignes de la dictée — libellés ET
  // descriptions — à `mesuresArbre`. Si l'un des deux lisait moins que l'autre,
  // la question serait tue et la case de la grille resterait introuvable : la
  // fente n'aurait jamais de prix, sans qu'aucune erreur ne le signale.
  const hauteurDansLaDictee = prestations.some((l) => contientHauteur(l));

  prestations.forEach((ligne, rang) => {
    const libelle = ligne.libelle.trim();
    if (!libelle) return;

    // --- La fente : hauteur ET diamètre, parce que c'est du VOLUME ---------
    //
    // Le patron, le 8 août 2026 : *« pour la fente ils devraient demander la
    // hauteur de l'arbre et son diamètre, et on crée une liste de prix en
    // fonction de la hauteur et du diamètre, comme ça il n'invente rien. »*
    //
    // Les deux mesures, et pas une : le volume d'un tronc va comme le carré du
    // diamètre multiplié par la hauteur. Un chêne de 60 cm fait quatre fois le
    // bois d'un chêne de 30 cm à hauteur égale — et c'est ce bois-là qu'on fend.
    if (estDeNature(ligne, ["fendage"], FENDAGE)) {
      if (!hauteurDansLaDictee) {
        questions.push({
          id: `fendage.hauteur#${rang}`,
          libellePrestation: libelle,
          question: "Quelle hauteur fait l'arbre ?",
          options: null,
          unite: "m",
        });
      }
      if (!contientDiametre(ligne) && !abattageDansLaDictee) {
        questions.push({
          id: `fendage.diametre#${rang}`,
          libellePrestation: libelle,
          question: "Quel diamètre fait le tronc ?",
          options: null,
          unite: "cm",
        });
      }
      return;
    }

    if (estDeNature(ligne, ["abattage", "dessouchage"], ABATTAGE)) {
      // **Une souche n'a plus d'arbre : on ne demande pas comment on l'abat.**
      // Sa remarque du 30 août 2026 — voir `DESSOUCHAGE` plus haut.
      const souche = estDessouchage(ligne);

      // La technique : c'est elle qui fait 600 ou 1 400 €. Une dictée ne la
      // contient à peu près jamais ; quand elle la contient, le modèle l'a
      // rangée dans le libellé, et `techniqueDeja` l'y trouve.
      if (!souche && !techniqueDeja(ligne)) {
        questions.push({
          id: `abattage.technique#${rang}`,
          libellePrestation: libelle,
          question: "Comment s'abat-il ?",
          options: optionsTechnique,
          unite: null,
        });
      }

      // Le diamètre, lui, se demande dans les deux cas : c'est le même tronc,
      // au ras du sol. La hauteur, elle, ne décide de rien — et c'est pourtant
      // elle que la dictée donne (« de vingt mètres de haut »). Ne pas la
      // confondre : demander « la taille » laisserait croire que la hauteur
      // suffit.
      if (!contientDiametre(ligne)) {
        questions.push({
          id: `${souche ? "dessouchage" : "abattage"}.diametre#${rang}`,
          libellePrestation: libelle,
          question: souche ? "Quel diamètre fait la souche ?" : "Quel diamètre fait le tronc ?",
          options: null,
          unite: "cm",
        });
      }
      return;
    }

    if (estDeNature(ligne, ["haie"], HAIE) && !contient(ligne, LONGUEUR)) {
      questions.push({
        id: `haie.longueur#${rang}`,
        libellePrestation: libelle,
        question: "Quelle longueur de haie ?",
        options: null,
        unite: "ml",
      });
    }
  });

  return questions.filter((q) => !dejaRepondu.has(q.id));
}

/**
 * Ce que la réponse ajoute au libellé de la prestation, pour le devis.
 *
 * Le client doit lire ce qui a été décidé — « Abattage du chêne mort —
 * démontage avec rétention, ⌀ 70 cm » —, pas seulement ce qui a été dicté. Une
 * précision obtenue puis rangée dans un coin de la base n'aurait servi à rien.
 */
export function precisionLisible(question: QuestionChiffrage, valeur: string): string {
  return precisionLisibleParId(question.id, question.options, question.unite, valeur);
}

function precisionLisibleParId(
  id: string,
  options: OptionReponse[] | null,
  unite: string | null,
  valeur: string
): string {
  if (options) {
    const choisie = options.find((o) => o.valeur === valeur);
    return (choisie?.libelle ?? valeur).toLowerCase();
  }
  // **Ces formulations sont relues par la machine autant que par le client.**
  // `mesures-arbre.ts` doit y retrouver le nombre pour désigner la case de la
  // grille : « ⌀ 45 cm » et « 12 m de haut » sont exactement les deux formes
  // qu'il sait lire. Les changer sans le prévenir casserait le chiffrage du
  // fendage en silence — sans erreur, avec seulement une case qui ne se trouve
  // plus.
  //
  // **Le suffixe, jamais le préfixe.** `prestation-structuree.ts` lit déjà ces
  // sujets par leur fin (`.diametre`, `.hauteur`) ; une liste de préfixes tenue
  // ici en parallèle laissait `dessouchage.diametre` sortir sans son ⌀ le jour
  // où il est né — et `mesures-arbre.ts` n'y aurait plus retrouvé le nombre.
  const sujet = id.split("#")[0];
  if (sujet.endsWith(".diametre")) {
    return `⌀ ${valeur} ${unite ?? ""}`.trim();
  }
  if (sujet.endsWith(".hauteur")) return `${valeur} ${unite ?? "m"} de haut`.trim();
  return `${valeur} ${unite ?? ""}`.trim();
}

/**
 * Le libellé de la prestation, augmenté de ce qu'il a répondu.
 *
 *     Abattage d'un chêne mort — démontage avec rétention, ⌀ 70 cm
 *
 * **Sans ça, l'arrêt ne laisserait aucune trace visible.** Une précision
 * obtenue puis rangée dans un coin de la base ne changerait rien à ce qu'il
 * relit, et la question aurait été posée pour rien.
 *
 * **Ce que ça ne fait PAS, et il faut le savoir en lisant ce code :** la
 * précision n'atteint pas encore la *ligne du devis*. Cette ligne porte
 * l'intitulé du tarif appliqué, pas le libellé de la prestation. Et elle ne
 * change pas non plus le montant — par la règle du patron lui-même
 * (`docs/EXEMPLE-DICTEE.md` §9c) : tant qu'aucun rapport n'a été observé entre
 * les techniques et les prix, l'agent **demande** le prix plutôt que d'en
 * fabriquer un. Ce qui manque est la mémoire, pas ce module. Voir `TODO.md` §0 ter.
 *
 * Idempotent : rejouer l'enchaînement ne recolle pas une seconde fois la même
 * mention. Le patron rejoue souvent, et un libellé qui s'allonge à chaque essai
 * finirait sur le devis du client.
 */
export function libelleEnrichi(libelle: string, precisionsLisibles: readonly string[]): string {
  const base = libelle.trim();
  const aAjouter = precisionsLisibles
    .map((p) => p.trim())
    .filter((p) => p !== "" && !base.toLowerCase().includes(p.toLowerCase()));
  if (aAjouter.length === 0) return base;
  return `${base} — ${aAjouter.join(", ")}`;
}
