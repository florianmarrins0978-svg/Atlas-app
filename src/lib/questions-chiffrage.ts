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
  /** Ce que ça change, chiffré si possible — pour qu'il sache pourquoi on l'arrête. */
  pourquoi: string;
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

const TECHNIQUES: OptionReponse[] = [
  { valeur: "au_pied", libelle: "Abattage au pied" },
  { valeur: "demontage", libelle: "Démontage" },
  { valeur: "demontage_retention", libelle: "Démontage avec rétention" },
];

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
/** Mots qui désignent une haie qu'on taille. */
const HAIE = /\bhaie/i;

// Une quantité en mètres linéaires, sous les formes qu'une dictée produit :
// « 20 ml », « 20 m linéaires », « vingt mètres de long ».
const LONGUEUR = /(\bml\b|mètres?\s+linéaires?|m\s*linéaires?|de\s+long\b|longueur)/i;
const DIAMETRE = /\b(diamètre|diametre|⌀|Ø)\b/i;

/**
 * Le texte dit-il déjà ce qu'on s'apprête à demander ?
 *
 * Regarde le libellé, la description, la quantité ET l'unité : le modèle peut
 * ranger « 70 cm » dans l'un ou l'autre selon la phrase, et redemander une
 * information déjà donnée est le plus sûr moyen de rendre l'arrêt pénible.
 */
function contient(ligne: LignePourQuestions, motif: RegExp): boolean {
  return motif.test(
    [ligne.libelle, ligne.description ?? "", ligne.quantite ?? "", ligne.unite ?? ""].join(" ")
  );
}

export type LignePourQuestions = {
  libelle: string;
  description?: string | null;
  quantite?: string | null;
  unite?: string | null;
};

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
  dejaRepondu: ReadonlySet<string> = new Set()
): QuestionChiffrage[] {
  const questions: QuestionChiffrage[] = [];

  prestations.forEach((ligne, rang) => {
    const libelle = ligne.libelle.trim();
    if (!libelle) return;

    if (ABATTAGE.test(libelle)) {
      // La technique : c'est elle qui fait 600 ou 1 400 €. Une dictée ne la
      // contient à peu près jamais ; quand elle la contient, le modèle l'a
      // rangée dans le libellé, et `techniqueDeja` l'y trouve.
      if (!techniqueDeja(ligne)) {
        questions.push({
          id: `abattage.technique#${rang}`,
          libellePrestation: libelle,
          question: "Comment s'abat-il ?",
          pourquoi: "C'est ce qui pèse le plus : un démontage avec rétention vaut plus du double d'un abattage au pied.",
          options: TECHNIQUES,
          unite: null,
        });
      }

      // Le diamètre. La hauteur, elle, ne décide de rien — et c'est pourtant
      // elle que la dictée donne (« de vingt mètres de haut »). Ne pas la
      // confondre : demander « la taille » laisserait croire que la hauteur
      // suffit.
      if (!contient(ligne, DIAMETRE)) {
        questions.push({
          id: `abattage.diametre#${rang}`,
          libellePrestation: libelle,
          question: "Quel diamètre fait le tronc ?",
          pourquoi: "Le prix se compte au diamètre, pas à la hauteur — la hauteur dictée ne suffit pas.",
          options: null,
          unite: "cm",
        });
      }
      return;
    }

    if (HAIE.test(libelle) && !contient(ligne, LONGUEUR)) {
      questions.push({
        id: `haie.longueur#${rang}`,
        libellePrestation: libelle,
        question: "Quelle longueur de haie ?",
        pourquoi: "Une haie se chiffre au mètre linéaire.",
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
  if (id.startsWith("abattage.diametre")) return `⌀ ${valeur} ${unite ?? ""}`.trim();
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
