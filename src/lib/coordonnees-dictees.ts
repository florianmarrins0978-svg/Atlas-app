/**
 * Ce qu'on retient d'une phrase dictée pour remplir la fiche d'un client.
 *
 * Le patron, le 7 août 2026 : *« à côté de "Un chantier", à droite, je veux une
 * petite touche discrète, juste le signe de la note vocale, pour que je puisse
 * appuyer dessus et parler pour remplir les infos du client si j'ai pas envie de
 * les écrire. »*
 *
 * **La règle qui prime : ne jamais inventer.** Un champ dont la dictée ne dit
 * rien reste vide (`docs/AGENT.md` §3). Un numéro de téléphone deviné, une
 * adresse complétée « au plus probable », et c'est un devis qui part chez la
 * mauvaise personne — ou un artisan qui se déplace à la mauvaise rue.
 *
 * **Pourquoi c'est déterministe, et pas confié à un modèle.** Un téléphone et
 * un e-mail ont une forme ; les reconnaître ne demande pas de comprendre la
 * phrase. Le faire ici plutôt que de le demander à un fournisseur, c'est un
 * aller-retour de moins, une dépense de moins, et surtout **un contrôle qui
 * peut échouer** : on peut donner à cette fonction n'importe quelle phrase et
 * vérifier ce qu'elle en tire. Le nom et l'adresse, eux, demandent de la
 * langue : ils restent au modèle, et cette fonction se contente de nettoyer ce
 * qu'il rend.
 */
import { chiffrerNombresDictes } from "./nombres-dictes";
import { detacherCivilite, type Civilite } from "./civilite";

export type CoordonneesDictees = {
  nom: string | null;
  /**
   * La pastille que le mot dicté désigne, ou `null` s'il n'en a dit aucun.
   *
   * **Sa demande du 7 septembre 2026 :** *« il ne faut jamais qu'il y ait
   * marqué monsieur, madame ou quoi que ce soit d'autre à part le nom dans
   * cette case-là »*, et le mot entendu doit sélectionner la pastille du haut.
   * Le mot n'est donc pas jeté : il change de champ.
   */
  civilite: Civilite | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
};

/**
 * Le téléphone, tel qu'une transcription l'écrit.
 *
 * Un service de transcription rend « zéro six douze trente-quatre » en chiffres,
 * mais avec des espaces, des points ou des tirets selon les jours — et parfois
 * un indicatif. On accepte donc les séparateurs, et on rend un numéro **sans
 * espaces** : c'est sous cette forme qu'un lien `sms:` fonctionne, et l'oublier
 * a déjà ouvert une messagerie vide chez le patron (le 5 août 2026).
 */
/**
 * **`0033` passe AVANT `0`, et l'ordre n'est pas cosmétique.** Une alternance
 * essaie ses branches de gauche à droite : avec `0` en premier, « 0033 6 12 34
 * 56 78 » se lisait à partir du deuxième zéro et rendait **0336123456** — dix
 * chiffres, l'air d'un numéro, et pas celui du client. Un numéro faux mais
 * crédible est pire qu'un champ vide : personne ne le corrige (mesuré le 9 août
 * 2026).
 *
 * Les bornes `(?<!\d)` et `(?!\d)` empêchent de commencer ou de s'arrêter au
 * milieu d'une suite de chiffres plus longue — un numéro à onze chiffres doit
 * être rejeté, pas raboté.
 */
const TELEPHONE = /(?<!\d)(?:\+33|0033|0)\s*[1-9](?:[\s.\-]*\d){8}(?!\d)/;

/** Volontairement simple : on reconnaît une adresse, on ne la valide pas. */
const EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;

/**
 * LES MOTS QUI ARRÊTENT LE RECOLLAGE.
 *
 * Une adresse e-mail dictée arrive en morceaux ; on recolle le morceau qui
 * précède et celui qui suit, **jamais plus d'un de chaque côté**. Ces mots-ci
 * ferment la porte : ce sont ceux qu'il prononce juste avant de donner son
 * adresse, et les coller produirait « sonmailflorian@… ».
 */
const MOTS_QUI_ARRETENT = new Set([
  "mail", "email", "e", "courriel", "adresse", "son", "sa", "ses", "cest",
  "est", "le", "la", "les", "de", "du", "des", "et", "un", "une",
  "monsieur", "madame", "mr", "mme", "client", "cliente", "telephone",
  "numero", "tel", "portable", "chantier", "rue", "avenue", "ville",
  "pour", "avec", "dans", "il", "elle", "je", "vous", "nous", "on",
  "merci", "voila", "donc", "aussi", "ensuite",
]);

