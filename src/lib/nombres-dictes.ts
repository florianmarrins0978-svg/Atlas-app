/**
 * Les nombres qu'un artisan prononce, tels qu'une transcription les écrit.
 *
 * **Le défaut, dans ses mots, le 9 août 2026 :** *« lorsque je remplis avec la
 * note vocale, si je ne dis pas "numéro de téléphone 0670…", il ne comprend pas
 * que c'est un numéro de téléphone. Il faut qu'il capte même si je ne précise
 * pas. »*
 *
 * **Ce que le diagnostic a montré, et qui n'était pas ce qu'on croyait.** Le
 * problème n'est pas l'annonce : la reconnaissance de forme ne l'a jamais
 * exigée. Le problème est que **le service de transcription écrit parfois les
 * chiffres en toutes lettres** — « zéro six douze trente-quatre cinquante-six
 * soixante-dix-huit » — et qu'aucune expression cherchant des chiffres ne peut
 * y voir un numéro. Quand il annonçait « numéro de téléphone », le modèle de
 * langue rattrapait ; sans l'annonce, plus personne ne rattrapait.
 *
 * Ce module rend donc les chiffres à ces mots-là, **avant** toute
 * reconnaissance de forme. Il ne devine rien : il traduit.
 */

/** Les mots qui valent un nombre, et leur valeur. */
const UNITES: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  vingts: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  // **« cent » est délibérément absent.** Aucun numéro de téléphone ne se dicte
  // en centaines, et l'accepter faisait écrire « mille deux cents » → « mille
  // 2100 ». Ce module sert à retrouver une forme, pas à réécrire le français :
  // ce qu'il ne sait pas traduire juste, il ne le traduit pas.
};

