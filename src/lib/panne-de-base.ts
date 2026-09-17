/**
 * CE QUE LA BASE A REFUSÉ, DIT EN FRANÇAIS — et le geste qui répare.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa plainte du 13 septembre 2026 : « je peux toujours pas créer de compte ! »**
 * — avec, en capture, l'écran « Une erreur · Cette page n'a pas pu s'afficher ·
 * Référence : 3285538552 ».
 *
 * **Reproduit ici, et c'est la seule chose qui a fait avancer le diagnostic.**
 * Le parcours entier joué dans un navigateur, sur une base à laquelle il
 * manquait la migration 0089, rend **exactement** cet écran : l'insertion de la
 * ligne d'essai lève, l'action meurt avec, et Next.js jette le patron sur la
 * frontière d'erreur de toute l'application. En version bâtie la cause n'est
 * même pas affichée — il ne reste qu'un numéro qui ne mène à rien, ni pour lui,
 * ni pour la session qui cherchera demain.
 *
 * C'est le défaut muet qu'`AGENTS.md` interdit de laisser vivre : *« devant un
 * défaut muet, la première livraison n'est pas un correctif, c'est de rendre le
 * défaut bavard »*. Ce module est cette moitié-là.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI LE CODE D'ERREUR, ET PAS LE MESSAGE.** PostgreSQL numérote ses
 * refus (`SQLSTATE`), et ces numéros ne changent ni de langue ni de version. Le
 * message, lui, est traduit et reformulé — le lire reviendrait à deviner. Le
 * numéro dit sans ambiguïté si la base **n'a pas** ce que le code demande (une
 * table, une colonne, un droit, une valeur qu'une contrainte n'accepte pas
 * encore) : dans tous ces cas, le code est en avance sur la base, et aucune
 * quantité de « Réessayer » n'y changera rien.
 *
 * **Fonction pure, dans `src/lib/`** : elle s'éprouve sans base et sans
 * navigateur, et les deux écrans qui s'en servent n'ont rien à décider
 * (`CLAUDE.md` §3 et §4 sexies).
 */

/**
 * Les refus qui veulent dire « la base n'est pas celle que ce code attend ».
 *
 * Ce ne sont pas des pannes passagères : elles se reproduiront à l'identique
 * tant que les migrations n'auront pas été appliquées.
 */
const CODES_DECALAGE = new Set([
  "42P01", // table inconnue — une migration qui la crée n'est pas passée
  "42703", // colonne inconnue — idem
  "42883", // fonction inconnue
  "3F000", // schéma inconnu
  "42501", // droit refusé — les GRANT d'une migration ne sont pas passés
  "23514", // une contrainte CHECK refuse une valeur que le code croit permise
  "23502", // NOT NULL sur une colonne que le code ne remplit pas encore
  "22P02", // type incompatible — la colonne n'a pas la forme attendue
]);

export type CauseDeLaPanne = "decalage-code-base" | "inconnue";

/**
 * Le code `SQLSTATE` d'une erreur, s'il y en a un.
 *
 * Le pilote `pg` le pose sur `error.code`, et Drizzle enveloppe l'erreur en
 * gardant l'originale dans `cause` — c'est la raison de la descente : sans
 * elle, tout refus de la base se lirait « inconnue » et le message juste ne
 * sortirait jamais.
 */
export function codeSqlDe(erreur: unknown, profondeurMax = 5): string | null {
  let courante: unknown = erreur;
  for (let saut = 0; saut <= profondeurMax; saut += 1) {
    if (typeof courante !== "object" || courante === null) return null;
    const code = (courante as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    courante = (courante as { cause?: unknown }).cause;
  }
  return null;
}

/** D'où vient ce refus : d'une base en retard, ou d'autre chose ? */
export function causeDeLaPanne(erreur: unknown): CauseDeLaPanne {
  const code = codeSqlDe(erreur);
  return code !== null && CODES_DECALAGE.has(code) ? "decalage-code-base" : "inconnue";
}

/**
 * Ce qui s'écrit à l'écran, et **rien de plus**.
 *
 * **Le geste dépend de l'endroit d'où l'on parle**, et c'est tout l'intérêt :
 * sur son banc d'essai, la base se remet à jour en rallumant l'espace — un
 * geste qui ne touche à aucune de ses données (`CLAUDE.md` §4 septies : on ne
 * lui propose jamais de reconstruire, de supprimer ni d'amorcer). Ailleurs,
 * personne ne peut rien faire depuis un écran : on dit ce qui se passe, sans
 * envoyer chercher un remède qui n'existe pas de ce côté-là.
 *
 * **LE CODE DE LA BASE PARAÎT SUR LE BANC, ET NULLE PART AILLEURS.** Ce n'est
 * pas le numéro de l'écran d'erreur, qui ne menait à rien : celui-là NOMME ce
 * que la base a refusé, et il tient sur la capture qu'il nous envoie. Le
 * journal, lui, est sur sa machine et personne n'ira l'y lire — c'est
 * exactement ce qui a coûté la soirée du 13 septembre. Un banc d'essai est là
 * pour éprouver ; un client, lui, n'a que faire d'un `23514`.
 *
 * **`echec` DIT CE QUI N'A PAS ABOUTI, et il n'a pas de valeur par défaut —
 * 17 septembre 2026.** Cette phrase est née pour l'écran « Créer mon compte »
 * et portait ses mots en dur ; branchée telle quelle sur les règlements, elle
 * annonçait au patron que son COMPTE n'avait pas pu être créé alors qu'il
 * notait un paiement. Un défaut par défaut se recopie sans qu'on le voie : le
 * rendre obligatoire oblige chaque écran à dire de quoi il parle.
 */
export function phraseDeLaPanne(
  cause: CauseDeLaPanne,
  surLeBanc: boolean,
  codeSql: string | null,
  /** Sans point final ni majuscule de suite : « Ce règlement n’a pas pu être enregistré ». */
  echec: string
): string {
  const repere = surLeBanc && codeSql ? ` (base : ${codeSql})` : "";
  if (cause === "decalage-code-base") {
    return surLeBanc
      ? `Votre espace n’est pas à jour avec sa base. Rallumez-le depuis github.com/codespaces.${repere}`
      : `${echec} : le service est en cours de mise à jour.`;
  }
  return `${echec}. Réessayez dans un instant.${repere}`;
}

/**
 * LE MESSAGE DE LA BASE, **SANS LES VALEURS QU'ON LUI A ENVOYÉES.**
 *
 * Drizzle écrit « Failed query: insert into … » puis, à la ligne, « params: »
 * suivi de **tout ce qui partait en base** : sur la création de compte, cela
 * veut dire l'adresse, le SIRET, l'IBAN et le condensat du mot de passe. Le
 * journal part chez Sentry quand un DSN est posé, et la rédaction de
 * `logger.ts` travaille sur les CLÉS, pas à l'intérieur d'une chaîne : elle ne
 * les verrait pas passer.
 *
 * On garde donc la requête — qui dit ce qui a échoué, et ne contient aucune
 * donnée — et l'on coupe à la ligne des valeurs. La longueur est bornée : un
 * journal n'est utile que s'il se lit.
 */
export function messageSansLesValeurs(message: string, longueurMax = 300): string {
  const coupe = message.split(/\n\s*params\s*:/i)[0].trim();
  return coupe.length > longueurMax ? `${coupe.slice(0, longueurMax)}…` : coupe;
}
