/**
 * Le téléphone : son pays, et ses espaces.
 *
 * **Demandé par le patron le 14 août 2026**, capture de l'écran à l'appui :
 * *« quelque chose d'un peu plus professionnel pour le téléphone, avec le
 * drapeau du pays qu'on peut changer, avec le +33. Et lorsqu'on écrit le
 * numéro, il se met exactement comme il faut avec les bons espacements. »*
 * Planche `maquettes/atlas-identite-saisie.html`.
 *
 * **Fonction pure, sans base ni écran** (`CLAUDE.md` §3) : l'écran affiche le
 * résultat, il ne décide de rien. C'est aussi ce qui permet d'éprouver
 * l'espacement de sept pays sans ouvrir un navigateur.
 *
 * ─── CE QUI EST STOCKÉ, ET POURQUOI PAS AUTRE CHOSE ────────────────────────
 *
 * Le numéro est rangé **tel qu'il s'écrit**, espaces compris : « 06 79 98 45 14 »
 * pour la France, « +32 471 12 34 56 » ailleurs. Deux raisons, et la seconde
 * a failli être oubliée :
 *
 *   1. c'est ce qui s'IMPRIME sur le devis et la facture. Ranger un format
 *      technique obligerait à le remettre en forme à chaque document — donc à
 *      écrire la règle une deuxième fois, ce que `CLAUDE.md` §3 interdit ;
 *   2. **la base contient déjà des numéros** (« 02 40 00 00 00 »). Changer de
 *      format aurait demandé une migration et rendu illisibles les documents
 *      déjà émis, qui gardent ce qu'ils portaient.
 *
 * L'indicatif n'a donc **pas de colonne à lui** : il se relit du numéro. Un
 * numéro qui commence par « + » porte son pays ; les autres sont français,
 * comme ils l'ont toujours été.
 */

export type PaysTelephone = {
  /** Code ISO, pour les clés de liste. */
  code: string;
  nom: string;
  /** Le drapeau, en un caractère — aucune image à charger. */
  drapeau: string;
  /** Avec le « + ». C'est ce que le patron lit quand il doute du drapeau. */
  indicatif: string;
  /**
   * La découpe du numéro, **sans son zéro de tête**, groupe par groupe.
   *
   * L'espacement français n'est pas universel : « 6 79 98 45 14 » en France,
   * « 471 12 34 56 » en Belgique. Écrire un numéro belge à la française le
   * rendrait méconnaissable à son propriétaire.
   *
   * **La découpe ignore le zéro parce qu'il n'appartient pas au numéro** : il
   * dit seulement qu'on compose depuis l'intérieur du pays, et il disparaît
   * devant l'indicatif. Le compter dans les groupes obligerait à deux tables —
   * une pour le national, une pour l'international — qui divergeraient.
   */
  groupes: number[];
  /**
   * Le zéro de tête, quand le pays en a un.
   *
   * Il se compose à l'intérieur du pays et **disparaît devant l'indicatif** :
   * « +33 6 79 … », jamais « +33 06 79 … ». C'est la faute la plus fréquente
   * sur les documents, et elle rend le numéro injoignable depuis l'étranger.
   */
  zeroNational: boolean;
};

/**
 * Sept pays, la France en tête.
 *
 * **La liste est courte à dessein.** Deux cents pays se parcourent mal quand on
 * en emploie un ; ceux-ci couvrent la France, ses voisins francophones et les
 * deux pays d'où viennent le plus d'artisans du bâtiment. Elle s'allongera s'il
 * le demande — c'est une ligne à ajouter.
 */
export const PAYS_TELEPHONE: readonly PaysTelephone[] = [
  { code: "FR", nom: "France", drapeau: "🇫🇷", indicatif: "+33", groupes: [1, 2, 2, 2, 2], zeroNational: true },
  { code: "BE", nom: "Belgique", drapeau: "🇧🇪", indicatif: "+32", groupes: [3, 2, 2, 2], zeroNational: true },
  { code: "CH", nom: "Suisse", drapeau: "🇨🇭", indicatif: "+41", groupes: [2, 3, 2, 2], zeroNational: true },
  { code: "LU", nom: "Luxembourg", drapeau: "🇱🇺", indicatif: "+352", groupes: [3, 3, 3], zeroNational: false },
  { code: "ES", nom: "Espagne", drapeau: "🇪🇸", indicatif: "+34", groupes: [3, 2, 2, 2], zeroNational: false },
  { code: "PT", nom: "Portugal", drapeau: "🇵🇹", indicatif: "+351", groupes: [3, 3, 3], zeroNational: false },
  { code: "MA", nom: "Maroc", drapeau: "🇲🇦", indicatif: "+212", groupes: [1, 2, 2, 2, 2], zeroNational: true },
] as const;

