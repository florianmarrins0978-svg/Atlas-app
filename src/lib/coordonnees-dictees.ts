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
  // Une dictée épelle l'adresse à voix haute, et la transcription écrit les
  // signes de ponctuation en toutes lettres, avec des espaces autour.
  //
  // **Le tiret et le souligné manquaient, et leur absence coûtait cher.**
  // « florian tiret martins arobase gmail point com » rendait
  // `martins@gmail.com` : le prénom disparaissait en silence, et l'adresse
  // obtenue avait l'air juste. Un champ vide se voit et se corrige ; une
  // adresse fausse et vraisemblable part avec le devis (mesuré le 9 août 2026).
  const epele = texte
    .replace(/\s*(?:@|arobase)\s*/gi, "@")
    .replace(/\s*(?:tiret\s+du\s+bas|underscore|souligne|soulign[ée])\s*/gi, "_")
    .replace(/\s*(?:tiret|trait\s+d['’]union)\s*/gi, "-")
    .replace(/\s+point\s+/gi, ".");
  const brutEmail = epele.match(EMAIL)?.[0];

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
    adresse: nettoyerChamp(duModele.adresse),
    telephone:
      evidentes.telephone ??
      (nettoyerChamp(duModele.telephone) ? normaliserTelephone(nettoyerChamp(duModele.telephone)!) : null),
    email: evidentes.email ?? nettoyerChamp(duModele.email)?.toLowerCase() ?? null,
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
