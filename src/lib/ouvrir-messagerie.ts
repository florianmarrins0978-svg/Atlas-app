/**
 * Ouvrir la messagerie du patron sur une adresse `sms:` ou `mailto:`.
 *
 * **Pourquoi un lien plutôt que `location.assign`.** Les deux marchent chez
 * lui ; un seul est observable. Un lien touché passe par le DOM, donc un
 * contrôle peut lire ce que l'application a réellement tenté d'ouvrir —
 * destinataire compris. `location.assign`, lui, ne laisse aucune trace : le
 * défaut d'hier — un message ouvert sans destinataire — ne se voyait que dans
 * la messagerie du patron, c'est-à-dire trop tard.
 *
 * **Et il se stube mal.** Redéfinir `window.location.assign` échoue selon le
 * contexte (« Cannot redefine property: assign ») : le contrôle tombe alors sur
 * son propre montage, pas sur le produit. Un lien, lui, s'intercepte partout —
 * c'est ce que fait le lanceur des suites (`scripts/e2e-browser.ts`).
 *
 * **Le nœud est retiré aussitôt** : laissé dans la page, il s'accumulerait à
 * chaque envoi, et un contrôle de mise en page finirait par mesurer des liens
 * invisibles que personne n'a voulus.
 */
export function ouvrirMessagerie(adresse: string): void {
  if (typeof document === "undefined") return;
  const lien = document.createElement("a");
  lien.href = adresse;
  lien.setAttribute("data-transmission-directe", "");
  // Hors de l'écran plutôt que `display:none` : un nœud non rendu n'est pas
  // toujours cliquable, et le geste doit rester un vrai geste.
  lien.style.position = "absolute";
  lien.style.left = "-9999px";
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
}
