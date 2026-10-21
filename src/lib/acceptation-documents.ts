/**
 * La phrase qui dit ce que vaut le bouton « Accepter » — planche du 17 octobre
 * 2026 (`appli/documents-legaux-un-geste.html`), sur le modèle d'Apple.
 *
 * **Une seule fonction pour l'écran et pour la preuve** : l'écran l'affiche,
 * l'action la recalcule depuis la liste du SERVEUR et l'enregistre avec chaque
 * acceptation. Deux rédactions finiraient par diverger, et la preuve dirait
 * une autre phrase que celle qu'il a lue (`CLAUDE.md` §3).
 */
export function phraseDAcceptation(nombreDeDocuments: number): string {
  const lesquels =
    nombreDeDocuments === 1
      ? "le document ci-dessous"
      : nombreDeDocuments === 2
        ? "les deux documents ci-dessous"
        : `les ${nombreDeDocuments} documents ci-dessous`;
  return `En touchant « Accepter », vous acceptez ${lesquels}.`;
}

/**
 * Ce qu'il a lu est-il exactement ce qu'on lui fait accepter ?
 *
 * Entre l'affichage et le geste, une version peut être publiée. Accepter alors
 * la liste du serveur engagerait un texte qu'il n'a jamais vu ; accepter celle
 * du navigateur laisserait le formulaire décider du périmètre. On refuse, et il
 * relit.
 */
export function memesDocuments(affiches: readonly string[], attendus: readonly string[]): boolean {
  if (affiches.length !== attendus.length) return false;
  const a = new Set(affiches);
  return a.size === attendus.length && attendus.every((id) => a.has(id));
}

/**
 * LE PRÉAVIS DE L'ARTICLE 15 — une nouvelle version est notifiée au moins
 * trente jours avant de s'imposer, et il peut résilier sans frais d'ici là.
 *
 * Avant le 18 octobre 2026, la version publiée bloquait l'application le jour
 * même : la promesse du contrat n'était tenue par rien. Pendant le préavis, la
 * version qu'il a acceptée reste celle qui vaut ; le jour venu, la nouvelle
 * est exigée. Un nouvel inscrit, lui, n'a rien accepté avant : il accepte la
 * dernière tout de suite.
 *
 * `enVigueurLe` absent : la version s'impose dès sa publication, comme celles
 * publiées avant cette règle.
 */
export function exigeeMaintenant(enVigueurLe: Date | null, aAccepteUnePrecedente: boolean, maintenant: Date): boolean {
  if (!aAccepteUnePrecedente || !enVigueurLe) return true;
  return maintenant.getTime() >= enVigueurLe.getTime();
}

