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
export type CoordonneesDictees = {
  nom: string | null;
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
const TELEPHONE = /(?:\+33|0)\s*[1-9](?:[\s.\-]*\d){8}/;

/** Volontairement simple : on reconnaît une adresse, on ne la valide pas. */
const EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;

/**
 * Extrait ce qui a une forme reconnaissable : téléphone et e-mail.
 *
 * Rend `null` pour ce qui n'y est pas — jamais une chaîne vide, qui se glisse
 * ensuite dans un champ et fait croire à une saisie.
 */
export function lireCoordonneesEvidentes(transcription: string): Pick<CoordonneesDictees, "telephone" | "email"> {
  const texte = transcription ?? "";

  const brutTelephone = texte.match(TELEPHONE)?.[0];
  // Une dictée épelle souvent l'adresse à voix haute (« point fr ») : le
  // service de transcription rend alors des espaces autour du @ ou du point.
  const brutEmail = texte.replace(/\s*(@|arobase)\s*/gi, "@").replace(/\s+point\s+/gi, ".").match(EMAIL)?.[0];

  return {
    telephone: brutTelephone ? brutTelephone.replace(/[\s.\-]/g, "") : null,
    email: brutEmail ? brutEmail.toLowerCase() : null,
  };
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
  return {
    nom: nettoyerChamp(duModele.nom),
    adresse: nettoyerChamp(duModele.adresse),
    telephone: evidentes.telephone ?? nettoyerChamp(duModele.telephone)?.replace(/[\s.\-]/g, "") ?? null,
    email: evidentes.email ?? nettoyerChamp(duModele.email)?.toLowerCase() ?? null,
  };
}

/** Rien de reconnu : l'écran doit le dire plutôt que de laisser croire. */
export function coordonneesVides(c: CoordonneesDictees): boolean {
  return !c.nom && !c.telephone && !c.email && !c.adresse;
}