/** Le pays par défaut. Il s'applique à tout numéro sans indicatif. */
export const PAYS_PAR_DEFAUT = PAYS_TELEPHONE[0];

export function paysParCode(code: string): PaysTelephone {
  return PAYS_TELEPHONE.find((p) => p.code === code) ?? PAYS_PAR_DEFAUT;
}

/** Les chiffres, et rien d'autre. */
function chiffres(valeur: string): string {
  return valeur.replace(/\D/g, "");
}

/**
 * Sépare un numéro rangé en base : son pays, et ses chiffres nationaux.
 *
 * **L'indicatif le plus LONG gagne**, et ce n'est pas un détail : « +33 » et
 * « +352 » commencent pareil au troisième caractère près. Comparer dans
 * l'ordre de la liste ferait lire un numéro luxembourgeois comme français, et
 * l'espacement suivrait la mauvaise règle.
 */
export function analyserTelephone(valeur: string | null | undefined): {
  pays: PaysTelephone;
  national: string;
} {
  const brut = (valeur ?? "").trim();
  if (brut.startsWith("+")) {
    const tous = [...PAYS_TELEPHONE].sort((a, b) => b.indicatif.length - a.indicatif.length);
    const num = chiffres(brut);
    for (const p of tous) {
      const ind = chiffres(p.indicatif);
      if (num.startsWith(ind)) return { pays: p, national: num.slice(ind.length) };
    }
    // Un indicatif qu'on ne connaît pas : on garde les chiffres et on ne
    // prétend pas savoir de quel pays il s'agit. Inventer un pays reviendrait à
    // réécrire son numéro à sa place.
    return { pays: PAYS_PAR_DEFAUT, national: num };
  }
  const num = chiffres(brut);
  // Le zéro de tête est un zéro NATIONAL : il ne fait pas partie du numéro, il
  // dit qu'on compose depuis l'intérieur du pays.
  return {
    pays: PAYS_PAR_DEFAUT,
    national: PAYS_PAR_DEFAUT.zeroNational && num.startsWith("0") ? num.slice(1) : num,
  };
}

/** La découpe brute, employée par les deux affichages — national et étranger. */
function decouper(pays: PaysTelephone, num: string): string[] {
  const morceaux: string[] = [];
  let reste = num;
  for (const taille of pays.groupes) {
    if (reste === "") break;
    morceaux.push(reste.slice(0, taille));
    reste = reste.slice(taille);
  }
  // Ce qui dépasse la découpe connue reste écrit, en bloc : un numéro plus long
  // que prévu doit pouvoir se saisir. Le tronquer effacerait des chiffres sous
  // les doigts de celui qui les tape.
  if (reste !== "") morceaux.push(reste);
  return morceaux;
}

/**
 * Pose les espaces au fur et à mesure de la frappe.
 *
 * **Elle doit accepter un numéro incomplet**, sinon l'espacement n'apparaîtrait
 * qu'au dernier chiffre — et le patron taperait dix chiffres collés en croyant
 * que ça ne marche pas.
 */
export function formaterNational(pays: PaysTelephone, national: string): string {
  const num = chiffres(national);
  if (num === "") return "";
  const morceaux = decouper(pays, num);
  // Le zéro se colle au PREMIER GROUPE, il ne fait pas groupe à lui seul :
  // « 06 79 … », jamais « 0 6 79 … ».
  if (pays.zeroNational) morceaux[0] = "0" + morceaux[0];
  return morceaux.join(" ");
}

/**
 * Ce qui part en base, et donc ce qui s'imprime.
 *
 * France : le format national, celui qu'on lit partout ici. Ailleurs :
 * l'indicatif puis le numéro **sans son zéro**, parce que c'est ainsi qu'on le
 * compose depuis la France.
 */
export function composerTelephone(pays: PaysTelephone, national: string): string {
  const num = chiffres(national);
  if (num === "") return "";
  if (pays.code === PAYS_PAR_DEFAUT.code) return formaterNational(pays, num);
  return `${pays.indicatif} ${decouper(pays, num).join(" ")}`;
}

/** Ce que l'écran montre dans le champ, pays mis à part. */
export function afficherTelephone(valeur: string | null | undefined): {
  pays: PaysTelephone;
  affiche: string;
} {
  const { pays, national } = analyserTelephone(valeur);
  return { pays, affiche: formaterNational(pays, national) };
}
