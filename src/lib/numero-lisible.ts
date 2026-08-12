// Un numéro de téléphone écrit pour être RELU, pas pour être composé.
//
// **Pourquoi cette fonction existe.** L'écran du devis annonçait « Au
// 0679984514 — c'est vous qui l'envoyez. » Dix chiffres collés ne se vérifient
// pas d'un coup d'œil : pour savoir si c'est le bon client, il faut les lire un
// à un. Or c'est précisément à cet endroit, juste avant d'ouvrir sa messagerie,
// que le patron a une dernière chance de voir qu'il s'adresse à la mauvaise
// personne — et le 12 août 2026, un devis n'est pas parti à cause d'une faute
// dans une adresse qu'il n'avait pas relue.
//
// Fonction pure, dans `src/lib/` : elle sert l'affichage, et rien qu'à
// l'affichage. **Le lien `sms:` continue de porter le numéro brut** — c'est
// `lienTransmission` qui retire les espaces (`src/lib/message-client.ts`), et
// mêler les deux ferait qu'un jour l'un suivrait l'autre par erreur.

/**
 * Espace un numéro français par paires : `0679984514` → `06 79 98 45 14`.
 *
 * **Rend la valeur telle quelle dès qu'il y a le moindre doute**, et ce n'est
 * pas de la prudence de façade : un numéro étranger, un poste à quatre
 * chiffres, une saisie en cours ne se découpent pas par deux. Les grouper de
 * force produirait un numéro d'apparence normale et pourtant faux — le pire
 * résultat possible sur une ligne dont le seul rôle est la vérification.
 *
 * Ne touche donc qu'à ce qu'elle reconnaît : dix chiffres commençant par zéro,
 * une fois les séparateurs d'usage retirés (« 06.79.98.45.14 » compte).
 */
export function numeroLisible(valeur: string): string {
  const brut = valeur.trim();
  if (!brut) return brut;

  const chiffres = brut.replace(/[\s.()\- ]/g, "");
  if (!/^0\d{9}$/.test(chiffres)) return brut;

  return chiffres.replace(/(\d{2})(?=\d)/g, "$1 ");
}

/**
 * Le destinataire tel qu'on l'écrit à l'écran, selon le canal.
 *
 * Une adresse e-mail ne se groupe pas — et l'y soumettre au hasard d'un
 * refactor serait exactement le genre de bêtise qu'un aiguillage explicite
 * empêche.
 */
export function destinataireLisible(canal: "sms" | "email", destinataire: string): string {
  return canal === "sms" ? numeroLisible(destinataire) : destinataire.trim();
}