/** Ce qui peut faire partie d'une adresse : rien d'accentué, aucune apostrophe. */
const MORCEAU_COLLABLE = /^[A-Za-z0-9._%+-]+$/;

function sansAccent(mot: string): string {
  return mot.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * **UN NOM PROPRE N'EST JAMAIS RECOLLÉ.**
 *
 * Sans cette borne, « Ludovic florian point martin arobase gmail point com »
 * rendait `ludovicflorian.martin@gmail.com` : une adresse fausse et
 * vraisemblable, fabriquée par le correctif lui-même. C'est exactement ce
 * qu'on cherchait à empêcher.
 *
 * La majuscule tranche parce qu'une transcription écrit une adresse dictée en
 * minuscules — « florian », « laposte » — et met la capitale aux noms. Ce qui
 * se perd au pire : le premier morceau d'une adresse posée en début de phrase,
 * où il n'y a de toute façon rien à recoller à sa gauche.
 */
function collable(morceau: string | undefined, interdit: string | null): boolean {
  if (morceau === undefined) return false;
  // **Un numéro de téléphone n'est pas un morceau d'adresse.**
  //
  // Attrapé par la suite existante, pas par moi : « 06 52 88 97 51 martin
  // arobase exemple point fr » rendait `0652889751martin@exemple.fr`. Une fois
  // les chiffres dictés convertis, le numéro devient un morceau collé à
  // l'adresse — et il en a exactement la forme.
  //
  // On compare au numéro RÉELLEMENT reconnu, jamais à « ce qui ressemble à un
  // téléphone » : une adresse dont la partie gauche est un nombre existe, et
  // la refuser au jugé rendrait une adresse tronquée.
  if (interdit !== null && morceau === interdit) return false;
  if (/^[A-Z]/.test(morceau)) return false;
  return MORCEAU_COLLABLE.test(morceau) && !MOTS_QUI_ARRETENT.has(sansAccent(morceau));
}

/**
 * L'ADRESSE E-MAIL, RECOLLÉE — sa plainte du 7 septembre 2026.
 *
 * *« Souvent l'arobase, elle ne le comprend pas donc ne l'écrit pas ! C'est
 * très embêtant, l'utilisateur va vite se lasser si ça ne fonctionne pas
 * bien. »* Il avait dicté « … arobase laposte point net » ; la fiche portait
 * un domaine inventé.
 *
 * ─── CE QUE LA MESURE A MONTRÉ, ET C'EST PIRE QUE SA PLAINTE ───────────────
 *
 * Sur sa phrase exacte, la version d'avant rendait :
 *
 *     « florian point martin zéro neuf sept huit arobase laposte point net »
 *         →  huit@laposte.net
 *
 * **Le prénom était avalé en silence, et le résultat avait l'air juste.** Un
 * champ vide se voit et se corrige ; une adresse fausse et vraisemblable part
 * avec le devis. C'est exactement le défaut que le commentaire d'origine
 * disait avoir corrigé pour « tiret » — les chiffres dictés le recréaient.
 *
 * ─── LES TROIS CAUSES, et aucune n'est celle qu'il croyait ────────────────
 *
 * | ce qui manquait | ce que ça coûtait |
 * |---|---|
 * | les chiffres dictés n'étaient PAS convertis pour l'e-mail | « zéro neuf sept huit » restait en lettres, et coupait l'adresse en deux |
 * | une seule orthographe d'arobase | « arobas », « arrobase », « at » : rien du tout |
 * | aucun recollage | « arobase la poste point net » rendait `null` |
 *
 * La conversion des chiffres existait déjà — elle ne servait qu'au téléphone.
 * Deux lectures de la même phrase, dont une seule tenue à jour.
 *
 * ─── LA BORNE : UN MORCEAU DE CHAQUE CÔTÉ, JAMAIS DEUX ────────────────────
 *
 * Recoller sans limite ferait « Ludovicflorian.martin0978@… » dès qu'un nom
 * précède l'adresse. Un morceau à gauche, un à droite : c'est ce que produit
 * une transcription qui coupe, et ça ne peut pas s'emballer.
 *
 * **Et à droite, seulement si l'adresse n'est pas déjà complète.** Sans cela,
 * « florian@gmail.com merci » deviendrait `florian@gmail.commerci` — une
 * adresse fausse fabriquée par le correctif lui-même.
 */
/**
 * LA PONCTUATION DITE À VOIX HAUTE, RENDUE EN SIGNES.
 *
 * **L'arobase s'écrit de six façons dans une transcription**, et une seule
 * était reconnue. C'est la cause directe de sa plainte : quand le signe
 * manque, il n'y a plus d'adresse du tout, et le modèle en invente une.
 *
 * « at » en fait partie, et le risque est maîtrisé : un « @ » posé par erreur
 * ne produit une adresse que s'il est entouré d'un nom et d'un domaine avec
 * son point. Un mot isolé ne fabrique rien.
 *
 * **Ce texte ne sort jamais de cette fonction.** La transcription montrée au
 * patron et envoyée au modèle n'est pas touchée : on ne réécrit pas ce qu'il
 * a dit, on cherche une forme dedans.
 */
function epeler(texte: string): string {
  return texte
    .replace(/\s*(?:@|a\s*robases?|arobases?|arrobases?|arobas|arrobas|arrobes?|a\s+commercial|\bat\b)\s*/gi, "@")
    .replace(/\s*(?:tiret\s+du\s+bas|underscore|souligne|soulign[ée])\s*/gi, "_")
    .replace(/\s*(?:tiret|trait\s+d['’]union)\s*/gi, "-")
    // **Le point sans exiger d'espace des deux côtés.** « … laposte point net »
    // marchait ; « … point net. » en fin de phrase, non — et c'est la moitié
    // des dictées, parce qu'une phrase se termine.
    .replace(/\s*\bpoints?\b\s*/gi, ".");
}

function recollerEmail(epele: string, telephone: string | null): string | null {
  const morceaux = epeler(epele).split(/\s+/).filter(Boolean);
  const i = morceaux.findIndex((m) => m.includes("@"));
  if (i < 0) return null;

  let candidat = morceaux[i];
  // À droite d'abord : le domaine décide si l'adresse est déjà complète.
  if (!EMAIL.test(candidat) && collable(morceaux[i + 1], telephone)) candidat = candidat + morceaux[i + 1];
  if (collable(morceaux[i - 1], telephone)) candidat = morceaux[i - 1] + candidat;

  const trouve = candidat.match(EMAIL)?.[0];
  return trouve ? trouve.toLowerCase() : null;
}

/**
 * Extrait ce qui a une forme reconnaissable : téléphone et e-mail.
 *
 * Rend `null` pour ce qui n'y est pas — jamais une chaîne vide, qui se glisse
 * ensuite dans un champ et fait croire à une saisie.
 */
export function lireCoordonneesEvidentes(transcription: string): Pick<CoordonneesDictees, "telephone" | "email"> {
  const texte = transcription ?? "";

  // **Les nombres dits en toutes lettres sont d'abord rendus en chiffres.**
  //
  // Le patron, le 9 août 2026 : *« si je ne dis pas "numéro de téléphone
  // 0670…", il ne comprend pas que c'est un numéro. »* Le diagnostic a montré
  // autre chose que ce qu'il croyait, et c'est pire : la transcription écrit
  // parfois « zéro six douze trente-quatre… », et **aucune** recherche de
  // chiffres ne pouvait y voir un numéro. Son annonce ne servait qu'à faire
  // rattraper le modèle de langue ; sans elle, plus rien ne rattrapait.
  //
  // La réécriture ne sert QU'À la reconnaissance de forme : la transcription
  // montrée au patron et envoyée au modèle n'est pas touchée.
  const chiffre = chiffrerNombresDictes(texte);

  const brutTelephone = (chiffre.match(TELEPHONE) ?? texte.match(TELEPHONE))?.[0];
  const brutEmail = recollerEmail(chiffre, brutTelephone ?? null);

  return {
    telephone: brutTelephone ? normaliserTelephone(brutTelephone) : null,
    email: brutEmail ? brutEmail.toLowerCase() : null,
  };
}

/**
 * Un numéro sans séparateurs, avec l'indicatif international sous une seule
 * forme.
 *
 * Sans espaces : c'est sous cette forme qu'un lien `sms:` fonctionne, et
 * l'oublier a déjà ouvert une messagerie vide chez le patron (5 août 2026).
 * `0033` devient `+33` — deux écritures du même indicatif produiraient deux
 * fiches pour un seul client.
 */
export function normaliserTelephone(brut: string): string {
  const compact = brut.replace(/[\s.\-]/g, "");
  return compact.startsWith("0033") ? `+33${compact.slice(4)}` : compact;
}

/**
 * Nettoie ce qu'un modèle a rendu, sans jamais le compléter.
 *
 * Un modèle qui ne sait pas répond souvent quelque chose plutôt que rien :
 * « inconnu », « non précisé », une chaîne vide, un espace. Aucune de ces
 * réponses n'est une donnée, et toutes finiraient telles quelles dans la fiche
 * du client puis sur le devis.
 */
const NON_REPONSES = new Set([
  "",
  "inconnu",
  "inconnue",
  "non precise",
  "non precisee",
  "non renseigne",
  "non renseignee",
  "n/a",
  "na",
  "null",
  "aucun",
  "aucune",
  "pas precise",
]);

export function nettoyerChamp(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const propre = valeur.trim().replace(/\s+/g, " ");
  const temoin = propre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.!]/g, "");
  if (NON_REPONSES.has(temoin)) return null;
  return propre || null;
}

/**
 * LE CODE POSTAL, RECOLLÉ — sa capture du 7 septembre 2026.
 *
 * Il avait dicté « 27730 Villennes » ; la fiche portait « 27 730 Villene ».
 * Une transcription lit les nombres à voix haute et les écrit par groupes,
 * comme on écrit un millier — sauf qu'un code postal n'est pas un nombre : il
 * ne se sépare jamais.
 *
 * **Deux plus trois chiffres, et seulement ceux-là.** Un département fait deux
 * chiffres, un code postal cinq ; toute autre coupe n'est pas un code postal,
 * et la recoller inventerait un nombre. Le reste de l'adresse n'est pas
 * touché : « Dierud et Marguerite » pour « rue des marguerites » est une faute
 * d'oreille, et rien ici ne peut la rattraper — il la corrige à la main.
 */
export function recollerCodePostal(adresse: string | null): string | null {
  if (adresse === null) return null;
  return adresse.replace(/(?<!\d)(\d{2})\s(\d{3})(?!\s?\d)/g, "$1$2");
}

/** Ce que le modèle propose n'entre que si ça ressemble vraiment à une adresse. */
function emailDuModele(valeur: unknown): string | null {
  // **UNE ADRESSE E-MAIL NE COMPORTE AUCUN ESPACE, JAMAIS — sa règle du
  // 7 septembre 2026, 16 h 26.** Il avait dicté « arborea pro arobase outlook
  // point fr » ; le champ portait « arborea pro@outlook.fr ».
  //
  // On retire les espaces AVANT de juger la forme : sans cela ce garde-ci
  // refuserait l'adresse au lieu de la réparer, et le champ resterait vide
  // alors que tout était là.
  const propre = nettoyerChamp(valeur)?.toLowerCase().replace(/\s+/g, "") ?? null;
  if (propre === null) return null;
  return EMAIL.test(propre) ? propre : null;
}

/**
 * LA VIRGULE QUI COUPE UN CODE POSTAL DE SA VILLE.
 *
 * **Sa capture du 7 septembre 2026 :** *« Pour l'adresse il me l'a séparée
 * par des virgules, je ne comprends pas pourquoi ?????!!!!! »* —
 * « 12 rue Bérangère, 27 500, Macon ».
 *
 * Un modèle ponctue ce qu'il rend, même quand on lui demande de recopier.
 * **On ne retire qu'UNE virgule, celle qui suit le code postal** : celle qui
 * suit la rue est du français ordinaire — « 12 rue Bérangère, 27500 Mâcon »
 * s'écrit ainsi sur une enveloppe — et l'enlever ne réparerait rien.
 */
function virguleApresLeCodePostal(adresse: string | null): string | null {
  if (adresse === null) return null;
  return adresse.replace(/(?<!\d)(\d{5})\s*,\s*/g, "$1 ");
}

/**
 * Assemble le résultat final : ce que la forme donne, complété par ce que la
 * langue donne — jamais l'inverse.
 *
 * L'ordre compte. Un modèle relit la même phrase et peut renvoyer un numéro
 * approché (un chiffre avalé, un indicatif inventé) ; la reconnaissance de
 * forme, elle, recopie ce qui est écrit. **En cas de désaccord sur un numéro ou
 * une adresse e-mail, c'est le texte qui gagne.**
 */
export function assemblerCoordonnees(
  transcription: string,
  duModele: Partial<Record<keyof CoordonneesDictees, unknown>>
): CoordonneesDictees {
  const evidentes = lireCoordonneesEvidentes(transcription);
  // **La civilité se détache ICI, et non dans la consigne du modèle.**
  //
  // On continue de lui demander le nom « avec sa civilité si elle est dite »
  // (`coordonnees-service.ts`) : lui faire choisir entre deux valeurs qu'il ne
  // connaît pas aurait ajouté une façon de se tromper là où il n'y en avait
  // pas, et la règle aurait alors existé en deux endroits — la consigne et
  // `civilite.ts` — que rien ne tient d'accord (`CLAUDE.md` §3). Le mot se
  // reconnaît sans comprendre la phrase : c'est le même partage que le
  // téléphone et l'e-mail, décrit en tête de ce fichier.
  const detache = detacherCivilite(nettoyerChamp(duModele.nom));
  return {
    nom: detache.nom || null,
    civilite: detache.civilite,
    adresse: virguleApresLeCodePostal(recollerCodePostal(nettoyerChamp(duModele.adresse))),
    telephone:
      evidentes.telephone ??
      (nettoyerChamp(duModele.telephone) ? normaliserTelephone(nettoyerChamp(duModele.telephone)!) : null),
    // **UN E-MAIL SANS ARROBASE N'EST PAS UN E-MAIL — sa capture du
    // 7 septembre 2026, 16 h 20.**
    //
    // Il avait dicté `flo-speed@hotmail.fr` ; la fiche portait
    // **`flo-speed-hotmail.fr`**. Le modèle avait écrit un tiret à la place du
    // signe — parce que la reconnaissance de forme, elle, n'avait rien trouvé
    // et lui laissait la main.
    //
    // La cause est réparée plus haut (`recollerEmail`). Ce garde-ci est la
    // seconde ligne : **ce que le modèle invente ne passe que s'il a la forme
    // d'une adresse.** Sinon le champ reste vide, et un champ vide se voit —
    // alors qu'une adresse plausible part avec le devis (`CLAUDE.md` §4).
    email: evidentes.email ?? emailDuModele(duModele.email),
  };
}

/** Rien de reconnu : l'écran doit le dire plutôt que de laisser croire. */
export function coordonneesVides(c: CoordonneesDictees): boolean {
  // **La civilité compte**, même seule. « Monsieur » dicté sans nom ne remplit
  // aucune case, mais il allume une pastille : annoncer « rien compris »
  // pendant qu'un choix s'inscrit à l'écran serait le seul message que le
  // patron ne peut pas recouper.
  return !c.nom && !c.civilite && !c.telephone && !c.email && !c.adresse;
}

/**
 * Ce que la dictée a le droit de CHANGER sur la fiche déjà commencée.
 *
 * **Sortie de l'écran le 7 septembre 2026** (`CLAUDE.md` §3 : un écran
 * n'décide de rien). Elle y vivait en quatre `if` mêlés à quatre `setState` —
 * donc éprouvable seulement au navigateur, c'est-à-dire nulle part, puisque la
 * dictée demande une clé que cet environnement n'a pas. La règle qu'elle porte
 * est pourtant celle qui coûte cher si elle se trompe : elle décide de ce qui
 * s'efface.
 *
 * **La règle, la même pour les cinq champs : on ne remplit que le vide.**
 * Écraser une saisie parce qu'on a dicté ensuite serait la pire façon d'aider —
 * le patron aurait tapé le numéro, dicté l'adresse, et perdu le numéro sans
 * comprendre pourquoi.
 *
 * **La civilité obéit à la même règle et à rien d'autre.** Elle ne dépend pas
 * du nom : « Monsieur, 06 79 98 45 14 » ne laisse aucun nom à poser, mais il a
 * bien dit monsieur. Et une pastille qu'il a touchée lui appartient — la dictée
 * ne la reprend pas.
 *
 * Rend **uniquement ce qui change** : un champ absent du résultat est un champ
 * auquel on ne touche pas. Rendre l'état complet aurait obligé l'écran à
 * comparer, et une comparaison de plus est une occasion de plus d'écraser.
 */
export type FicheEnCours = {
  nom: string;
  civilite: Civilite | null;
  telephone: string;
  email: string;
  adresse: string;
};

export function champsARemplir(
  actuel: FicheEnCours,
  dictee: CoordonneesDictees
): Partial<FicheEnCours> {
  const aRemplir: Partial<FicheEnCours> = {};
  if (dictee.nom && !actuel.nom.trim()) aRemplir.nom = dictee.nom;
  if (dictee.civilite && actuel.civilite === null) aRemplir.civilite = dictee.civilite;
  if (dictee.telephone && !actuel.telephone.trim()) aRemplir.telephone = dictee.telephone;
  if (dictee.email && !actuel.email.trim()) aRemplir.email = dictee.email;
  if (dictee.adresse && !actuel.adresse.trim()) aRemplir.adresse = dictee.adresse;
  return aRemplir;
}