/** Sans accents ni majuscules : « Zéro » et « zero » sont le même mot. */
function sansAccent(mot: string): string {
  return mot
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * La valeur d'une suite de mots formant UN nombre, ou `null`.
 *
 * Traite les formes françaises composées : « dix-sept », « soixante-dix »,
 * « quatre-vingt-douze », « quatre-vingts ». Les tirets ont déjà été remplacés
 * par des espaces par l'appelant — une transcription les met ou non, selon les
 * jours, et s'en remettre à eux rendrait la lecture dépendante de l'humeur du
 * service.
 */
function valeurDesMots(mots: string[]): number | null {
  if (mots.length === 0) return null;

  let total = 0;
  let vu = false;
  // Vrai juste après « soixante-DIX » ou « quatre-vingt-DIX ». C'est ce qui
  // distingue « soixante-dix-huit » (78) de « soixante-dix » suivi d'un autre
  // nombre : dans le premier cas seulement, un 7, 8 ou 9 vient s'ajouter.
  let apresDix = false;

  for (let i = 0; i < mots.length; i++) {
    const mot = mots[i];

    // « quatre-vingt(s) » : la seule irrégularité qui se lit en deux mots.
    if (mot === "quatre" && (mots[i + 1] === "vingt" || mots[i + 1] === "vingts")) {
      // Derrière un nombre déjà complet, c'en est un AUTRE — pas une suite.
      // Sans ce refus, « soixante-dix quatre-vingts » faisait 150.
      if (vu) return null;
      total = 80;
      vu = true;
      apresDix = false;
      i++;
      continue;
    }

    const valeur = UNITES[mot];
    if (valeur === undefined) return null;

    // « soixante-dix » à « soixante-seize », « quatre-vingt-dix » à
    // « quatre-vingt-seize » : la dizaine prend un nombre de dix à seize.
    if ((total === 60 || total === 80) && valeur >= 10 && valeur <= 16) {
      apresDix = valeur === 10;
      total += valeur;
      continue;
    }

    // « dix-sept », « dix-huit », « dix-neuf ».
    if (total === 10 && !vuComplet(vu, total) && valeur >= 7 && valeur <= 9) {
      total += valeur;
      apresDix = false;
      continue;
    }

    // « soixante-dix-sept », « quatre-vingt-dix-neuf ».
    if (apresDix && valeur >= 7 && valeur <= 9) {
      total += valeur;
      apresDix = false;
      continue;
    }

    // Dizaine puis unité : « trente quatre », « quatre-vingt deux ».
    //
    // **70 et 90 en sont exclus, et ce n'est pas un détail.** Ils sont déjà
    // composés : leur ajouter une unité produirait « soixante-dix quatre-vingts »
    // → 74. Mesuré le 9 août 2026 sur une dictée réelle, qui donnait 062301010
    // au lieu de 0670809010 — un numéro faux, donc un client qu'on n'appelle
    // jamais. Les 77-79 passent par la règle `apresDix` ci-dessus.
    if (DIZAINES_A_UNITE.has(total) && valeur >= 1 && valeur <= 9) {
      total += valeur;
      apresDix = false;
      continue;
    }

    // Un nombre déjà complet suivi d'un autre : ce sont deux nombres, pas un.
    if (vu) return null;

    total = valeur;
    vu = true;
    apresDix = false;
  }

  return vu ? total : null;
}

/** `total === 10` peut venir du mot « dix » seul : il reste alors extensible. */
function vuComplet(vu: boolean, total: number): boolean {
  return vu && total !== 10;
}

/**
 * Combien de chiffres ce nombre occupe quand on le dicte dans une suite.
 *
 * **C'est la règle qui fait tout le travail.** Un numéro se dit par paires :
 * « zéro six / douze / trente-quatre » vaut 0, 6, 12, 34 et s'écrit
 * « 0612 34 ». Une valeur en dessous de dix occupe donc UN chiffre, une valeur
 * de dix à quatre-vingt-dix-neuf en occupe DEUX. Sans cela, « zéro six » ferait
 * « 06 » ou « 0 6 » selon l'implémentation, et le numéro serait faux d'un
 * chiffre — c'est-à-dire faux.
 */
function enChiffres(valeur: number): string {
  return valeur < 10 ? String(valeur) : String(valeur).padStart(2, "0");
}

/** Les dizaines qui acceptent une unité derrière elles. Ni 70 ni 90 : voir plus haut. */
const DIZAINES_A_UNITE = new Set([20, 30, 40, 50, 60, 80]);

/** Les liaisons qui traversent une suite de nombres sans la rompre. */
const LIAISONS = new Set(["et"]);

/**
 * Réécrit en chiffres les nombres dits en toutes lettres.
 *
 * Les suites de mots-nombres consécutifs sont **collées** : « zéro six douze
 * trente-quatre cinquante-six soixante-dix-huit » devient « 0612345678 ». C'est
 * ce qui permet à la reconnaissance de forme de voir un numéro là où elle ne
 * voyait qu'une phrase.
 *
 * **Ce que ce collage NE fait pas.** Il n'invente aucun chiffre et ne complète
 * rien : deux nombres séparés par un mot ordinaire restent séparés. « J'ai
 * abattu deux chênes de vingt mètres » donne « 2 chênes de 20 mètres » — jamais
 * « 220 ». Le reste du texte n'est pas touché.
 */
export function chiffrerNombresDictes(texte: string): string {
  if (!texte) return "";

  const morceaux = texte.split(/(\s+)/);
  const sortie: string[] = [];
  let i = 0;

  while (i < morceaux.length) {
    const brut = morceaux[i];
    if (/^\s+$/.test(brut)) {
      sortie.push(brut);
      i++;
      continue;
    }

    const suite = lireSuite(morceaux, i);
    if (suite) {
      sortie.push(suite.chiffres);
      i = suite.suivant;
      continue;
    }

    sortie.push(brut);
    i++;
  }

  return sortie.join("");
}

/** Un mot est-il un nombre, seul ou composé par des traits d'union ? */
function valeurDuMot(brut: string): number | null {
  const propre = sansAccent(brut.replace(/[.,;:!?]+$/, ""));
  if (/^\d+$/.test(propre)) return null; // traité à part : les chiffres se recopient
  const parties = propre.split(/[-‑–]/).filter(Boolean);
  if (parties.length === 0) return null;
  return valeurDesMots(parties);
}

/**
 * Lit, à partir de `depart`, la plus longue suite de nombres consécutifs.
 *
 * **Le trait d'union commande, quand il est là.** Une transcription qui écrit
 * « soixante-dix quatre-vingts quatre-vingt-dix » a déjà fait le découpage :
 * trois nombres, 70, 80, 90. Coller les mots par-dessus ce découpage produisait
 * « quatre-vingts quatre » → 84, et un numéro faux d'un bout à l'autre
 * (mesuré le 9 août 2026 : 067084201010 au lieu de 0670809010).
 *
 * Quand il n'y a **aucun** trait d'union dans la suite, la transcription n'a pas
 * découpé et il faut le faire : « zero six douze trente quatre cinquante six
 * soixante dix huit » n'a de sens qu'en recollant les mots deux à deux.
 *
 * Deux régimes, donc, et c'est la présence des tirets qui choisit — jamais une
 * préférence de notre part.
 */
function lireSuite(
  morceaux: string[],
  depart: number
): { chiffres: string; suivant: number } | null {
  // --- Premier passage : quels morceaux forment la suite ? -----------------
  const mots: string[] = [];
  let i = depart;
  let dernierUtile = depart;
  let avecTirets = false;

  while (i < morceaux.length) {
    const brut = morceaux[i];
    if (/^\s+$/.test(brut)) {
      i++;
      continue;
    }
    const propre = sansAccent(brut.replace(/[.,;:!?]+$/, ""));
    const estChiffres = /^\d+$/.test(propre);
    if (!estChiffres && valeurDuMot(brut) === null && !LIAISONS.has(propre)) break;
    if (!LIAISONS.has(propre)) {
      if (/[-‑–]/.test(propre)) avecTirets = true;
      mots.push(brut);
      dernierUtile = i + 1;
    }
    i++;
  }

  if (mots.length === 0) return null;

  // --- Second passage : les traduire ---------------------------------------
  const valeurs: string[] = [];

  if (avecTirets) {
    // La transcription a découpé : on la suit mot à mot.
    for (const mot of mots) {
      const propre = sansAccent(mot.replace(/[.,;:!?]+$/, ""));
      if (/^\d+$/.test(propre)) {
        valeurs.push(propre);
        continue;
      }
      const v = valeurDuMot(mot);
      if (v !== null) valeurs.push(enChiffres(v));
    }
  } else {
    // Aucun tiret : c'est à nous de recoller, en prenant le plus long nombre
    // possible à chaque pas.
    let enCours: string[] = [];
    const vider = () => {
      if (enCours.length === 0) return;
      const v = valeurDesMots(enCours);
      if (v !== null) valeurs.push(enChiffres(v));
      enCours = [];
    };
    for (const mot of mots) {
      const propre = sansAccent(mot.replace(/[.,;:!?]+$/, ""));
      if (/^\d+$/.test(propre)) {
        vider();
        valeurs.push(propre);
        continue;
      }
      const tentative = [...enCours, propre];
      if (valeurDesMots(tentative) !== null) enCours = tentative;
      else {
        vider();
        enCours = [propre];
      }
    }
    vider();
  }

  if (valeurs.length === 0) return null;
  return { chiffres: valeurs.join(""), suivant: dernierUtile };
}
